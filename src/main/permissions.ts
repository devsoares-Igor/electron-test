import { shell, systemPreferences } from "electron";

export async function requestMediaPermissions(): Promise<void> {
    if (process.platform !== "darwin") return;

    const cam = await systemPreferences.askForMediaAccess("camera");
    const mic = await systemPreferences.askForMediaAccess("microphone");

    if (!cam || !mic) {
        console.warn("[permissions] Câmera ou microfone negados no macOS.");
    }

    // Verifica permissão de gravação de tela (necessária para desktopCapturer no macOS)
    const screenStatus = systemPreferences.getMediaAccessStatus("screen");
    if (screenStatus !== "granted") {
        console.warn(
            "[permissions] Gravação de tela não autorizada no macOS. " +
                "O usuário precisa conceder em: Preferências > Privacidade > Gravação de Tela.",
        );
        // Abre as preferências de privacidade no macOS para o usuário conceder a permissão
        shell.openExternal(
            "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture",
        );
    }
}
