import { ipcRenderer } from "electron";
import ptLocale from "../renderer/locales/pt.json";
import enLocale from "../renderer/locales/en.json";
import esLocale from "../renderer/locales/es.json";
import { colors, withAlpha } from "../shared/colors";
import { createDShowStream, DSHOW_DEVICE_PREFIX } from "./dshow-stream";

declare const __ELECTRON_SOURCE_HOST__: string;

// ─── Injetar sessão de auto-login ANTES do React inicializar ─────────────────
try {
    // Limpar sessão se foi solicitado (ex: "Entrar com outra conta")
    const shouldClear = ipcRenderer.sendSync("session:should-clear") as boolean;
    if (shouldClear) {
        localStorage.removeItem("Data");
        localStorage.removeItem("RealmConfig");
        localStorage.removeItem("Realm");
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
    }
} catch { /* non-fatal */ }
// ─────────────────────────────────────────────────────────────────────────────

// ─── Clipboard override (navigator.clipboard falha no Electron sem foco) ─────
try {
    Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        get: () => ({
            writeText: (text: string) => ipcRenderer.invoke("clipboard:write", text),
            readText: () => Promise.resolve(""),
        }),
    });
} catch { /* non-fatal */ }
// ─────────────────────────────────────────────────────────────────────────────

// ─── Renderer-side debug logging ─────────────────────────────────────────────
try {
    const _rlog = (msg: string) => ipcRenderer.send("debug:rlog", msg);

    _rlog(`[Renderer] loaded url=${window.location.href}`);
    _rlog(`[Renderer] Realm=${localStorage.getItem("Realm") ?? "null"} Data=${localStorage.getItem("Data") ? "SET" : "null"}`);

    const _origPush = history.pushState.bind(history);
    const _origReplace = history.replaceState.bind(history);
    history.pushState = (s, t, url) => { _rlog(`[Renderer] pushState → ${url}`); return _origPush(s, t, url); };
    history.replaceState = (s, t, url) => { _rlog(`[Renderer] replaceState → ${url}`); return _origReplace(s, t, url); };
    window.addEventListener("popstate", () => _rlog(`[Renderer] popstate → ${window.location.pathname}`));
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

// ─────────────────────────────────────────────────────────────────────────────
// Injeta tokens, scrollbar e estilos globais no webapp carregado no Electron.
// Não sobrescreve estilos do webapp — apenas define :root vars e pseudoelementos.
function injectDesignSystemCss(): void {
    if (document.getElementById("__realms_ds__")) return;
    const style = document.createElement("style");
    style.id = "__realms_ds__";
    style.textContent = [
        /* CSS custom properties — disponíveis globalmente no webapp */
        ":root{",
        `  --realms-bg:${colors.bg};`,
        `  --realms-bg2:${colors.bg2};`,
        `  --realms-bg3:${colors.bg3};`,
        `  --realms-accent:${colors.accent};`,
        `  --realms-accent-l:${colors.accentL};`,
        `  --realms-green:${colors.green};`,
        `  --realms-text:${colors.text};`,
        `  --realms-text2:${colors.text2};`,
        "  --realms-font:'Inter',system-ui,-apple-system,sans-serif;",
        "  --realms-radius:8px;",
        "}",
        /* Scrollbar — tênue, discreta, combina com o design system */
        "::-webkit-scrollbar{width:6px;height:6px}",
        "::-webkit-scrollbar-track{background:transparent}",
        "::-webkit-scrollbar-thumb{background:rgba(148,163,184,0.22);border-radius:3px}",
        "::-webkit-scrollbar-thumb:hover{background:rgba(148,163,184,0.42)}",
        "::-webkit-scrollbar-corner{background:transparent}",
        /* Seleção de texto — azul do accent */
        `::selection{background:${withAlpha(colors.accent, 0.28)}}`,
        /* Font smoothing — renderização mais nítida (padrão macOS/Chrome) */
        "*,*::before,*::after{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}",
        /* Barra de loading pré-injetada (disponível ANTES do React carregar) */
        /* Usada pelo account-select via classe CSS — nunca congela no primeiro render */
        "@keyframes __rbar1{0%{left:-35%;right:100%}60%,100%{left:100%;right:-90%}}",
        "@keyframes __rbar2{0%{left:-200%;right:100%}60%,100%{left:107%;right:-8%}}",
        `.__realms_loading_bar{position:fixed;top:0;left:0;right:0;height:3px;z-index:9999;overflow:hidden;background:${withAlpha(colors.accent, 0.12)};pointer-events:none}`,
        `.__realms_loading_bar::before,.__realms_loading_bar::after{content:'';position:absolute;top:0;bottom:0;background:linear-gradient(90deg,${colors.accent},${colors.accentL})}`,
        ".__realms_loading_bar::before{animation:__rbar1 2.1s cubic-bezier(.65,.815,.735,.395) infinite}",
        ".__realms_loading_bar::after{animation:__rbar2 2.1s cubic-bezier(.165,.84,.44,1) 1.15s infinite}",
        /* Separador titlebar → webapp: gradient shadow no topo do webapp (injetado aqui pois titlebar e webapp são janelas Electron separadas) */
        "body::before{",
        "  content:'';",
        "  position:fixed;top:0;left:0;right:0;",
        "  height:10px;",
        "  background:linear-gradient(to bottom,rgba(0,0,0,0.07) 0%,transparent 100%);",
        "  backdrop-filter:blur(0px);",
        "  z-index:2147483646;pointer-events:none;",
        "}",
        "@media(prefers-color-scheme:dark){body::before{background:linear-gradient(to bottom,rgba(0,0,0,0.28) 0%,transparent 100%)}}",
    ].join("");
    (document.head ?? document.documentElement).appendChild(style);
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectDesignSystemCss, { once: true });
} else {
    injectDesignSystemCss();
}
// ─────────────────────────────────────────────────────────────────────────────

