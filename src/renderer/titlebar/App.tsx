import {
    Box,
    alpha,
    Tooltip,
    Typography,
    createTheme,
    useMediaQuery,
} from "@mui/material";
import { useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { buildLightDarkTheme, colors } from "../lib/theme";
import { AppIcon, AppIconButton, ThemeRoot } from "../components";

export default function Titlebar() {
    const { t } = useTranslation();
    const isDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });

    const theme = useMemo(() => createTheme(
        buildLightDarkTheme(isDark ? "dark" : "light"),
        { palette: { background: { default: isDark ? colors.bg2 : "#FFFFFF", paper: isDark ? colors.bg2 : "#FFFFFF" } } }
    ), [isDark]);

    const btnColor = isDark ? colors.text2 : "#64748B";
    const btnHoverBg = isDark ? alpha(colors.text, 0.10) : "rgba(0,0,0,0.06)";
    const btnHoverColor = isDark ? colors.text : "#0F172A";
    const btnActiveBg = isDark ? alpha(colors.text, 0.16) : "rgba(0,0,0,0.10)";
    const BTN_SX = {
        width: 32, height: 32, color: btnColor, borderRadius: "6px", flexShrink: 0,
        "&:hover": { bgcolor: btnHoverBg, color: btnHoverColor },
        "&:active": { bgcolor: btnActiveBg },
        "&:focus-visible": { boxShadow: `0 0 0 2px ${alpha(colors.accentL, 0.6)}` },
    } as const;

    const handleReload = () => {
        window.titlebarAPI.reload();
    };

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === "F5") handleReload(); };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    return (
        <ThemeRoot theme={theme}>
            <Box
                sx={{
                    height: "100%",
                    bgcolor: isDark ? colors.bg2 : "#FFFFFF",
                    WebkitAppRegion: "drag",
                    display: "flex",
                    alignItems: "center",
                    px: "8px",
                    pr: "148px",
                } as object}
            >
                {/* Esquerda: ⋮ menu */}
                <Tooltip title="Menu" placement="bottom">
                    <AppIconButton
                        onClick={() => window.titlebarAPI.showMenu()}
                        sx={{ ...BTN_SX, WebkitAppRegion: "no-drag" } as object}
                        aria-label="Menu"
                    >
                        <Typography sx={{ fontSize: 18, lineHeight: 1, color: "inherit", letterSpacing: "1px", fontWeight: 700 }}>⋮</Typography>
                    </AppIconButton>
                </Tooltip>

                {/* Direita: reload */}
                <Box sx={{ ml: "auto", WebkitAppRegion: "no-drag" } as object}>
                    <Tooltip title={t("titlebar.reload")} placement="bottom">
                        <AppIconButton onClick={handleReload} sx={BTN_SX} aria-label={t("titlebar.reload")}>
                            <AppIcon name="reload" sx={{ width: 16, height: 16 }} />
                        </AppIconButton>
                    </Tooltip>
                </Box>
            </Box>
        </ThemeRoot>
    );
}

