import { IconButton } from "@mui/material";
import type { IconButtonProps } from "@mui/material";

export function AppIconButton({ size = "small", ...props }: IconButtonProps) {
    return <IconButton size={size} {...props} />;
}
