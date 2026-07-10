# Realms Desktop — Electron App

Aplicativo desktop do Realms Web, empacotado com Electron.

Carrega a aplicação web diretamente de URLs remotas — sem dependência de build do client.
Suporta captura de dispositivos de áudio virtuais (vMix, VB-Cable) via pipeline FFmpeg → WebAudio → WebRTC.

---

## Pré-requisitos

- **Node.js 20+** via nvm no WSL
- **Node.js 20+** instalado no Windows (detectado automaticamente pelo PATH)
- **Git** no WSL

---

## Setup inicial (apenas na primeira vez)

```bash
bash setup.sh
```

Instala dependências no WSL e no Windows e faz um build de verificação.

---

## Rodar em modo dev (abre o app no Windows)

```bash
bash run-win.sh school     # https://schoolwebv2.ip.tv/
bash run-win.sh staging    # https://stagingwebv2.ip.tv/
bash run-win.sh realms     # https://realmswebv2.ip.tv/
bash run-win.sh local      # http://localhost:3000  (requer servidor local rodando)
```

O script faz automaticamente: build TypeScript → copia `build/` para Windows → instala binários (Electron, FFmpeg, cross-env) → abre o app.

---

## Gerar installer Windows (.exe)

**No PowerShell do Windows** (`C:\Users\<usuario>\Realms-electron-app`):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
npm run dist:school     # installer para School
npm run dist:staging    # installer para Staging
npm run dist:realms     # installer para Realms
```

**No WSL (Linux):**

```bash
npm run dist:school:linux    # .AppImage + .deb para School
```

### Saída

```
out/
  Realms Setup 1.x.x.exe    ← Installer NSIS (x64 + ia32)
  Realms 1.x.x.exe          ← Portable (x64)
```

---

## Scripts npm

| Comando | Descrição |
|---|---|
| `npm run dev` | Build local + abre Electron (WSL) |
| `npm run build:<env>` | Compila para o ambiente especificado |
| `npm run start:<env>` | Build + abre Electron (Windows, sem script shell) |
| `npm run dist:<env>` | Build + gera installer Windows |
| `npm run dist:<env>:linux` | Build + gera pacote Linux |
| `npm run typecheck` | Verifica tipos TypeScript sem compilar |
| `npm run lint` | Roda ESLint em `src/` |
| `npm run format` | Formata `src/` e `static/` com Prettier |
| `npm run generate:icons` | Gera ícones a partir de `static/logo_loading.svg` |

---

## Ambientes

| Env | URL carregada |
|---|---|
| `local` | `http://localhost:3000/?source=schoolwebv2.ip.tv` |
| `school` | `https://schoolwebv2.ip.tv/` |
| `staging` | `https://stagingwebv2.ip.tv/` |
| `realms` | `https://realmswebv2.ip.tv/` |

O ambiente é baked no build via `esbuild define` — não há variável de runtime.

---

## Estrutura do projeto

```
src/
  main/
    ipc/
      index.ts             ← registra todos os handlers IPC
      audio-capture.ts     ← dshow:start / dshow:stop (captura DirectShow via FFmpeg)
      audio-devices.ts     ← list-system-audio-devices (PowerShell + registry)
      screen-capture.ts    ← show-source-picker, get-screen-sources
      window-control.ts    ← retry-load, reload-view, devtools
    media/
      ffmpeg.ts            ← FfmpegManager: resolve binário (bundled → PATH → download)
      capture-session.ts   ← CaptureSession: 1 processo FFmpeg por dispositivo
      capture-manager.ts   ← CaptureManager: 1 sessão ativa por WebContents
    config.ts              ← URLs e flags por ambiente
    i18n.ts                ← detecção de idioma (app.getLocale → pt / en / es)
    index.ts               ← entry point do processo principal
    permissions.ts         ← permissões de mídia
    window.ts              ← criação das janelas e WebContentsView
  preload/
    main.ts                ← preload da janela principal (getUserMedia + enumerateDevices overrides)
    dshow-stream.ts        ← pipeline DirectShow: AudioContext + GainNode + AudioBufferSourceNode
    picker.ts              ← preload do seletor de tela (contextBridge)
    titlebar.ts            ← preload da barra de título (contextBridge)
  picker/
    App.tsx                ← UI do seletor de tela (React + MUI)
    index.tsx              ← mount do React
  shared/
    types/
      ipc.ts               ← tipos SourceData e PickerResult
      global.d.ts          ← augmentação do Window (electronAPI, pickerAPI, titlebarAPI)

static/
  icons/                   ← ícones da aplicação
  devtools-dialog.html     ← dialog de senha para DevTools (i18n: pt/en/es)
  offline.html             ← tela de erro de conexão (i18n: pt/en/es)
  picker.html              ← janela de seleção de tela
  splash.html              ← splash screen (i18n: pt/en/es)
  titlebar.html            ← barra de título customizada (i18n: pt/en/es)
  logo_loading.svg         ← logo do splash screen

assets/
  installer-banner-resized.bmp  ← banner do installer NSIS (build only)

scripts/
  build.mjs                ← compila todo o projeto via esbuild
  generate-icons.mjs       ← gera ícones a partir do SVG
```

---

## Captura de áudio virtual (vMix, VB-Cable)

