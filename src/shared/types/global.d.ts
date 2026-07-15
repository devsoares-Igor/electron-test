import type { PickerResult, SourceData, SavedAccount } from "./ipc";
import type { AutoLoginResult, PendingSession } from "../../main/accounts/types";

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
            showMenu(): void;
            getZoom(): Promise<number>;
            setZoom(percent: number): void;
            showAccountSelect?(): void;
            hasSavedAccounts?(): Promise<boolean>;
        };
        accountsAPI: {
            list(): Promise<SavedAccount[]>;
            count(): Promise<number>;
            remove(id: string): Promise<void>;
            removeAll(): Promise<void>;
            login(id: string): Promise<AutoLoginResult>;
            loadApp(): void;
            loadFresh?(): void;
            savePending(): Promise<void>;
            skipSave(): Promise<void>;
            getPending(): Promise<PendingSession | null>;
        };
    }
}

export type { };

