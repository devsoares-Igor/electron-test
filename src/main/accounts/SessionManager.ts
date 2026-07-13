import { app } from "electron";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import path from "path";
import type { SavedAccount } from "./types";
import { CredentialManager } from "./CredentialManager";

interface StoredEntry {
    account: SavedAccount;
    encryptedPassword: string;
}

const MAX_ACCOUNTS = 10;

const AVATAR_COLORS = [
    "#5865f2", "#43b581", "#eb459e",
    "#faa61a", "#ed4245", "#7289da",
    "#99aab5", "#3498db", "#e67e22",
];

function avatarColor(nick: string): string {
    let n = 0;
    for (let i = 0; i < nick.length; i++) n += nick.charCodeAt(i);
    return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export class SessionManager {
    private static get filePath(): string {
        return path.join(app.getPath("userData"), "saved-accounts.json");
    }

    private static read(): StoredEntry[] {
        try {
            if (!existsSync(this.filePath)) return [];
            return JSON.parse(readFileSync(this.filePath, "utf-8")) as StoredEntry[];
        } catch { return []; }
    }

    private static write(entries: StoredEntry[]): void {
        writeFileSync(this.filePath, JSON.stringify(entries, null, 2), "utf-8");
    }

    static list(): SavedAccount[] {
        return this.read()
            .sort((a, b) => new Date(b.account.lastAccess).getTime() - new Date(a.account.lastAccess).getTime())
            .map(e => e.account);
    }

    static count(): number {
        return this.read().length;
    }

    static save(data: Omit<SavedAccount, "id" | "avatarColor">, password: string): void {
        const entries = this.read().filter(
            e => !(e.account.nick === data.nick && e.account.realm === data.realm),
        );
        const account: SavedAccount = {
            ...data,
            id: randomUUID(),
            avatarColor: avatarColor(data.nick),
        };
        entries.unshift({ account, encryptedPassword: CredentialManager.encrypt(password) });
        this.write(entries.slice(0, MAX_ACCOUNTS));
    }

    static getById(id: string): SavedAccount | null {
        return this.read().find(e => e.account.id === id)?.account ?? null;
    }

    static getPassword(id: string): string | null {
        const entry = this.read().find(e => e.account.id === id);
        if (!entry) return null;
        try { return CredentialManager.decrypt(entry.encryptedPassword); } catch { return null; }
    }

    static remove(id: string): void {
        this.write(this.read().filter(e => e.account.id !== id));
    }

    static removeAll(): void {
        this.write([]);
    }

    static updateLastAccess(id: string): void {
        const entries = this.read();
        const entry = entries.find(e => e.account.id === id);
        if (entry) {
            entry.account.lastAccess = new Date().toISOString();
            this.write(entries);
        }
    }
}
