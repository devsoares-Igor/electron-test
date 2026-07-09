import type { PickerResult, SourceData } from "./ipc";

// Each API is only available in its respective Electron window context:
//   electronAPI — main window (WebContentsView preload)
//   pickerAPI   — screen picker window (picker preload)
//   titlebarAPI — titlebar overlay (titlebar preload)

declare global {
    interface Window {
        electronAPI: {
            readonly platform: string;
            readonly isElectron: true;
            retry(): void;
            listSystemAudioDevices(): Promise<Array<{
                name: string;
                status: "OK" | "disconnected" | "unknown";
                direction: "input" | "output" | "unknown";
                nativeId?: number;
                hostApi?: string;
            }>>;
        };
        pickerAPI: {
            onSourcesReady(callback: (sources: SourceData[]) => void): void;
            sendResult(result: PickerResult | null): void;
        };
        titlebarAPI: {
            reload(): void;
        };
    }
}

export type { };

