import { TextField } from "@mui/material";
import type { TextFieldProps } from "@mui/material";

export function AppTextField({ size = "small", fullWidth = true, ...props }: TextFieldProps) {
    return <TextField size={size} fullWidth={fullWidth} {...props} />;
}
