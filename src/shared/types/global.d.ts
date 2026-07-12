import type { PickerResult, SourceData } from "./ipc";

declare module "react" {
    interface CSSProperties {
        WebkitAppRegion?: "drag" | "no-drag";
    }
}

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
            }>>;
        };
        pickerAPI: {
            getSources(): Promise<SourceData[]>;
            sendResult(result: PickerResult | null): void;
        };
        titlebarAPI: {
            reload(): void;
            openDevtools(password: string): Promise<boolean>;
            showDevtoolsDialog(): void;
            getZoom(): Promise<number>;
            setZoom(percent: number): void;
            showMenu(): void;
        };
    }
}

export type { };

