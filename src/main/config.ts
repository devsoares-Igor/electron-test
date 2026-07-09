/**
 * Environment configuration — baked at build time via esbuild define.
 * Each env maps to its own URL and behavior.
 */

declare const __ELECTRON_ENV__: string;
declare const __APP_URL__: string;
declare const __IS_LOCAL__: boolean;

export type ElectronEnv = "local" | "school" | "staging" | "realms";

const ENV_MAP: Record<ElectronEnv, { appUrl: string; isLocal: boolean }> = {
    local: { appUrl: "http://localhost:3000/?source=schoolwebv2.ip.tv", isLocal: true },
    school: { appUrl: "https://schoolwebv2.ip.tv/", isLocal: false },
    staging: { appUrl: "https://stagingwebv2.ip.tv/", isLocal: false },
    realms: { appUrl: "https://realmswebv2.ip.tv/", isLocal: false },
};

export const CURRENT_ENV = (
    typeof __ELECTRON_ENV__ !== "undefined" ? __ELECTRON_ENV__ : "local"
) as ElectronEnv;
export const APP_URL =
    typeof __APP_URL__ !== "undefined" ? __APP_URL__ : ENV_MAP[CURRENT_ENV].appUrl;
export const IS_LOCAL =
    typeof __IS_LOCAL__ !== "undefined" ? __IS_LOCAL__ : ENV_MAP[CURRENT_ENV].isLocal;

/** Base hostname derived from APP_URL (e.g. "schoolwebv2.ip.tv") */
export const APP_HOST = (() => {
    try {
        return new URL(APP_URL).hostname;
    } catch {
        return "schoolwebv2.ip.tv";
    }
})();
