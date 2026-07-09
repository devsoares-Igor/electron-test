import { ipcRenderer } from "electron";

// contextIsolation is intentionally disabled for this WebContentsView.
// The getDisplayMedia override below must run in the same JavaScript context as
// the renderer so that calls to navigator.mediaDevices.getDisplayMedia() are
// intercepted before any library in the page can reach the native API.
// This view loads only controlled, trusted URLs (the Realms web application).
// See: src/main/window.ts — WebContentsView webPreferences

declare const __ELECTRON_SOURCE_HOST__: string;

window.electronAPI = {
    platform: process.platform,
    isElectron: true,
    retry: () => ipcRenderer.send("retry-load"),
    listSystemAudioDevices: () => ipcRenderer.invoke("list-system-audio-devices"),
};

// Packaged builds: write the realm hostname to localStorage so the web app can
// identify the target realm without a query parameter in the URL.
if (window.location.protocol === "file:" && typeof __ELECTRON_SOURCE_HOST__ !== "undefined") {
    try {
        localStorage.setItem("devRealmHostname", __ELECTRON_SOURCE_HOST__);
    } catch {
        // Blocked by browser storage policy — non-fatal.
    }
}

// Warm-up: faz uma chamada getUserMedia com AEC/AGC desligado logo que o DOM
// estiver pronto. Isso força o Chromium a usar o pipeline WASAPI raw e incluir
// dispositivos virtuais (vMix, VB-Cable, etc.) na enumeração de dispositivos.
// Sem isso, o Chrome filtra esses dispositivos por incompatibilidade com AEC.
window.addEventListener("DOMContentLoaded", () => {
    navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then((stream) => stream.getTracks().forEach((t) => t.stop()))
        .catch(() => { /* não fatal */ });
}, { once: true });

// Unlock AudioContext on the first user gesture. Some contexts start in the
// "suspended" state even with --autoplay-policy=no-user-gesture-required.
window.addEventListener(
    "click",
    function unlockAudio() {
        const ctx = (window as Window & { _audioContext?: AudioContext })._audioContext;
        if (ctx?.state === "suspended") {
            ctx.resume().catch(() => { });
        }
        try {
            const ac = new AudioContext();
            const buf = ac.createBuffer(1, 1, 22050);
            const src = ac.createBufferSource();
            src.buffer = buf;
            src.connect(ac.destination);
            src.start(0);
            ac.close().catch(() => { });
        } catch {
            // AudioContext unavailable — non-fatal.
        }
        window.removeEventListener("click", unlockAudio);
    },
    { once: true },
);

// Prevent nosleep.js from using a hidden video element as a Wake Lock fallback.
const mockWakeLockSentinel = {
    type: "screen" as WakeLockType,
    released: false,
    onrelease: null as null,
    release: (): Promise<void> => Promise.resolve(),
    addEventListener: (): void => { },
    removeEventListener: (): void => { },
    dispatchEvent: (): boolean => true,
};

Object.defineProperty(navigator, "wakeLock", {
    value: { request: (_type: WakeLockType) => Promise.resolve(mockWakeLockSentinel) },
    writable: false,
    configurable: true,
});

// Capture getUserMedia before any library (e.g. Janus) can replace it.
const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

// ─── DirectShow virtual device bridge ────────────────────────────────────────
// Injects DirectShow-only devices (vMix, etc.) into enumerateDevices() and
// creates a synthetic MediaStream via AudioWorklet when those devices are selected.

const DS_PREFIX = "dshow:";

// Cache system devices so PowerShell isn't called on every enumerateDevices()
type SysDevice = { name: string; direction: string; status: string };
let _sysCache: SysDevice[] = [];
let _sysCacheTs = 0;
async function getSysDevices(): Promise<SysDevice[]> {
    if (Date.now() - _sysCacheTs < 10_000) return _sysCache;
    try {
        _sysCache = (await ipcRenderer.invoke("list-system-audio-devices")) as SysDevice[];
        _sysCacheTs = Date.now();
    } catch { /* non-fatal */ }
    return _sysCache;
}

// Prefetch on page load (warm cache before the web app calls enumerateDevices)
getSysDevices().catch(() => { /* ignore */ });

