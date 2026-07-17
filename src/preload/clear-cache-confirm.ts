import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("clearCacheAPI", {
    confirm: (): Promise<void> => ipcRenderer.invoke("clear-cache:confirm"),
    cancel: (): Promise<void> => ipcRenderer.invoke("clear-cache:cancel"),
});
