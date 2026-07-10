import { ipcMain } from "electron";
import { FfmpegManager } from "../media/ffmpeg";
import { CaptureManager } from "../media/capture-manager";

// Minimum interval between re-initialization attempts (avoids hammering the
// download server if the connection is still down).
const REINIT_COOLDOWN_MS = 30_000;
let lastReinitAt = 0;

export function registerAudioCaptureHandlers(): void {
    ipcMain.handle("dshow:start", async (event, deviceName: string) => {
        // If FFmpeg wasn't available at startup (e.g. no internet), retry now.
        // This handles the case where internet comes back after the app launched.
        if (!FfmpegManager.isAvailable && Date.now() - lastReinitAt > REINIT_COOLDOWN_MS) {
            lastReinitAt = Date.now();
            console.log("[dshow:start] FFmpeg not available, retrying initialization…");
            await FfmpegManager.initialize();
        }

        if (!FfmpegManager.isAvailable) {
            event.sender.send("dshow:error", "FFmpeg unavailable — check your internet connection and try again.");
            return false;
        }

        CaptureManager.start(event.sender, deviceName);
        return true;
    });

    ipcMain.handle("dshow:stop", (event) => {
        CaptureManager.stop(event.sender.id);
    });
}
