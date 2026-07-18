import path from "path";
import { appendFileSync } from "fs";
import { centerOnDisplay } from "./screen-utils";
import { colors, lightColors } from "../shared/colors";
import { SessionManager } from "./accounts/SessionManager";
import { APP_HOST, APP_URL, CURRENT_ENV, IS_LOCAL } from "./config";
import { resolveLocale, resolveWebLocale, getCachedWebLocale } from "./locale";
import { BrowserWindow, ipcMain, shell, WebContentsView, nativeTheme } from "electron";

const logFile = path.join(
    process.env.USERPROFILE || process.env.HOME || ".",
    "Desktop", `deeplink-debug-${CURRENT_ENV}.txt`
);
function dlog(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { appendFileSync(logFile, line, "utf-8"); } catch { }
}

// Flag de supressão — pode ser setada de fora (ex: handleDeepLink em index.ts)
let _suppressAccountSelect = false;
let _suppressTimer: ReturnType<typeof setTimeout> | null = null;

export function suppressAccountSelectFor(ms: number): void {
    if (_suppressTimer) clearTimeout(_suppressTimer);
    _suppressAccountSelect = true;
    dlog(`[Suppress] accountSelect suppressed for ${ms}ms`);
    _suppressTimer = setTimeout(() => { _suppressAccountSelect = false; _suppressTimer = null; }, ms);
}

export const TB_HEIGHT = 32;

/** Cores do overlay nativo (botões −□×) adaptadas ao tema do sistema */
function overlayColors(isDark: boolean) {
    return {
        color: isDark ? colors.bg2 : lightColors.bg2,
        symbolColor: isDark ? colors.text2 : colors.text3,
        height: TB_HEIGHT,
    };
}

const ALLOWED_PERMISSIONS = [
    "media",
    "camera",
    "fullscreen",
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

    const SPLASH_W = 360, SPLASH_H = 280;
    const splash = new BrowserWindow({
        width: SPLASH_W,
        height: SPLASH_H,
        ...centerOnDisplay(SPLASH_W, SPLASH_H),
        frame: false,
        resizable: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        backgroundColor: colors.bg,
        webPreferences: { nodeIntegration: false, contextIsolation: true },
    });
    splash.loadFile(path.join(__dirname, "..", "renderer", "splash", "index.html"), { query: { locale } });
    splash.setMenu(null);

    // Main window — hidden titlebar + native overlay (Discord/VS Code style)
    const WIN_W = 1280, WIN_H = 800;
    const win = new BrowserWindow({
        width: WIN_W,
        height: WIN_H,
        ...centerOnDisplay(WIN_W, WIN_H),
        minWidth: 800,
        minHeight: 600,
        icon: iconPath,
        show: false,
        titleBarStyle: "hidden",
        backgroundColor: nativeTheme.shouldUseDarkColors ? colors.bg2 : lightColors.bg2,
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
        win.setBackgroundColor(isDark ? colors.bg2 : lightColors.bg2);
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
    view.setBackgroundColor(colors.bg);

    const updateBounds = () => {
        const [w, h] = win.getContentSize();
        const yOff = win.isFullScreen() ? 0 : TB_HEIGHT;
        view.setBounds({ x: 0, y: yOff, width: w, height: Math.max(0, h - yOff) });
    };
    updateBounds();
    win.on("resize", updateBounds);
    win.on("enter-full-screen", updateBounds);
    win.on("leave-full-screen", () => {
        updateBounds();
        view.webContents.send("win:fullscreen-changed", false);
    });

    // iframes cross-origin (ex: YouTube) chamam requestFullscreen nativo —
    // o proxy do preload não os intercepta, mas o Electron dispara esses eventos.
    view.webContents.on("enter-html-full-screen", () => win.setFullScreen(true));
    view.webContents.on("leave-html-full-screen", () => win.setFullScreen(false));

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
        view.setBackgroundColor(nativeTheme.shouldUseDarkColors ? colors.bg : lightColors.bg);
        view.webContents.loadFile(
            path.join(__dirname, "..", "renderer", "account-select", "index.html"),
            { query: { locale: l } },
        );
    };

    const loadApp = () => {
        view.setBackgroundColor(colors.bg);
        view.webContents.loadURL(APP_URL);
    };

    ipcMain.on("accounts:load-app", loadApp);
    ipcMain.on("accounts:show-select", loadAccountSelect);

    let loadAccountSelectTimer: ReturnType<typeof setTimeout> | null = null;

    const onLoginNavigation = (url: string) => {
        try {
            const { pathname } = new URL(url);
            const navMsg = `[Navigation] pathname=${pathname} suppress=${_suppressAccountSelect} accounts=${SessionManager.count()}`;
            console.log(navMsg);
            dlog(navMsg);

            // Cancela timer pendente se o webapp navegou para fora de /login
            if (pathname !== "/login" && pathname !== "/login/") {
                if (loadAccountSelectTimer) {
                    clearTimeout(loadAccountSelectTimer);
                    loadAccountSelectTimer = null;
                }
            }

            if ((pathname === "/login" || pathname === "/login/") && SessionManager.count() > 0) {
                if (_suppressAccountSelect) return;
                loadAccountSelectTimer = setTimeout(loadAccountSelect, 400);
            }
        } catch { }
    };

    view.webContents.on("did-navigate", (_e, url) => {
        try {
            if (!url.includes("offline.html") && !url.startsWith("file://")) {
                resolveWebLocale(view).catch(() => { });
            }
        } catch { }
        onLoginNavigation(url);
    });

    // React Router usa replaceState/pushState → dispara did-navigate-in-page
    view.webContents.on("did-navigate-in-page", (_e, url, isMainFrame) => {
        if (!isMainFrame) return;
        onLoginNavigation(url);
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
            const W = 900, H = 700;
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: W,
                    height: H,
                    ...centerOnDisplay(W, H, win.getBounds()),
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
            const W = 500, H = 620;
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: W,
                    height: H,
                    ...centerOnDisplay(W, H, win.getBounds()),
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
            const W = 860, H = 640;
            return {
                action: "allow",
                overrideBrowserWindowOptions: {
                    width: W,
                    height: H,
                    ...centerOnDisplay(W, H, win.getBounds()),
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
