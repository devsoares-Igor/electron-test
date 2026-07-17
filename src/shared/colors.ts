/**
 * Paleta "Professional Dark Desktop" — usada em todo o Electron
 * (renderers React via theme.ts + botão flutuante do preload).
 *
 * Módulo isolado (sem dependência de @mui/material) para poder ser
 * importado também pelo preload sem carregar o MUI no bundle.
 */
export const colors = {
    // Backgrounds
    bg: "#0F172A",   // fundo principal
    bg2: "#1E293B",   // cards / papers
    bg3: "#334155",   // hover / inputs
    bg4: "#475569",   // bordas / divisores

    // Texto
    text: "#F1F5F9",
    text2: "#94A3B8",
    text3: "#64748B",

    // Marca
    accent: "#1D4ED8",   // primary
    accentL: "#60A5FA",   // primary light
    accentH: "#1E40AF",   // primary dark
    green: "#10B981",   // tertiary / sucesso
    danger: "#ed4245",   // erro / ações destrutivas
} as const;

/**
 * Tokens específicos do tema claro sem equivalente 1:1 em `colors`
 * (usados por buildLightDarkTheme + main/window.ts + renderers adaptativos).
 */
export const lightColors = {
    bg: "#EEF2F7",    // fundo principal (claro)
    bg2: "#FFFFFF",   // cards / papers / chrome nativo (claro)
    text: "#0F172A",  // texto primário (claro)
    text2: "#475569", // texto secundário (claro)
} as const;

/** Converte uma cor hex ("#RRGGBB") em `rgba(r,g,b,alpha)`. */
export function withAlpha(hex: string, alpha: number): string {
    const n = parseInt(hex.replace("#", ""), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return `rgba(${r},${g},${b},${alpha})`;
}