// Override enumerateDevices to inject DirectShow-only input devices
const _origEnumDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
    value: async (): Promise<MediaDeviceInfo[]> => {
        const [native, sys] = await Promise.all([_origEnumDevices(), getSysDevices()]);
        const nativeLabels = new Set(native.map(d => d.label.toLowerCase().trim()).filter(Boolean));
        const synth = sys
            .filter(d => d.name && d.direction !== "output" && !nativeLabels.has(d.name.toLowerCase().trim()))
            .map(d => ({
                deviceId: `${DS_PREFIX}${encodeURIComponent(d.name)}`,
                groupId: "dshow-virtual",
                kind: "audioinput" as MediaDeviceKind,
                label: d.name,
                toJSON: () => ({}),
            } as MediaDeviceInfo));
        return [...native, ...synth];
    },
    writable: true, configurable: true,
});

// AudioContext persistente + GainNode como mix bus.
// Todas as AudioBufferSourceNodes conectam ao mixBus.
// Cada getUserMedia cria um novo MediaStreamDestinationNode conectado ao mixBus.
// Assim, múltiplas chamadas getUserMedia para o MESMO device não reiniciam o FFmpeg —
// apenas adicionam mais um destino ao mesmo pipeline.
let _captureCtx: AudioContext | null = null;
let _mixBus: GainNode | null = null;
let _captureChunkListener: ((e: Electron.IpcRendererEvent, buf: Buffer) => void) | null = null;
let _currentDevice: string | null = null;
let _activeDestCount = 0;
let _nextStart = 0;
let _audioReady: Promise<void> | null = null;
let _keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
// Timer de switch: para o FFmpeg quando usuário troca de vMix para outro device
let _switchTimer: ReturnType<typeof setTimeout> | null = null;

function stopVMixCapture(): void {
    if (_keepAliveTimer) { clearTimeout(_keepAliveTimer); _keepAliveTimer = null; }
    if (_switchTimer) { clearTimeout(_switchTimer); _switchTimer = null; }
    if (_captureChunkListener) {
        ipcRenderer.removeListener("dshow-chunk", _captureChunkListener);
        _captureChunkListener = null;
    }
    ipcRenderer.invoke("dshow-stop").catch(() => { /* ignore */ });
    _currentDevice = null; _audioReady = null; _activeDestCount = 0;
}

function getOrCreateCaptureCtx(): { ctx: AudioContext; mix: GainNode } {
    if (!_captureCtx || _captureCtx.state === "closed") {
        _captureCtx = new AudioContext({ sampleRate: 48000 });
        _mixBus = _captureCtx.createGain();
        _mixBus.gain.value = 1;
        _nextStart = 0;
    }
    return { ctx: _captureCtx, mix: _mixBus! };
}

