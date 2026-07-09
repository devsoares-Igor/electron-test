import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("titlebarAPI", {
    reload: () => ipcRenderer.send("reload-view"),
    openDevtools: (password: string) => ipcRenderer.invoke("open-devtools", password),
    showDevtoolsDialog: () => ipcRenderer.send("show-devtools-dialog"),
});
