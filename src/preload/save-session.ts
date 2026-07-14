import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("accountsAPI", {
    list: (): Promise<unknown[]> => ipcRenderer.invoke("accounts:list"),
    count: (): Promise<number> => ipcRenderer.invoke("accounts:count"),
    remove: (id: string): Promise<void> => ipcRenderer.invoke("accounts:remove", id),
    removeAll: (): Promise<void> => ipcRenderer.invoke("accounts:remove-all"),
    login: (id: string): Promise<unknown> => ipcRenderer.invoke("accounts:login", id),
    loadApp: (): void => ipcRenderer.send("accounts:load-app"),
    savePending: (): Promise<void> => ipcRenderer.invoke("accounts:save-pending"),
    skipSave: (): Promise<void> => ipcRenderer.invoke("accounts:skip-save"),
    getPending: (): Promise<unknown> => ipcRenderer.invoke("accounts:get-pending"),
});
