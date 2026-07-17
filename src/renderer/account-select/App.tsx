import {
    Box,
    Chip,
    alpha,
    Avatar,
    Dialog,
    Divider,
    Tooltip,
    Typography,
    DialogTitle,
    GlobalStyles,
    useMediaQuery,
    DialogActions,
    DialogContent,
    CircularProgress,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { buildLightDarkTheme, colors } from "../lib/theme";
import type { SavedAccount } from "../../shared/types/ipc";
import { ThemeRoot, AppButton, AppIconButton } from "../components";
import { PersonGroupIcon, AddPersonIcon, GearIcon, ClockIcon, ArrowIcon, ChevronIcon, TrashIcon } from "./icons";

// ─── Tipos ────────────────────────────────────────────────────────────────────
// SavedAccount importada de shared/types/ipc.ts (fonte única, sem duplicação)

type TFn = (key: string, opts?: Record<string, unknown>) => string;

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── AccountCard ──────────────────────────────────────────────────────────────

interface CardProps {
    acc: SavedAccount;
    isCurrent: boolean;
    isLoading: boolean;
    isDisabled: boolean;
    managing: boolean;
    isDark: boolean;
    t: TFn;
    onSelect: () => void;
    onRemove: () => void;
}

function AccountCard({ acc, isCurrent, isLoading, isDisabled, managing, isDark, t, onSelect, onRemove }: CardProps) {
    const clickable = !managing && !isDisabled;
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [flipStyle, setFlipStyle] = useState<CSSProperties | null>(null);

    const handleClick = () => {
        if (!clickable) return;
        const rect = cardRef.current?.getBoundingClientRect();
        if (rect) {
            // Fase 1: fixa o card exatamente onde ele já está (sem transição)
            setFlipStyle({
                position: "fixed",
                top: rect.top, left: rect.left,
                width: rect.width, height: rect.height,
                margin: 0, zIndex: 20, transition: "none",
            });
        }
        onSelect();
    };

    useEffect(() => {
        if (!isLoading) { setFlipStyle(null); return; }
        // Fase 2 (próximo frame): anima do lugar original pro centro da tela
        const raf = requestAnimationFrame(() => {
            setFlipStyle(prev => prev && {
                ...prev,
                top: "50%", left: "50%", transform: "translate(-50%, -50%)",
                transition: "top 0.45s cubic-bezier(.4,0,.2,1), left 0.45s cubic-bezier(.4,0,.2,1), transform 0.45s cubic-bezier(.4,0,.2,1)",
            });
        });
        return () => cancelAnimationFrame(raf);
    }, [isLoading]);

    return (
        <Box
            ref={cardRef}
            role="button"
            tabIndex={clickable ? 0 : -1}
            aria-label={`${acc.name} – ${t("accounts.clickToEnter")}`}
            onKeyDown={e => { if (clickable && (e.key === "Enter" || e.key === " ")) handleClick(); }}
            onClick={handleClick}
            style={flipStyle ?? undefined}
            sx={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 0.75,
                p: 3,
                borderRadius: 3,
                border: "1.5px solid",
                borderColor: isCurrent
                    ? alpha(colors.accentL, 0.8)
                    : isDark ? alpha(colors.text, 0.09) : "rgba(0,0,0,0.09)",
                bgcolor: "background.paper",
                cursor: managing ? "default" : isDisabled ? "not-allowed" : "pointer",
                userSelect: "none",
                outline: "none",
                boxShadow: isLoading
                    ? (isDark ? `0 12px 40px ${alpha(colors.accent, 0.35)}` : `0 12px 32px rgba(0,0,0,0.18)`)
                    : isCurrent
                        ? (isDark ? `0 4px 22px ${alpha(colors.accent, 0.18)}` : `0 4px 16px rgba(0,0,0,0.07)`)
                        : (isDark ? "0 2px 12px rgba(0,0,0,0.25)" : "0 2px 10px rgba(0,0,0,0.05)"),
                transition: "opacity 0.25s ease, box-shadow 0.25s ease, border-color 0.2s",
                opacity: isDisabled && !isLoading ? 0 : 1,
                pointerEvents: isDisabled && !isLoading ? "none" : "auto",
                transform: !flipStyle && isDisabled && !isLoading ? "scale(0.92)" : undefined,
                "&:hover": clickable ? {
                    borderColor: alpha(colors.accentL, 0.8),
                    transform: "translateY(-3px)",
                    boxShadow: isDark
                        ? `0 0 20px ${alpha(colors.accent, 0.3)}, 0 8px 24px rgba(0,0,0,0.3)`
                        : `0 8px 24px rgba(0,0,0,0.12)`,
                } : {},
                "&:focus-visible": {
                    boxShadow: `0 0 0 3px ${alpha(colors.accentL, 0.55)}`,
                },
            }}
        >
            {/* Avatar */}
            <Box sx={{ position: "relative", mt: isCurrent ? 2 : 1 }}>
                {/* Badge Atual */}
                {isCurrent && (
                    <Box sx={{
                        position: "absolute", top: -22, left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex", alignItems: "center", gap: 0.5,
                        bgcolor: alpha(colors.green, 0.15),
                        border: `1px solid ${alpha(colors.green, 0.35)}`,
                        borderRadius: 10, px: 1, py: 0.25,
                        zIndex: 1, whiteSpace: "nowrap",
                    }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: colors.green }} />
                        <Typography sx={{ fontSize: 10, fontWeight: 700, color: colors.green, lineHeight: 1 }}>
                            {t("accounts.current")}
                        </Typography>
                    </Box>
                )}

                <Avatar sx={{
                    width: 80, height: 80, bgcolor: acc.avatarColor, fontSize: 28, fontWeight: 700,
                    boxShadow: `0 0 0 3px ${alpha(acc.avatarColor, 0.25)}, 0 0 26px ${alpha(acc.avatarColor, 0.45)}`,
                }}>
                    {isLoading
                        ? <CircularProgress size={28} color="inherit" thickness={3} />
                        : initials(acc.name)}
                </Avatar>

                {/* Botão remover */}
                {managing && (
                    <Tooltip title={t("accounts.remove")} placement="top" arrow>
                        <AppIconButton
                            size="small"
                            onClick={e => { e.stopPropagation(); onRemove(); }}
                            sx={{
                                position: "absolute", top: -6, right: -6,
                                width: 26, height: 26,
                                bgcolor: "error.main", color: colors.text,
                                border: "2px solid", borderColor: "background.default",
                                "&:hover": { bgcolor: "error.dark", transform: "scale(1.1)" },
                                transition: "transform 0.15s",
                                animation: "badgeIn 0.2s ease-out",
                                "@keyframes badgeIn": {
                                    from: { opacity: 0, transform: "scale(0.3)" },
                                    to: { opacity: 1, transform: "scale(1)" },
                                },
                            }}
                        >
                            <TrashIcon size={12} />
                        </AppIconButton>
                    </Tooltip>
                )}
            </Box>

            {/* Nome */}
            <Tooltip title={acc.name} placement="top" arrow enterDelay={600}>
                <Typography sx={{
                    fontWeight: 700,
                    fontSize: "clamp(13px, 1.3vw, 16px)",
                    textAlign: "center",
                    color: "text.primary",
                    lineHeight: 1.25,
                    width: "100%",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    wordBreak: "break-word",
                }}>
                    {acc.name}
                </Typography>
            </Tooltip>

            {/* Nick */}
            <Tooltip title={acc.nick} placement="top" arrow enterDelay={600}>
                <Typography variant="caption" color="text.secondary" sx={{
                    display: "block", textAlign: "center", width: "100%",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    fontSize: "clamp(11px, 1vw, 13px)",
                }}>
                    {acc.nick}
                </Typography>
            </Tooltip>

            {/* Realm */}
            <Chip
                label={acc.realm.toUpperCase()}
                size="small"
                sx={{
                    bgcolor: alpha(colors.green, 0.12),
                    color: colors.green,
                    fontWeight: 700, fontSize: 10,
                    letterSpacing: "0.07em", height: 22,
                    border: `1px solid ${alpha(colors.green, 0.3)}`,
                }}
            />

            {/* Último acesso */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.disabled" }}>
                <ClockIcon />
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                    {t("accounts.lastAccess")}: {fmtDate(acc.lastAccess, t)}
                </Typography>
            </Box>

            {/* Botão entrar */}
            {!managing && (
                <AppButton
                    variant={isCurrent ? "contained" : "outlined"}
                    size="small"
                    fullWidth
                    disabled={isDisabled}
                    endIcon={<ArrowIcon />}
                    onClick={e => { e.stopPropagation(); handleClick(); }}
                    sx={{
                        mt: "auto",
                        fontSize: "clamp(11px, 1vw, 13px)",
                        fontWeight: 700,
                        transition: "transform 0.15s, box-shadow 0.15s, background 0.15s, border-color 0.15s",
                        ...(isCurrent ? {
                            background: `linear-gradient(135deg, ${colors.accent} 0%, ${colors.accentH} 100%)`,
                            color: colors.text,
                            boxShadow: `0 3px 14px ${alpha(colors.accent, 0.4)}`,
                            "&:hover": {
                                background: `linear-gradient(135deg, ${colors.accentL} 0%, ${colors.accent} 100%)`,
                                boxShadow: `0 4px 18px ${alpha(colors.accent, 0.55)}`,
                                transform: "translateY(-1px)",
                            },
                        } : {
                            borderColor: alpha(colors.accentL, 0.5),
                            color: colors.accentL,
                            "&:hover": {
                                borderColor: colors.accentL,
                                bgcolor: alpha(colors.accent, 0.08),
                                transform: "translateY(-1px)",
                            },
                        }),
                        "&:disabled": { opacity: 0.5 },
                    }}
                >
                    {t("accounts.clickToEnter")}
                </AppButton>
            )}
        </Box>
    );
}

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function AccountSelect() {
    const { t } = useTranslation();
    const prefersDark = useMediaQuery("(prefers-color-scheme: dark)", { noSsr: true });
    const isDark = prefersDark;
    const theme = useMemo(() => buildLightDarkTheme(isDark ? "dark" : "light"), [isDark]);

    const [accounts, setAccounts] = useState<SavedAccount[]>([]);
    const [loaded, setLoaded] = useState(false);
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [managing, setManaging] = useState(false);
    const [confirmAll, setConfirmAll] = useState(false);
    const [confirmRemove, setConfirmRemove] = useState<SavedAccount | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [exiting, setExiting] = useState(false);

    const navigateAway = (fn: () => void) => {
        setExiting(true);
        setTimeout(fn, 220);
    };

    useEffect(() => {
        window.accountsAPI.list()
            .then(list => { setAccounts(list as SavedAccount[]); setLoaded(true); })
            .catch(() => setLoaded(true));
    }, []);

    const handleSelect = async (id: string) => {
        if (managing || loading) return;
        setLoading(id);
        setError(null);
        try {
            const result = await window.accountsAPI.login(id) as { success: boolean; error?: string };
            if (result.success) {
                navigateAway(() => window.accountsAPI.loadApp());
            } else {
                setLoading(null);
                setError(result.error ?? t("accounts.loginError"));
            }
        } catch (err) { setLoading(null); setError(String(err)); }
    };

    const handleRemove = async (id: string) => {
        await window.accountsAPI.remove(id).catch(() => { });
        setConfirmRemove(null);
        setAccounts(prev => {
            const next = prev.filter(a => a.id !== id);
            if (next.length === 0) setManaging(false);
            return next;
        });
    };

    const handleRemoveAll = async () => {
        await window.accountsAPI.removeAll().catch(() => { });
        setAccounts([]); setManaging(false); setConfirmAll(false);
    };

    const enterOtherAccount = () => {
        const fn = window.accountsAPI.loadFresh ?? window.accountsAPI.loadApp;
        navigateAway(() => fn());
    };

    // Breakpoints para colunas responsivas
    const isXL = useMediaQuery("(min-width:1600px)", { noSsr: true });
    const isLg = useMediaQuery("(min-width:1200px)", { noSsr: true });
    const isMd = useMediaQuery("(min-width:900px)", { noSsr: true });
    const isSm = useMediaQuery("(min-width:600px)", { noSsr: true });
    const maxCols = isXL ? 6 : isLg ? 5 : isMd ? 3 : isSm ? 2 : 1;

    const currentId = accounts[0]?.id;
    const filtered = accounts;

    const PEEK_ROWS = 2;
    const peekCount = expanded
        ? filtered.length
        : Math.min(maxCols * PEEK_ROWS, filtered.length);
    const displayed = filtered.slice(0, peekCount);
    const remainingCount = filtered.length - peekCount;
    const emptyState = loaded && accounts.length === 0;

    const n = displayed.length;
    const activeCols = n > 0 ? Math.min(maxCols, n) : 1;
    const gridTemplateColumns = n <= activeCols
        ? `repeat(${activeCols}, minmax(180px, 280px))`
        : `repeat(${activeCols}, 1fr)`;
    const gridMaxWidth = `min(96vw, 2000px)`;

    const dialogPaperSx = {
        borderRadius: 3,
        border: isDark ? `1px solid ${alpha(colors.text, 0.09)}` : "1px solid rgba(0,0,0,0.09)",
    };

    const bottomBorderColor = isDark ? alpha(colors.text, 0.07) : "rgba(0,0,0,0.08)";

    return (
        <ThemeRoot theme={theme}>
            {/* Scrollbar customizada */}
            <GlobalStyles styles={{
                "*::-webkit-scrollbar": { width: "6px", height: "6px" },
                "*::-webkit-scrollbar-track": { background: "transparent" },
                "*::-webkit-scrollbar-thumb": {
                    background: isDark ? alpha(colors.text, 0.14) : "rgba(0,0,0,0.14)",
                    borderRadius: "4px",
                },
                "*::-webkit-scrollbar-thumb:hover": {
                    background: isDark ? alpha(colors.text, 0.26) : "rgba(0,0,0,0.26)",
                },
                "*::-webkit-scrollbar-corner": { background: "transparent" },
                "html": {
                    scrollbarColor: isDark ? `${alpha(colors.text, 0.14)} transparent` : "rgba(0,0,0,0.14) transparent",
                    scrollbarWidth: "thin",
                },
            }} />

            {/* Barra de loading via classe CSS pré-injetada pelo preload — nunca congela no primeiro render */}
            {loading && <div className="__realms_loading_bar" />}

            {/* ── Layout: coluna com area scrollavel + barra fixa ── */}
            <Box sx={{
                height: "100vh", display: "flex", flexDirection: "column",
                bgcolor: "background.default", overflow: "hidden", position: "relative",
                animation: exiting ? "acctFadeOut 0.2s ease-in forwards" : "acctFadeIn 0.18s ease-out",
                "@keyframes acctFadeIn": { from: { opacity: 0 }, to: { opacity: 1 } },
                "@keyframes acctFadeOut": { from: { opacity: 1 }, to: { opacity: 0 } },
            } as object}>

                {/* Glow ambiente de fundo — puramente decorativo, atrás de todo o conteúdo */}
                <Box aria-hidden sx={{
                    position: "absolute", inset: 0, overflow: "hidden",
                    pointerEvents: "none", zIndex: -1,
                    "&::before, &::after": { content: '""', position: "absolute", borderRadius: "50%", filter: "blur(120px)" },
                    "&::before": {
                        width: 480, height: 480, top: "-14%", left: "-10%",
                        background: isDark ? alpha(colors.accent, 0.18) : alpha(colors.accent, 0.09),
                    },
                    "&::after": {
                        width: 420, height: 420, bottom: "-16%", right: "-8%",
                        background: isDark ? alpha(colors.green, 0.12) : alpha(colors.green, 0.07),
                    },
                }} />

                {emptyState ? (
                    /* Estado vazio: centralizado */
                    <Box sx={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", px: 3 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2.5, maxWidth: 400, textAlign: "center" }}>
                            <Box sx={{
                                width: "clamp(64px, 8vw, 88px)", height: "clamp(64px, 8vw, 88px)",
                                borderRadius: "50%", bgcolor: alpha(colors.accent, 0.1),
                                display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main",
                            }}>
                                <PersonGroupIcon size={36} />
                            </Box>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: "text.primary", letterSpacing: "-0.5px", mb: 1 }}>
                                    {t("accounts.emptyTitle")}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {t("accounts.emptySubtitle")}
                                </Typography>
                            </Box>
                            <AppButton
                                variant="contained" size="large"
                                disabled={!!loading}
                                onClick={() => { setLoading("__enter__"); enterOtherAccount(); }}
                                sx={{ px: 5, py: 1.5, borderRadius: 2.5, fontWeight: 600 }}
                            >
                                {t("accounts.signIn")}
                            </AppButton>
                        </Box>
                    </Box>

                ) : loaded ? (
                    <>
                        {/* ── Área scrollável ────────────────────── */}
                        <Box sx={{
                            flex: "1 1 auto",
                            overflowY: "auto",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            py: 2,
                            px: { xs: 2, sm: 3, md: "clamp(24px, 4vw, 64px)" },
                        }}>
                            <Box sx={{ width: "100%", maxWidth: "min(95vw, 1400px)", display: "flex", flexDirection: "column", alignItems: "center", my: "auto" }}>

                                {/* Cabeçalho */}
                                <Box sx={{
                                    textAlign: "center", mb: { xs: 3, md: 4 }, width: "100%",
                                    opacity: loading ? 0 : 1,
                                    pointerEvents: loading ? "none" : "auto",
                                    transition: "opacity 0.25s ease",
                                }}>
                                    <Box sx={{
                                        width: "clamp(56px, 6vw, 76px)", height: "clamp(56px, 6vw, 76px)",
                                        borderRadius: "50%",
                                        bgcolor: isDark ? alpha(colors.accentL, 0.15) : alpha(colors.accent, 0.10),
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        color: isDark ? colors.accentL : colors.accent, mx: "auto", mb: 2,
                                        boxShadow: isDark
                                            ? `0 0 0 1px ${alpha(colors.accentL, 0.28)}, 0 0 36px ${alpha(colors.accent, 0.35)}`
                                            : `0 0 0 1px ${alpha(colors.accent, 0.18)}, 0 8px 28px ${alpha(colors.accent, 0.15)}`,
                                    }}>
                                        <PersonGroupIcon size={36} />
                                    </Box>
                                    <Typography sx={{
                                        fontWeight: 800,
                                        fontSize: "clamp(1.6rem, 3.5vw, 2.75rem)",
                                        letterSpacing: "-0.5px",
                                        lineHeight: 1.15,
                                        color: "text.primary",
                                    }}>
                                        {t("accounts.chooseTitlePart1")}{" "}
                                        <Box component="span" sx={{ color: colors.accentL }}>
                                            {t("accounts.chooseTitlePart2")}
                                        </Box>
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mt: 1, fontSize: "clamp(13px, 1.2vw, 16px)" }}>
                                        {t("accounts.chooseSubtitle")}
                                    </Typography>
                                </Box>

                                {/* Banner de erro */}
                                {error && (
                                    <Box sx={{
                                        mb: 3, px: 2.5, py: 1.5,
                                        bgcolor: alpha(colors.danger, 0.1),
                                        border: `1px solid ${alpha(colors.danger, 0.3)}`,
                                        borderRadius: 2, maxWidth: 560, width: "100%",
                                    }}>
                                        <Typography variant="body2" color="error.main">{error}</Typography>
                                    </Box>
                                )}

                                {/* Grade de cards */}
                                <Box sx={{
                                    display: "grid",
                                    gridTemplateColumns,
                                    justifyContent: "center",
                                    gap: 1.5,
                                    width: "100%",
                                    maxWidth: gridMaxWidth,
                                    mx: "auto",
                                    mb: 2,
                                    alignItems: "stretch",
                                }}>
                                    {displayed.map(acc => (
                                        <AccountCard
                                            key={acc.id}
                                            acc={acc}
                                            isCurrent={acc.id === currentId}
                                            isLoading={loading === acc.id}
                                            isDisabled={!!loading}
                                            managing={managing}
                                            isDark={isDark}
                                            t={t}
                                            onSelect={() => handleSelect(acc.id)}
                                            onRemove={() => setConfirmRemove(acc)}
                                        />
                                    ))}
                                </Box>

                                {/* Ver mais / Ver menos */}
                                {remainingCount > 0 && (
                                    <AppButton
                                        variant="text"
                                        onClick={() => setExpanded(e => !e)}
                                        endIcon={<ChevronIcon open={expanded} />}
                                        sx={{ color: "text.secondary", fontWeight: 500 }}
                                    >
                                        {expanded ? t("accounts.seeLess") : t("accounts.seeMore", { count: remainingCount })}
                                    </AppButton>
                                )}
                            </Box>
                        </Box>

                        {/* ── Barra inferior — oculta durante loading ── */}
                        {!loading && (
                            <Box sx={{
                                flexShrink: 0,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                pt: 2,
                                pb: 2.5,
                                px: 3,
                                bgcolor: "background.default",
                                borderTop: `1px solid ${bottomBorderColor}`,
                            }}>
                                {/* Divisor "ou" */}
                                <Box sx={{ mb: 2, width: "100%", maxWidth: 500, display: "flex", alignItems: "center", gap: 2 }}>
                                    <Divider sx={{ flex: 1, borderColor: isDark ? alpha(colors.text, 0.12) : "rgba(0,0,0,0.15)" }} />
                                    <Typography variant="caption" color="text.disabled" sx={{ fontSize: 12 }}>
                                        {t("accounts.or")}
                                    </Typography>
                                    <Divider sx={{ flex: 1, borderColor: isDark ? alpha(colors.text, 0.12) : "rgba(0,0,0,0.15)" }} />
                                </Box>

                                {/* Botões de ação */}
                                {!managing ? (
                                    <Box sx={{ display: "flex", gap: 1.5, flexWrap: "wrap", justifyContent: "center" }}>
                                        <AppButton
                                            variant="outlined"
                                            startIcon={<AddPersonIcon />}
                                            disabled={!!loading}
                                            onClick={() => { setLoading("__enter__"); enterOtherAccount(); }}
                                            sx={{ px: 2.5, py: 1, borderRadius: 2, color: "text.secondary", "&:hover": { color: "text.primary" } }}
                                        >
                                            {t("accounts.otherAccount")}
                                        </AppButton>
                                        <AppButton
                                            variant="outlined"
                                            startIcon={<GearIcon />}
                                            disabled={!!loading}
                                            onClick={() => setManaging(true)}
                                            sx={{ px: 2.5, py: 1, borderRadius: 2, color: "text.secondary", "&:hover": { color: "text.primary" } }}
                                        >
                                            {t("accounts.manage")}
                                        </AppButton>
                                    </Box>
                                ) : (
                                    <Box sx={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
                                        <AppButton variant="text" color="error" startIcon={<TrashIcon />} onClick={() => setConfirmAll(true)}>
                                            {t("accounts.removeAll")}
                                        </AppButton>
                                        <AppButton variant="outlined" onClick={() => setManaging(false)} sx={{ borderRadius: 2.5 }}>
                                            {t("accounts.done")}
                                        </AppButton>
                                    </Box>
                                )}
                            </Box>
                        )}
                    </>
                ) : null}
            </Box>

            {/* ── Dialog: remover conta ────────────────────────── */}
            <Dialog open={!!confirmRemove} onClose={() => setConfirmRemove(null)} maxWidth="xs" fullWidth
                slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>{t("accounts.confirmRemoveTitle")}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        {t("accounts.confirmRemoveDesc", { name: confirmRemove?.name ?? "" })}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <AppButton variant="outlined" onClick={() => setConfirmRemove(null)}>{t("accounts.cancel")}</AppButton>
                    <AppButton variant="contained" color="error"
                        onClick={() => confirmRemove && handleRemove(confirmRemove.id)}>
                        {t("accounts.remove")}
                    </AppButton>
                </DialogActions>
            </Dialog>

            {/* ── Dialog: remover todas ────────────────────────── */}
            <Dialog open={confirmAll} onClose={() => setConfirmAll(false)} maxWidth="xs" fullWidth
                slotProps={{ paper: { sx: dialogPaperSx } }}>
                <DialogTitle sx={{ fontWeight: 700 }}>{t("accounts.removeAllTitle")}</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">{t("accounts.removeAllDesc")}</Typography>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
                    <AppButton variant="outlined" onClick={() => setConfirmAll(false)}>{t("accounts.cancel")}</AppButton>
                    <AppButton variant="contained" color="error" onClick={handleRemoveAll}>{t("accounts.removeAll")}</AppButton>
                </DialogActions>
            </Dialog>
        </ThemeRoot>
    );
}
