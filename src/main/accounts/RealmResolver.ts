const REALM_API: Record<string, string> = {
    school: "https://school-api.ip.tv",
    staging: "https://staging-api.ip.tv",
    realms: "https://realms-api.ip.tv",
    iptvcorp: "https://realms-api.ip.tv",
};

export function resolveApiBaseUrl(realm: string): string {
    return REALM_API[realm.toLowerCase()] ?? `https://${realm}-api.ip.tv`;
}
