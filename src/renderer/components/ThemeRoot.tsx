import type { ReactNode } from "react";
import { baseTheme } from "../lib/theme";
import type { Theme } from "@mui/material";
import { ThemeProvider, CssBaseline, createTheme } from "@mui/material";

interface ThemeRootProps {
    children: ReactNode;
    theme?: Theme;
}

export function ThemeRoot({ children, theme }: ThemeRootProps) {
    return (
        <ThemeProvider theme={theme ?? createTheme(baseTheme)}>
            <CssBaseline />
            {children}
        </ThemeProvider>
    );
}
