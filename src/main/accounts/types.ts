// SavedAccount é definida em shared/types/ipc.ts (fonte única) e re-exportada aqui
export type { SavedAccount } from "../../shared/types/ipc";

export interface PendingSession {
    nick: string;
    realm: string;
    password: string;
    name: string;
    apiBaseUrl: string;
}

export interface AutoLoginResult {
    success: boolean;
    error?: string;
}
