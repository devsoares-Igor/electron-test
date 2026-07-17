import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ThemeRoot, AppButton } from "../components";
import { buildLightDarkTheme, colors } from "../lib/theme";
import { Box, Typography, useMediaQuery, GlobalStyles, alpha } from "@mui/material";

export default function ClearCacheConfirm() {
    const { t } = useTranslation();
    const api = window.clearCacheAPI;
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
    const isDark = prefersDark;
    const theme = buildLightDarkTheme(isDark ? "dark" : "light");
    const [busy, setBusy] = useState(false);
    const loggedOut = new URLSearchParams(location.search).get("loggedOut") === "1";

    const handleConfirm = async () => {
        setBusy(true);
        await api.confirm();
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
                        alignItems: "center",
                        justifyContent: "center",
                        bgcolor: "background.paper",
                        borderRadius: 3,
                        overflow: "hidden",
                        border: isDark
                            ? "1px solid rgba(255,255,255,0.10)"
                            : "1px solid rgba(0,0,0,0.09)",
                        px: 3.5, pb: 3, pt: 3.5, gap: 2,
                        WebkitAppRegion: "no-drag",
                        userSelect: "none",
                    } as object}
                >
                    {/* Ícone de aviso */}
                    <Box sx={{
                        width: 56, height: 56, borderRadius: "50%",
                        bgcolor: alpha(colors.danger, 0.12),
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: colors.danger,
                        flexShrink: 0,
                        boxShadow: `0 0 0 1px ${alpha(colors.danger, 0.3)}, 0 0 28px ${alpha(colors.danger, 0.25)}`,
                    }}>
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
                        </svg>
                    </Box>

                    {/* Textos */}
                    <Box sx={{ textAlign: "center" }}>
                        <Typography sx={{ fontWeight: 700, fontSize: 16, color: "text.primary", mb: 1 }}>
                            {t("clearCache.title")}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>
                            {t(loggedOut ? "clearCache.messageLoggedOut" : "clearCache.message")}
                        </Typography>
                    </Box>

                    {/* Botões */}
                    <Box sx={{ display: "flex", gap: 1.5, width: "100%", mt: 0.5 }}>
                        <AppButton fullWidth variant="outlined" size="large" disabled={busy} onClick={() => api.cancel()}>
                            {t("clearCache.cancel")}
                        </AppButton>
                        <AppButton fullWidth variant="contained" color="error" size="large" disabled={busy} onClick={handleConfirm}>
                            {t(loggedOut ? "clearCache.confirmLoggedOut" : "clearCache.confirm")}
                        </AppButton>
                    </Box>
                </Box>
            </Box>
        </ThemeRoot>
    );
}
