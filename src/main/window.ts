import { BrowserWindow, shell, WebContentsView } from "electron";
import path from "path";
import { APP_HOST, APP_URL, IS_LOCAL } from "./config";

// ─── Constants ───────────────────────────────────────────────────────────────

const TB_HEIGHT = 32;

const ALLOWED_PERMISSIONS = [
    "media",
    "camera",
    "microphone",
    "audioOutput",
    "audioCapture",
    "notifications",
    "display-capture",
    "screen-wake-lock",
];

// ─── Permissions ─────────────────────────────────────────────────────────────

function applyPermissions(win: BrowserWindow): void {
    const { session } = win.webContents;

    session.setPermissionRequestHandler((_wc, permission, callback) => {
        callback(ALLOWED_PERMISSIONS.includes(permission));
    });

    session.setPermissionCheckHandler((_wc, permission) => {
        return ALLOWED_PERMISSIONS.includes(permission);
    });

    // Inject Referer/Origin on YouTube requests to prevent Error 153
    session.webRequest.onBeforeSendHeaders(
        { urls: ["*://*.youtube.com/*", "*://*.ytimg.com/*", "*://*.googlevideo.com/*"] },
        (details, callback) => {
            const headers = { ...details.requestHeaders };
            if (!headers["Referer"]) headers["Referer"] = `https://${APP_HOST}/`;
            if (!headers["Origin"]) headers["Origin"] = `https://${APP_HOST}`;
            callback({ requestHeaders: headers });
        },
    );
}

// ─── Window factory ──────────────────────────────────────────────────────────

export function createWindow(): { win: BrowserWindow; view: WebContentsView } {
    const iconFile =
        process.platform === "win32"
            ? "icon.ico"
            : process.platform === "darwin"
                ? "icon.icns"
                : "icon.png";
    const iconPath = path.join(__dirname, "icons", iconFile);

    // Splash screen
    const splash = new BrowserWindow({
        width: 360,
        height: 280,
        frame: false,
        center: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    splash.loadFile(path.join(__dirname, "splash.html"));
    splash.setMenu(null);

    // Main window — hidden titlebar + native overlay (Discord/VS Code style)
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        icon: iconPath,
        show: false,
        titleBarStyle: "hidden",
        backgroundColor: "#2B2D31",
        titleBarOverlay: { color: "#2B2D31", symbolColor: "#B5BAC1", height: TB_HEIGHT },
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "titlebar-preload.js"),
        },
    });
    win.setMenu(null);
    win.loadFile(path.join(__dirname, "titlebar.html"));

    // WebContentsView — app content below the titlebar
    const view = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: false,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    win.contentView.addChildView(view);

    const updateBounds = () => {
        const [w, h] = win.getContentSize();
        view.setBounds({ x: 0, y: TB_HEIGHT, width: w, height: Math.max(0, h - TB_HEIGHT) });
    };
    updateBounds();
    win.on("resize", updateBounds);

    // Reveal logic: show window after page loads (or after safety timeout)
    const revealWindow = () => {
        clearTimeout(splashTimeout);
        if (!win.isVisible()) win.show();
        if (!splash.isDestroyed()) splash.destroy();
    };
    view.webContents.once("did-stop-loading", () => setTimeout(revealWindow, 500));
    const splashTimeout = setTimeout(revealWindow, 30_000);

    // Permissions + network
    applyPermissions(win);
    view.webContents.session.disableNetworkEmulation();

    // Load the app
    view.webContents.loadURL(APP_URL);

    // Offline fallback
    view.webContents.on("did-fail-load", (_e, errorCode, _desc, validatedURL) => {
        if (errorCode === -3) return;
        if (validatedURL?.includes("offline.html")) return;

        if (!win.isVisible()) win.show();
        if (!splash.isDestroyed()) splash.destroy();

        const OFFLINE_CODES = [-106, -105, -109, -21, -2];
        const reason = OFFLINE_CODES.includes(errorCode)
            ? "offline"
            : IS_LOCAL
                ? "devserver"
                : "offline";
        view.webContents.loadFile(path.join(__dirname, "offline.html"), { query: { reason } });
    });

    // Child windows (chat detach, etc.)
    view.webContents.setWindowOpenHandler(({ url }) => {
        const isInternal =
            url.startsWith("http://localhost") ||
            url.startsWith("https://localhost") ||
            url.startsWith(`https://${APP_HOST}`);

        if (isInternal) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: 900,
                    height: 700,
                    webPreferences: {
                        preload: path.join(__dirname, "preload.js"),
                        contextIsolation: false,
                        nodeIntegration: false,
                        sandbox: false,
                    },
                },
            };
        }

        // Google OAuth popup — deve abrir dentro do Electron para que o
        // postMessage do GSI funcione entre o popup e a janela pai.
        const isGoogleOAuth =
            url.startsWith("https://accounts.google.com/") ||
            url.startsWith("https://oauth2.googleapis.com/");

        if (isGoogleOAuth) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: 500,
                    height: 620,
                    resizable: false,
                    webPreferences: {
                        nodeIntegration: false,
                        contextIsolation: true,
                        sandbox: true,
                    },
                },
            };
        }

        // External links — only open http/https
        if (url.startsWith("https://") || url.startsWith("http://")) {
            shell.openExternal(url);
        }
        return { action: "deny" };
    });

    // Block non-http/https navigations (mailto:, custom schemes, etc.)
    view.webContents.on("will-navigate", (event, url) => {
        const allowed = url.startsWith("http://") || url.startsWith("https://");
        if (!allowed) event.preventDefault();
    });

    view.webContents.on("did-create-window", (child, details) => {
        child.setMenu(null);

        // Se for popup do Google OAuth, sobrescreve o User-Agent para evitar
        // o erro "disallowed_useragent" que o Google lança ao detectar Electron.
        const url = details.url ?? "";
        const isGoogleOAuth =
            url.startsWith("https://accounts.google.com/") ||
            url.startsWith("https://oauth2.googleapis.com/");

        if (isGoogleOAuth) {
            const chromeUA =
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/126.0.0.0 Safari/537.36";
            child.webContents.setUserAgent(chromeUA);

            // Redireciona navegações internas do popup (Google troca URLs durante o flow)
            child.webContents.on("will-navigate", (_e, navUrl) => {
                if (
                    navUrl.startsWith("https://accounts.google.com/") ||
                    navUrl.startsWith("https://oauth2.googleapis.com/")
                ) return;
                // qualquer outra URL no popup (ex: redirect de volta) não precisa navegar
                _e.preventDefault();
            });
        }
    });

    return { win, view };
}

/** Reload the main app URL (called by IPC retry-load) */
export function reloadApp(view: WebContentsView): void {
    view.webContents.loadURL(APP_URL);
}
