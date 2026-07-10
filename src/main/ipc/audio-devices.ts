import { ipcMain } from "electron";
import { execSync } from "child_process";

export type SystemAudioDevice = {
    name: string;
    status: "OK" | "disconnected" | "unknown";
    direction: "input" | "output" | "unknown";
};

function runPowerShell(script: string): unknown[] {
    try {
        const out = execSync(
            `powershell.exe -NoProfile -NonInteractive -Command "${script}"`,
            { encoding: "utf8", timeout: 8_000, windowsHide: true },
        );
        const parsed = JSON.parse(out.trim());
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
        return [];
    }
}

function directionFromInstanceId(id: string): "input" | "output" | "unknown" {
    if (id.includes("{0.0.0.")) return "output";
    if (id.includes("{0.0.1.")) return "input";
    return "unknown";
}

function isDevice(item: unknown): item is Record<string, unknown> {
    return typeof item === "object" && item !== null;
}

function listPnpEndpoints(): SystemAudioDevice[] {
    const ps = "Get-PnpDevice -Class AudioEndpoint | Select-Object FriendlyName,Status,InstanceId | ConvertTo-Json -Compress";
    return runPowerShell(ps)
        .filter(isDevice)
        .filter(d => typeof d["FriendlyName"] === "string")
        .map(d => ({
            name: d["FriendlyName"] as string,
            status: d["Status"] === "OK" ? "OK" : d["Status"] === "Unknown" ? "disconnected" : "unknown",
            direction: directionFromInstanceId(String(d["InstanceId"] ?? "")),
        } as SystemAudioDevice));
}

function listWmiDevices(): SystemAudioDevice[] {
    const ps = "Get-WmiObject Win32_SoundDevice | Select-Object Name,Status | ConvertTo-Json -Compress";
    return runPowerShell(ps)
        .filter(isDevice)
        .filter(d => typeof d["Name"] === "string")
        .map(d => ({
            name: d["Name"] as string,
            status: d["Status"] === "OK" ? "OK" : "unknown",
            direction: "unknown",
        } as SystemAudioDevice));
}

function listMMDevicesRegistry(): SystemAudioDevice[] {
    const ps = [
        "$r=@()",
        "$dirs=@('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Capture','HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\MMDevices\\Audio\\Render')",
        "foreach($d in $dirs){",
        "  $dir=if($d -like '*Capture*'){'input'}else{'output'}",
        "  try{foreach($dev in (Get-ChildItem $d -EA Stop)){",
        "    try{",
        "      $p=Get-ItemProperty ($dev.PSPath+'\\Properties') -EA Stop",
        "      $n=$p.'{a45c254e-df1c-4efd-8020-67d146a850e0},2'",
        "      $s=(Get-ItemProperty $dev.PSPath -EA Stop).DeviceState",
        "      if($n){$r+=[PSCustomObject]@{name=$n;direction=$dir;status=if($s-eq 1){'OK'}else{'disconnected'}}}",
        "    }catch{}}",
        "  }catch{}}",
        "$r|ConvertTo-Json -Compress",
    ].join(";");

    return runPowerShell(ps)
        .filter(isDevice)
        .filter(d => typeof d["name"] === "string")
        .map(d => ({
            name: d["name"] as string,
            status: d["status"] === "OK" ? "OK" : "disconnected",
            direction: d["direction"] as "input" | "output",
        } as SystemAudioDevice));
}

function listDirectShowDevices(): SystemAudioDevice[] {
    const captureGuid = "{33D9A762-90C8-11D0-BD43-00A0C911CE86}";
    const renderGuid = "{E0F158E1-CB04-11D0-BD4E-00A0C911CE86}";

    const ps = [
        "$r=@()",
        "function S($p,$d){ try{ Get-ChildItem $p -EA Stop | ForEach-Object { $n=(Get-ItemProperty $_.PSPath -EA Stop).FriendlyName; if($n){ $script:r+=[PSCustomObject]@{name=$n;direction=$d;status='OK'} } } }catch{} }",
        `S 'HKCU:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${captureGuid}' 'input'`,
        `S 'HKLM:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${captureGuid}' 'input'`,
        `S 'HKLM:\\SOFTWARE\\Classes\\CLSID\\${captureGuid}\\Instance' 'input'`,
        `S 'HKLM:\\SOFTWARE\\WOW6432Node\\Classes\\CLSID\\${captureGuid}\\Instance' 'input'`,
        `S 'HKCU:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${renderGuid}' 'output'`,
        `S 'HKLM:\\SOFTWARE\\Microsoft\\ActiveMovie\\devenum\\${renderGuid}' 'output'`,
        `S 'HKLM:\\SOFTWARE\\Classes\\CLSID\\${renderGuid}\\Instance' 'output'`,
        `S 'HKLM:\\SOFTWARE\\WOW6432Node\\Classes\\CLSID\\${renderGuid}\\Instance' 'output'`,
        "$r|ConvertTo-Json -Compress",
    ].join(";");

    return runPowerShell(ps)
        .filter(isDevice)
        .filter(d => typeof d["name"] === "string")
        .map(d => ({
            name: d["name"] as string,
            status: "OK",
            direction: d["direction"] as "input" | "output",
        } as SystemAudioDevice));
}

function listWindowsDevices(): SystemAudioDevice[] {
    const sources = [
        listDirectShowDevices(),
        listMMDevicesRegistry(),
        listPnpEndpoints(),
        listWmiDevices(),
    ];

    const seen = new Set<string>();
    const result: SystemAudioDevice[] = [];
    for (const device of sources.flat()) {
        const key = device.name.toLowerCase();
        if (!seen.has(key)) { seen.add(key); result.push(device); }
    }
    return result;
}

export function registerAudioDeviceHandlers(): void {
    ipcMain.handle("list-system-audio-devices", (): SystemAudioDevice[] =>
        process.platform === "win32" ? listWindowsDevices() : [],
    );
}
