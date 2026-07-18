import path from "path";
import { appendFileSync } from "fs";
import { pathToFileURL } from "url";
import { registerIpcHandlers } from "./ipc";
import { FfmpegManager } from "./media/ffmpeg";
import { requestMediaPermissions } from "./permissions";
import { APP_URL, CURRENT_ENV, IS_LOCAL, PROTOCOL_SCHEME, PRODUCT_NAME } from "./config";
import { createWindow, suppressAccountSelectFor } from "./window";
import { app, BrowserWindow, Menu, net, protocol, WebContentsView } from "electron";

const logFile = path.join(
    process.env.USERPROFILE || process.env.HOME || ".",
    "Desktop", `deeplink-debug-${CURRENT_ENV}.txt`
);
function dlog(msg: string) {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    try { appendFileSync(logFile, line, "utf-8"); } catch { }
    console.log(msg);
}

// Nome do app isolado por build — garante userData (contas salvas, cache)
// separado entre local/school/staging/realms quando rodando lado a lado.
app.setName(PRODUCT_NAME);

Menu.setApplicationMenu(null);

if (process.platform === "win32") {
    app.setAppUserModelId(`com.realms.iptv.${CURRENT_ENV}`);
}

// ─── Deep link protocol ───────────────────────────────────────────────────────
// Cada build registra seu PRÓPRIO esquema (realms / realms-school / realms-staging /
// realms-local) — assim, links de um ambiente sempre abrem o build correspondente,
// em vez de brigar pelo registro único de "realms://" com os demais builds instalados.
// Em modo dev (electron.exe + main.js separados), é necessário passar
// o execPath e os args explicitamente para o registry incluir o main.js.
// Em modo packaged o app.isPackaged resolve automaticamente.
if (app.isPackaged) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
} else {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
        path.resolve(__dirname, "..", "main", "index.js"),
    ]);
}

function parseDeepLink(url: string): { type: "invite"; token: string; api: string } | null {
    try {
        const u = new URL(url);
        if (u.protocol !== `${PROTOCOL_SCHEME}:`) return null;
        if (u.hostname === "invite") {
            // Formato: <scheme>://invite/TOKEN  ou  <scheme>://invite/?api=mas&token=TOKEN
            const token = u.pathname.replace(/^\//, "") || u.searchParams.get("token") || "";
            const api = u.searchParams.get("api") || "mas";
            if (token) return { type: "invite", token, api };
        }
        return null;
    } catch { return null; }
}

let mainView: WebContentsView | null = null;
let mainWin: BrowserWindow | null = null;

function handleDeepLink(url: string): void {
    dlog(`[DeepLink] received: ${url}`);
    const link = parseDeepLink(url);
    dlog(`[DeepLink] parsed: ${JSON.stringify(link)}`);
    if (!link || !mainView || !mainWin) {
        dlog(`[DeepLink] abort — link=${!!link} mainView=${!!mainView} mainWin=${!!mainWin}`);
        return;
    }

    if (link.type === "invite") {
        // Suprime loadAccountSelect por 15s para o fluxo de invite completar
        suppressAccountSelectFor(15_000);

        const inviteUrl = `${APP_URL}?api=${link.api}&token=${encodeURIComponent(link.token)}`;
        mainView.webContents.loadURL(inviteUrl).catch(() => { });

        // Força a janela para frente (Windows pode ignorar focus() simples)
        if (mainWin.isMinimized()) mainWin.restore();
        mainWin.setAlwaysOnTop(true);
        mainWin.show();
        mainWin.focus();
        mainWin.setAlwaysOnTop(false);
    }
}

// Windows: app já rodando — segunda instância envia o URL via argv
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
} else {
    app.on("second-instance", (_e, argv) => {
        dlog(`[second-instance] argv=${JSON.stringify(argv)}`);
        const url = argv.find(a => a.startsWith(`${PROTOCOL_SCHEME}://`));
        if (url) {
            handleDeepLink(url);
        } else if (mainWin) {
            if (mainWin.isMinimized()) mainWin.restore();
            mainWin.setAlwaysOnTop(true);
            mainWin.show();
            mainWin.focus();
            mainWin.setAlwaysOnTop(false);
        }
    });
}

// macOS: app já rodando
app.on("open-url", (_e, url) => handleDeepLink(url));
// ─────────────────────────────────────────────────────────────────────────────

protocol.registerSchemesAsPrivileged([{
    scheme: PROTOCOL_SCHEME,
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
    protocol.handle(PROTOCOL_SCHEME, (request) => {
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

    console.log(`[Electron] env=${CURRENT_ENV} url=${APP_URL}`);

    const { win, view } = createWindow();
    mainWin = win;
    mainView = view;
    registerIpcHandlers(win, view);

    if (process.env.OPEN_DEVTOOLS === "1") {
        view.webContents.openDevTools({ mode: "detach" });
    }

    // Verifica deep link na inicialização (Windows: URL no argv)
    const startUrl = process.argv.find(a => a.startsWith(`${PROTOCOL_SCHEME}://`));
    if (startUrl) {
        // Aguarda a janela estar pronta antes de navegar
        view.webContents.once("did-finish-load", () => handleDeepLink(startUrl));
    }

    // Não bloqueia a primeira janela: nada na inicialização depende do FFmpeg
    // (só é usado quando o usuário inicia uma captura — audio-capture.ts já
    // tem retry/lazy-init próprio caso ainda não esteja pronto nesse momento).
    FfmpegManager.initialize();

    prewarmLocal();

    app.on("activate", () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});
