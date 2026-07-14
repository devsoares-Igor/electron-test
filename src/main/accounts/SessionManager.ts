import path from "path";
import { app } from "electron";
import { randomUUID } from "crypto";
import type { SavedAccount } from "./types";
import { CredentialManager } from "./CredentialManager";
import { readFileSync, writeFileSync, existsSync } from "fs";

interface StoredEntry {
    account: SavedAccount;
    encryptedPassword: string;
}

const MAX_ACCOUNTS = 10;

// Mesmo algoritmo do webconference/src/model/utils.ts
const GROUP_COLOR = [
    "#C5C5C5", "#00FFFF", "#078E2E", "#FE0000", "#FF07FE", "#FF5A00",
    "#FF8EC4", "#9A7F4F", "#2C5C8E", "#00C5FF", "#8EC5C6",
    "#2D5B5C", "#5BFEC4", "#8FC52D", "#FF5A2E", "#994B74",
    "#C27496", "#FF8F5B", "#FFC48E", "#FF5B5B", "#FF005B",
    "#8E5BC4", "#C47146", "#914807", "#AF9413", "#E7BE2E",
];

function hashCode(str: string): number {
    const lstr = str.length;
    if (lstr === 0) return 0;
    if (lstr === 1) {
        const c = str.charCodeAt(0);
        return c + c * 7;
    }
    const c0 = str.charCodeAt(0);
    const c1 = str.charCodeAt(1);
    const c2 = str.charCodeAt(lstr - 1);
    const c3 = str.charCodeAt(lstr - 2);
    return c0 + c1 * 3 + c2 * 7 + c3 * 11;
}

function avatarColor(nick: string): string {
    return GROUP_COLOR[Math.abs(hashCode(nick)) % GROUP_COLOR.length];
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
