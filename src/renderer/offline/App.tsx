import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { colors, buildLightDarkTheme } from "../lib/theme";
import { AppButton, AppIcon, ThemeRoot } from "../components";
import { Box, Paper, Typography, alpha, useMediaQuery } from "@mui/material";

export default function Offline() {
    const { t } = useTranslation();
    const reason = new URLSearchParams(location.search).get("reason");
    const isDev = reason === "devserver";
    const isDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
    const theme = useMemo(() => buildLightDarkTheme(isDark ? "dark" : "light"), [isDark]);

    return (
        <ThemeRoot theme={theme}>
            {/* Glow ambiente de fundo — mesmo tratamento do account-select */}
            <Box aria-hidden sx={{
                position: "fixed", inset: 0, overflow: "hidden",
                pointerEvents: "none", zIndex: 0,
                "&::before, &::after": { content: '""', position: "absolute", borderRadius: "50%", filter: "blur(120px)" },
                "&::before": { width: 420, height: 420, top: "-15%", left: "-12%", background: isDark ? alpha(colors.accent, 0.18) : alpha(colors.accent, 0.09) },
                "&::after": { width: 380, height: 380, bottom: "-15%", right: "-10%", background: isDark ? alpha(colors.green, 0.10) : alpha(colors.green, 0.06) },
            }} />

            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", position: "relative" }}>
                <Paper
                    elevation={8}
                    sx={{ p: "48px 40px 40px", textAlign: "center", maxWidth: 400, width: "90%", borderRadius: 3 }}
                >
                    <Box
                        sx={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 72,
                            height: 72,
                            borderRadius: "50%",
                            bgcolor: isDark ? alpha(colors.accentL, 0.15) : alpha(colors.accent, 0.10),
                            mb: 3,
                            color: "primary.main",
                            boxShadow: isDark
                                ? `0 0 0 1px ${alpha(colors.accentL, 0.25)}, 0 0 32px ${alpha(colors.accent, 0.3)}`
                                : `0 0 0 1px ${alpha(colors.accent, 0.18)}, 0 8px 28px ${alpha(colors.accent, 0.15)}`,
                        }}
                    >
                        <AppIcon name={isDev ? "devserver" : "offline"} sx={{ fontSize: 36 }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 500, mb: 1.25 }}>
                        {t(isDev ? "offline.devTitle" : "offline.offlineTitle")}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                        {t(isDev ? "offline.devSubtitle" : "offline.offlineSubtitle")}
                    </Typography>
                    <AppButton onClick={() => window.electronAPI?.retry()} sx={{ px: 3 }}>
                        {t("offline.retry")}
                    </AppButton>
                    <Box sx={{ borderTop: "1px solid", borderColor: "divider", mt: 4, pt: 2.5 }}>
                        <Typography variant="caption" color="text.disabled">
                            {t(isDev ? "offline.devCaption" : "offline.offlineCaption")}
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </ThemeRoot>
    );
}
