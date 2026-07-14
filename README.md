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
│   │   ├── accounts/       # Gerenciamento de contas salvas
│   │   │   ├── SessionManager.ts   # CRUD de sessões (JSON + keychain)
│   │   │   ├── CredentialManager.ts# Criptografia de senhas
│   │   │   ├── RealmResolver.ts    # Resolução de URL de API por realm
│   │   │   └── types.ts
│   │   ├── ipc/            # Handlers IPC
│   │   │   ├── accounts.ts # Login automático, salvar/remover sessões
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
│   │   ├── main.ts         # Preload da janela principal (getUserMedia, dshow, botão trocar conta)
│   │   ├── titlebar.ts     # Preload da titlebar (reload, zoom, devtools)
│   │   ├── save-session.ts # Preload do diálogo de salvar sessão
│   │   ├── picker.ts       # Preload do picker de tela
│   │   └── dshow-stream.ts # Módulo de captura DirectShow
│   │
│   ├── renderer/           # React — uma pasta por janela
│   │   ├── splash/         # Tela de carregamento
│   │   ├── titlebar/       # Barra de título customizada
│   │   ├── titlebar-menu/  # Popup do menu ⋮ (zoom + trocar conta)
│   │   ├── offline/        # Página de erro de conexão
│   │   ├── picker/         # Seletor de compartilhamento de tela
│   │   ├── account-select/ # Tela de seleção de conta salva
│   │   ├── save-session/   # Diálogo flutuante "Salvar sessão"
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
│           ├── global.d.ts # Tipos de window.electronAPI, accountsAPI, titlebarAPI
│           └── ipc.ts      # Tipos de mensagens IPC
│
├── assets/                 # Banner do installer NSIS
├── static/icons/           # Ícones da aplicação
├── scripts/after-pack.mjs  # Hook electron-builder (electron fuses)
├── build-win.sh            # Build completo → installer Windows
├── run-win.sh              # Build + execução rápida no Windows (dev)
├── setup.sh                # Setup inicial (instala deps WSL + Windows)
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

### `window.accountsAPI` (preload: main.ts + save-session.ts)

```ts
list(): Promise<SavedAccount[]>          // lista contas salvas
count(): Promise<number>                 // total de contas
login(id: string): Promise<AutoLoginResult> // auto-login via API
remove(id: string): Promise<void>
removeAll(): Promise<void>
loadApp(): void                          // carrega a web app
loadFresh?(): void                       // carrega sem sessão salva
savePending(): Promise<void>             // salva a sessão pendente
skipSave(): Promise<void>               // descarta a sessão pendente
getPending(): Promise<PendingSession|null>
```

> **Fluxo de auto-login:** ao navegar para `/login` com contas salvas, a app redireciona automaticamente para `account-select`. Ao fazer login via web, o preload intercepta o POST `/device` e dispara o diálogo `save-session`.

---

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
showMenu(): void                              // abre/fecha o menu ⋮
getZoom(): Promise<number>
setZoom(percent: number): void
showAccountSelect?(): void                    // volta para account-select
hasSavedAccounts?(): Promise<boolean>         // há contas salvas?
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

**1.2.0**
