import { ipcRenderer } from "electron";

export const DSHOW_CHANNELS = {
    start: "dshow:start",
    stop: "dshow:stop",
    chunk: "dshow:chunk",
    ended: "dshow:ended",
    error: "dshow:error",
} as const;

export const DSHOW_DEVICE_PREFIX = "dshow:";

// ─── State ───────────────────────────────────────────────────────────────────

let captureCtx: AudioContext | null = null;
let mixBus: GainNode | null = null;
let chunkListener: ((e: Electron.IpcRendererEvent, buf: Buffer) => void) | null = null;
let currentDevice: string | null = null;
let nextStartTime = 0;
let audioReadyPromise: Promise<void> | null = null;
let keepAliveTimer: ReturnType<typeof setTimeout> | null = null;
let switchTimer: ReturnType<typeof setTimeout> | null = null;

// Tracks every active MediaStreamDestinationNode so we can disconnect them all on stop.
const activeDestinations = new Set<MediaStreamAudioDestinationNode>();

const BUFFER_AHEAD_SECONDS = 0.12;
const KEEP_ALIVE_MS = 5_000;
const SWITCH_STOP_DELAY_MS = 2_000;

// ─── Logging ─────────────────────────────────────────────────────────────────

function logState(event: string, extra = ""): void {
    const ctx = captureCtx?.state ?? "null";
    const dest = activeDestinations.size;
    const dev = currentDevice ?? "null";
    console.log(
        `[dshow:${event}] device="${dev}" destinations=${dest} ctx=${ctx} ffmpeg=${chunkListener !== null}${extra ? " " + extra : ""}`,
    );
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getOrCreateContext(): { ctx: AudioContext; mix: GainNode } {
    if (!captureCtx || captureCtx.state === "closed") {
        captureCtx = new AudioContext({ sampleRate: 48000 });
        mixBus = captureCtx.createGain();
        mixBus.gain.value = 1;
        nextStartTime = 0;
    }
    return { ctx: captureCtx, mix: mixBus! };
}

function scheduleChunk(mix: GainNode, ctx: AudioContext, buf: Buffer): void {
    const float32 = new Float32Array(
        buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    );
    const audioBuffer = ctx.createBuffer(1, float32.length, 48000);
    audioBuffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(mix);

    if (nextStartTime < ctx.currentTime) nextStartTime = ctx.currentTime + BUFFER_AHEAD_SECONDS;
    source.start(nextStartTime);
    nextStartTime += audioBuffer.duration;
}

function stopCapture(): void {
    logState("stopCapture");

    if (keepAliveTimer) { clearTimeout(keepAliveTimer); keepAliveTimer = null; }
    if (switchTimer) { clearTimeout(switchTimer); switchTimer = null; }

    // Stop FFmpeg — no more audio chunks sent to the mix bus.
    if (chunkListener) {
        ipcRenderer.removeListener(DSHOW_CHANNELS.chunk, chunkListener);
        chunkListener = null;
    }
    ipcRenderer.invoke(DSHOW_CHANNELS.stop).catch(() => undefined);

    currentDevice = null;
    audioReadyPromise = null;
    nextStartTime = 0;

    // IMPORTANT: do NOT close the AudioContext or disconnect destinations.
    // Closing the context transitions MediaStreamTracks to "ended" state, which
    // causes Janus to detect the ended track and call getUserMedia again for vMix —
    // creating a restart loop. Instead, release our module-level references so the
    // next session gets a fresh context, while the old one keeps running silently.
    // The GainNode will output silence, keeping Janus tracks "live" and preventing
    // any auto-restart.
    activeDestinations.clear();
    captureCtx = null;
    mixBus = null;
}

function onDestinationEnded(dest: MediaStreamAudioDestinationNode, mix: GainNode): void {
    try { mix.disconnect(dest); } catch { /* already disconnected */ }
    const wasTracked = activeDestinations.delete(dest);
    logState("destEnded");

    // Orphaned destination (from a previous session already stopped) — ignore.
    if (!wasTracked) return;

    if (activeDestinations.size > 0) return;

    if (keepAliveTimer) clearTimeout(keepAliveTimer);
    keepAliveTimer = setTimeout(stopCapture, KEEP_ALIVE_MS);
}

function attachDestination(ctx: AudioContext, mix: GainNode): MediaStream {
    const dest = ctx.createMediaStreamDestination();
    mix.connect(dest);
    activeDestinations.add(dest);
    dest.stream.getAudioTracks().forEach(t =>
        t.addEventListener("ended", () => onDestinationEnded(dest, mix)),
    );
    logState("destAttached");
    return dest.stream;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function createDShowStream(deviceName: string): Promise<MediaStream> {
    logState("createStream:enter", `request="${deviceName}"`);

    if (keepAliveTimer) { clearTimeout(keepAliveTimer); keepAliveTimer = null; }
    // switchTimer is NOT cancelled here — it is only cancelled when switching to a
    // DIFFERENT device. If the same device is re-requested during a teardown window
    // (app re-init after user switched away), the timer continues and vMix stops.

    const { ctx, mix } = getOrCreateContext();
    if (ctx.state !== "running") await ctx.resume();

    // Same device already running.
    if (currentDevice === deviceName && chunkListener) {
        if (switchTimer) {
            // Teardown is pending (user switched away). Do NOT cancel — let FFmpeg stop.
            // The stream returned here will go silent after the timer fires.
            logState("createStream:reuse-teardown-pending");
        } else {
            logState("createStream:reuse");
        }
        if (audioReadyPromise) await audioReadyPromise;
        return attachDestination(ctx, mix);
    }

    // Different device — cancel any pending teardown and switch.
    if (switchTimer) { clearTimeout(switchTimer); switchTimer = null; }

    // Stop existing capture first.
    if (chunkListener) {
        logState("createStream:switchDevice", `new="${deviceName}"`);
        ipcRenderer.removeListener(DSHOW_CHANNELS.chunk, chunkListener);
        chunkListener = null;
        activeDestinations.clear();
        await ipcRenderer.invoke(DSHOW_CHANNELS.stop).catch(() => undefined);
        await new Promise<void>(r => setTimeout(r, 350));
    }

    currentDevice = deviceName;
    nextStartTime = 0;

    let resolveReady!: () => void;
    audioReadyPromise = new Promise<void>(r => { resolveReady = r; });

    let firstChunk = true;
    const listener = (_e: Electron.IpcRendererEvent, buf: Buffer): void => {
        if (ctx.state === "closed") return;
        if (firstChunk) {
            firstChunk = false;
            resolveReady();
            logState("createStream:firstChunk");
        }
        scheduleChunk(mix, ctx, buf);
    };

    chunkListener = listener;
    ipcRenderer.on(DSHOW_CHANNELS.chunk, listener);

    logState("createStream:starting");
    const started = await ipcRenderer.invoke(DSHOW_CHANNELS.start, deviceName) as boolean;
    if (!started) {
        ipcRenderer.removeListener(DSHOW_CHANNELS.chunk, listener);
        chunkListener = null; currentDevice = null;
        throw new DOMException("FFmpeg unavailable. Reinstall the app.", "NotReadableError");
    }

    const audioArrived = await new Promise<boolean>(resolve => {
        const timeout = setTimeout(() => resolve(false), 4_000);
        ipcRenderer.once(DSHOW_CHANNELS.chunk, () => { clearTimeout(timeout); resolve(true); });
        ipcRenderer.once(DSHOW_CHANNELS.error, () => { clearTimeout(timeout); resolve(false); });
    });

    if (!audioArrived) {
        ipcRenderer.removeListener(DSHOW_CHANNELS.chunk, listener);
        chunkListener = null; currentDevice = null;
        await ipcRenderer.invoke(DSHOW_CHANNELS.stop).catch(() => undefined);
        throw new DOMException(`"${deviceName}" produced no audio. Ensure vMix is active.`, "NotReadableError");
    }

    const onEnd = (): void => {
        if (chunkListener === listener) {
            ipcRenderer.removeListener(DSHOW_CHANNELS.chunk, listener);
            chunkListener = null; currentDevice = null;
            logState("createStream:ffmpegEnded");
        }
    };
    ipcRenderer.once(DSHOW_CHANNELS.ended, onEnd);
    ipcRenderer.once(DSHOW_CHANNELS.error, onEnd);

    logState("createStream:ready");
    return attachDestination(ctx, mix);
}

export function scheduleCaptureTeardown(): void {
    if (!chunkListener) return;
    logState("teardown:scheduled", `delay=${SWITCH_STOP_DELAY_MS}ms`);
    if (switchTimer) clearTimeout(switchTimer);
    switchTimer = setTimeout(stopCapture, SWITCH_STOP_DELAY_MS);
}

export function stopCaptureImmediate(): void {
    if (!chunkListener && !switchTimer) return;
    logState("teardown:immediate");
    stopCapture();
}
