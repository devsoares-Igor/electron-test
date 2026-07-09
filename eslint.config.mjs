// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
    {
        ignores: ["build/**", "node_modules/**", "scripts/**", "renderer/**", "out/**"],
    },
    ...tseslint.configs.recommended,
    {
        rules: {
            "@typescript-eslint/no-explicit-any": "error",
            "@typescript-eslint/explicit-module-boundary-types": "off",
            "@typescript-eslint/no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],
            "no-restricted-imports": [
                "error",
                {
                    paths: [
                        {
                            name: "electron",
                            importNames: ["ipcRenderer"],
                            message:
                                "Do not import ipcRenderer in renderer code. " +
                                "Use the API exposed via contextBridge: window.electronAPI or window.pickerAPI.",
                        },
                    ],
                },
            ],
        },
    },
    {
        // Preload scripts are the only files allowed to import ipcRenderer directly.
        files: ["src/preload/**/*.ts", "src/picker/preload.ts"],
        rules: {
            "no-restricted-imports": "off",
        },
    },
);
