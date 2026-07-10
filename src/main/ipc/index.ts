import type { BrowserWindow, WebContentsView } from "electron";

import { registerAudioDeviceHandlers } from "./audio-devices";
import { registerAudioCaptureHandlers } from "./audio-capture";
import { registerScreenCaptureHandlers } from "./screen-capture";
import { registerWindowControlHandlers } from "./window-control";

export function registerIpcHandlers(win: BrowserWindow, view: WebContentsView): void {
    registerScreenCaptureHandlers();
    registerWindowControlHandlers(win, view);
    registerAudioDeviceHandlers();
    registerAudioCaptureHandlers();
}
