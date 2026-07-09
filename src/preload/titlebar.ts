import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("titlebarAPI", {
    reload: () => ipcRenderer.send("reload-view"),
});
