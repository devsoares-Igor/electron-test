import { createTheme } from "@mui/material";
import { colors, lightColors } from "../../shared/colors";

export { colors, lightColors };

export const baseTheme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: colors.accent, light: colors.accentL, dark: colors.accentH },
        success: { main: colors.green },
        error: { main: colors.danger },
        background: { default: colors.bg, paper: colors.bg2 },
        text: {
            primary: colors.text,
            secondary: colors.text2,
            disabled: colors.text3,
        },
        divider: "rgba(255,255,255,0.07)",
    },
    shape: { borderRadius: 12 },
    typography: {
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
        h4: { fontFamily: "'Hanken Grotesk', 'Inter', system-ui, sans-serif", fontWeight: 700 },
        h5: { fontFamily: "'Hanken Grotesk', 'Inter', system-ui, sans-serif", fontWeight: 700 },
        h6: { fontFamily: "'Hanken Grotesk', 'Inter', system-ui, sans-serif", fontWeight: 600 },
    },
    components: {
        MuiPaper: {
            styleOverrides: {
                root: {
                    backgroundImage: "none",
                    border: "1px solid rgba(255,255,255,0.06)",
                },
            },
        },
        MuiButton: {
            styleOverrides: {
                root: {
                    textTransform: "none",
                    fontWeight: 500,
                    borderRadius: 8,
                    fontSize: "0.8125rem", // 13px
                    letterSpacing: "0.01em",
                },
                contained: {
                    fontWeight: 600,
                    boxShadow: "none",
                    "&:hover": { boxShadow: "none" },
                },
                outlined: {
                    borderColor: "rgba(255,255,255,0.15)",
                    "&:hover": {
                        borderColor: colors.accentL,
                        backgroundColor: "rgba(29,78,216,0.06)",
                    },
                },
                text: {
                    "&:hover": {
                        backgroundColor: "rgba(255,255,255,0.05)",
                    },
                },
            },
        },
        MuiDialog: {
            styleOverrides: {
                paper: { border: "1px solid rgba(255,255,255,0.08)", backgroundImage: "none" },
            },
        },
        MuiInputBase: {
            styleOverrides: {
                root: { backgroundColor: colors.bg3 },
            },
        },
        MuiOutlinedInput: {
            styleOverrides: {
                notchedOutline: { borderColor: "rgba(255,255,255,0.1)" },
            },
        },
        MuiDivider: {
            styleOverrides: {
                root: { borderColor: "rgba(255,255,255,0.07)" },
            },
        },
    },
});

/**
 * Estende o baseTheme com suporte a light/dark mode.
 * Usado por renderers que suportam os dois modos (account-select, save-session).
 */
export function buildLightDarkTheme(mode: "dark" | "light") {
    const isDark = mode === "dark";
    return createTheme(baseTheme, {
        palette: {
            mode,
            ...(isDark ? {} : {
                background: { default: lightColors.bg, paper: lightColors.bg2 },
                text: { primary: lightColors.text, secondary: lightColors.text2, disabled: colors.text2 },
                divider: "rgba(0,0,0,0.08)",
            }),
        },
        ...(isDark ? {} : {
            components: {
                MuiButton: {
                    styleOverrides: {
                        outlined: { borderColor: "rgba(0,0,0,0.20)" },
                    },
                },
                MuiPaper: {
                    styleOverrides: {
                        root: { backgroundImage: "none", border: "1px solid rgba(0,0,0,0.08)" },
                    },
                },
                MuiInputBase: {
                    styleOverrides: {
                        root: { backgroundColor: "rgba(0,0,0,0.05)" },
                    },
                },
                MuiOutlinedInput: {
                    styleOverrides: {
                        notchedOutline: { borderColor: "rgba(0,0,0,0.20)" },
                    },
                },
            },
        }),
    });
}
