import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("titlebarAPI", {
    reload: () => ipcRenderer.send("reload-view"),
    openDevtools: (password: string) => ipcRenderer.invoke("open-devtools", password),
    showDevtoolsDialog: () => ipcRenderer.send("show-devtools-dialog"),
    getZoom: (): Promise<number> => ipcRenderer.invoke("get-zoom"),
    setZoom: (percent: number): void => ipcRenderer.send("set-zoom", percent),
    showMenu: (): void => ipcRenderer.send("show-titlebar-menu"),
});
