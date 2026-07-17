import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { buildLightDarkTheme, colors } from "../lib/theme";
import { ThemeRoot, AppButton, AppIconButton } from "../components";
import { Box, Typography, useMediaQuery, GlobalStyles, alpha } from "@mui/material";

export default function SaveSession() {
    const { t } = useTranslation();
    const api = window.accountsAPI;
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
    const isDark = prefersDark;
    const theme = useMemo(() => buildLightDarkTheme(isDark ? "dark" : "light"), [isDark]);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        await api.savePending();
        setSaved(true);
        setTimeout(() => api.skipSave(), 2500);
    };

    return (
        <ThemeRoot theme={theme}>
            <GlobalStyles styles={{ "html, body": { background: "transparent !important" } }} />
            {/* Wrapper transparente com padding para não tocar as bordas da janela */}
            <Box sx={{ height: "100vh", p: "10px", boxSizing: "border-box", WebkitAppRegion: "drag" } as object}>
                <Box
                    sx={{
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                        bgcolor: "background.paper",
                        borderRadius: 3,
                        overflow: "hidden",
                        border: isDark
                            ? "1px solid rgba(255,255,255,0.10)"
                            : "1px solid rgba(0,0,0,0.09)",
                    } as object}
                >
                    {/* Close */}
                    <Box sx={{ display: "flex", justifyContent: "flex-end", px: 2, pt: 1.5, WebkitAppRegion: "no-drag" } as object}>
                        {!saved && (
                            <AppIconButton onClick={() => api.skipSave()} sx={{ width: 28, height: 28 }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                            </AppIconButton>
                        )}
                    </Box>

                    {saved ? (
                        <Box sx={{
                            flex: 1, display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            px: 3.5, pb: 4, gap: 2, userSelect: "none",
                            animation: "fadeUp 0.35s ease-out",
                            "@keyframes fadeUp": {
                                from: { opacity: 0, transform: "translateY(12px)" },
                                to: { opacity: 1, transform: "translateY(0)" },
                            },
                        } as object}>
                            <Box sx={{
                                width: 68, height: 68, borderRadius: "50%",
                                bgcolor: alpha(colors.green, 0.12),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: colors.green,
                                boxShadow: `0 0 0 1px ${alpha(colors.green, 0.3)}, 0 0 32px ${alpha(colors.green, 0.28)}`,
                                animation: "popIn 0.4s cubic-bezier(0.34,1.56,0.64,1)",
                                "@keyframes popIn": {
                                    from: { transform: "scale(0.4)", opacity: 0 },
                                    to: { transform: "scale(1)", opacity: 1 },
                                },
                            } as object}>
                                <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                            </Box>
                            <Box sx={{ textAlign: "center" }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 17, color: "text.primary", mb: 0.75 }}>
                                    {t("saveSession.savedTitle")}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                                    {t("saveSession.savedSubtitle")}
                                </Typography>
                            </Box>
                        </Box>
                    ) : (
                        /* Content normal */
                        <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", px: 3.5, pb: 3, gap: 2, WebkitAppRegion: "no-drag", userSelect: "none" } as object}>

                            {/* Ícone de sucesso */}
                            <Box sx={{
                                width: 56, height: 56, borderRadius: "50%",
                                bgcolor: alpha(colors.green, 0.12),
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: colors.green,
                                boxShadow: `0 0 0 1px ${alpha(colors.green, 0.3)}, 0 0 28px ${alpha(colors.green, 0.25)}`,
                            }}>
                                <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                                </svg>
                            </Box>

                            {/* Textos */}
                            <Box sx={{ textAlign: "center" }}>
                                <Typography sx={{ fontWeight: 700, fontSize: 16, color: "text.primary", mb: 1 }}>
                                    {t("saveSession.title")}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                                    {t("saveSession.subtitle")}
                                </Typography>
                            </Box>

                            {/* Aviso dispositivo confiável */}
                            <Box sx={{
                                display: "flex", alignItems: "flex-start", gap: 1,
                                px: 1.5, py: 1, borderRadius: 2,
                                bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)",
                                width: "100%",
                            }}>
                                <Box sx={{ color: "text.disabled", flexShrink: 0, mt: "1px" }}>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z" />
                                    </svg>
                                </Box>
                                <Typography variant="caption" color="text.disabled" sx={{ lineHeight: 1.5 }}>
                                    {t("saveSession.device")}
                                </Typography>
                            </Box>

                            {/* Botões */}
                            <Box sx={{ display: "flex", gap: 1.5, width: "100%", mt: 0.5 }}>
                                <AppButton fullWidth variant="outlined" size="large" onClick={() => api.skipSave()}>
                                    {t("saveSession.skip")}
                                </AppButton>
                                <AppButton fullWidth variant="contained" size="large" onClick={handleSave}>
                                    {t("saveSession.save")}
                                </AppButton>
                            </Box>
                        </Box>
                    )}
                </Box>
            </Box>
        </ThemeRoot>
    );
}
