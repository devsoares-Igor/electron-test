import { safeStorage } from "electron";

export class CredentialManager {
    static encrypt(plaintext: string): string {
        if (!safeStorage.isEncryptionAvailable()) {
            return Buffer.from(plaintext, "utf-8").toString("base64");
        }
        return safeStorage.encryptString(plaintext).toString("base64");
    }

    static decrypt(encrypted: string): string {
        if (!safeStorage.isEncryptionAvailable()) {
            return Buffer.from(encrypted, "base64").toString("utf-8");
        }
        return safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    }
}
