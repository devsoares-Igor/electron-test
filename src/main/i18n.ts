import { app } from "electron";

export type AppLocale = "pt" | "en" | "es";

const LOCALE_MAP: Record<string, AppLocale> = {
    pt: "pt",
    en: "en",
    es: "es",
};

export function resolveLocale(): AppLocale {
    const raw = app.getLocale().split("-")[0].toLowerCase();
    return LOCALE_MAP[raw] ?? "en";
}
