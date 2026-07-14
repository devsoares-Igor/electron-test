import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { baseTheme, colors } from "../lib/theme";
import { AppIcon, AppIconButton, ThemeRoot } from "../components";
import { Box, Divider, Typography, createTheme } from "@mui/material";

const theme = createTheme(baseTheme, {
    palette: { background: { default: colors.bg3, paper: colors.bg3 } },
});

const BTN = {
    width: 26, height: 26, color: colors.text2, borderRadius: "6px",
    "&:hover": { bgcolor: "rgba(255,255,255,0.1)", color: colors.text },
} as const;

const ROW_SX = {
    display: "flex", alignItems: "center", gap: 1, width: "100%",
    px: 1.5, py: 0.875, bgcolor: "transparent", border: "none",
    cursor: "pointer", color: colors.text2,
    "&:hover": { bgcolor: "rgba(255,255,255,0.06)", color: colors.text },
    transition: "background 0.1s, color 0.1s",
} as const;

export default function TitlebarMenu() {
    const { t } = useTranslation();
    const [zoom, setZoom] = useState(100);
    const [hasAccounts, setHasAccounts] = useState(false);

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
                    <AppIcon name="zoomIn" sx={{ width: 16, height: 16, color: colors.text2, mr: 1, flexShrink: 0 }} />
                    <Typography sx={{ fontSize: 13, color: colors.text, flex: 1 }}>
                        {t("titlebar.zoom")}
                    </Typography>
                    <Box sx={{ display: "flex", alignItems: "center", bgcolor: `rgba(29,78,216,0.12)`, borderRadius: "6px", px: "2px", border: `1px solid rgba(96,165,250,0.15)` }}>
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
                        <Divider sx={{ borderColor: "rgba(255,255,255,0.07)" }} />
                        <Box
                            component="button"
                            onClick={() => { window.titlebarAPI.showAccountSelect?.(); window.close(); }}
                            sx={ROW_SX}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
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
