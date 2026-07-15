import { app } from "electron";
import type { WebContentsView } from "electron";

export type Locale = "pt" | "en" | "es";

const LOCALE_MAP: Record<string, Locale> = {
    pt: "pt",
    en: "en",
    es: "es",
};

/** Locale detectado pelo OS — usado como fallback */
export function resolveLocale(): Locale {
    const raw = app.getLocale().split("-")[0].toLowerCase();
    return LOCALE_MAP[raw] ?? "en";
}

/** Cache do locale da web app — atualizado por resolveWebLocale() a cada navegação */
let _cachedWebLocale: Locale | null = null;

export function getCachedWebLocale(): Locale {
    return _cachedWebLocale ?? resolveLocale();
}

/** Lê localStorage.i18nextLng da web app e atualiza o cache interno */
export async function resolveWebLocale(view: WebContentsView): Promise<Locale> {
    try {
        const raw: string = await view.webContents.executeJavaScript(
            "localStorage.getItem('i18nextLng') || ''",
        );
        // raw vazio = página file:// sem i18n (account-select, offline, etc.) → usa cache
        if (!raw) return getCachedWebLocale();
        const prefix = raw.split("-")[0].toLowerCase();
        const resolved = LOCALE_MAP[prefix] ?? resolveLocale();
        _cachedWebLocale = resolved;
        return resolved;
    } catch {
        return getCachedWebLocale();
    }
}