// ─── Fullscreen proxy ─────────────────────────────────────────────────────────
// A WebContentsView não suporta HTML fullscreen diretamente com titleBarOverlay.
// Intercepta as chamadas da webapp e delega ao Electron, mantendo a API nativa.

let _fullscreenElement: Element | null = null;

const _dispatchFullscreenChange = (target: Element | null): void => {
    (target ?? document.documentElement).dispatchEvent(new Event("fullscreenchange", { bubbles: true }));
    if (target && target !== document.documentElement) {
        document.dispatchEvent(new Event("fullscreenchange"));
    }
};

Object.defineProperty(document, "fullscreenElement", {
    get: () => _fullscreenElement,
    configurable: true,
});
Object.defineProperty(document, "fullscreen", {
    get: () => _fullscreenElement !== null,
    configurable: true,
});

const _setFullscreenElement = (el: Element | null): void => { _fullscreenElement = el; };

Element.prototype.requestFullscreen = function (_options?: FullscreenOptions): Promise<void> {
    _setFullscreenElement(this);
    ipcRenderer.send("win:set-fullscreen", true);
    setTimeout(() => _dispatchFullscreenChange(this), 0);
    return Promise.resolve();
};

document.exitFullscreen = function (): Promise<void> {
    const el = _fullscreenElement;
    _setFullscreenElement(null);
    ipcRenderer.send("win:set-fullscreen", false);
    setTimeout(() => _dispatchFullscreenChange(el), 0);
    return Promise.resolve();
};

// Sincroniza quando o Electron sai do fullscreen via Esc ou OS
ipcRenderer.on("win:fullscreen-changed", (_e, isFullscreen: boolean) => {
    if (!isFullscreen && _fullscreenElement) {
        const el = _fullscreenElement;
        _setFullscreenElement(null);
        _dispatchFullscreenChange(el);
    }
});
// ─────────────────────────────────────────────────────────────────────────────

