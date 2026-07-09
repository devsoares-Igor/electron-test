import { ChildProcess, spawn } from "child_process";
import type { WebContents } from "electron";
import { ipcMain } from "electron";
import { accessSync, appendFileSync } from "fs";
import os from "os";
import { join } from "path";

// ─── Debug log ─────────────────────────────────────────────────────

const LOG_FILE = join(os.homedir(), "electron-audio.log");

function dbg(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    process.stdout.write(line);
    try { appendFileSync(LOG_FILE, line); } catch { /* ignore */ }
}

ipcMain.on("debug-log", (_e, msg: string) => dbg(`[renderer] ${msg}`));

// ─── FFmpeg path ──────────────────────────────────────────────────────────────

function getFfmpegBin(): string | null {
    // 1. ffmpeg-static bundled in app
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const p = require("ffmpeg-static") as string;
        dbg(`[getFfmpegBin] ffmpeg-static returned: "${p}"`);
        if (p) {
            const unpacked = p.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
            try { accessSync(unpacked); dbg(`[getFfmpegBin] using unpacked: "${unpacked}"`); return unpacked; } catch (e) { dbg(`[getFfmpegBin] unpacked not accessible: ${e}`); }
            try { accessSync(p); dbg(`[getFfmpegBin] using original: "${p}"`); return p; } catch (e) { dbg(`[getFfmpegBin] original not accessible: ${e}`); }
        }
    } catch (e) { dbg(`[getFfmpegBin] require("ffmpeg-static") threw: ${e}`); }

    // 2. resourcesPath fallback
    if (process.resourcesPath) {
        const rp = join(process.resourcesPath, "ffmpeg.exe");
        try { accessSync(rp); dbg(`[getFfmpegBin] using resourcesPath: "${rp}"`); return rp; } catch { /* not there */ }
    }

    // 3. Common Windows locations
    const candidates = [
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        String(process.env["ProgramFiles"]) + "\\ffmpeg\\bin\\ffmpeg.exe",
    ];
    for (const c of candidates) {
        try { accessSync(c); dbg(`[getFfmpegBin] using candidate: "${c}"`); return c; } catch { /* not found */ }
    }

    dbg(`[getFfmpegBin] not found anywhere`);
    return null;
}

// ─── Auto-install FFmpeg ──────────────────────────────────────────────────

let _ffmpegCache: string | null | undefined = undefined; // undefined = not yet resolved

/**
 * Returns the FFmpeg binary path.
 * The binary is downloaded during setup/run-win.sh.
 * This function also attempts an auto-download as a last-resort fallback,
 * in case the user bypassed setup or the binary was deleted.
 * Result is cached — install runs at most once per process lifetime.
 */
