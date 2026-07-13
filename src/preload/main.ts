import { ipcRenderer } from "electron";
import { createDShowStream, DSHOW_DEVICE_PREFIX, scheduleCaptureTeardown, stopCaptureImmediate } from "./dshow-stream";

declare const __ELECTRON_SOURCE_HOST__: string;

// ─── Injetar sessão de auto-login ANTES do React inicializar ─────────────────
try {
    // Limpar sessão se foi solicitado (ex: "Entrar com outra conta")
    const shouldClear = ipcRenderer.sendSync("session:should-clear") as boolean;
    if (shouldClear) {
        localStorage.removeItem("Data");
        localStorage.removeItem("RealmConfig");
        localStorage.removeItem("Realm");
        console.log("[preload] session cleared for fresh login");
    }

    // Injetar sessão de auto-login se existir
    const injection = ipcRenderer.sendSync("session:get-injection") as string | null;
    if (injection) {
        const { realm, realmConfig, data } = JSON.parse(injection) as {
            realm: string; realmConfig: string; data: string;
        };
        localStorage.setItem("Realm", realm);
        localStorage.setItem("RealmConfig", realmConfig);
        localStorage.setItem("Data", data);
        console.log("[preload] session injected for realm:", realm);
    }
} catch { /* non-fatal */ }
// ─────────────────────────────────────────────────────────────────────────────

window.electronAPI = {
    platform: process.platform,
    isElectron: true,
    retry: () => ipcRenderer.send("retry-load"),
    listSystemAudioDevices: () => ipcRenderer.invoke("list-system-audio-devices"),
};

window.accountsAPI = {
    list: () => ipcRenderer.invoke("accounts:list"),
    count: () => ipcRenderer.invoke("accounts:count"),
    remove: (id: string) => ipcRenderer.invoke("accounts:remove", id),
    removeAll: () => ipcRenderer.invoke("accounts:remove-all"),
    login: (id: string) => ipcRenderer.invoke("accounts:login", id),
    loadApp: () => ipcRenderer.send("accounts:load-app"),
    loadFresh: () => ipcRenderer.send("accounts:load-app-fresh"),
    savePending: () => ipcRenderer.invoke("accounts:save-pending"),
    skipSave: () => ipcRenderer.invoke("accounts:skip-save"),
    getPending: () => ipcRenderer.invoke("accounts:get-pending"),
};

if (window.location.protocol === "file:" && typeof __ELECTRON_SOURCE_HOST__ !== "undefined") {
    try {
        localStorage.setItem("devRealmHostname", __ELECTRON_SOURCE_HOST__);
    } catch { /* storage blocked */ }
}

// ─── Intercept POST /device (fetch + XHR/axios) ───────────────────────────────

function notifyLoginSuccess(url: string, reqBody: Record<string, unknown>, resBody: Record<string, unknown>): void {
    console.log("[accounts] notifyLoginSuccess", url, !!reqBody.nick, !!resBody.auth_token);
    if (!reqBody.nick || !reqBody.password || !resBody.auth_token) return;
    console.log("[accounts] sending device:login-success for", reqBody.nick);
    ipcRenderer.send("device:login-success", {
        nick: reqBody.nick,
        realm: reqBody.realm ?? "",
        password: reqBody.password,
        name: resBody.name ?? reqBody.nick,
        apiBaseUrl: new URL(url).origin,
    });
}

// Intercept native fetch
const _origFetch = window.fetch.bind(window);
(window as Window & typeof globalThis).fetch = async function (
    input: RequestInfo | URL,
    init?: RequestInit,
): Promise<Response> {
    const url = typeof input === "string" ? input
        : input instanceof URL ? input.href
            : (input as Request).url;
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();

    if (method === "POST" && url.includes("/device")) {
        let reqBody: Record<string, unknown> = {};
        try { reqBody = JSON.parse((init?.body as string) ?? "{}"); } catch { /* ignore */ }

        const response = await _origFetch(input as RequestInfo, init);

        if (response.ok) {
            try {
                const data = await response.clone().json() as Record<string, unknown>;
                notifyLoginSuccess(url, reqBody, data);
            } catch { /* ignore */ }
        }

        return response;
    }

    return _origFetch(input as RequestInfo, init);
};

