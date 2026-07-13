import type { BrowserWindow, WebContentsView } from "electron";

import { registerAudioDeviceHandlers } from "./audio-devices";
import { registerAudioCaptureHandlers } from "./audio-capture";
import { registerScreenCaptureHandlers } from "./screen-capture";
import { registerWindowControlHandlers } from "./window-control";
import { registerAccountHandlers } from "./accounts";

export function registerIpcHandlers(win: BrowserWindow, view: WebContentsView): void {
    registerScreenCaptureHandlers(view);
    registerWindowControlHandlers(win, view);
    registerAudioDeviceHandlers();
    registerAudioCaptureHandlers();
    registerAccountHandlers(win, view);
}