// ─── Iframe fullscreen permission ─────────────────────────────────────────────
// O Chromium lê a Feature Policy do iframe no momento da inserção no DOM.
// Para garantir allow="fullscreen" a tempo, interceptamos setAttribute e o
// setter .allow ANTES da inserção, via Object.defineProperty.

function _ensureFullscreenAllow(value: string): string {
    return value.includes("fullscreen") ? value : (value ? `${value}; fullscreen` : "fullscreen");
}

// Intercepta el.setAttribute("allow", ...) — caminho usado pelo React
const _origSetAttr = Element.prototype.setAttribute;
Object.defineProperty(Element.prototype, "setAttribute", {
    value(this: Element, name: string, value: string): void {
        if (this instanceof HTMLIFrameElement && name === "allow") {
            _origSetAttr.call(this, name, _ensureFullscreenAllow(value));
        } else {
            _origSetAttr.call(this, name, value);
        }
    },
    writable: true,
    configurable: true,
});

// Intercepta el.allow = "..." — caminho usado por código imperativo
const _iframeAllowDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, "allow");
if (_iframeAllowDesc?.set) {
    Object.defineProperty(HTMLIFrameElement.prototype, "allow", {
        get: _iframeAllowDesc.get,
        set(this: HTMLIFrameElement, value: string) {
            _iframeAllowDesc.set!.call(this, _ensureFullscreenAllow(value));
        },
        configurable: true,
        enumerable: _iframeAllowDesc.enumerable,
    });
}

// Fallback para iframes já no DOM ou sem atributo "allow"
new MutationObserver(mutations => {
    for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
            if (node instanceof HTMLIFrameElement && !node.allow.includes("fullscreen")) {
                _origSetAttr.call(node, "allow", _ensureFullscreenAllow(node.allow));
            } else if (node instanceof Element) {
                node.querySelectorAll<HTMLIFrameElement>("iframe").forEach(iframe => {
                    if (!iframe.allow.includes("fullscreen")) {
                        _origSetAttr.call(iframe, "allow", _ensureFullscreenAllow(iframe.allow));
                    }
                });
            }
        }
    }
}).observe((document.documentElement as Node | null) ?? document, { childList: true, subtree: true });

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll<HTMLIFrameElement>("iframe").forEach(iframe => {
        if (!iframe.allow.includes("fullscreen")) {
            _origSetAttr.call(iframe, "allow", _ensureFullscreenAllow(iframe.allow));
        }
    });
}, { once: true });
// ─────────────────────────────────────────────────────────────────────────────

// ─── Intercept POST /device (fetch + XHR/axios) ───────────────────────────────

