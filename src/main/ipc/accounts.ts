import path from "path";
import * as https from "https";
import { APP_URL } from "../config";
import { resolveWebLocale } from "../locale";
import { SessionManager } from "../accounts/SessionManager";
import { resolveApiBaseUrl } from "../accounts/RealmResolver";
import { BrowserWindow, ipcMain, WebContentsView } from "electron";
import type { PendingSession, AutoLoginResult } from "../accounts/types";

let pendingSession: PendingSession | null = null;
let saveSessionWin: BrowserWindow | null = null;

// Dados de sessão a serem injetados no localStorage via preload (sendSync)
let pendingInjection: string | null = null;
// Flag para limpar sessão na próxima carga (login fresco)
let pendingClearSession = false;

export function registerAccountHandlers(win: BrowserWindow, view: WebContentsView): void {
    ipcMain.handle("accounts:list", () => SessionManager.list());
    ipcMain.handle("accounts:count", () => SessionManager.count());
    ipcMain.handle("accounts:remove", (_e, id: string) => SessionManager.remove(id));
    ipcMain.handle("accounts:remove-all", () => SessionManager.removeAll());

    // Preload chama isso via sendSync para obter (e limpar) dados de injeção
    ipcMain.on("session:get-injection", (event) => {
        event.returnValue = pendingInjection ?? null;
        pendingInjection = null;
    });

    // Preload chama isso via sendSync para saber se deve limpar a sessão
    ipcMain.on("session:should-clear", (event) => {
        event.returnValue = pendingClearSession;
        pendingClearSession = false;
    });

    // accounts:load-app-fresh → limpa sessão e carrega login fresco (sem loading page)
    ipcMain.on("accounts:load-app-fresh", () => {
        pendingClearSession = true;
        view.webContents.loadURL(APP_URL);
    });

    // Save session (called from save-session dialog)
    ipcMain.handle("accounts:save-pending", () => {
        if (!pendingSession) return;
        const { nick, realm, password, name, apiBaseUrl } = pendingSession;
        SessionManager.save(
            { realm, nick, name, apiBaseUrl, lastAccess: new Date().toISOString() },
            password,
        );
        pendingSession = null;
        // Notifica a web view para exibir o botão de trocar conta
        view.webContents.send("accounts:session-saved");
    });

    ipcMain.handle("accounts:skip-save", () => {
        pendingSession = null;
        saveSessionWin?.destroy();
    });

    ipcMain.handle("accounts:get-pending", () => pendingSession);

    // Auto-login: call API → inject session into web app localStorage
    ipcMain.handle("accounts:login", async (_e, id: string): Promise<AutoLoginResult> => {
        const account = SessionManager.getById(id);
        const password = SessionManager.getPassword(id);
        if (!account || !password) return { success: false, error: "Conta não encontrada" };

        try {
            const apiBaseUrl = account.apiBaseUrl || resolveApiBaseUrl(account.realm);

            const [realmData, userData] = await withTimeout(Promise.all([
                apiGet(`${apiBaseUrl}/mas/realm/${account.realm}/config`),
                apiPost(`${apiBaseUrl}/device`, {
                    nick: account.nick,
                    password,
                    realm: account.realm,
                    fields: [
                        "auth_token", "files_base_url", "name", "nick", "role",
                        "invite_token", "irm_servers", "ppcs_server", "room_server",
                        "css_server", "acs_server", "webrtc_config", "permissions",
                    ],
                }, account.realm),
            ]), 15_000);

            if (!userData?.auth_token) {
                const msg = (userData?.message as string) || (userData?.error as string) || JSON.stringify(userData).slice(0, 120);
                return { success: false, error: msg || "Credenciais inválidas" };
            }

            userData.api_server = apiBaseUrl;
            userData.login_mode = "user";

            // Garante que permissions é JSON válido para evitar crash no InviteDlg
            if (userData.permissions !== undefined) {
                try { JSON.parse(userData.permissions as string); }
                catch { userData.permissions = "[]"; }
            } else {
                userData.permissions = "[]";
            }

            // Armazena para injeção via sendSync no preload (roda antes do React)
            pendingInjection = JSON.stringify({
                realm: account.realm,
                realmConfig: JSON.stringify(realmData),
                data: JSON.stringify(userData),
            });

            SessionManager.updateLastAccess(id);
            return { success: true };
        } catch (err) {
            return { success: false, error: String(err) };
        }
    });

    // accounts:load-app e accounts:show-select são gerenciados em window.ts

    // Triggered by preload when POST /device succeeds (fresh web login)
    ipcMain.on("device:login-success", (_e, session: PendingSession) => {
        // Don't prompt if account already saved
        const existing = SessionManager.list().find(
            a => a.nick === session.nick && a.realm === session.realm,
        );
        if (existing) { SessionManager.updateLastAccess(existing.id); return; }

        pendingSession = session;
        openSaveSessionDialog(win, view);
    });
}

function openSaveSessionDialog(win: BrowserWindow, view: WebContentsView): void {
    if (saveSessionWin && !saveSessionWin.isDestroyed()) return;

    const { x, y, width, height } = win.getBounds();
    const W = 440, H = 350;

    saveSessionWin = new BrowserWindow({
        width: W, height: H,
        x: x + Math.round((width - W) / 2),
        y: y + Math.round((height - H) / 2),
        parent: win, modal: false,
        frame: false, resizable: false,
        minimizable: false, maximizable: false,
        skipTaskbar: true, alwaysOnTop: true,
        backgroundColor: "#00000000",
        transparent: true,
        roundedCorners: true,
        hasShadow: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "..", "preload", "save-session.js"),
        },
    });
    saveSessionWin.setMenu(null);
    resolveWebLocale(view).then(locale => {
        if (!saveSessionWin || saveSessionWin.isDestroyed()) return;
        saveSessionWin.loadFile(
            path.join(__dirname, "..", "renderer", "save-session", "index.html"),
            { query: { locale } },
        );
    });
    saveSessionWin.on("closed", () => { saveSessionWin = null; });
}

// ─── HTTP helpers ─────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)),
    ]);
}

function apiGet(url: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
        const { hostname, pathname, search } = new URL(url);
        https.get(
            { hostname, path: pathname + search, headers: { Accept: "application/json" } },
            (res) => {
                let raw = "";
                res.on("data", c => raw += c);
                res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("JSON parse error")); } });
            },
        ).on("error", reject);
    });
}

function apiPost(url: string, body: object, realm: string): Promise<Record<string, unknown>> {
    const json = JSON.stringify(body);
    const { hostname, pathname } = new URL(url);
    return new Promise((resolve, reject) => {
        const req = https.request(
            {
                hostname, path: pathname, method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "x-api-realm": realm,
                    "x-api-platform": "webclient",
                    "Content-Length": Buffer.byteLength(json),
                },
            },
            (res) => {
                let raw = "";
                res.on("data", c => raw += c);
                res.on("end", () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error("JSON parse error")); } });
            },
        );
        req.on("error", reject);
        req.write(json);
        req.end();
    });
}
