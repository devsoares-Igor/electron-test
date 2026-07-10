import { WebContents } from "electron";
import { FfmpegManager } from "./ffmpeg";
import { ChildProcess, spawn } from "child_process";

const CAPTURE_ARGS = [
    "-vn",
    "-ar", "48000",
    "-ac", "1",
    "-f", "f32le",
    "-blocksize", "16384",  // 4096 float32 samples per chunk
    "-fflags", "+nobuffer+flush_packets",
    "-flush_packets", "1",
    "-loglevel", "quiet",
    "pipe:1",
];

export class CaptureSession {
    private proc: ChildProcess | null = null;

    constructor(
        private readonly sender: WebContents,
        readonly deviceName: string,
    ) { }

    start(): void {
        this.stop();

        this.proc = spawn(
            FfmpegManager.binPath,
            ["-f", "dshow", "-i", `audio=${this.deviceName}`, ...CAPTURE_ARGS],
            { windowsHide: true },
        );

        this.proc.stdout?.on("data", (chunk: Buffer) => {
            if (!this.sender.isDestroyed()) {
                this.sender.send("dshow:chunk", chunk);
            }
        });

        this.proc.on("close", (code) => {
            if (!this.sender.isDestroyed()) {
                this.sender.send("dshow:ended", code);
            }
        });

        this.proc.on("error", (err) => {
            console.error(`[CaptureSession] "${this.deviceName}":`, err.message);
            if (!this.sender.isDestroyed()) {
                this.sender.send("dshow:error", err.message);
            }
        });
    }

    stop(): void {
        if (!this.proc) return;
        try { this.proc.kill("SIGKILL"); } catch { /* already gone */ }
        this.proc = null;
    }
}
