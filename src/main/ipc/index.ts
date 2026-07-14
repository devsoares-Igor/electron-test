
import { registerAccountHandlers } from "./accounts";
import { registerAudioDeviceHandlers } from "./audio-devices";
import type { BrowserWindow, WebContentsView } from "electron";
import { registerAudioCaptureHandlers } from "./audio-capture";
import { registerScreenCaptureHandlers } from "./screen-capture";
import { registerWindowControlHandlers } from "./window-control";

export function registerIpcHandlers(win: BrowserWindow, view: WebContentsView): void {
    registerScreenCaptureHandlers(view);
    registerWindowControlHandlers(win, view);
    registerAudioDeviceHandlers();
    registerAudioCaptureHandlers();
    registerAccountHandlers(win, view);
}
