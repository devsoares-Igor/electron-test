import {
    Tab,
    Box,
    Tabs,
    Paper,
    Button,
    Switch,
    Typography,
    createTheme,
    CssBaseline,
    ThemeProvider,
    FormControlLabel,
    CircularProgress,
} from "@mui/material";
import { useEffect, useState } from "react";

interface Source {
    id: string;
    name: string;
    thumbnail: string;
}

const darkTheme = createTheme({
    palette: {
        mode: "dark",
        primary: { main: "#3b6ae0", light: "#5f87e8", dark: "#325bc5" },
        background: { default: "#0f1623", paper: "#212c35" },
        divider: "rgba(255,255,255,0.08)",
        text: {
            primary: "#e8edf2",
            secondary: "#8a9db5",
            disabled: "#4a5d72",
        },
    },
    typography: {
        fontFamily: '"Segoe UI", system-ui, -apple-system, sans-serif',
    },
    components: {
        MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
        MuiButton: { styleOverrides: { root: { textTransform: "none", fontWeight: 500 } } },
        MuiTab: {
            styleOverrides: { root: { textTransform: "none", fontWeight: 500, minHeight: 38 } },
        },
    },
});

function SourceCard({
    src,
    selected,
    onSelect,
    onDoubleClick,
}: {
    src: Source;
    selected: boolean;
    onSelect: () => void;
    onDoubleClick: () => void;
}) {
    return (
        <Paper
            elevation={selected ? 4 : 1}
            onClick={onSelect}
            onDoubleClick={onDoubleClick}
            sx={{
                cursor: "pointer",
                border: "2px solid",
                borderColor: selected ? "primary.main" : "transparent",
                bgcolor: selected ? "#1a3060" : "background.paper",
                p: 0.75,
                borderRadius: 1.5,
                transition: "border-color 0.15s, background-color 0.15s",
                "&:hover": {
                    bgcolor: selected ? "#1a3060" : "#2a3844",
                    borderColor: selected ? "primary.main" : "#3a4f63",
                },
            }}
        >
            <Box
                component="img"
                src={src.thumbnail}
                sx={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    objectFit: "contain",
                    bgcolor: "#0a0f18",
                    borderRadius: "4px",
                    display: "block",
                }}
            />
            <Typography
                variant="caption"
                noWrap
                title={src.name}
                sx={{ display: "block", mt: 0.5, color: "text.secondary", textAlign: "center" }}
            >
                {src.name}
            </Typography>
        </Paper>
    );
}

export default function App() {
    const [sources, setSources] = useState<Source[] | null>(null);
    const [tab, setTab] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [audio, setAudio] = useState(false);

    useEffect(() => {
        window.pickerAPI.onSourcesReady((srcs) => setSources(srcs));
    }, []);

    const screenSources = (sources ?? []).filter((s) => s.id.startsWith("screen:"));
    const windowSources = (sources ?? []).filter((s) => !s.id.startsWith("screen:"));
    const filtered = tab === 0 ? screenSources : windowSources;

    const doShare = (id: string | null = selected): void => {
        if (id) window.pickerAPI.sendResult({ id, audio });
    };

    return (
        <ThemeProvider theme={darkTheme}>
            <CssBaseline />
            <Box
                sx={{
                    px: 3,
                    pt: 2.5,
                    pb: 2,
                    height: "100vh",
                    display: "flex",
                    flexDirection: "column",
                    overflow: "hidden",
                    userSelect: "none",
                }}
            >
                <Typography variant="h6" sx={{ mb: 0.25, fontSize: "15px", fontWeight: 500 }}>
                    Escolha o que compartilhar
                </Typography>
                <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 1.5, fontSize: "12px" }}
                >
                    O site terá acesso ao conteúdo da sua tela
                </Typography>

                <Tabs
                    value={tab}
                    onChange={(_, v: number) => {
                        setTab(v);
                        setSelected(null);
                    }}
                    sx={{ mb: 1.5, minHeight: 38 }}
                >
                    <Tab label="Tela inteira" />
                    <Tab label="Janela" />
                </Tabs>

                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        mb: 1.5,
                        pr: 0.5,
                        "&::-webkit-scrollbar": { width: "6px" },
                        "&::-webkit-scrollbar-thumb": { bgcolor: "#3a4f63", borderRadius: "3px" },
                    }}
                >
                    {sources === null ? (
                        <Box
                            sx={{
                                display: "flex",
                                justifyContent: "center",
                                alignItems: "center",
                                height: 200,
                            }}
                        >
                            <CircularProgress size={32} />
                        </Box>
                    ) : filtered.length === 0 ? (
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                justifyContent: "center",
                                alignItems: "center",
                                height: 200,
                                gap: 1,
                            }}
                        >
                            <Typography variant="body2" color="text.disabled">
                                Nenhuma fonte disponível
                            </Typography>
                            {sources.length === 0 && tab === 0 && (
                                <Typography
                                    variant="caption"
                                    color="text.disabled"
                                    sx={{ textAlign: "center", maxWidth: 280 }}
                                >
                                    No macOS, autorize em Preferências → Privacidade → Gravação de
                                    Tela.
                                </Typography>
                            )}
                        </Box>
                    ) : (
                        <Box
                            sx={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                                gap: 1,
                            }}
                        >
                            {filtered.map((src) => (
                                <SourceCard
                                    key={src.id}
                                    src={src}
                                    selected={selected === src.id}
                                    onSelect={() => setSelected(src.id)}
                                    onDoubleClick={() => doShare(src.id)}
                                />
                            ))}
                        </Box>
                    )}
                </Box>

                <Box sx={{ borderTop: "1px solid", borderColor: "divider", pt: 1.5 }}>
                    <FormControlLabel
                        control={
                            <Switch
                                checked={audio}
                                onChange={(e) => setAudio(e.target.checked)}
                                size="small"
                                color="primary"
                            />
                        }
                        label={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    style={{ color: "#8a9db5", flexShrink: 0 }}
                                >
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                                </svg>
                                <Typography variant="body2">
                                    Compartilhar também o áudio da tela
                                </Typography>
                            </Box>
                        }
                        labelPlacement="start"
                        sx={{ ml: 0, width: "100%", justifyContent: "space-between" }}
                    />
                </Box>

                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, mt: 1.5 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={() => window.pickerAPI.sendResult(null)}
                        sx={{ color: "primary.main", borderColor: "divider" }}
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        disabled={!selected}
                        onClick={() => doShare()}
                    >
                        Compartilhar
                    </Button>
                </Box>
            </Box>
        </ThemeProvider>
    );
}
