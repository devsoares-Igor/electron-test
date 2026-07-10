import { contextBridge, ipcRenderer } from "electron";
import type { PickerResult, SourceData } from "../shared/types/ipc";

contextBridge.exposeInMainWorld("pickerAPI", {
    onSourcesReady: (callback: (sources: SourceData[]) => void): void => {
        ipcRenderer.on("sources-ready", (_event, sources: SourceData[]) => callback(sources));
    },
    sendResult: (result: PickerResult | null): void => {
        ipcRenderer.send("picker-result", result);
    },
});
