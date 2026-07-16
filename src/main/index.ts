import path from "path";
import { pathToFileURL } from "url";
import { createWindow } from "./window";
import { registerIpcHandlers } from "./ipc";
import { FfmpegManager } from "./media/ffmpeg";
import { requestMediaPermissions } from "./permissions";
import { APP_URL, CURRENT_ENV, IS_LOCAL } from "./config";
import { app, BrowserWindow, Menu, net, protocol } from "electron";

Menu.setApplicationMenu(null);

if (process.platform === "win32") {
    app.setAppUserModelId("com.realms.iptv");
}

protocol.registerSchemesAsPrivileged([{
    scheme: "realms",
    privileges: { standard: true, secure: true, supportFetchAPI: true },
}]);


app.commandLine.appendSwitch(
    "enable-features",
    "WebWakeLock,WebRTC-H264WithOpenH264FFmpeg,WebRTCPipeWireCapturer," +
    "ScreenCaptureKitMac,WindowsGraphicsCapture,AudioOutputDeviceSelection",
);
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
    } catch { }
}

app.whenReady().then(async () => {
    const appDir = path.resolve(__dirname, "..");
    protocol.handle("realms", (request) => {
        const { pathname } = new URL(request.url);
        const safe = path.normalize(decodeURIComponent(pathname.slice(1)));
        const filePath = path.resolve(appDir, safe);
        const relative = path.relative(appDir, filePath);
        if (!safe || relative.startsWith("..") || path.isAbsolute(relative)) {
            return new Response("Forbidden", { status: 403 });
        }
        return net.fetch(pathToFileURL(filePath).toString());
    });

    await requestMediaPermissions();
    await FfmpegManager.initialize();

    prewarmLocal();

    console.log(`[Electron] env=${CURRENT_ENV} url=${APP_URL}`);

    const { win, view } = createWindow();
    registerIpcHandlers(win, view);

    if (process.env.OPEN_DEVTOOLS === "1") {
        view.webContents.openDevTools({ mode: "detach" });
    }

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
