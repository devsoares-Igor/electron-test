
declare const __APP_URL__: string;
declare const __IS_LOCAL__: boolean;
declare const __PRODUCT_NAME__: string;
declare const __ELECTRON_ENV__: string;
declare const __PROTOCOL_SCHEME__: string;
declare const __DEVTOOLS_PASSWORD__: string;

export type ElectronEnv = "local" | "school" | "staging" | "realms";

const ENV_MAP: Record<ElectronEnv, { appUrl: string; isLocal: boolean; scheme: string; productName: string }> = {
    local: { appUrl: "http://localhost:3000/?source=schoolwebv2.ip.tv", isLocal: true, scheme: "realms-local", productName: "Realms Local" },
    staging: { appUrl: "https://stagingwebv2.ip.tv/", isLocal: false, scheme: "realms-staging", productName: "Realms Staging" },
    school: { appUrl: "https://schoolwebv2.ip.tv/", isLocal: false, scheme: "realms-school", productName: "Realms School" },
    realms: { appUrl: "https://realmswebv2.ip.tv/", isLocal: false, scheme: "realms", productName: "Realms" },
};

export const CURRENT_ENV = (
    typeof __ELECTRON_ENV__ !== "undefined" ? __ELECTRON_ENV__ : "local"
) as ElectronEnv;
export const APP_URL =
    typeof __APP_URL__ !== "undefined" ? __APP_URL__ : ENV_MAP[CURRENT_ENV].appUrl;
export const IS_LOCAL =
    typeof __IS_LOCAL__ !== "undefined" ? __IS_LOCAL__ : ENV_MAP[CURRENT_ENV].isLocal;

export const DEVTOOLS_PASSWORD: string =
    typeof __DEVTOOLS_PASSWORD__ !== "undefined" ? __DEVTOOLS_PASSWORD__ : "realms-dev";

export const PROTOCOL_SCHEME: string =
    typeof __PROTOCOL_SCHEME__ !== "undefined" ? __PROTOCOL_SCHEME__ : ENV_MAP[CURRENT_ENV].scheme;

export const PRODUCT_NAME: string =
    typeof __PRODUCT_NAME__ !== "undefined" ? __PRODUCT_NAME__ : ENV_MAP[CURRENT_ENV].productName;

export const APP_HOST = (() => {
    try {
        return new URL(APP_URL).hostname;
    } catch {
        return "schoolwebv2.ip.tv";
    }
})();

export function realmsUrl(file: string, query?: Record<string, string>): string {
    const params = query ? "?" + new URLSearchParams(query).toString() : "";
    return `${PROTOCOL_SCHEME}://app/${file}${params}`;
}
