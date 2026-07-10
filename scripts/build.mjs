import { join } from "path";
import { build } from "esbuild";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "fs";

const ENVS = {
    local: { appUrl: "http://localhost:3000/?source=schoolwebv2.ip.tv", isLocal: true },
    school: { appUrl: "https://schoolwebv2.ip.tv/", isLocal: false },
    staging: { appUrl: "https://stagingwebv2.ip.tv/", isLocal: false },
    realms: { appUrl: "https://realmswebv2.ip.tv/", isLocal: false },
};

const electronEnv = process.env.ELECTRON_ENV || "local";
if (!ENVS[electronEnv]) {
    console.error(`Invalid ELECTRON_ENV: "${electronEnv}". Valid values: ${Object.keys(ENVS).join(" | ")}`);
    process.exit(1);
}

const { appUrl, isLocal } = ENVS[electronEnv];
const devtoolsPassword = process.env.DEVTOOLS_PASSWORD || "realms-dev";
console.log(`→ Buildando para ambiente: ${electronEnv} → ${appUrl}`);

mkdirSync("build", { recursive: true });

const envDefine = {
    "__ELECTRON_ENV__": JSON.stringify(electronEnv),
    "__APP_URL__": JSON.stringify(appUrl),
    "__IS_LOCAL__": JSON.stringify(isLocal),
    // legacy compat
    "__ELECTRON_SOURCE_HOST__": JSON.stringify(new URL(appUrl.startsWith("http://localhost") ? "http://schoolwebv2.ip.tv" : appUrl).hostname),
};


await Promise.all([
    // Main process
    build({
        entryPoints: ["src/main/index.ts"],
        bundle: true,
        outfile: "build/main.js",
        platform: "node",
        target: "node20",
        external: ["electron", "ffmpeg-static"],
        sourcemap: true,
        define: { ...envDefine, "__DEVTOOLS_PASSWORD__": JSON.stringify(devtoolsPassword) },
    }),

    // Main preload (contextIsolation: false — see src/preload/main.ts)
    build({
        entryPoints: ["src/preload/main.ts"],
        bundle: true,
        outfile: "build/preload.js",
        platform: "node",
        target: "node20",
        external: ["electron"],
        define: envDefine,
    }),

    // Titlebar preload (contextIsolation: true, uses contextBridge)
    build({
        entryPoints: ["src/preload/titlebar.ts"],
        bundle: true,
        outfile: "build/titlebar-preload.js",
        platform: "node",
        target: "node20",
        external: ["electron"],
    }),

    // Picker preload (contextIsolation: true, uses contextBridge)
    build({
        entryPoints: ["src/preload/picker.ts"],
        bundle: true,
        outfile: "build/picker-preload.js",
        platform: "node",
        target: "node20",
        external: ["electron"],
    }),

    // Picker UI (React + MUI browser bundle)
    build({
        entryPoints: ["src/picker/index.tsx"],
        bundle: true,
        outfile: "build/picker-bundle.js",
        platform: "browser",
        target: "chrome120",
        minify: true,
        jsx: "automatic",
    }),
]);

// Copia HTMLs estáticos e ícones para build/
for (const f of ["picker.html", "splash.html", "offline.html", "titlebar.html", "devtools-dialog.html", "logo_loading.svg"]) {
    copyFileSync(join("static", f), join("build", f));
}

// Copia ícones (se a pasta existir)
const iconsDir = join("build", "icons");
const srcIconsDir = join("static", "icons");
if (existsSync(srcIconsDir)) {
    mkdirSync(iconsDir, { recursive: true });
    for (const f of readdirSync(srcIconsDir)) {
        copyFileSync(join(srcIconsDir, f), join(iconsDir, f));
    }
}

console.log("✓ Build completo → build/");
