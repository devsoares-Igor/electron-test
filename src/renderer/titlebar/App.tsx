import {
    Box,
    Tooltip,
    Typography,
    createTheme,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { baseTheme, colors } from "../lib/theme";
import { AppIcon, AppIconButton, ThemeRoot } from "../components";

const theme = createTheme(baseTheme, {
    palette: { background: { default: colors.bg2, paper: colors.bg2 } },
});

const BTN_SX = {
    width: 28,
    height: 28,
    color: "#94A3B8",
    borderRadius: "4px",
    "&:hover": { bgcolor: "rgba(255,255,255,0.08)", color: "#F1F5F9" },
    "&:active": { bgcolor: "rgba(255,255,255,0.14)" },
} as const;

export default function Titlebar() {
    const { t } = useTranslation();
    const [spinning, setSpinning] = useState(false);

    const handleReload = () => {
        setSpinning(true);
        window.titlebarAPI.reload();
        setTimeout(() => setSpinning(false), 500);
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
                    bgcolor: "#1E293B",
                    WebkitAppRegion: "drag",
                    display: "flex",
                    alignItems: "center",
                    px: "8px",
                    pr: "148px",
                } as object}
            >
                {/* Esquerda: ⋮ menu */}
                <AppIconButton
                    onClick={() => window.titlebarAPI.showMenu()}
                    sx={{ ...BTN_SX, WebkitAppRegion: "no-drag" } as object}
                    aria-label="Menu"
                >
                    <Typography sx={{ fontSize: 16, lineHeight: 1, color: "inherit", letterSpacing: "1px" }}>⋮</Typography>
                </AppIconButton>

                {/* Direita: reload */}
                <Box sx={{ ml: "auto", WebkitAppRegion: "no-drag" } as object}>
                    <Tooltip title={t("titlebar.reload")} placement="bottom">
                        <AppIconButton onClick={handleReload} sx={BTN_SX}>
                            <AppIcon
                                name="reload"
                                sx={{
                                    width: 15,
                                    height: 15,
                                    transition: "transform 0.5s linear",
                                    transform: spinning ? "rotate(360deg)" : "none",
                                }}
                            />
                        </AppIconButton>
                    </Tooltip>
                </Box>
            </Box>
        </ThemeRoot>
    );
}

