import { useTranslation } from "react-i18next";
import { useEffect, useMemo, useState } from "react";
import { buildLightDarkTheme, colors } from "../lib/theme";
import { AppIcon, AppIconButton, ThemeRoot } from "../components";
import { Box, Divider, Typography, createTheme, alpha, useMediaQuery } from "@mui/material";

export default function TitlebarMenu() {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(100);
    const [hasAccounts, setHasAccounts] = useState(false);
    const isDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });

    const theme = useMemo(() => createTheme(
        buildLightDarkTheme(isDark ? "dark" : "light"),
        { palette: { background: { default: isDark ? colors.bg3 : "#FFFFFF", paper: isDark ? colors.bg3 : "#FFFFFF" } } }
    ), [isDark]);

    const itemColor = isDark ? colors.text2 : "#475569";
    const itemHoverBg = isDark ? alpha(colors.text, 0.06) : "rgba(0,0,0,0.05)";
    const itemHoverColor = isDark ? colors.text : "#0F172A";

    const BTN = {
        width: 26, height: 26, color: itemColor, borderRadius: "6px",
        "&:hover": { bgcolor: isDark ? alpha(colors.text, 0.1) : "rgba(0,0,0,0.07)", color: itemHoverColor },
    } as const;

    const ROW_SX = {
        display: "flex", alignItems: "center", gap: 1, width: "100%",
        px: 1.5, py: 0.875, bgcolor: "transparent", border: "none",
        cursor: "pointer", color: itemColor,
        "&:hover": { bgcolor: itemHoverBg, color: itemHoverColor },
        transition: "background 0.1s, color 0.1s",
    } as const;

    useEffect(() => {
        window.titlebarAPI.getZoom().then(setZoom);
        window.titlebarAPI.hasSavedAccounts?.().then(setHasAccounts).catch(() => { });
        window.addEventListener("blur", () => window.close(), { once: true });
    }, []);

    const change = (delta: number) => {
        const next = Math.max(50, Math.min(200, zoom + delta));
        setZoom(next);
        window.titlebarAPI.setZoom(next);
    };

    return (
        <ThemeRoot theme={theme}>
            <Box sx={{ overflow: "hidden" }}>
                {/* Zoom */}
                <Box sx={{ display: "flex", alignItems: "center", px: 1.5, py: 0.75 }}>
                    <AppIcon name="zoomIn" sx={{ width: 16, height: 16, color: itemColor, mr: 1, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13, color: isDark ? colors.text : "#0F172A", flex: 1 }}>
                        {t("titlebar.zoom")}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", bgcolor: alpha(colors.accent, 0.12), borderRadius: "6px", px: "2px", border: `1px solid ${alpha(colors.accentL, 0.15)}` }}>
                        <AppIconButton onClick={() => change(-10)} sx={BTN}>
                            <Typography sx={{ fontSize: 16, lineHeight: 1, color: "inherit", fontWeight: 300 }}>−</Typography>
                        </AppIconButton>
                        <Typography
                            onClick={() => { setZoom(100); window.titlebarAPI.setZoom(100); }}
                            sx={{ fontSize: 11, fontWeight: 600, color: zoom === 100 ? colors.text3 : colors.accentL, minWidth: 36, textAlign: "center", cursor: "pointer", userSelect: "none", "&:hover": { color: colors.text }, transition: "color 0.15s" }}
                        >
                            {zoom}%
                        </Typography>
                        <AppIconButton onClick={() => change(10)} sx={BTN}>
                            <Typography sx={{ fontSize: 16, lineHeight: 1, color: "inherit", fontWeight: 300 }}>+</Typography>
                        </AppIconButton>
                    </Box>
                </Box>

                {hasAccounts && (
                    <>
                        <Divider sx={{ borderColor: isDark ? alpha(colors.text, 0.07) : "rgba(0,0,0,0.08)" }} />
                        <Box
                            component="button"
                            onClick={() => { window.titlebarAPI.showAccountSelect?.(); window.close(); }}
                            sx={{
                                ...ROW_SX,
                                fontFamily: "inherit",
                                fontSize: 13,
                                lineHeight: 1,
                            }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M12 12.75c1.63 0 3.07.39 4.24.9 1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73 1.17-.52 2.61-.91 4.24-.91zM4 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm1.13 1.1c-.37-.06-.74-.1-1.13-.1-.99 0-1.93.21-2.78.58C.48 14.9 0 15.62 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29zM20 13c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm4 3.43c0-.81-.48-1.53-1.22-1.85C21.93 14.21 20.99 14 20 14c-.39 0-.76.04-1.13.1.4.68.63 1.46.63 2.29V18H24v-1.57zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
                            </svg>
                            <Typography sx={{ fontSize: 13, color: "inherit", whiteSpace: "nowrap" }}>
                                {t("titlebar.switchAccount")}
                            </Typography>
                        </Box>
                    </>
                )}
            </Box>
        </ThemeRoot>
    );
}
