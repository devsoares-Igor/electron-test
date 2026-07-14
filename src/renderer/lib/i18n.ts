import i18n from "i18next";
import pt from "../locales/pt.json";
import en from "../locales/en.json";
import es from "../locales/es.json";
import { initReactI18next } from "react-i18next";

export type Locale = "pt" | "en" | "es";

const VALID_LOCALES: readonly Locale[] = ["pt", "en", "es"];
const detected = new URLSearchParams(location.search).get("locale") ?? "en";
const lng: Locale = (VALID_LOCALES as readonly string[]).includes(detected)
    ? (detected as Locale)
    : "en";

i18n.use(initReactI18next).init({
    resources: {
        pt: { translation: pt },
        en: { translation: en },
        es: { translation: es },
    },
    lng,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
});

export default i18n;
