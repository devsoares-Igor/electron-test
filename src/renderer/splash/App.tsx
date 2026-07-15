import { colors } from "../lib/theme";
import logoUrl from "./logo_loading.svg";
import { ThemeRoot } from "../components";
import { keyframes } from "@emotion/react";
import { useTranslation } from "react-i18next";
import { Box, LinearProgress, Typography, alpha } from "@mui/material";

const pulse = keyframes`
    0%   { transform: translateZ(0) scale(1);    opacity: 1; }
    50%  { transform: translateZ(0) scale(1.05); opacity: 0.9; }
    100% { transform: translateZ(0) scale(1);    opacity: 1; }
`;

export default function Splash() {
    const { t } = useTranslation();

    return (
        <ThemeRoot>
            {/* Glow de fundo — radial centrado no logo */}
            <Box sx={{
                position: "fixed", inset: 0, pointerEvents: "none",
                background: `radial-gradient(ellipse 260px 180px at 50% 42%, ${alpha(colors.accent, 0.22)} 0%, transparent 70%)`,
            }} />

            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    gap: 0,
                    userSelect: "none",
                    WebkitAppRegion: "drag",
                    bgcolor: "background.default",
                } as object}
            >
                {/* Logo com glow */}
                <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center", mb: 3 }}>
                    <Box sx={{
                        position: "absolute",
                        width: 180, height: 180, borderRadius: "50%",
                        background: `radial-gradient(circle, ${alpha(colors.accent, 0.18)} 0%, transparent 65%)`,
                    }} />
                    <Box
                        component="img"
                        src={logoUrl as string}
                        alt="Realms"
                        sx={{
                            width: 108,
                            height: 108,
                            position: "relative",
                            zIndex: 1,
                            willChange: "transform",
                            backfaceVisibility: "hidden",
                            animation: `${pulse} 2.5s ease-in-out infinite`,
                            filter: `drop-shadow(0 4px 28px ${alpha(colors.accent, 0.5)})`,
                        }}
                    />
                </Box>

                {/* Nome do app */}
                <Typography sx={{
                    fontFamily: "'Hanken Grotesk', 'Inter', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: "1.375rem",
                    letterSpacing: "-0.02em",
                    color: colors.text,
                    mb: 0.75,
                }}>
                    Realms
                </Typography>

                {/* Status */}
                <Typography sx={{
                    fontSize: "0.6875rem",
                    color: colors.text3,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    fontWeight: 500,
                }}>
                    {t("splash.loading")}
                </Typography>
            </Box>

            {/* Barra de progresso */}
            <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}>
                <LinearProgress
                    color="primary"
                    sx={{
                        height: 2,
                        bgcolor: alpha(colors.accent, 0.12),
                        "& .MuiLinearProgress-bar": {
                            background: `linear-gradient(90deg, ${colors.accent}, ${colors.accentL})`,
                        },
                    }}
                />
            </Box>
        </ThemeRoot>
    );
}

