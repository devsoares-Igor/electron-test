/** Conta salva localmente no dispositivo — compartilhada entre main e renderer via IPC */
export interface SavedAccount {
    id: string;
    realm: string;
    nick: string;
    name: string;
    apiBaseUrl: string;
    lastAccess: string; // ISO 8601
    avatarColor: string;
}

export interface SourceData {
    id: string;
    name: string;
    thumbnail: string;
}

export interface PickerResult {
    id: string;
    audio: boolean;
}