async function ensureFfmpegBin(): Promise<string | null> {
    if (_ffmpegCache !== undefined) return _ffmpegCache;

    _ffmpegCache = getFfmpegBin();
    if (_ffmpegCache) return _ffmpegCache;

    dbg("[ffmpeg] Binary missing — running auto-download via ffmpeg-static...");

    await new Promise<void>((resolve) => {
        let installScript = "";
        try { installScript = require.resolve("ffmpeg-static/install"); } catch { /* not found */ }

        if (!installScript) {
            dbg("[ffmpeg] ffmpeg-static/install.js not found, skipping");
            resolve();
            return;
        }

        const safe = installScript.replace(/\\/g, "\\\\").replace(/'/g, "''");
        const ps = [
            "$env:PATH = 'C:\\Program Files\\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')",
            `node '${safe}'`,
        ].join("; ");

        const child = spawn("powershell.exe", ["-NoProfile", "-Command", ps],
            { windowsHide: true });

        child.stdout?.on("data", (d: Buffer) => dbg(`[ffmpeg-install] ${d.toString().trim()}`));
        child.stderr?.on("data", (d: Buffer) => dbg(`[ffmpeg-install] ${d.toString().trim()}`));
        child.on("close", (code) => { dbg(`[ffmpeg-install] done (exit ${code})`); resolve(); });
        child.on("error", (e) => { dbg(`[ffmpeg-install] error: ${e.message}`); resolve(); });
        setTimeout(() => { try { child.kill(); } catch { /* ignore */ } resolve(); }, 90_000);
    });

    _ffmpegCache = getFfmpegBin();
    dbg(_ffmpegCache
        ? `[ffmpeg] Auto-install OK → ${_ffmpegCache}`
        : "[ffmpeg] Auto-install FAILED — FFmpeg still unavailable");

    return _ffmpegCache;
}

// ─── Active capture sessions ──────────────────────────────────────────────────

const sessions = new Map<number, ChildProcess>();

function stopSession(webContentsId: number): void {
    const proc = sessions.get(webContentsId);
    if (!proc) return;
    try { proc.kill("SIGKILL"); } catch { /* already dead */ }
    sessions.delete(webContentsId);
}

// ─── FFmpeg args builders ─────────────────────────────────────────────────────

const OUTPUT_ARGS = [
    "-vn",
    "-ar", "48000",
    "-ac", "1",
    "-f", "f32le",
    "-blocksize", "16384",   // 4096 samples × 4 bytes ≈ 85ms/chunk
    "-fflags", "+nobuffer+flush_packets",
    "-flush_packets", "1",
    "-loglevel", "error",    // report real errors only
    "pipe:1",
];

function buildDShowArgs(device: string): string[] {
    return ["-f", "dshow", "-i", `audio=${device}`, ...OUTPUT_ARGS];
}

function buildWasapiLoopbackArgs(device: string): string[] {
    // WASAPI loopback captures a render (output) endpoint — used for vMix Bus, VB-Cable Output, etc.
    return ["-f", "wasapi", "-loopback", "1", "-i", device, ...OUTPUT_ARGS];
}

// ─── Spawn and detect device open ────────────────────────────────────────────

/**
 * Spawns FFmpeg and determines whether the device opened successfully.
 *
 * Success criterion: FFmpeg stays alive for DEVICE_OPEN_MS without exiting.
 * This is the correct criterion because:
 *   - A device that can't be opened causes FFmpeg to EXIT immediately with error.
 *   - A device that is open but silent (e.g. vMix Bus A with no content) keeps
 *     FFmpeg running but produces no audio chunks — that is a VALID state.
 *     Audio will flow once content plays in vMix.
 *
 * DO NOT use "received first chunk" as success — that breaks silent devices.
 *
 * Resolves:
 *   "ok"     — FFmpeg is alive and device is open (data may or may not be flowing)
 *   "failed" — FFmpeg exited before DEVICE_OPEN_MS (device not found / wrong type)
 */
const DEVICE_OPEN_MS = 2500;

type SpawnResult = "ok" | "failed";

function spawnCapture(
    bin: string,
    args: string[],
    wid: number,
    sender: WebContents,
): Promise<SpawnResult> {
    return new Promise((resolve) => {
        const ffmpeg = spawn(bin, args, { windowsHide: true });
        sessions.set(wid, ffmpeg);

        let confirmed = false;

        // If FFmpeg is still alive after DEVICE_OPEN_MS → device opened successfully.
        // Resolve immediately on data if it arrives sooner (fast path for active devices).
        const openTimer = setTimeout(() => {
            if (!confirmed) { confirmed = true; resolve("ok"); }
        }, DEVICE_OPEN_MS);

        ffmpeg.stdout.on("data", (chunk: Buffer) => {
            if (!confirmed) {
                confirmed = true;
                clearTimeout(openTimer);
                resolve("ok");
            }
            if (!sender.isDestroyed()) sender.send("dshow-chunk", chunk);
        });

        ffmpeg.stderr.on("data", (data: Buffer) => {
            const msg = data.toString().trim();
            if (msg) console.error("[capture]", msg.slice(0, 300));
        });

        ffmpeg.on("close", (code) => {
            clearTimeout(openTimer);
            sessions.delete(wid);
            if (!confirmed) {
                // Exited before being confirmed → real failure (device not found)
                confirmed = true;
                resolve("failed");
            } else {
                // Was open, now ended — notify renderer
                if (!sender.isDestroyed()) sender.send("dshow-ended", code);
            }
        });

        ffmpeg.on("error", (err) => {
            clearTimeout(openTimer);
            sessions.delete(wid);
            console.error("[capture] spawn error:", err.message);
            if (!confirmed) { confirmed = true; resolve("failed"); }
        });
    });
}


// ─── Handlers ─────────────────────────────────────────────────────────────────

export function registerAudioCaptureHandlers(): void {

    ipcMain.handle("dshow-check", async (): Promise<{ ok: boolean; path: string | null }> => {
        const p = await ensureFfmpegBin();
        return { ok: p !== null, path: p };
    });

    /**
     * Starts audio capture with automatic fallback:
     *   1. DirectShow  — works for physical mics and virtual capture devices
     *   2. WASAPI loopback — works for render endpoints (vMix Bus, VB-Cable Output, etc.)
     *
     * FFmpeg is auto-downloaded if missing.
     * Returns true if any mode opens the device (even if silent).
     */
    ipcMain.handle("dshow-start", async (event, deviceName: string) => {
        const wid = event.sender.id;
        stopSession(wid);

        const bin = await ensureFfmpegBin();
        if (!bin) {
            dbg(`[dshow-start] FFmpeg not found`);
            if (!event.sender.isDestroyed()) {
                event.sender.send("dshow-error",
                    "FFmpeg não encontrado. Reinstale o app ou instale o FFmpeg em C:\\ffmpeg\\bin\\ffmpeg.exe"
                );
            }
            return false;
        }

        dbg(`[dshow-start] device="${deviceName}"`);

        // 1. Try DirectShow (physical mics, virtual capture devices)
        dbg(`[dshow-start] trying DirectShow...`);
        const dsResult = await spawnCapture(bin, buildDShowArgs(deviceName), wid, event.sender);
        dbg(`[dshow-start] DirectShow result=${dsResult}`);
        if (dsResult === "ok") return true;

        // 2. Fallback: WASAPI loopback (vMix Bus, VB-Cable Output, render endpoints)
        dbg(`[dshow-start] trying WASAPI loopback...`);
        const wasapiResult = await spawnCapture(bin, buildWasapiLoopbackArgs(deviceName), wid, event.sender);
        dbg(`[dshow-start] WASAPI result=${wasapiResult}`);
        if (wasapiResult === "ok") return true;

        // Both modes failed
        dbg(`[dshow-start] FAILED for "${deviceName}" — both DirectShow and WASAPI loopback failed`);
        if (!event.sender.isDestroyed()) {
            event.sender.send("dshow-error",
                `"${deviceName}" não produziu áudio.\n` +
                `Verifique se o dispositivo está ativo no vMix e tente novamente.`
            );
        }
        return false;
    });

    ipcMain.handle("dshow-stop", (event) => {
        stopSession(event.sender.id);
        return true;
    });
}

