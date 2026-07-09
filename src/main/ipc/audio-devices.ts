import { execSync } from "child_process";
import { ipcMain } from "electron";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SystemAudioDevice = {
    name: string;
    /** "OK" = ativo, "disconnected" = desconectado mas registrado */
    status: "OK" | "disconnected" | "unknown";
    /** Determinado pelo InstanceId do Windows (render = output, capture = input) */
    direction: "input" | "output" | "unknown";
    /** Índice PortAudio (naudiodon) — presente apenas em dispositivos nativos */
    nativeId?: number;
    /** Backend de áudio do PortAudio (MME, DirectSound, WASAPI, etc.) */
    hostApi?: string;
};

// ─── Windows helpers ──────────────────────────────────────────────────────────

/**
 * O InstanceId de endpoints de áudio do Windows segue o padrão:
 *   SWD\MMDEVAPI\{0.0.0.00000000}.{GUID}  → render (output)
 *   SWD\MMDEVAPI\{0.0.1.00000000}.{GUID}  → capture (input)
 */
function parseDirection(instanceId: string): "input" | "output" | "unknown" {
    if (instanceId.includes("{0.0.0.")) return "output";
    if (instanceId.includes("{0.0.1.")) return "input";
    return "unknown";
}

function runPowerShell(command: string): unknown[] {
    let stdout: string;
    try {
        stdout = execSync(
            `powershell.exe -NoProfile -NonInteractive -Command "${command}"`,
            { encoding: "utf8", timeout: 8_000, windowsHide: true },
        );
    } catch (err) {
        console.error("[audio-devices] PowerShell falhou:", err);
        return [];
    }
    try {
        const raw = JSON.parse(stdout.trim());
        return Array.isArray(raw) ? raw : [raw];
    } catch {
        console.error("[audio-devices] JSON inválido:", stdout.slice(0, 200));
        return [];
    }
}

/**
 * Fonte primária: AudioEndpoint via Get-PnpDevice.
 * Lista endpoints WASAPI (hardware e virtual que se registram como PnP).
 */
