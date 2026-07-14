import { Button } from "@mui/material";
import type { ButtonProps } from "@mui/material";

export function AppButton({ variant = "contained", ...props }: ButtonProps) {
    return <Button variant={variant} {...props} />;
}
