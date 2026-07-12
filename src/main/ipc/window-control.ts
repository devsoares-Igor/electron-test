import path from "path";
import { reloadApp } from "../window";
import { resolveWebLocale } from "../locale";
import { DEVTOOLS_PASSWORD } from "../config";
import { BrowserWindow, ipcMain, WebContentsView } from "electron";

export function registerWindowControlHandlers(win: BrowserWindow, view: WebContentsView): void {
    ipcMain.removeAllListeners("retry-load");
    ipcMain.on("retry-load", () => reloadApp(view));

    ipcMain.removeAllListeners("reload-view");
    ipcMain.on("reload-view", () => view.webContents.reload());

    ipcMain.removeHandler("open-devtools");
    ipcMain.handle("open-devtools", (_event, password: string) => {
        if (password !== DEVTOOLS_PASSWORD) return false;
        view.webContents.openDevTools({ mode: "detach" });
        return true;
    });

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

        const locale = await resolveWebLocale(view);
        const { x, y } = win.getBounds();
        menuPopup = new BrowserWindow({
            width: 370,
            height: 118,
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

    ipcMain.removeAllListeners("show-devtools-dialog");
    ipcMain.on("show-devtools-dialog", async () => {
        const locale = await resolveWebLocale(view);
        const dialog = new BrowserWindow({
            width: 280,
            height: 148,
            parent: win,
            modal: false,
            resizable: false,
            minimizable: false,
            maximizable: false,
            frame: false,
            alwaysOnTop: true,
            skipTaskbar: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, "..", "preload", "titlebar.js"),
            },
        });
        dialog.setMenu(null);
        dialog.loadFile(path.join(__dirname, "..", "renderer", "devtools-dialog", "index.html"), { query: { locale } });
    });
}
