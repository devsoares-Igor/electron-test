import {
    Box,
    alpha,
    Avatar,
    Dialog,
    Tooltip,
    Typography,
    createTheme,
    DialogTitle,
    DialogActions,
    useMediaQuery,
    DialogContent,
    LinearProgress,
    CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { baseTheme, colors } from "../lib/theme";
import { useEffect, useMemo, useState } from "react";
import { ThemeRoot, AppButton, AppIconButton } from "../components";

function buildTheme(mode: "dark" | "light") {
    const isDark = mode === "dark";
    return createTheme(baseTheme, {
        palette: {
            mode,
            ...(isDark ? {} : {
                background: { default: "#F8FAFC", paper: "#FFFFFF" },
                text: { primary: "#0F172A", secondary: "#475569", disabled: "#94A3B8" },
                divider: "rgba(0,0,0,0.08)",
            }),
        },
    });
}

interface SavedAccount {
    id: string; realm: string; nick: string; name: string;
    apiBaseUrl: string; lastAccess: string; avatarColor: string;
}

type TFn = (key: string, opts?: Record<string, unknown>) => string;

function fmtDate(iso: string, t: TFn): string {
    try {
        const d = new Date(iso);
        const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        const diffH = (Date.now() - d.getTime()) / 3_600_000;
        if (diffH < 1) return t("accounts.timeNow", { time });
        if (diffH < 24) return t("accounts.timeToday", { time });
        if (diffH < 48) return t("accounts.timeYesterday", { time });
        return `${d.toLocaleDateString([], { day: "2-digit", month: "short" })}, ${time}`;
    } catch { return "—"; }
}

function initials(name: string): string {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

function TrashIcon({ size = 18 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
        </svg>
    );
}

export default function AccountSelect() {
    const { t } = useTranslation();
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
    const theme = useMemo(() => buildTheme(prefersDark ? "dark" : "light"), [prefersDark]);

    const [accounts, setAccounts] = useState<SavedAccount[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [managing, setManaging] = useState(false);
    const [confirmAll, setConfirmAll] = useState(false);
    const [hovered, setHovered] = useState<string | null>(null);

    useEffect(() => {
        window.accountsAPI.list()
            .then(list => { setAccounts(list); setLoaded(true); })
            .catch(() => setLoaded(true));
    }, []);

    const handleSelect = async (id: string) => {
        if (managing) return;
        setLoading(id);
        setError(null);
        try {
            const result = await window.accountsAPI.login(id);
            if (result.success) {
                window.accountsAPI.loadApp();
            } else {
                setLoading(null);
                setError(result.error ?? t("accounts.loginError"));
            }
        } catch (err) {
            setLoading(null);
            setError(String(err));
        }
    };

    const handleRemove = async (id: string) => {
        await window.accountsAPI.remove(id).catch(() => { });
        setAccounts(prev => {
            const next = prev.filter(a => a.id !== id);
            if (next.length === 0) setManaging(false);
            return next;
        });
    };

    const handleRemoveAll = async () => {
        await window.accountsAPI.removeAll().catch(() => { });
        setAccounts([]);
        setManaging(false);
        setHovered(null);
        setConfirmAll(false);
    };

    return (
        <ThemeRoot theme={theme}>
            {/* Barra de progresso no topo — aparece durante o login */}
            {loading && (
                <LinearProgress
                    sx={{
                        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9999,
                        height: 3,
                        bgcolor: "transparent",
                        "& .MuiLinearProgress-bar": { bgcolor: colors.accentL },
                    }}
                />
            )}
            <Box
                sx={{
                    minHeight: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: "background.default",
                    py: 6,
                    px: 2,
                }}
            >
                {/* Empty state */}
                {loaded && accounts.length === 0 && !managing ? (
                    <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                        <Box sx={{
                            width: 72, height: 72, borderRadius: "50%",
                            bgcolor: alpha(colors.accent, 0.1),
                            display: "flex", alignItems: "center", justifyContent: "center",
                            color: "primary.main",
                        }}>
                            <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                        </Box>
                        <Box sx={{ textAlign: "center" }}>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", letterSpacing: "-0.5px", mb: 0.75 }}>
                                {t("accounts.emptyTitle")}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {t("accounts.emptySubtitle")}
                            </Typography>
                        </Box>
                        <AppButton
                            variant="contained"
                            size="large"
                            disabled={!!loading}
                            onClick={() => {
                                setLoading("__enter__");
                                if (window.accountsAPI.loadFresh) {
                                    window.accountsAPI.loadFresh();
                                } else {
                                    window.accountsAPI.loadApp();
                                }
                            }}
                            sx={{ px: 5, mt: 1 }}
                        >
                            {t("accounts.signIn")}
                        </AppButton>
                    </Box>
                ) : loaded ? (
                    <>
                        {/* Title */}
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                color: "text.primary",
                                mb: 4,
                                letterSpacing: "-0.5px",
                            }}
                        >
                            {t("accounts.welcome")}
                        </Typography>

                        {/* Error banner */}
                        {error && (
                            <Box
                                sx={{
                                    mb: 3, px: 2.5, py: 1.5,
                                    bgcolor: alpha("#ed4245", 0.12),
                                    border: `1px solid ${alpha("#ed4245", 0.3)}`,
                                    borderRadius: 2,
                                    maxWidth: 480, width: "100%",
                                }}
                            >
                                <Typography variant="body2" color="error.main">
                                    {error}
                                </Typography>
                            </Box>
                        )}

                        {/* Grade estilo Netflix — responsiva via clamp/vw */}
                        <Box sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            justifyContent: "center",
                            gap: "clamp(20px, 3.5vw, 56px)",
                            width: "min(92vw, 1100px)",
                            mb: 5,
                            maxHeight: "60vh",
                            overflowY: "auto",
                            py: 1.5,
                            px: 1,
                        }}>
                            {accounts.map(acc => {
                                const isLoading = loading === acc.id;
                                const isHovered = hovered === acc.id;
                                const active = isHovered && !managing;
                                return (
                                    <Box key={acc.id}
                                        onMouseEnter={() => setHovered(acc.id)}
                                        onMouseLeave={() => setHovered(null)}
                                        onClick={() => !managing && handleSelect(acc.id)}
                                        sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5, cursor: managing ? "default" : "pointer", userSelect: "none", position: "relative", width: "clamp(90px, 13vw, 160px)" }}
                                    >
                                        {/* Avatar */}
                                        <Box sx={{ position: "relative" }}>
                                            <Avatar sx={{
                                                width: "clamp(78px, 12vw, 140px)",
                                                height: "clamp(78px, 12vw, 140px)",
                                                bgcolor: acc.avatarColor,
                                                fontSize: "clamp(26px, 4vw, 50px)",
                                                fontWeight: 700,
                                                outline: "none",
                                                boxShadow: active ? `0 0 0 3px ${colors.accentL}` : "none",
                                                transform: active && !isLoading ? "scale(1.07)" : "scale(1)",
                                                transition: "transform 0.18s ease, outline-color 0.18s ease",
                                                filter: loading && !isLoading ? "brightness(0.45)" : "none",
                                            }}>
                                                {isLoading
                                                    ? <CircularProgress size={32} color="inherit" thickness={3} />
                                                    : initials(acc.name)}
                                            </Avatar>
                                            {managing && (
                                                <Tooltip title={t("accounts.remove")} placement="top">
                                                    <AppIconButton size="small"
                                                        onClick={e => { e.stopPropagation(); handleRemove(acc.id); }}
                                                        sx={{
                                                            position: "absolute", top: -4, right: -4,
                                                            width: 24, height: 24,
                                                            bgcolor: "error.main", color: "#fff",
                                                            border: "2px solid", borderColor: "background.default",
                                                            "&:hover": { bgcolor: "#c0392b" },
                                                            animation: "badgeIn 0.2s ease-out",
                                                            "@keyframes badgeIn": {
                                                                from: { opacity: 0, transform: "scale(0.3)" },
                                                                to: { opacity: 1, transform: "scale(1)" },
                                                            },
                                                        }}>
                                                        <TrashIcon size={11} />
                                                    </AppIconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                        {/* Texto */}
                                        <Box sx={{ textAlign: "center", width: "100%", px: 0.5 }}>
                                            <Typography sx={{
                                                fontWeight: 600,
                                                fontSize: "clamp(11px, 1.1vw, 14px)",
                                                lineHeight: 1.25,
                                                color: active ? colors.accentL : "text.primary",
                                                transition: "color 0.15s",
                                                overflow: "hidden",
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                            }}>
                                                {acc.name}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.25 }}>
                                                {acc.nick}
                                            </Typography>
                                            <Typography sx={{ color: colors.green, fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", fontSize: 10, display: "block", mt: 0.25 }}>
                                                {acc.realm}
                                            </Typography>
                                            <Typography variant="caption" sx={{ color: "text.disabled", display: "block", mt: 0.25 }}>
                                                {fmtDate(acc.lastAccess, t)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>

                        {/* Actions */}
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 1.5 }}>
                            {!managing ? (
                                <>
                                    <AppButton
                                        variant="outlined"
                                        onClick={() => {
                                            if (window.accountsAPI.loadFresh) {
                                                window.accountsAPI.loadFresh();
                                            } else {
                                                window.accountsAPI.loadApp();
                                            }
                                        }}
                                        disabled={!!loading}
                                        sx={{
                                            px: 4, py: 1,
                                            borderColor: alpha(colors.text2, 0.3),
                                            color: "text.secondary",
                                            "&:hover": {
                                                borderColor: "primary.main",
                                                color: "text.primary",
                                                bgcolor: alpha(colors.accent, 0.08),
                                            },
                                        }}
                                    >
                                        {t("accounts.otherAccount")}
                                    </AppButton>
                                    {accounts.length > 0 && (
                                        <AppButton
                                            variant="text"
                                            onClick={() => { setManaging(true); setHovered(null); }}
                                            disabled={!!loading}
                                            sx={{ color: "text.disabled", "&:hover": { color: "text.secondary" } }}
                                        >
                                            {t("accounts.manage")}
                                        </AppButton>
                                    )}
                                </>
                            ) : (
                                <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                                    <AppButton
                                        variant="text"
                                        color="error"
                                        onClick={() => setConfirmAll(true)}
                                        startIcon={<TrashIcon />}
                                    >
                                        {t("accounts.removeAll")}
                                    </AppButton>
                                    <AppButton
                                        variant="outlined"
                                        onClick={() => { setManaging(false); setHovered(null); }}
                                    >
                                        {t("accounts.done")}
                                    </AppButton>
                                </Box>
                            )}
                        </Box>
                    </>
                ) : null}
            </Box>

            {/* Confirm remove all dialog */}
            <Dialog
                open={confirmAll}
                onClose={() => setConfirmAll(false)}
                maxWidth="xs"
                fullWidth
                slotProps={{ paper: { sx: { border: `1px solid rgba(255,255,255,0.08)` } } }}
            >
                <DialogTitle sx={{ fontWeight: 700 }}>
                    {t("accounts.removeAllTitle")}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        {t("accounts.removeAllDesc")}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <AppButton variant="outlined" onClick={() => setConfirmAll(false)}>
                        {t("accounts.cancel")}
                    </AppButton>
                    <AppButton variant="contained" color="error" onClick={handleRemoveAll}>
                        {t("accounts.removeAll")}
                    </AppButton>
                </DialogActions>
            </Dialog>
        </ThemeRoot>
    );
}
