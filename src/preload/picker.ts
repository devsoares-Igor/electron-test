import { contextBridge, ipcRenderer } from "electron";
import type { PickerResult, SourceData } from "../shared/types/ipc";

contextBridge.exposeInMainWorld("pickerAPI", {
    getSources: (): Promise<SourceData[]> =>
        ipcRenderer.invoke("get-screen-sources") as Promise<SourceData[]>,
    sendResult: (result: PickerResult | null): void => {
        ipcRenderer.send("picker-result", result);
    },
});
