import path from "path";
import { reloadApp } from "../window";
import { resolveWebLocale, getCachedWebLocale } from "../locale";
import { BrowserWindow, ipcMain, WebContentsView } from "electron";

export function registerWindowControlHandlers(win: BrowserWindow, view: WebContentsView): void {
    ipcMain.removeAllListeners("retry-load");
    ipcMain.on("retry-load", () => reloadApp(view));

    ipcMain.removeAllListeners("reload-view");
    ipcMain.on("reload-view", () => view.webContents.reload());

    ipcMain.removeHandler("get-zoom");
    ipcMain.handle("get-zoom", () => Math.round(view.webContents.zoomFactor * 100));

    ipcMain.removeAllListeners("set-zoom");
    ipcMain.on("set-zoom", (_event, percent: number) => {
        view.webContents.zoomFactor = Math.max(50, Math.min(200, percent)) / 100;
    });

    let menuPopup: BrowserWindow | null = null;

    ipcMain.removeAllListeners("show-titlebar-menu");
    ipcMain.on("show-titlebar-menu", async () => {
        // Toggle: fecha se já está aberto
        if (menuPopup && !menuPopup.isDestroyed()) {
            menuPopup.destroy();
            menuPopup = null;
            return;
        }

        // Usa o cache do locale da webapp; tenta atualizar via resolveWebLocale mas não bloqueia
        const locale = await resolveWebLocale(view).catch(() => getCachedWebLocale());
        const { x, y } = win.getBounds();
        menuPopup = new BrowserWindow({
            width: 330,
            height: 150,
            x: x + 4,
            y: y + 32,
            frame: false,
            transparent: false,
            resizable: false,
            movable: false,
            minimizable: false,
            maximizable: false,
            skipTaskbar: true,
            alwaysOnTop: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "..", "preload", "titlebar.js"),
            },
        });
        menuPopup.setMenu(null);
        menuPopup.loadFile(
            path.join(__dirname, "..", "renderer", "titlebar-menu", "index.html"),
            { query: { locale } },
        );
        menuPopup.on("blur", () => {
            if (menuPopup && !menuPopup.isDestroyed()) menuPopup.destroy();
            menuPopup = null;
        });
    });

    ipcMain.removeAllListeners("win:set-fullscreen");
    ipcMain.on("win:set-fullscreen", (_event, enter: boolean) => {
        win.setFullScreen(enter);
    });

    let clearCacheWin: BrowserWindow | null = null;

    const LOGGED_OUT_ROUTES = new Set(["/", "/login"]);

    ipcMain.removeAllListeners("clear-cache");
    ipcMain.on("clear-cache", () => {
        if (clearCacheWin && !clearCacheWin.isDestroyed()) return;

        let isLoggedOut = false;
        try {
            const url = view.webContents.getURL();
            if (url.includes("/account-select/")) {
                // Tela local de escolha de conta — usuário já está deslogado
                isLoggedOut = true;
            } else {
                const pathname = new URL(url).pathname.replace(/\/$/, "") || "/";
                isLoggedOut = LOGGED_OUT_ROUTES.has(pathname);
            }
        } catch { /* mantém isLoggedOut = false (default mais seguro) */ }

        const { x, y, width, height } = win.getBounds();
        const W = 400, H = 300;
        clearCacheWin = new BrowserWindow({
            width: W, height: H,
            x: x + Math.round((width - W) / 2),
            y: y + Math.round((height - H) / 2),
            parent: win, modal: false,
            frame: false, resizable: false,
            minimizable: false, maximizable: false,
            skipTaskbar: true, alwaysOnTop: true,
            backgroundColor: "#00000000",
            transparent: true,
            roundedCorners: true,
            hasShadow: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "..", "preload", "clear-cache-confirm.js"),
            },
        });
        clearCacheWin.setMenu(null);
        clearCacheWin.loadFile(
            path.join(__dirname, "..", "renderer", "clear-cache-confirm", "index.html"),
            { query: { locale: getCachedWebLocale(), loggedOut: isLoggedOut ? "1" : "0" } },
        );
    });

    ipcMain.removeHandler("clear-cache:cancel");
    ipcMain.handle("clear-cache:cancel", () => {
        clearCacheWin?.destroy();
        clearCacheWin = null;
    });

    ipcMain.removeHandler("clear-cache:confirm");
    ipcMain.handle("clear-cache:confirm", async () => {
        clearCacheWin?.destroy();
        clearCacheWin = null;

        const ses = view.webContents.session;
        await ses.clearStorageData();
        await ses.clearCache();
        view.webContents.reload();
    });
}
