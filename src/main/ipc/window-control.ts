import { ipcMain, WebContentsView } from "electron";
import { reloadApp } from "../window";

export function registerWindowControlHandlers(view: WebContentsView): void {
    ipcMain.removeAllListeners("retry-load");
    ipcMain.on("retry-load", () => reloadApp(view));

    ipcMain.removeAllListeners("reload-view");
    ipcMain.on("reload-view", () => view.webContents.reload());
}