// Intercept XMLHttpRequest (axios uses XHR by default in browsers)
const _XHROpen = XMLHttpRequest.prototype.open;
const _XHRSend = XMLHttpRequest.prototype.send;

XMLHttpRequest.prototype.open = function (
    method: string, url: string | URL, ...rest: unknown[]
) {
    (this as XMLHttpRequest & { _method?: string; _url?: string })._method = method.toUpperCase();
    (this as XMLHttpRequest & { _method?: string; _url?: string })._url = String(url); if (method.toUpperCase() === "POST" && String(url).includes("/device")) {
        console.log("[accounts] XHR open intercepted:", method, String(url));
    } return (_XHROpen as Function).call(this, method, url, ...rest);
};

XMLHttpRequest.prototype.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const self = this as XMLHttpRequest & { _method?: string; _url?: string };
    if (self._method === "POST" && self._url?.includes("/device")) {
        let reqBody: Record<string, unknown> = {};
        try { reqBody = JSON.parse(String(body ?? "{}")); } catch { /* ignore */ }

        self.addEventListener("load", function () {
            if (self.status >= 200 && self.status < 300) {
                try {
                    const data = JSON.parse(self.responseText) as Record<string, unknown>;
                    notifyLoginSuccess(self._url!, reqBody, data);
                } catch { /* ignore */ }
            }
        }, { once: true });
    }
    return _XHRSend.call(this, body);
};
// ─────────────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
    navigator.mediaDevices
        .getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
        .then(s => s.getTracks().forEach(t => t.stop()))
        .catch(() => undefined);
}, { once: true });

window.addEventListener("click", function unlockAudio() {
    const ctx = (window as Window & { _audioContext?: AudioContext })._audioContext;
    if (ctx?.state === "suspended") ctx.resume().catch(() => undefined);
    try {
        const ac = new AudioContext();
        const buf = ac.createBuffer(1, 1, 22050);
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start(0);
        ac.close().catch(() => undefined);
    } catch { }
    window.removeEventListener("click", unlockAudio);
}, { once: true });

const mockWakeLockSentinel = {
    type: "screen" as WakeLockType,
    released: false,
    onrelease: null as null,
    release: (): Promise<void> => Promise.resolve(),
    addEventListener: (): void => undefined,
    removeEventListener: (): void => undefined,
    dispatchEvent: (): boolean => true,
};

Object.defineProperty(navigator, "wakeLock", {
    value: { request: (_type: WakeLockType) => Promise.resolve(mockWakeLockSentinel) },
    writable: false,
    configurable: true,
});

const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);

type SysDevice = { name: string; direction: string; status: string };
let sysDeviceCache: SysDevice[] = [];
let sysCacheExpiry = 0;

async function getSystemDevices(): Promise<SysDevice[]> {
    if (Date.now() < sysCacheExpiry) return sysDeviceCache;
    try {
        sysDeviceCache = await ipcRenderer.invoke("list-system-audio-devices") as SysDevice[];
        sysCacheExpiry = Date.now() + 10_000;
    } catch { /* non-fatal */ }
    return sysDeviceCache;
}

getSystemDevices().catch(() => undefined); // pre-warm cache

