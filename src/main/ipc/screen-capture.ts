import { BrowserWindow, desktopCapturer, ipcMain, IpcMainEvent } from "electron";
import path from "path";
import type { PickerResult, SourceData } from "../../shared/types/ipc";

export function registerScreenCaptureHandlers(): void {
    ipcMain.handle("show-source-picker", (): Promise<PickerResult | null> => {
        return openSourcePicker();
    });

    ipcMain.handle("get-screen-sources", async (): Promise<SourceData[]> => {
        const sources = await desktopCapturer.getSources({
            types: ["screen", "window"],
            thumbnailSize: { width: 320, height: 180 },
        });
        return sources.map((s) => ({
            id: s.id,
            name: s.name,
            thumbnail: s.thumbnail.toDataURL(),
        }));
    });
}

async function openSourcePicker(): Promise<PickerResult | null> {
    const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
    });

    const sourcesData: SourceData[] = sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
    }));

    return new Promise<PickerResult | null>((resolve) => {
        let settled = false;

        const done = (result: PickerResult | null): void => {
            if (settled) return;
            settled = true;
            ipcMain.removeListener("picker-result", resultHandler);
            resolve(result);
        };

        const pickerWin = new BrowserWindow({
            width: 820,
            height: 560,
            resizable: false,
            title: "Compartilhar tela",
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                preload: path.join(__dirname, "picker-preload.js"),
            },
        });

        pickerWin.loadFile(path.join(__dirname, "picker.html"));
        pickerWin.setMenu(null);

        pickerWin.webContents.once("did-finish-load", () => {
            pickerWin.webContents.send("sources-ready", sourcesData);
        });

        // done() is called before destroy() to guarantee that the Promise resolves
        // with the user's selection before the "closed" event fires with null.
        const resultHandler = (_event: IpcMainEvent, result: PickerResult | null): void => {
            done(result ?? null);
            pickerWin.destroy();
        };

        ipcMain.once("picker-result", resultHandler);
        pickerWin.on("closed", () => done(null));
    });
}
