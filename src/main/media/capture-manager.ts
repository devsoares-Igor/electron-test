import { WebContents } from "electron";
import { CaptureSession } from "./capture-session";

export class CaptureManager {
    private static readonly sessions = new Map<number, CaptureSession>();

    static start(sender: WebContents, deviceName: string): void {
        this.stop(sender.id);
        const session = new CaptureSession(sender, deviceName);
        this.sessions.set(sender.id, session);
        session.start();
        sender.once("destroyed", () => this.stop(sender.id));
    }

    static stop(webContentsId: number): void {
        const session = this.sessions.get(webContentsId);
        if (!session) return;
        session.stop();
        this.sessions.delete(webContentsId);
    }

    static stopAll(): void {
        for (const id of this.sessions.keys()) this.stop(id);
    }
}
