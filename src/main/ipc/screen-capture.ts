import path from "path";
import { resolveWebLocale } from "../locale";
import type { PickerResult, SourceData } from "../../shared/types/ipc";
import { BrowserWindow, desktopCapturer, ipcMain, IpcMainEvent, screen, WebContentsView } from "electron";

export function registerScreenCaptureHandlers(win: BrowserWindow, view: WebContentsView): void {
    ipcMain.handle("show-source-picker", (): Promise<PickerResult | null> => {
        return openSourcePicker(win, view);
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

async function openSourcePicker(win: BrowserWindow, view: WebContentsView): Promise<PickerResult | null> {
    const locale = await resolveWebLocale(view);
    const sources = await desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 320, height: 180 },
    });

    const sourcesData: SourceData[] = sources.map((s) => ({
        id: s.id,
        name: s.name,
        thumbnail: s.thumbnail.toDataURL(),
    }));

    // Centra o picker no mesmo monitor que a janela principal
    const winBounds = win.getBounds();
    const display = screen.getDisplayMatching(winBounds);
    const { x: dx, y: dy, width: dw, height: dh } = display.workArea;
    const pickerW = 820;
    const pickerH = 560;
    const pickerX = Math.round(dx + (dw - pickerW) / 2);
    const pickerY = Math.round(dy + (dh - pickerH) / 2);

    return new Promise<PickerResult | null>((resolve) => {
        let settled = false;

        const done = (result: PickerResult | null): void => {
            if (settled) return;
            settled = true;
            ipcMain.removeListener("picker-result", resultHandler);
            resolve(result);
        };

        const iconFile = process.platform === "win32" ? "icon.ico" : process.platform === "darwin" ? "icon.icns" : "icon.png";
        const iconPath = path.join(__dirname, "..", "..", "static", "icons", iconFile);

        const pickerWin = new BrowserWindow({
            width: pickerW,
            height: pickerH,
            x: pickerX,
            y: pickerY,
            resizable: false,
            title: " ",
            icon: iconPath,
            webPreferences: {
                contextIsolation: true,
                nodeIntegration: false,
                sandbox: false,
                preload: path.join(__dirname, "..", "preload", "picker.js"),
            },
        });
        pickerWin.setMenu(null);
        pickerWin.webContents.on("page-title-updated", (e) => e.preventDefault());

        pickerWin.loadFile(path.join(__dirname, "..", "renderer", "picker", "index.html"), { query: { locale } });
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
