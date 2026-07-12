import { app } from "electron";
import type { WebContentsView } from "electron";

export type Locale = "pt" | "en" | "es";

const LOCALE_MAP: Record<string, Locale> = {
    pt: "pt",
    en: "en",
    es: "es",
};

/** Locale do SO — fallback */
export function resolveLocale(): Locale {
    const raw = app.getLocale().split("-")[0].toLowerCase();
    return LOCALE_MAP[raw] ?? "en";
}

/** Lê o idioma escolhido pelo usuário dentro da web app (localStorage.i18nextLng).
 *  Se não disponível, cai no locale do SO. */
export async function resolveWebLocale(view: WebContentsView): Promise<Locale> {
    try {
        const raw: string = await view.webContents.executeJavaScript(
            "localStorage.getItem('i18nextLng') || ''",
        );
        // i18nextLng pode ser "pt-BR", "en-US", "es-419", etc.
        const prefix = raw.split("-")[0].toLowerCase();
        return LOCALE_MAP[prefix] ?? resolveLocale();
    } catch {
        return resolveLocale();
    }
}
