import path from "path";
import { APP_HOST, APP_URL, IS_LOCAL } from "./config";
import { SessionManager } from "./accounts/SessionManager";
import { resolveLocale, resolveWebLocale, getCachedWebLocale } from "./locale";
import { BrowserWindow, ipcMain, shell, WebContentsView, nativeTheme } from "electron";

const TB_HEIGHT = 32;

/** Cores do overlay nativo (botões −□×) adaptadas ao tema do sistema */
function overlayColors(isDark: boolean) {
    return {
        color: isDark ? "#1E293B" : "#FFFFFF",
        symbolColor: isDark ? "#94A3B8" : "#64748B",
        height: TB_HEIGHT,
    };
}

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

export function createWindow(): { win: BrowserWindow; view: WebContentsView } {
    const iconFile =
        process.platform === "win32"
            ? "icon.ico"
            : process.platform === "darwin"
                ? "icon.icns"
                : "icon.png";
    const iconPath = path.join(__dirname, "..", "..", "static", "icons", iconFile);

    const locale = resolveLocale();

    const splash = new BrowserWindow({
        width: 360,
        height: 280,
        frame: false,
        center: true,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: "#0F172A",
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    splash.loadFile(path.join(__dirname, "..", "renderer", "splash", "index.html"), { query: { locale } });
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
        backgroundColor: nativeTheme.shouldUseDarkColors ? "#1E293B" : "#FFFFFF",
        titleBarOverlay: overlayColors(nativeTheme.shouldUseDarkColors),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload", "titlebar.js"),
        },
    });
    win.setMenu(null);
    win.loadFile(path.join(__dirname, "..", "renderer", "titlebar", "index.html"), { query: { locale } });

    // Atualiza botões −□× quando o sistema muda de tema
    const onNativeThemeUpdate = () => {
        if (win.isDestroyed()) return;
        const isDark = nativeTheme.shouldUseDarkColors;
        win.setTitleBarOverlay(overlayColors(isDark));
        win.setBackgroundColor(isDark ? "#1E293B" : "#FFFFFF");
    };
    nativeTheme.on("updated", onNativeThemeUpdate);
    win.on("closed", () => {
        nativeTheme.removeListener("updated", onNativeThemeUpdate);
        win.removeListener("resize", updateBounds);
    });

    // WebContentsView — app content below the titlebar
    const view = new WebContentsView({
        webPreferences: {
            preload: path.join(__dirname, "..", "preload", "main.js"),
            contextIsolation: false,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    win.contentView.addChildView(view);
    view.setBackgroundColor("#0F172A");

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
    view.webContents.once("did-stop-loading", () => setTimeout(revealWindow, 300));
    const splashTimeout = setTimeout(revealWindow, 8_000);

    // Permissions + network
    applyPermissions(win);
    view.webContents.session.disableNetworkEmulation();

    const loadAccountSelect = () => {
        const l = getCachedWebLocale();
        view.setBackgroundColor(nativeTheme.shouldUseDarkColors ? "#0F172A" : "#EEF2F7");
        view.webContents.loadFile(
            path.join(__dirname, "..", "renderer", "account-select", "index.html"),
            { query: { locale: l } },
        );
    };

    const loadApp = () => {
        view.setBackgroundColor("#0F172A");
        view.webContents.loadURL(APP_URL);
    };

    ipcMain.on("accounts:load-app", loadApp);
    ipcMain.on("accounts:show-select", loadAccountSelect);

    view.webContents.on("did-navigate", (_e, url) => {
        try {
            if (!url.includes("offline.html") && !url.startsWith("file://")) {
                resolveWebLocale(view).catch(() => { });
            }
            const { pathname } = new URL(url);
            if ((pathname === "/login" || pathname === "/login/") && SessionManager.count() > 0) {
                setTimeout(loadAccountSelect, 150);
            }
        } catch { }
    });

    // Startup
    if (SessionManager.count() > 0) {
        loadAccountSelect();
    } else {
        loadApp();
    }

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
        view.webContents.loadFile(path.join(__dirname, "..", "renderer", "offline", "index.html"), { query: { reason, locale } });
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
                        preload: path.join(__dirname, "..", "preload", "main.js"),
                        contextIsolation: false,
                        nodeIntegration: false,
                        sandbox: false,
                    },
                },
            };
        }

        // Google OAuth popup — must open inside Electron so the GSI postMessage
        // between the popup and the parent window works correctly.
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

        // Termos e Privacidade — abrem como popup interno
        const isStaticDoc = url.startsWith("https://static.ip.tv/");
        if (isStaticDoc) {
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: 860,
                    height: 640,
                    resizable: true,
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
        child.setIcon(iconPath);
        child.setTitle(" ");
        child.webContents.on("page-title-updated", (e) => e.preventDefault());

        // Override the User-Agent on Google OAuth popups to avoid the
        // "disallowed_useragent" error that Google throws when detecting Electron.
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

            // Block navigations that leave Google's OAuth domain during the flow.
            child.webContents.on("will-navigate", (_e, navUrl) => {
                if (
                    navUrl.startsWith("https://accounts.google.com/") ||
                    navUrl.startsWith("https://oauth2.googleapis.com/")
                ) return;
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
