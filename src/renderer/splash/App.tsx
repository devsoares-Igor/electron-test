import logoUrl from "./logo_loading.svg";
import { ThemeRoot } from "../components";
import { keyframes } from "@emotion/react";
import { useTranslation } from "react-i18next";
import { Box, LinearProgress, Typography } from "@mui/material";

const pulse = keyframes`
    0%   { transform: translateZ(0) scale(1);    opacity: 1; }
    50%  { transform: translateZ(0) scale(1.06); opacity: 0.88; }
    100% { transform: translateZ(0) scale(1);    opacity: 1; }
`;

export default function Splash() {
    const { t } = useTranslation();

    return (
        <ThemeRoot>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100vh",
                    userSelect: "none",
                    WebkitAppRegion: "drag",
                    bgcolor: "background.default",
                } as object}
            >
                <Box
                    component="img"
                    src={logoUrl as string}
                    alt="Realms"
                    sx={{
                        width: 148,
                        height: 148,
                        mb: 3,
                        willChange: "transform",
                        backfaceVisibility: "hidden",
                        animation: `${pulse} 2s ease-in-out infinite`,
                    }}
                />
                <Typography
                    variant="h6"
                    color="#f2f3f5"
                    sx={{ fontWeight: 500, letterSpacing: "0.0075em", mb: 0.5 }}
                >
                    Realms
                </Typography>
                <Typography variant="caption" color="#b5bac1">
                    {t("splash.loading")}
                </Typography>
            </Box>
            <Box sx={{ position: "fixed", bottom: 0, left: 0, right: 0 }}>
                <LinearProgress color="primary" />
            </Box>
        </ThemeRoot>
    );
}
