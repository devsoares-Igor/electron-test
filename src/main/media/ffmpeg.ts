import * as path from "path";
import * as https from "https";
import { app } from "electron";
import { promisify } from "util";
import { access, mkdir } from "fs/promises";
import { exec, spawn } from "child_process";

const execAsync = promisify(exec);

type FfmpegInfo = { binPath: string; version: string };

export class FfmpegManager {
    private static _info: FfmpegInfo | null = null;

    static get binPath(): string {
        if (!this._info) throw new Error("FfmpegManager not initialized");
        return this._info.binPath;
    }

    static get isAvailable(): boolean {
        return this._info !== null;
    }

    static async initialize(): Promise<void> {
        try {
            const binPath = await this.resolve();
            const version = await this.readVersion(binPath);
            this._info = { binPath, version };
            console.log(`[FfmpegManager] ${binPath} (${version})`);
        } catch (err) {
            console.error("[FfmpegManager] Initialization failed:", err);
        }
    }

    private static async resolve(): Promise<string> {
        for (const candidate of this.candidates()) {
            if (candidate && await this.isValid(candidate)) return candidate;
        }
        return this.download();
    }

    private static candidates(): (string | null)[] {
        const userData = app.getPath("userData");
        const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
        return [
            this.fromFfmpegStatic(),
            path.join(userData, "ffmpeg", "ffmpeg.exe"),
            path.join(programFiles, "ffmpeg", "bin", "ffmpeg.exe"),
            "C:\\ffmpeg\\bin\\ffmpeg.exe",
            process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
        ];
    }

    private static fromFfmpegStatic(): string | null {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const raw = require("ffmpeg-static") as string;
            if (!raw) return null;
            return raw.replace(/app\.asar([\\/])/, "app.asar.unpacked$1");
        } catch {
            return null;
        }
    }

    private static async isValid(binPath: string): Promise<boolean> {
        try {
            await access(binPath);
            const { stdout } = await execAsync(`"${binPath}" -version`);
            return stdout.includes("ffmpeg version");
        } catch {
            return false;
        }
    }

    private static async readVersion(binPath: string): Promise<string> {
        try {
            const { stdout } = await execAsync(`"${binPath}" -version`);
            return stdout.split("\n")[0]?.trim() ?? "unknown";
        } catch {
            return "unknown";
        }
    }

    private static async download(): Promise<string> {
        if (process.platform !== "win32") {
            throw new Error("FFmpeg not found. Install it and ensure it is in PATH.");
        }

        const dir = path.join(app.getPath("userData"), "ffmpeg");
        const dest = path.join(dir, "ffmpeg.exe");

        if (await this.isValid(dest)) return dest;

        console.log("[FfmpegManager] Downloading FFmpeg…");
        await mkdir(dir, { recursive: true });

        const apiResponse = await this.fetchText("https://ffbinaries.com/api/v1/version/latest");
        const api = JSON.parse(apiResponse) as { bin: Record<string, Record<string, string>> };
        const zipUrl = api.bin["windows-64"]?.["ffmpeg"];

        if (!zipUrl) throw new Error("Could not determine FFmpeg download URL from ffbinaries.com");

        const zip = path.join(dir, "ffmpeg.zip");
        const script = [
            `Invoke-WebRequest -Uri '${zipUrl}' -OutFile '${zip}' -UseBasicParsing`,
            `Expand-Archive -Path '${zip}' -DestinationPath '${dir}' -Force`,
            `Get-ChildItem -Path '${dir}' -Filter 'ffmpeg.exe' -Recurse | Select-Object -First 1 | Move-Item -Destination '${dest}' -Force`,
            `Remove-Item -Path '${zip}' -ErrorAction SilentlyContinue`,
        ].join(";");

        await new Promise<void>((resolve, reject) => {
            const ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], {
                windowsHide: true,
            });
            ps.on("close", (code) => code === 0 ? resolve() : reject(new Error(`PowerShell exited with code ${code}`)));
            ps.on("error", reject);
        });

        if (!await this.isValid(dest)) {
            throw new Error("FFmpeg download succeeded but binary validation failed.");
        }

        console.log("[FfmpegManager] Download complete.");
        return dest;
    }

    private static fetchText(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            https.get(url, { headers: { "User-Agent": "Realms-Desktop" } }, (res) => {
                let body = "";
                res.on("data", (chunk: Buffer) => { body += chunk.toString(); });
                res.on("end", () => resolve(body));
            }).on("error", reject);
        });
    }
}