function notifyLoginSuccess(url: string, reqBody: Record<string, unknown>, resBody: Record<string, unknown>): void {
    if (!reqBody.nick || !reqBody.password || !resBody.auth_token) return;
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
    (this as XMLHttpRequest & { _method?: string; _url?: string })._url = String(url);
    return (_XHROpen as (method: string, url: string | URL, ...rest: unknown[]) => void).call(this, method, url, ...rest);
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

    // Botão flutuante "Trocar de conta" — só em / e /login
    const SWITCH_ROUTES = new Set(["/", "/login"]);
    const shouldShowSwitch = () => SWITCH_ROUTES.has(window.location.pathname.replace(/\/$/, "") || "/");

    // Label do botão — lido dos mesmos arquivos de locale usados pelos renderers React
    const _locales: Record<string, typeof enLocale> = { pt: ptLocale, en: enLocale, es: esLocale };
    const _rawLang = (localStorage.getItem("i18nextLng") || navigator.language).split("-")[0].toLowerCase();
    const switchLabel = (_locales[_rawLang] ?? enLocale).titlebar.switchAccount;

    const createSwitchBtn = () => {
        if (document.getElementById("__realms_switch_account__")) return;
        const btn = document.createElement("button");
        btn.id = "__realms_switch_account__";
        btn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
                <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85C21.93 14.21 20.99 14 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z"/>
            </svg>
            <span>${switchLabel}</span>
        `;
        Object.assign(btn.style, {
            position: "fixed", top: "8px", left: "16px",
            zIndex: "2147483647", display: "flex", alignItems: "center", gap: "6px",
            padding: "9px 16px",
            background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentH} 100%)`,
            color: colors.text,
            border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: "8px",
            fontSize: "14px",
            fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
            fontWeight: "600",
            cursor: "pointer",
            backdropFilter: "blur(12px)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.35)",
            transition: "background 0.15s, color 0.15s, border-color 0.15s, transform 0.1s, box-shadow 0.15s",
            outline: "none",
            userSelect: "none",
        });
        btn.addEventListener("mouseenter", () => {
            btn.style.background = `linear-gradient(135deg, ${colors.accentL} 0%, ${colors.accent} 100%)`;
            btn.style.borderColor = "rgba(255,255,255,0.22)";
            btn.style.boxShadow = "0 3px 12px rgba(0,0,0,0.45)";
            btn.style.transform = "translateY(-1px)";
        });
        btn.addEventListener("mouseleave", () => {
            btn.style.background = `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentH} 100%)`;
            btn.style.borderColor = "rgba(255,255,255,0.14)";
            btn.style.boxShadow = "0 2px 8px rgba(0,0,0,0.35)";
            btn.style.transform = "translateY(0)";
        });
        btn.addEventListener("click", () => {
            const style = document.createElement("style");
            style.textContent = "@keyframes __realms_slide{0%{background-position:200% 0}100%{background-position:-200% 0}}";
            document.head.appendChild(style);
            const bar = document.createElement("div");
            bar.style.cssText = `position:fixed;top:0;left:0;right:0;height:3px;z-index:2147483647;background:linear-gradient(90deg,${colors.accentL} 0%,${colors.accent} 40%,${colors.accentL} 100%);background-size:200% 100%;animation:__realms_slide 0.9s linear infinite;`;
            document.body.appendChild(bar);
            ipcRenderer.send("accounts:show-select");
        });
        document.body.appendChild(btn);
    };

    const removeSwitchBtn = () => document.getElementById("__realms_switch_account__")?.remove();

    const updateSwitchBtn = () => {
        if (shouldShowSwitch()) createSwitchBtn();
        else removeSwitchBtn();
    };

    const setupHistoryListeners = (() => {
        let done = false;
        return () => {
            if (done) return;
            done = true;
            const origPushState = history.pushState.bind(history);
            const origReplaceState = history.replaceState.bind(history);
            history.pushState = (...a) => { origPushState(...a); updateSwitchBtn(); };
            history.replaceState = (...a) => { origReplaceState(...a); updateSwitchBtn(); };
            window.addEventListener("popstate", updateSwitchBtn);
        };
    })();

    ipcRenderer.invoke("accounts:count").then((count: unknown) => {
        const n = count as number;

        if (n > 0) {
            updateSwitchBtn();
            setupHistoryListeners();
        }

        // Exibe o botão ao salvar a primeira sessão (conta 0 → 1)
        ipcRenderer.on("accounts:session-saved", () => {
            if (shouldShowSwitch()) createSwitchBtn();
            setupHistoryListeners();
        });
    }).catch(() => { /* non-fatal */ });
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

            console.log(`[gUM] → non-dshow audio`);
        }

        const stream = await originalGetUserMedia(constraints);
        const tracks = stream.getTracks().map(t => `${t.kind}:${t.label}`).join(", ");
        console.log(`[gUM] → native stream tracks: [${tracks}]`);

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
    background: ${withAlpha(colors.accent, 0.24)};
    z-index: 2147483647; pointer-events: none;
}
#${PROGRESS_BAR_ID} > span {
    position: absolute; top: 0; bottom: 0;
    background: ${colors.accent}; width: auto;
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