function listPnpAudioEndpoints(): SystemAudioDevice[] {
    const ps =
        "Get-PnpDevice -Class AudioEndpoint |" +
        " Select-Object FriendlyName, Status, InstanceId |" +
        " ConvertTo-Json -Compress";

    return runPowerShell(ps)
        .filter((item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null &&
            typeof (item as Record<string, unknown>).FriendlyName === "string",
        )
        .map((item) => ({
            name: item.FriendlyName as string,
            status: item.Status === "OK" ? "OK" as const : item.Status === "Unknown" ? "disconnected" as const : "unknown" as const,
            direction: parseDirection(String(item.InstanceId ?? "")),
        }));
}

/**
 * Fonte secundária: Win32_SoundDevice via WMI.
 * Captura drivers de áudio virtuais (vMix, VB-Cable, etc.) que por vezes não
 * aparecem como AudioEndpoint PnP mas estão registrados como dispositivos WDM.
 */
function listWmiSoundDevices(): SystemAudioDevice[] {
    const ps =
        "Get-WmiObject Win32_SoundDevice |" +
        " Select-Object Name, Status |" +
        " ConvertTo-Json -Compress";

    return runPowerShell(ps)
        .filter((item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null &&
            typeof (item as Record<string, unknown>).Name === "string",
        )
        .map((item) => ({
            name: item.Name as string,
            status: item.Status === "OK" ? "OK" as const : "unknown" as const,
            direction: "unknown" as const,
        }));
}

/**
 * Fonte terciária: lê o registro MMDevices diretamente.
 * É a fonte definitiva dos endpoints WASAPI — inclui dispositivos virtuais
 * (vMix, VB-Cable, etc.) que podem não aparecer via PnP ou WMI.
 * PKEY_Device_FriendlyName = {a45c254e-df1c-4efd-8020-67d146a850e0},2
 */
function listMMDevicesRegistry(): SystemAudioDevice[] {
    const ps = [
        "$r=@()",
        "$dirs=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Capture','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render')",
        "foreach($d in $dirs){",
        "  $dir=if($d -like '*Capture*'){'input'}else{'output'}",
        "  try{foreach($dev in (Get-ChildItem $d -EA Stop)){",
        "    try{",
        "      $p=Get-ItemProperty ($dev.PSPath + '\\Properties') -EA Stop",
        "      $n=$p.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'",
        "      $s=(Get-ItemProperty $dev.PSPath -EA Stop).DeviceState",
        "      if($n){$r+=[PSCustomObject]@{name=$n;direction=$dir;status=if($s-eq 1){'OK'}else{'disconnected'}}}",
        "    }catch{}}",
        "  }catch{}}",
        "$r|ConvertTo-Json -Compress",
    ].join(";");

    return runPowerShell(ps)
        .filter((item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null &&
            typeof (item as Record<string, unknown>).name === "string",
        )
        .map((item) => ({
            name: item.name as string,
            status: item.status === "OK" ? "OK" as const : "disconnected" as const,
            direction: item.direction as "input" | "output",
        }));
}

/**
 * Fonte quaternária: registro DirectShow (HKCU + HKLM).
 * Apps nativos como o IP.TV usam DirectShow para enumerar áudio.
 * Dispositivos virtuais (vMix Audio, etc.) frequentemente aparecem AQUI
 * mas não como endpoints WASAPI.
 * Categoria de captura DirectShow: {33D9A762-90C8-11d0-BD43-00A0C911CE86}
 * Categoria de renderização DirectShow: {E0F158E1-CB04-11d0-BD4E-00A0C911CE86}
 */
function listDirectShowDevices(): SystemAudioDevice[] {
    const cIn = "{33D9A762-90C8-11D0-BD43-00A0C911CE86}";
    const cOut = "{E0F158E1-CB04-11D0-BD4E-00A0C911CE86}";

    // Script flat: define helper S que acessa $script:r, depois chama S para
    // cada path individualmente (sem arrays aninhados — evita bugs de parsing).
    const ps = [
        "$r=@()",
        "function S($p,$d){ try{ Get-ChildItem $p -EA Stop | ForEach-Object { $n=(Get-ItemProperty $_.PSPath -EA Stop).FriendlyName; if($n){ $script:r+=[PSCustomObject]@{name=$n;direction=$d;status='OK'} } } }catch{} }",
        `S 'HKCU:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${cIn}' 'input'`,
        `S 'HKLM:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${cIn}' 'input'`,
        `S 'HKLM:\\SOFTWARE\\Classes\\CLSID\\${cIn}\\Instance' 'input'`,
        `S 'HKLM:\\SOFTWARE\\WOW6432Node\\Classes\\CLSID\\${cIn}\\Instance' 'input'`,
        `S 'HKCU:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${cOut}' 'output'`,
        `S 'HKLM:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${cOut}' 'output'`,
        `S 'HKLM:\\SOFTWARE\\Classes\\CLSID\\${cOut}\\Instance' 'output'`,
        `S 'HKLM:\\SOFTWARE\\WOW6432Node\\Classes\\CLSID\\${cOut}\\Instance' 'output'`,
        "$r|ConvertTo-Json -Compress",
    ].join(";");

    return runPowerShell(ps)
        .filter((item): item is Record<string, unknown> =>
            typeof item === "object" && item !== null &&
            typeof (item as Record<string, unknown>).name === "string",
        )
        .map((item) => ({
            name: item.name as string,
            status: "OK" as const,
            direction: item.direction as "input" | "output",
        }));
}

function listWindowsAudioDevices(): SystemAudioDevice[] {
    const pnp = listPnpAudioEndpoints();
    const wmi = listWmiSoundDevices();
    const reg = listMMDevicesRegistry();
    const ds = listDirectShowDevices();
    const pa = listPortAudioDevices();

    // DirectShow e PortAudio têm prioridade: veem dispositivos WDM que WASAPI não vê.
    const seen = new Set<string>();
    const all: SystemAudioDevice[] = [];
    for (const d of [...pa, ...ds, ...reg, ...pnp, ...wmi]) {
        const key = d.name.toLowerCase();
        if (!seen.has(key)) { seen.add(key); all.push(d); }
    }
    return all;
}

// ─── PortAudio / naudiodon ───────────────────────────────────────────────────

type PortAudioDevice = {
    id: number;
    name: string;
    maxInputChannels: number;
    maxOutputChannels: number;
    defaultSampleRate: number;
    hostAPIName: string;
};

/**
 * Fonte nativa: PortAudio via naudiodon.
 * Acessa dispositivos WDM / DirectSound / ASIO que o WASAPI (Chrome) não vê.
 * Requer instalação no Windows: npm install naudiodon && npx @electron/rebuild
 */
function listPortAudioDevices(): SystemAudioDevice[] {
    let getDevices: () => PortAudioDevice[];
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const na = require("naudiodon") as { getDevices: () => PortAudioDevice[] };
        getDevices = na.getDevices.bind(na);
    } catch {
        return []; // naudiodon não instalado — silencioso
    }

    try {
        return getDevices()
            .filter((d) => d.maxInputChannels > 0 || d.maxOutputChannels > 0)
            .map((d): SystemAudioDevice => ({
                name: d.name,
                status: "OK",
                direction:
                    d.maxInputChannels > 0 && d.maxOutputChannels === 0 ? "input" :
                        d.maxOutputChannels > 0 && d.maxInputChannels === 0 ? "output" :
                            "unknown",
                nativeId: d.id,
                hostApi: d.hostAPIName,
            }));
    } catch (err) {
        console.error("[audio-devices] naudiodon.getDevices falhou:", err);
        return [];
    }
}

// ─── IPC handler ──────────────────────────────────────────────────────────────

export function registerAudioDeviceHandlers(): void {
    ipcMain.handle("list-system-audio-devices", (): SystemAudioDevice[] => {
        if (process.platform === "win32") {
            return listWindowsAudioDevices();
        }
        // macOS / Linux: o renderer usa enumerateDevices() diretamente
        return [];
    });
}
