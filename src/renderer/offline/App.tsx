import { colors } from "../lib/theme";
import { useTranslation } from "react-i18next";
import { Box, Paper, Typography, alpha } from "@mui/material";
import { AppButton, AppIcon, ThemeRoot } from "../components";

export default function Offline() {
    const { t } = useTranslation();
    const reason = new URLSearchParams(location.search).get("reason");
    const isDev = reason === "devserver";

    return (
        <ThemeRoot>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
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
                            bgcolor: alpha(colors.accent, 0.12),
                            mb: 3,
                            color: "primary.main",
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
                    <Box sx={{ borderTop: `1px solid ${alpha(colors.text, 0.08)}`, mt: 4, pt: 2.5 }}>
                        <Typography variant="caption" color="text.disabled">
                            {t(isDev ? "offline.devCaption" : "offline.offlineCaption")}
                        </Typography>
                    </Box>
                </Paper>
            </Box>
        </ThemeRoot>
    );
}
