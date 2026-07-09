import { BrowserWindow, ipcMain, WebContentsView } from "electron";
import path from "path";
import { DEVTOOLS_PASSWORD } from "../config";
import { reloadApp } from "../window";

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

    ipcMain.removeAllListeners("show-devtools-dialog");
    ipcMain.on("show-devtools-dialog", () => {
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
                preload: path.join(__dirname, "titlebar-preload.js"),
            },
        });
        dialog.setMenu(null);
        dialog.loadFile(path.join(__dirname, "devtools-dialog.html"));
    });
}
