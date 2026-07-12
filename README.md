# Realms Desktop

Aplicativo desktop do **Realms WebClient** construído com Electron + electron-vite + React + TypeScript.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework desktop | Electron 42 |
| Build tool | electron-vite 4 |
| UI | React 18 + Material UI 6 |
| Linguagem | TypeScript (strict) |
| i18n | react-i18next |
| Captura de mídia | FFmpeg (DirectShow/dshow) |

---

## Estrutura do projeto

```
├── src/
│   ├── main/               # Processo principal (Node.js)
│   │   ├── index.ts        # Entry point
│   │   ├── window.ts       # Criação de janelas
│   │   ├── config.ts       # URLs e variáveis de ambiente
│   │   ├── locale.ts       # Detecção de idioma
│   │   ├── permissions.ts  # Permissões de mídia
│   │   ├── ipc/            # Handlers IPC
│   │   │   ├── audio-capture.ts
│   │   │   ├── audio-devices.ts
│   │   │   ├── screen-capture.ts
│   │   │   └── window-control.ts
│   │   └── media/          # FFmpeg / captura DirectShow
│   │       ├── ffmpeg.ts
│   │       ├── capture-manager.ts
│   │       └── capture-session.ts
│   │
│   ├── preload/            # Bridge main ↔ renderer
│   │   ├── main.ts         # Preload da janela principal (getUserMedia, dshow)
│   │   ├── titlebar.ts     # Preload da titlebar (reload, zoom, devtools)
│   │   ├── picker.ts       # Preload do picker de tela
│   │   └── dshow-stream.ts # Módulo de captura DirectShow (importado por main.ts)
│   │
│   ├── renderer/           # React — uma pasta por janela
│   │   ├── splash/         # Tela de carregamento
│   │   ├── titlebar/       # Barra de título customizada
│   │   ├── titlebar-menu/  # Popup do menu ⋮ (zoom + devtools)
│   │   ├── offline/        # Página de erro de conexão
│   │   ├── picker/         # Seletor de compartilhamento de tela
│   │   ├── devtools-dialog/# Dialog de senha do DevTools
│   │   ├── components/     # Biblioteca de componentes MUI
│   │   │   ├── AppButton.tsx
│   │   │   ├── AppIconButton.tsx
│   │   │   ├── AppTextField.tsx
│   │   │   ├── AppIcon.tsx
│   │   │   └── ThemeRoot.tsx
│   │   ├── lib/
│   │   │   ├── i18n.ts     # Configuração react-i18next
│   │   │   └── theme.ts    # Tema MUI (dark)
│   │   └── locales/
│   │       ├── pt.json
│   │       ├── en.json
│   │       └── es.json
│   │
│   └── shared/
│       └── types/
│           ├── global.d.ts # Tipos de window.electronAPI, pickerAPI, titlebarAPI
│           └── ipc.ts      # Tipos de mensagens IPC
│
├── assets/                 # Banner do installer NSIS
├── static/icons/           # Ícones da aplicação
├── scripts/after-pack.mjs  # Hook electron-builder (electron fuses)
├── build-win.sh            # Build completo → installer Windows
├── run-win.sh              # Build + execução rápida no Windows (dev)
├── electron.vite.config.ts
└── package.json
```

---

## Ambientes

| Env | URL |
|---|---|
| `local` | `http://localhost:3000` |
| `school` | `https://schoolwebv2.ip.tv/` |
| `staging` | `https://stagingwebv2.ip.tv/` |
| `realms` | `https://realmswebv2.ip.tv/` |

---

## Desenvolvimento

### Pré-requisitos

- Node.js 20+
- WSL2 (Ubuntu) com acesso ao Windows para os scripts `.sh`

### Instalar dependências

```bash
npm install
```

### Rodar em modo desenvolvimento (Linux/WSL)

```bash
npm run dev
# abre com env=local (http://localhost:3000)
```

### Rodar no Windows via WSL

```bash
bash run-win.sh school    # env school
bash run-win.sh staging   # env staging
bash run-win.sh realms    # env realms
```

O script faz build, sincroniza `out/main`, `out/preload`, `out/renderer` para `C:\Users\<user>\Realms-electron-app` e abre o Electron.

---

## Build do installer

```bash
bash build-win.sh school    # gera installer em out/school/
bash build-win.sh staging   # gera installer em out/staging/
bash build-win.sh realms    # gera installer em out/realms/
```

Gera `Realms Setup <versão>.exe` via electron-builder (NSIS, x64 only).

---

## IPC — APIs expostas ao renderer

### `window.electronAPI` (preload: main.ts)

```ts
platform: string
isElectron: true
retry(): void                          // recarrega a URL principal
listSystemAudioDevices(): Promise<...> // lista dispositivos de áudio do SO
```

### `window.titlebarAPI` (preload: titlebar.ts)

```ts
reload(): void
openDevtools(password: string): Promise<boolean>
showDevtoolsDialog(): void
showMenu(): void          // abre/fecha o menu ⋮
getZoom(): Promise<number>
setZoom(percent: number): void
```

### `window.pickerAPI` (preload: picker.ts)

```ts
getSources(): Promise<SourceData[]>
sendResult(result: PickerResult | null): void
```

---

## i18n

Idiomas suportados: **pt**, **en**, **es**

O idioma é detectado automaticamente do `localStorage.i18nextLng` da web app. Se não disponível, usa o locale do SO (`app.getLocale()`).

Arquivos de tradução: `src/renderer/locales/*.json`

---

## FFmpeg

O `FfmpegManager` tenta resolver o binário na seguinte ordem:

1. `node_modules/ffmpeg-static` (bundled)
2. `%APPDATA%/Realms/ffmpeg/ffmpeg.exe` (userData)
3. `C:\Program Files\ffmpeg\bin\ffmpeg.exe`
4. `C:\ffmpeg\bin\ffmpeg.exe`
5. Download automático via [ffbinaries.com](https://ffbinaries.com)

---

## Versão

**1.0.0**
