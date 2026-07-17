import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

const ENVS: Record<string, { appUrl: string; isLocal: boolean }> = {
    local: { appUrl: "http://localhost:3000/?source=schoolwebv2.ip.tv", isLocal: true },
    staging: { appUrl: "https://stagingwebv2.ip.tv/", isLocal: false },
    school: { appUrl: "https://schoolwebv2.ip.tv/", isLocal: false },
    realms: { appUrl: "https://realmswebv2.ip.tv/", isLocal: false },
};

const electronEnv = process.env.ELECTRON_ENV || "local";
const { appUrl, isLocal } = ENVS[electronEnv] ?? ENVS.local;
const devtoolsPassword = process.env.DEVTOOLS_PASSWORD || "realms-dev";
const sourceHost = new URL(
    appUrl.startsWith("http://localhost") ? "http://schoolwebv2.ip.tv" : appUrl,
).hostname;

const sharedDefine = {
    __ELECTRON_ENV__: JSON.stringify(electronEnv),
    __APP_URL__: JSON.stringify(appUrl),
    __IS_LOCAL__: JSON.stringify(isLocal),
    __ELECTRON_SOURCE_HOST__: JSON.stringify(sourceHost),
};

export default defineConfig({
    main: {
        define: { ...sharedDefine, __DEVTOOLS_PASSWORD__: JSON.stringify(devtoolsPassword) },
        build: { sourcemap: true, externalizeDeps: true },
    },
    preload: {
        define: sharedDefine,
        build: {
            externalizeDeps: true,
            rollupOptions: {
                input: {
                    main: resolve(__dirname, "src/preload/main.ts"),
                    titlebar: resolve(__dirname, "src/preload/titlebar.ts"),
                    picker: resolve(__dirname, "src/preload/picker.ts"),
                    "save-session": resolve(__dirname, "src/preload/save-session.ts"),
                    "clear-cache-confirm": resolve(__dirname, "src/preload/clear-cache-confirm.ts"),
                },
            },
        },
    },
    renderer: {
        plugins: [react()],
        build: {
            rollupOptions: {
                input: {
                    splash: resolve(__dirname, "src/renderer/splash/index.html"),
                    titlebar: resolve(__dirname, "src/renderer/titlebar/index.html"),
                    offline: resolve(__dirname, "src/renderer/offline/index.html"),
                    picker: resolve(__dirname, "src/renderer/picker/index.html"),
                    "titlebar-menu": resolve(__dirname, "src/renderer/titlebar-menu/index.html"),
                    "account-select": resolve(__dirname, "src/renderer/account-select/index.html"),
                    "save-session": resolve(__dirname, "src/renderer/save-session/index.html"),
                    "clear-cache-confirm": resolve(__dirname, "src/renderer/clear-cache-confirm/index.html"),
                },
            },
        },
    },
});
