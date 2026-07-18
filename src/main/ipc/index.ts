
import path from "path";
import { appendFileSync } from "fs";
import { clipboard, ipcMain } from "electron";
import { registerAccountHandlers } from "./accounts";
import { registerAudioDeviceHandlers } from "./audio-devices";
import type { BrowserWindow, WebContentsView } from "electron";
import { registerAudioCaptureHandlers } from "./audio-capture";
import { registerScreenCaptureHandlers } from "./screen-capture";
import { registerWindowControlHandlers } from "./window-control";

const logFile = path.join(
    process.env.USERPROFILE || process.env.HOME || ".",
    "Desktop", "deeplink-debug.txt"
);
function dlog(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { appendFileSync(logFile, line, "utf-8"); } catch { }
}

export function registerIpcHandlers(win: BrowserWindow, view: WebContentsView): void {
    registerScreenCaptureHandlers(win, view);
    registerWindowControlHandlers(win, view);
    registerAudioDeviceHandlers();
    registerAudioCaptureHandlers();
    registerAccountHandlers(win, view);

    ipcMain.handle("clipboard:write", (_e, text: string) => {
        clipboard.writeText(String(text));
    });

    ipcMain.on("debug:rlog", (_e, msg: string) => {
        dlog(msg);
    });
}