async function createDShowStream(deviceName: string): Promise<MediaStream> {
    // Cancela qualquer stop pendente (keep-alive ou switch)
    if (_keepAliveTimer) { clearTimeout(_keepAliveTimer); _keepAliveTimer = null; }
    if (_switchTimer) { clearTimeout(_switchTimer); _switchTimer = null; }

    const { ctx, mix } = getOrCreateCaptureCtx();
    if (ctx.state !== "running") await ctx.resume();

    // Se o mesmo device já está sendo capturado (ou iniciando), aguarda o áudio
    // confirmar ANTES de retornar o stream — evita que o Janus receba stream silencioso.
    if (_currentDevice === deviceName && _captureChunkListener) {
        if (_audioReady) await _audioReady;

        const destination = ctx.createMediaStreamDestination();
        mix.connect(destination);
        _activeDestCount++;
        destination.stream.getAudioTracks().forEach(t => t.addEventListener("ended", () => onDestEnded(destination, mix)));
        return destination.stream;
    }

    // Device diferente ou FFmpeg não está rodando — reiniciar captura
    if (_captureChunkListener) {
        ipcRenderer.removeListener("dshow-chunk", _captureChunkListener);
        _captureChunkListener = null;
        await ipcRenderer.invoke("dshow-stop").catch(() => { /* ignore */ });
        await new Promise<void>(r => setTimeout(r, 350));
    }

    _currentDevice = deviceName;
    _nextStart = 0;

    // Promise que resolve no primeiro chunk de áudio
    let resolveAudioReady!: () => void;
    _audioReady = new Promise<void>(r => { resolveAudioReady = r; });

    const AHEAD = 0.12;
    let firstChunk = true;

    const onChunk = (_e: Electron.IpcRendererEvent, buf: Buffer) => {
        if (ctx.state === "closed") return;
        // Notifica todos os callers que esperavam pelo áudio
        if (firstChunk) { firstChunk = false; resolveAudioReady(); }
        const float32 = new Float32Array(
            buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
        );
        const audioBuffer = ctx.createBuffer(1, float32.length, 48000);
        audioBuffer.copyToChannel(float32, 0);
        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(mix);
        if (_nextStart < ctx.currentTime) { _nextStart = ctx.currentTime + AHEAD; }
        source.start(_nextStart);
        _nextStart += audioBuffer.duration;
    };

    _captureChunkListener = onChunk;
    ipcRenderer.on("dshow-chunk", onChunk);

    const started = await ipcRenderer.invoke("dshow-start", deviceName) as boolean;
    if (!started) {
        ipcRenderer.removeListener("dshow-chunk", onChunk);
        _captureChunkListener = null; _currentDevice = null; _audioReady = null;
        throw new DOMException("FFmpeg não encontrado. Reinstale o app.", "NotReadableError");
    }

    const gotAudio = await new Promise<boolean>((resolve) => {
        const t = setTimeout(() => resolve(false), 4_000);
        ipcRenderer.once("dshow-chunk", () => { clearTimeout(t); resolve(true); });
        ipcRenderer.once("dshow-error", () => { clearTimeout(t); resolve(false); });
    });

    if (!gotAudio) {
        ipcRenderer.removeListener("dshow-chunk", onChunk);
        _captureChunkListener = null; _currentDevice = null; _audioReady = null;
        await ipcRenderer.invoke("dshow-stop").catch(() => { /* ignore */ });
        throw new DOMException(`"${deviceName}" não produziu áudio — verifique se o vMix está ativo.`, "NotReadableError");
    }

    const onFfmpegEnd = () => {
        if (_captureChunkListener === onChunk) {
            ipcRenderer.removeListener("dshow-chunk", onChunk);
            _captureChunkListener = null; _currentDevice = null; _audioReady = null;
        }
    };
    ipcRenderer.once("dshow-ended", onFfmpegEnd);
    ipcRenderer.once("dshow-error", onFfmpegEnd);

    // Cria a primeira destination para este caller
    const destination = ctx.createMediaStreamDestination();
    mix.connect(destination);
    _activeDestCount++;
    destination.stream.getAudioTracks().forEach(t => t.addEventListener("ended", () => onDestEnded(destination, mix)));

    return destination.stream;
}

function onDestEnded(destination: MediaStreamAudioDestinationNode, mix: GainNode): void {
    mix.disconnect(destination);
    _activeDestCount--;
    if (_activeDestCount <= 0) {
        _activeDestCount = 0;
        // Keep-alive: mantém FFmpeg vivo por 5s para absorver o gap preview → join
        if (_keepAliveTimer) clearTimeout(_keepAliveTimer);
        _keepAliveTimer = setTimeout(() => {
            if (_captureChunkListener) {
                ipcRenderer.removeListener("dshow-chunk", _captureChunkListener);
                _captureChunkListener = null;
            }
            ipcRenderer.invoke("dshow-stop").catch(() => { /* ignore */ });
            _currentDevice = null; _audioReady = null; _keepAliveTimer = null;
        }, 5_000);
    }
}

// Helper: extrai o deviceId independente do formato (string | {exact} | {ideal} | array)
function extractDeviceId(raw: MediaTrackConstraints["deviceId"]): string {
    if (typeof raw === "string") return raw;
    if (Array.isArray(raw)) return String(raw[0] ?? "");
    if (raw && typeof raw === "object") {
        const c = raw as { exact?: unknown; ideal?: unknown };
        const val = c.exact ?? c.ideal;
        if (typeof val === "string") return val;
        if (Array.isArray(val)) return String(val[0] ?? "");
    }
    return "";
}

