import { flipFuses, FuseVersion, FuseV1Options } from "@electron/fuses";
import path from "path";

export default async function afterPack(context) {
    const { appOutDir, electronPlatformName, packager } = context;
    const productName = packager.appInfo.productFilename;

    const binaryName = {
        darwin: `${productName}.app/Contents/MacOS/${productName}`,
        win32: `${productName}.exe`,
        linux: productName,
    }[electronPlatformName];

    if (!binaryName) {
        console.warn(`[fuses] Unknown platform "${electronPlatformName}", skipping fuse flip.`);
        return;
    }

    const binaryPath = path.join(appOutDir, binaryName);
    console.log(`[fuses] Flipping fuses on ${binaryPath}`);

    await flipFuses(binaryPath, {
        version: FuseVersion.V1,
        [FuseV1Options.RunAsNode]: false,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableCookieEncryption]: true,
    });

    console.log("[fuses] Done.");
}