Dispositivos de áudio DirectShow (como vMix Audio) não são expostos pelo WASAPI padrão do Chrome.
O app contorna isso com um pipeline proprietário:

```
vMix (DirectShow)
  → FFmpeg -f dshow (captura PCM)
  → Electron IPC (chunks de áudio)
  → WebAudio AudioBufferSourceNode
  → MediaStreamDestinationNode
  → getUserMedia interceptado no preload
  → WebRTC transmite normalmente
```

O FFmpeg é detectado automaticamente (ffmpeg-static bundado, PATH, ou download automático via ffbinaries.com).

---

## i18n

O idioma é detectado via `app.getLocale()` e passado como `?locale=<lang>` para cada página HTML.
Suporte atual: **pt** (Português), **en** (English), **es** (Español).

---

## Google OAuth

O popup do Google (`accounts.google.com`) abre dentro do Electron com User-Agent de Chrome real,
permitindo que o GSI (`@react-oauth/google`) funcione via `postMessage` sem precisar de VB-Cable ou PKCE externo.

---

## Ferramentas de qualidade

- **TypeScript 6** com `strict: true`
- **ESLint 9** (flat config)
- **Prettier 3**
- **Imports ordenados por comprimento de linha** (menor → maior), sem auto-organização

---

## Pré-requisitos

- **Node.js 20+** via nvm no WSL
- **Node.js 20+** instalado no Windows (qualquer diretório, detectado automaticamente pelo PATH)
- **Git** no WSL

---

## Setup inicial (apenas na primeira vez)

```bash
bash setup.sh
```

Instala as dependências no WSL e no Windows e faz um build de verificação.

---

## Rodar em modo dev (abre o app no Windows)

```bash
bash run-win.sh school     # https://schoolwebv2.ip.tv/
bash run-win.sh staging    # https://stagingwebv2.ip.tv/
bash run-win.sh realms     # https://realmswebv2.ip.tv/
bash run-win.sh local      # http://localhost:3000  (requer servidor local rodando)
```

---

## Gerar installer Windows (.exe)

```bash
bash build-win.sh school     # installer para School
bash build-win.sh staging    # installer para Staging
bash build-win.sh realms     # installer para Realms
```

O processo faz automaticamente:

1. Build do main process (TypeScript via esbuild)
2. Copia artefatos para o Windows
3. Roda `electron-builder` no Windows via PowerShell

### Saída

```
C:\Users\<usuario>\Realms-electron-app\out\<env>\
  Realms Setup 1.x.x.exe    <- Installer NSIS (x64 + ia32)
  Realms 1.x.x.exe          <- Portable (x64)
```

---

## Scripts npm

| Comando | Descrição |
|---|---|
| `npm run dev` | Build local + abre Electron no WSL |
| `npm run build:local` | Compila para ambiente local |
| `npm run build:school` | Compila para School |
| `npm run build:staging` | Compila para Staging |
| `npm run build:realms` | Compila para Realms |
| `npm run typecheck` | Verifica tipos TypeScript sem compilar |
| `npm run lint` | Roda ESLint em `src/` |
| `npm run format` | Formata `src/` e `static/` com Prettier |
| `npm run generate:icons` | Gera ícones da aplicação a partir do SVG |

---

## Ambientes

| Env | URL carregada |
|---|---|
| `local` | `http://localhost:3000/?source=schoolwebv2.ip.tv` |
| `school` | `https://schoolwebv2.ip.tv/` |
| `staging` | `https://stagingwebv2.ip.tv/` |
| `realms` | `https://realmswebv2.ip.tv/` |

O ambiente é baked no build via `esbuild define` — não há variável de runtime.

---

## Estrutura do projeto

```
src/
  main/
    config.ts          <- URLs e flags por ambiente (fonte única de verdade)
    index.ts           <- entry point do processo principal
    window.ts          <- criação das janelas e WebContentsView
    permissions.ts     <- permissões de mídia (câmera, mic, tela)
    ipc/
      index.ts         <- agrega e registra todos os handlers IPC
      screen-capture.ts  <- show-source-picker, get-screen-sources
      window-control.ts  <- retry-load, reload-view
  preload/
    main.ts            <- preload da janela principal (WebContentsView)
    titlebar.ts        <- preload da barra de título (contextBridge)
  picker/
    App.tsx            <- UI do seletor de tela (React + MUI)
    index.tsx          <- mount do React
    preload.ts         <- preload do picker (contextBridge, contextIsolation: true)
  shared/
    types/
      ipc.ts           <- tipos SourceData e PickerResult
      global.d.ts      <- augmentação do Window (electronAPI, pickerAPI, titlebarAPI)

static/                <- HTMLs e assets usados pelo Electron
  icons/               <- ícones da aplicação (gerados por generate-icons.mjs)
  offline.html         <- tela de erro de conexão
  picker.html          <- janela de seleção de tela
  splash.html          <- splash screen
  titlebar.html        <- barra de título customizada

scripts/
  build.mjs            <- compila o processo principal via esbuild
  generate-icons.mjs   <- gera ícones a partir do static/logo_loading.svg
```

---

## Ferramentas de qualidade

- **TypeScript 6** com `strict: true`
- **ESLint 9** (flat config) — bloqueia import direto de `ipcRenderer` fora dos preloads
- **Prettier 3** — formatação automática ao salvar (configurado em `.vscode/settings.json`)
