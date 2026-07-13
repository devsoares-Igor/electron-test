export interface SavedAccount {
    id: string;
    realm: string;
    nick: string;
    name: string;
    apiBaseUrl: string;
    lastAccess: string; // ISO 8601
    avatarColor: string;
}

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