const originalEnumerateDevices = navigator.mediaDevices.enumerateDevices.bind(navigator.mediaDevices);
Object.defineProperty(navigator.mediaDevices, "enumerateDevices", {
    value: async (): Promise<MediaDeviceInfo[]> => {
        const [native, sys] = await Promise.all([originalEnumerateDevices(), getSystemDevices()]);
        const nativeLabels = native.map(d => d.label.toLowerCase().trim()).filter(Boolean);

        // Use fuzzy match: exclude DirectShow devices whose name is contained in
        // (or contains) any native Chrome label. This handles cases where Chrome
        // appends USB IDs to labels, e.g. "Microfone (HD Pro Webcam C920) (046d:082d)".
        const isAlreadyNative = (name: string): boolean => {
            const n = name.toLowerCase().trim();
            return nativeLabels.some(nl => nl.includes(n) || n.includes(nl));
        };

        const virtual = sys
            .filter(d => d.name && d.direction !== "output" && !isAlreadyNative(d.name))
            .map(d => ({
                deviceId: `${DSHOW_DEVICE_PREFIX}${encodeURIComponent(d.name)}`,
                groupId: "dshow-virtual",
                kind: "audioinput" as MediaDeviceKind,
                label: d.name,
                toJSON: () => ({}),
            } as MediaDeviceInfo));

        console.log(`[enum] native=${native.filter(d => d.kind === "audioinput").length} virtual=${virtual.length}`, virtual.map(d => d.label));
        return [...native, ...virtual];
    },
    writable: true, configurable: true,
});

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

Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
    value: async (constraints?: MediaStreamConstraints): Promise<MediaStream> => {
        const audio = constraints?.audio;
        const video = constraints?.video;

        const audioId = audio && typeof audio === "object"
            ? extractDeviceId((audio as MediaTrackConstraints).deviceId)
            : (audio === true ? "[any]" : "[none]");
        const videoId = video && typeof video === "object"
            ? extractDeviceId((video as MediaTrackConstraints).deviceId)
            : (video === true ? "[any]" : "[none]");

        console.log(`[gUM] audio="${audioId}" video="${videoId}"`);

        if (audio && typeof audio === "object") {
            const deviceId = extractDeviceId((audio as MediaTrackConstraints).deviceId);

            if (deviceId.startsWith(DSHOW_DEVICE_PREFIX)) {
                const deviceName = decodeURIComponent(deviceId.slice(DSHOW_DEVICE_PREFIX.length));

                // Before using FFmpeg, check if Chrome can access this device natively.
                // Some devices appear in the DirectShow registry with a different name than
                // their Chrome/WASAPI label (e.g. Windows in Portuguese vs Chrome in English).
                // If a fuzzy name match exists in the native list, prefer Chrome's native path.
                const nativeDevices = await originalEnumerateDevices();
                const n = deviceName.toLowerCase();
                const nativeMatch = nativeDevices.find(d =>
                    d.kind === "audioinput" && d.label &&
                    (d.label.toLowerCase().includes(n) || n.includes(d.label.toLowerCase())),
                );

                if (nativeMatch) {
                    console.log(`[gUM] dshow "${deviceName}" → native fallback "${nativeMatch.label}"`);
                    const audioStream = await originalGetUserMedia({ audio: { deviceId: { exact: nativeMatch.deviceId } } });
                    if (constraints?.video) {
                        try {
                            const videoStream = await originalGetUserMedia({ video: constraints.video });
                            return new MediaStream([...audioStream.getAudioTracks(), ...videoStream.getVideoTracks()]);
                        } catch { return audioStream; }
                    }
                    return audioStream;
                }

                console.log(`[gUM] → dshow capture: "${deviceName}"`);
                const audioStream = await createDShowStream(deviceName);

                if (constraints?.video) {
                    try {
                        const videoStream = await originalGetUserMedia({ video: constraints.video });
                        console.log(`[gUM] → combined dshow audio + video`);
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

            // Only schedule teardown when an explicit non-dshow deviceId was requested.
            // Generic audio:true or audio without deviceId are permission/enum requests
            // (e.g. the irmwebclient3 Devices component calls getUserMedia({audio:true,video:true})
            // just to enumerate devices) and should NOT stop the vMix capture.
            const hasExplicitDeviceId = !!(audio as MediaTrackConstraints).deviceId;
            if (hasExplicitDeviceId) {
                console.log(`[gUM] \u2192 non-dshow audio with explicit deviceId, scheduling vMix teardown`);
                scheduleCaptureTeardown();
            } else {
                console.log(`[gUM] \u2192 non-dshow audio (no deviceId = permission/enum request, skipping teardown)`);
            }
        }

        const stream = await originalGetUserMedia(constraints);
        const tracks = stream.getTracks().map(t => `${t.kind}:${t.label}`).join(", ");
        console.log(`[gUM] → native stream tracks: [${tracks}]`);

        // Only stop vMix when the request had an explicit deviceId (genuine device switch).
        // Generic requests like audio:true or audio without deviceId are permission/enum
        // calls and should not interrupt the vMix capture.
        const audioConstraint = constraints?.audio;
        const hadExplicitDeviceId = audioConstraint && typeof audioConstraint === "object"
            && !!(audioConstraint as MediaTrackConstraints).deviceId;
        if (hadExplicitDeviceId && stream.getAudioTracks().length > 0) stopCaptureImmediate();

        return stream;
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
