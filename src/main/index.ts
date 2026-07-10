import { createWindow } from "./window";
import { registerIpcHandlers } from "./ipc";
import { FfmpegManager } from "./media/ffmpeg";
import { requestMediaPermissions } from "./permissions";
import { app, BrowserWindow, Menu, net } from "electron";
import { APP_URL, CURRENT_ENV, IS_LOCAL } from "./config";

Menu.setApplicationMenu(null);

if (process.platform === "win32") {
    app.setAppUserModelId("com.realms.iptv");
}


app.commandLine.appendSwitch(
    "enable-features",
    "WebWakeLock,WebRTC-H264WithOpenH264FFmpeg,WebRTCPipeWireCapturer," +
    "ScreenCaptureKitMac,WindowsGraphicsCapture,AudioOutputDeviceSelection",
);
app.commandLine.appendSwitch("enable-blink-features", "WakeLock");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("enable-usermedia-screen-capturing");

if (IS_LOCAL) {
    app.commandLine.appendSwitch("allow-insecure-localhost");
    app.commandLine.appendSwitch(
        "unsafely-treat-insecure-origin-as-secure",
        "http://localhost:3000",
    );
}

function prewarmLocal(): void {
    if (!IS_LOCAL) return;
    try {
        const req = net.request(APP_URL);
        req.on("response", (res) => {
            res.on("data", () => { });
        });
        req.on("error", () => { });
        req.end();
    } catch {
        // Non-fatal — dev server may not be ready yet.
    }
}

app.whenReady().then(async () => {
    await requestMediaPermissions();
    await FfmpegManager.initialize(); // resolves silently even if FFmpeg is missing

    prewarmLocal();

    console.log(`[Electron] env=${CURRENT_ENV} url=${APP_URL}`);

    const { win, view } = createWindow();
    registerIpcHandlers(win, view);

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
