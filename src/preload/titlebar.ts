import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("titlebarAPI", {
    reload: () => ipcRenderer.send("reload-view"),
    showMenu: (): void => ipcRenderer.send("show-titlebar-menu"),
    getZoom: (): Promise<number> => ipcRenderer.invoke("get-zoom"),
    setZoom: (percent: number): void => ipcRenderer.send("set-zoom", percent),
    showAccountSelect: (): void => ipcRenderer.send("accounts:show-select"),
    hasSavedAccounts: (): Promise<boolean> =>
        ipcRenderer.invoke("accounts:count").then((n: unknown) => (n as number) > 0),
});