// Override getUserMedia to intercept DirectShow device requests
Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    value: async (constraints?: MediaStreamConstraints): Promise<MediaStream> => {
        const audio = constraints?.audio;

        if (audio && typeof audio === "object") {
            const deviceId = extractDeviceId((audio as MediaTrackConstraints).deviceId);

            if (deviceId.startsWith(DS_PREFIX)) {
                // Cancela qualquer switch timer — usuário voltou para vMix
                if (_switchTimer) { clearTimeout(_switchTimer); _switchTimer = null; }

                const name = decodeURIComponent(deviceId.slice(DS_PREFIX.length));
                const audioStream = await createDShowStream(name);

                if (constraints?.video) {
                    try {
                        const videoStream = await originalGetUserMedia({ video: constraints.video });
                        return new MediaStream([
                            ...audioStream.getAudioTracks(),
                            ...videoStream.getVideoTracks(),
                        ]);
                    } catch {
                        return audioStream;
                    }
                }

                return audioStream;
            }

            // Device não-vMix com deviceId explícito: agenda parada do FFmpeg
            // (usuário trocou para microfone normal)
            if (deviceId && _captureChunkListener) {
                if (_switchTimer) clearTimeout(_switchTimer);
                _switchTimer = setTimeout(stopVMixCapture, 2_000);
            }
        }

        return originalGetUserMedia(constraints);
    },
    writable: true, configurable: true,
});

// Override getDisplayMedia to open the custom screen-picker window via IPC.
Object.defineProperty(navigator.mediaDevices, "getDisplayMedia", {
    value: async function (_constraints?: MediaStreamConstraints): Promise<MediaStream> {
        let result: { id: string; audio: boolean } | null;
        try {
            result = (await ipcRenderer.invoke("show-source-picker")) as typeof result;
        } catch {
            throw new DOMException("Captura de tela falhou", "NotAllowedError");
        }
        if (!result) {
            throw new DOMException("Compartilhamento cancelado", "NotAllowedError");
        }
        return originalGetUserMedia({
            audio: result.audio
                ? ({
                    mandatory: { chromeMediaSource: "desktop" },
                } as unknown as MediaTrackConstraints)
                : false,
            video: {
                mandatory: {
                    chromeMediaSource: "desktop",
                    chromeMediaSourceId: result.id,
                },
            } as unknown as MediaTrackConstraints,
        });
    },
    writable: true,
    configurable: true,
});

// Progress bar shown during active fetch/XHR requests.
// Injected by Electron so the web app does not need its own loading indicator.
const PROGRESS_BAR_ID = "__electron-progress__";
const PROGRESS_STYLE_ID = "__electron-progress-style__";

const PROGRESS_CSS = `
#${PROGRESS_BAR_ID} {
    position: fixed; top: 0; left: 0; right: 0;
    height: 4px; overflow: hidden;
    background: rgba(88,101,242,.24);
    z-index: 2147483647; pointer-events: none;
}
#${PROGRESS_BAR_ID} > span {
    position: absolute; top: 0; bottom: 0;
    background: #5865F2; width: auto;
}
#${PROGRESS_BAR_ID} > span:first-child {
    animation: __ep1__ 2.1s cubic-bezier(.65,.815,.735,.395) infinite;
}
#${PROGRESS_BAR_ID} > span:last-child {
    animation: __ep2__ 2.1s cubic-bezier(.165,.84,.44,1) 1.15s infinite;
}
@keyframes __ep1__ {
    0%   { left:-35%;  right:100%; }
    60%  { left:100%;  right:-90%; }
    100% { left:100%;  right:-90%; }
}
@keyframes __ep2__ {
    0%   { left:-200%; right:100%; }
    60%  { left:107%;  right:-8%;  }
    100% { left:107%;  right:-8%;  }
}
`.trim();

let activeRequestCount = 0;

function showProgressBar(): void {
    if (document.getElementById(PROGRESS_BAR_ID)) return;
    if (!document.getElementById(PROGRESS_STYLE_ID)) {
        const style = document.createElement("style");
        style.id = PROGRESS_STYLE_ID;
        style.textContent = PROGRESS_CSS;
        document.head.appendChild(style);
    }
    const bar = document.createElement("div");
    bar.id = PROGRESS_BAR_ID;
    bar.innerHTML = "<span></span><span></span>";
    document.body.appendChild(bar);
}

function hideProgressBar(): void {
    document.getElementById(PROGRESS_BAR_ID)?.remove();
}

window.addEventListener("DOMContentLoaded", () => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        activeRequestCount++;
        showProgressBar();
        return originalFetch(input, init).finally(() => {
            if (--activeRequestCount <= 0) {
                activeRequestCount = 0;
                hideProgressBar();
            }
        });
    };

    const originalXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function (
        body?: Document | XMLHttpRequestBodyInit | null,
    ): void {
        activeRequestCount++;
        showProgressBar();
        this.addEventListener("loadend", () => {
            if (--activeRequestCount <= 0) {
                activeRequestCount = 0;
                hideProgressBar();
            }
        });
        originalXhrSend.call(this, body);
    };
});
