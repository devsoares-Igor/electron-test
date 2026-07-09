import { ChildProcess, spawn } from "child_process";
import { ipcMain } from "electron";
import { accessSync } from "fs";
import { join } from "path";

// ─── FFmpeg path ──────────────────────────────────────────────────────────────

function getFfmpegBin(): string | null {
    // 1. ffmpeg-static bundled in app (dev or packaged via asarUnpack)
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const p = require("ffmpeg-static") as string;
        if (p) {
            // In a packaged app, asarUnpack moves files to app.asar.unpacked/
            const unpacked = p.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
            try { accessSync(unpacked); return unpacked; } catch { /* try original */ }
            try { accessSync(p); return p; } catch { /* not accessible */ }
        }
    } catch { /* not installed */ }

    // 2. Copied into process.resourcesPath (extraResources fallback)
    if (process.resourcesPath) {
        const rp = join(process.resourcesPath, "ffmpeg.exe");
        try { accessSync(rp); return rp; } catch { /* not there */ }
    }

    // 3. Common portable install locations on Windows
    const candidates = [
        "C:\\ffmpeg\\bin\\ffmpeg.exe",
        "C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe",
        String(process.env["ProgramFiles"]) + "\\ffmpeg\\bin\\ffmpeg.exe",
    ];
    for (const c of candidates) {
        try { accessSync(c); return c; } catch { /* not found */ }
    }

    // 4. PATH — may throw at spawn time if not found
    return null;
}

// ─── Active capture sessions ──────────────────────────────────────────────────

const sessions = new Map<number, ChildProcess>();

function stopSession(webContentsId: number): void {
    const proc = sessions.get(webContentsId);
    if (!proc) return;
    try { proc.kill("SIGKILL"); } catch { /* already dead */ }
    sessions.delete(webContentsId);
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function registerAudioCaptureHandlers(): void {

    /** Verifica se o FFmpeg está disponível — chamado pelo preload antes de exibir devices vMix */
    ipcMain.handle("dshow-check", (): { ok: boolean; path: string | null } => {
        const p = getFfmpegBin();
        return { ok: p !== null, path: p };
    });

    ipcMain.handle("dshow-start", (event, deviceName: string) => {
        const wid = event.sender.id;
        stopSession(wid);   // termina captura anterior para esta view

        const bin = getFfmpegBin();
        if (!bin) {
            // FFmpeg não encontrado — notifica o renderer com mensagem clara
            if (!event.sender.isDestroyed()) {
                event.sender.send("dshow-error",
                    "FFmpeg não encontrado. Reinstale o app ou instale o FFmpeg manualmente em C:\\ffmpeg\\bin\\ffmpeg.exe"
                );
            }
            return false;
        }

        const ffmpeg = spawn(
            bin,
            [
                // Entrada DirectShow
                "-f", "dshow",
                "-i", `audio=${deviceName}`,
                // Saída: PCM float32 mono 48kHz com chunks fixos de 4096 amostras (~85ms)
                // Chunks fixos eliminam jitter e garantem scheduling estável no renderer
                "-vn",
                "-ar", "48000",
                "-ac", "1",
                "-f", "f32le",
                "-blocksize", "16384",   // 4096 amostras × 4 bytes = 16384 bytes por chunk
                "-fflags", "+nobuffer+flush_packets",
                "-flush_packets", "1",
                "-loglevel", "quiet",
                "pipe:1",
            ],
            { windowsHide: true },
        );

        sessions.set(wid, ffmpeg);

        ffmpeg.stdout.on("data", (chunk: Buffer) => {
            if (!event.sender.isDestroyed()) {
                event.sender.send("dshow-chunk", chunk);
            }
        });

        ffmpeg.stderr.on("data", (data: Buffer) => {
            // Only log real errors (not the usual startup info)
            const msg = data.toString();
            if (msg.includes("Error") || msg.includes("error")) {
                console.error("[dshow-capture]", msg.slice(0, 200));
            }
        });

        ffmpeg.on("close", (code) => {
            sessions.delete(wid);
            if (!event.sender.isDestroyed()) {
                event.sender.send("dshow-ended", code);
            }
        });

        ffmpeg.on("error", (err) => {
            console.error("[dshow-capture] spawn error:", err.message);
            sessions.delete(wid);
            if (!event.sender.isDestroyed()) {
                event.sender.send("dshow-error", err.message);
            }
        });

        return true;
    });

    ipcMain.handle("dshow-stop", (event) => {
        stopSession(event.sender.id);
        return true;
    });
}
