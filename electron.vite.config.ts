import { resolve } from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "electron-vite";

// Cada build (env) precisa de identidade própria — protocolo de deep link e
// nome de app distintos — para poder ser instalado/aberto lado a lado com os
// outros ambientes sem que um "roube" o registro de protocolo ou o userData
// (contas salvas, cache) do outro. `realms` (produção) mantém os valores
// originais para não quebrar instalações existentes de usuários finais.
const ENVS: Record<string, { appUrl: string; isLocal: boolean; scheme: string; productName: string }> = {
    local: { appUrl: "http://localhost:3000/?source=schoolwebv2.ip.tv", isLocal: true, scheme: "realms-local", productName: "Realms Local" },
    staging: { appUrl: "https://stagingwebv2.ip.tv/", isLocal: false, scheme: "realms-staging", productName: "Realms Staging" },
    school: { appUrl: "https://schoolwebv2.ip.tv/", isLocal: false, scheme: "realms-school", productName: "Realms School" },
    realms: { appUrl: "https://realmswebv2.ip.tv/", isLocal: false, scheme: "realms", productName: "Realms" },
};

const electronEnv = process.env.ELECTRON_ENV || "local";
const { appUrl, isLocal, scheme, productName } = ENVS[electronEnv] ?? ENVS.local;
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
        define: {
            ...sharedDefine,
            __DEVTOOLS_PASSWORD__: JSON.stringify(devtoolsPassword),
            __PROTOCOL_SCHEME__: JSON.stringify(scheme),
            __PRODUCT_NAME__: JSON.stringify(productName),
        },
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
