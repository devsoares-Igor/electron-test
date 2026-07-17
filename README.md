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
│   ├── main/                        # Processo principal (Node.js)
│   │   ├── index.ts                 # Entry point
│   │   ├── window.ts                # Criação de janelas, titleBarOverlay adaptativo
│   │   ├── config.ts                # URLs e variáveis de ambiente
│   │   ├── locale.ts                # Detecção de idioma (SO + web app)
│   │   ├── permissions.ts           # Permissões de câmera/microfone
│   │   ├── accounts/
│   │   │   ├── SessionManager.ts    # CRUD de sessões (JSON + keychain)
│   │   │   ├── CredentialManager.ts # Criptografia de senhas
│   │   │   ├── RealmResolver.ts     # Resolução de URL de API por realm
│   │   │   └── types.ts             # PendingSession, AutoLoginResult (re-exporta SavedAccount do shared)
│   │   ├── ipc/
│   │   │   ├── index.ts             # Registro central de todos os handlers
│   │   │   ├── accounts.ts          # Login automático, salvar/remover sessões
│   │   │   ├── audio-capture.ts     # DirectShow audio
│   │   │   ├── audio-devices.ts     # Enumeração de dispositivos
│   │   │   ├── screen-capture.ts    # Fontes de compartilhamento de tela
│   │   │   └── window-control.ts    # Zoom, menu titlebar, reload
│   │   └── media/
│   │       ├── ffmpeg.ts            # Download e resolução do binário FFmpeg
│   │       ├── capture-manager.ts   # Gerenciador de sessões de captura ativas
│   │       └── capture-session.ts   # Sessão individual de captura DirectShow
│   │
│   ├── preload/                     # Bridge main ↔ renderer (contextBridge)
│   │   ├── main.ts                  # Preload da view principal:
│   │   │                            #   · Injeção de sessão no localStorage
│   │   │                            #   · Interceptação fetch/XHR para detectar login
│   │   │                            #   · Design System CSS injection 
│   │   │                            #   · Botão flutuante "Trocar de conta"
│   │   │                            #   · Override getUserMedia para captura DirectShow
│   │   ├── titlebar.ts              # Preload da titlebar e menus (contextBridge)
│   │   ├── save-session.ts          # Preload do diálogo de salvar sessão (contextBridge)
│   │   ├── clear-cache-confirm.ts   # Preload do diálogo de limpar cache (contextBridge)
│   │   ├── picker.ts                # Preload do picker de tela (contextBridge)
│   │   └── dshow-stream.ts          # Módulo de captura de áudio via DirectShow
│   │
│   ├── renderer/                    # React — uma pasta por janela Electron
│   │   ├── splash/                  # Tela de carregamento (logo + glow + barra de progresso)
│   │   ├── titlebar/                # Barra de título customizada (adaptativa light/dark)
│   │   ├── titlebar-menu/           # Popup do menu ⋮ (zoom, trocar conta, limpar cache — adaptativo light/dark)
│   │   ├── offline/                 # Página de erro de conexão / dev server offline
│   │   ├── picker/                  # Seletor de compartilhamento de tela/janela
│   │   ├── account-select/          # Tela de seleção de conta salva
│   │   │   ├── App.tsx              # Componente principal (Netflix-style grid, light/dark)
│   │   │   └── icons.tsx            # Ícones SVG específicos desta tela
│   │   ├── save-session/            # Diálogo flutuante "Salvar sessão" (light/dark)
│   │   ├── clear-cache-confirm/     # Diálogo flutuante "Limpar cache" (light/dark)
│   │   │
│   │   ├── components/              # Design System — componentes MUI reutilizáveis
│   │   │   ├── AppButton.tsx        # Wrapper de Button com variant="contained" default
│   │   │   ├── AppIconButton.tsx    # Wrapper de IconButton com size="small" default
│   │   │   ├── AppTextField.tsx     # Wrapper de TextField com size="small" e fullWidth default
│   │   │   ├── AppIcon.tsx          # Ícones SVG nomeados (offline, devserver, reload, zoomIn)
│   │   │   ├── ThemeRoot.tsx        # ThemeProvider + CssBaseline wrapper
│   │   │   └── index.ts             # Re-exports de todos os componentes
│   │   │
│   │   ├── lib/
│   │   │   ├── i18n.ts             # Configuração react-i18next (detecção via ?locale=)
│   │   │   └── theme.ts            # Tokens de design + baseTheme MUI + buildLightDarkTheme()
│   │   │
│   │   └── locales/
│   │       ├── pt.json             # Português
│   │       ├── en.json             # English
│   │       └── es.json             # Español
│   │
│   └── shared/
│       └── types/
│           ├── global.d.ts         # window.electronAPI, accountsAPI, titlebarAPI, pickerAPI, clearCacheAPI
│           └── ipc.ts              # Tipos IPC compartilhados: SavedAccount, SourceData, PickerResult
│
├── assets/                         # Banner do installer NSIS
├── static/icons/                   # Ícones da aplicação (.ico, .icns, .png)
├── scripts/after-pack.mjs          # Hook electron-builder (electron fuses)
├── build-win.sh                    # Build completo → installer Windows
├── run-win.sh                      # Build + execução rápida no Windows (dev)
├── setup.sh                        # Setup inicial (instala deps WSL + Windows)
├── electron.vite.config.ts
└── package.json
```

---

## Design System

O Design System é centralizado em `src/renderer/lib/theme.ts` e reutilizado em todos os renderers.

### Paleta de cores (`colors`)

```ts
colors = {
    bg:      "#0F172A",  // fundo principal (dark)
    bg2:     "#1E293B",  // cards / titlebar (dark)
    bg3:     "#334155",  // hover / inputs (dark)
    bg4:     "#475569",  // bordas / scrollbar (dark)
    text:    "#F1F5F9",  // texto primário
    text2:   "#94A3B8",  // texto secundário
    text3:   "#64748B",  // texto desabilitado
    accent:  "#1D4ED8",  // azul primário
    accentL: "#60A5FA",  // azul primário claro
    accentH: "#1E40AF",  // azul primário escuro
    green:   "#10B981",  // sucesso / terciário
}
```

### Temas disponíveis

| Função | Uso |
|---|---|
| `baseTheme` | Tema dark padrão para todos os renderers |
| `buildLightDarkTheme(mode)` | Estende `baseTheme` com suporte a `"light"` ou `"dark"`. Usado em renderers com suporte adaptativo ao sistema (`account-select`, `save-session`, `titlebar`, `titlebar-menu`) |

### Regras de uso

- Todos os botões usam `AppButton` ou `AppIconButton` — nunca `Button`/`IconButton` diretamente
- Todos os campos usam `AppTextField`
- Toda janela de renderer usa `ThemeRoot` como wrapper raiz
- Cores hardcoded são substituídas por tokens `colors.*` ou `alpha(colors.*, opacidade)`
- Strings visíveis ao usuário sempre passam por `t()` (i18n)

### Componentes e respectivos wrappers

| MUI | Wrapper | Padrões aplicados |
|---|---|---|
| `Button` | `AppButton` | `variant="contained"`, `textTransform: none`, `borderRadius: 8`, `fontWeight: 600` |
| `IconButton` | `AppIconButton` | `size="small"` |
| `TextField` | `AppTextField` | `size="small"`, `fullWidth: true` |
| `SvgIcon` | `AppIcon` | Ícones nomeados: `offline`, `devserver`, `devtools`, `reload`, `zoomIn` |

---

## Suporte a Tema Claro/Escuro

A aplicação detecta o tema do sistema operacional via:

- **Renderers React**: `useMediaQuery("(prefers-color-scheme: dark)")` + `buildLightDarkTheme(mode)`
- **Botões nativos (−□×)**: `nativeTheme.shouldUseDarkColors` + `win.setTitleBarOverlay()` atualizado em `nativeTheme.on("updated")`
- **CSS injection no webapp**: `@media (prefers-color-scheme: dark)` no CSS injetado pelo preload

---

## CSS Injection (padrão Discord/Slack)

O preload `main.ts` injeta CSS global no webapp via `document.head` assim que o DOM estiver disponível:

```
:root { --realms-bg, --realms-accent, --realms-font, ... }  /* CSS custom properties */
::-webkit-scrollbar { ... }                                  /* Scrollbar 6px discreta */
::selection { background: rgba(29,78,216,0.28) }             /* Seleção com accent blue */
*, *::before, *::after { -webkit-font-smoothing: antialiased } /* Font smoothing */
body::before { ... gradient shadow ... }                     /* Separador titlebar → webapp */
```

O CSS é **não-destrutivo** — apenas adiciona camadas de baixa especificidade sem sobrescrever estilos do webapp.

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
npm run dev          # env=local   (http://localhost:3000)
npm run dev:school   # env=school  (https://schoolwebv2.ip.tv/)
npm run dev:staging  # env=staging (https://stagingwebv2.ip.tv/)
npm run dev:realms   # env=realms  (https://realmswebv2.ip.tv/)
```

Nos ambientes não-locais (`school`, `staging`, `realms`) a webview carrega a URL remota diretamente, sem depender de um servidor local — o hot-reload do processo main/preload continua funcionando normalmente.

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
list(): Promise<SavedAccount[]>              // lista contas salvas
count(): Promise<number>                     // total de contas
login(id: string): Promise<AutoLoginResult>  // auto-login via API
remove(id: string): Promise<void>
removeAll(): Promise<void>
loadApp(): void                              // carrega a web app (sessão atual)
loadFresh?(): void                           // carrega sem sessão (login fresco)
savePending(): Promise<void>                 // confirma e salva a sessão pendente
skipSave(): Promise<void>                    // descarta a sessão pendente
getPending(): Promise<PendingSession|null>   // retorna dados da sessão pendente
```

> **Fluxo de auto-login:** ao navegar para `/login` com contas salvas, a app redireciona automaticamente para `account-select`. Ao fazer login via web, o preload intercepta o POST `/device` e dispara o diálogo `save-session`.

---

### `window.electronAPI` (preload: main.ts)

```ts
platform: string
isElectron: true
retry(): void                           // recarrega a URL principal
listSystemAudioDevices(): Promise<...>  // lista dispositivos de áudio do SO
```

### `window.titlebarAPI` (preload: titlebar.ts)

```ts
reload(): void
showMenu(): void                        // abre/fecha o menu ⋮
getZoom(): Promise<number>              // zoom atual em %
setZoom(percent: number): void          // define zoom (50–200%)
showAccountSelect?(): void              // volta para account-select
hasSavedAccounts?(): Promise<boolean>   // há contas salvas?
clearCache?(): void                     // abre o diálogo "Limpar cache"
```

### `window.clearCacheAPI` (preload: clear-cache-confirm.ts)

```ts
confirm(): Promise<void>  // confirma: limpa storage/cache da view principal e recarrega
cancel(): Promise<void>   // cancela e fecha o diálogo
```

> A mensagem exibida varia conforme a rota atual da view principal: se estiver em
> `/`, `/login` ou na tela local `account-select`, o usuário já está deslogado e o
> aviso de "você será desconectado" não é exibido (ver `clearCache.messageLoggedOut`).

### `window.pickerAPI` (preload: picker.ts)

```ts
getSources(): Promise<SourceData[]>
sendResult(result: PickerResult | null): void
```

---

## Tipos compartilhados

Definidos em `src/shared/types/ipc.ts` — disponíveis tanto no processo principal quanto nos renderers:

```ts
interface SavedAccount {     // Conta salva no dispositivo
    id, realm, nick, name, apiBaseUrl, lastAccess, avatarColor
}
interface SourceData {       // Fonte de compartilhamento de tela
    id, name, thumbnail
}
interface PickerResult {     // Resultado da seleção de tela
    id, audio
}
```

> `SavedAccount` é a fonte única de verdade — re-exportada de `main/accounts/types.ts` e importada diretamente em `renderer/account-select/App.tsx`.

---

## i18n

Idiomas suportados: **pt** (padrão), **en**, **es**

O idioma é detectado via parâmetro `?locale=` na URL gerada pelo processo principal (`resolveLocale()`), que verifica `localStorage.i18nextLng` da web app ou usa o locale do SO via `app.getLocale()`.

Arquivos de tradução: `src/renderer/locales/*.json`

---

## FFmpeg

O `FfmpegManager` resolve o binário na seguinte ordem:

1. `node_modules/ffmpeg-static` (bundled)
2. `%APPDATA%/Realms/ffmpeg/ffmpeg.exe` (userData)
3. `C:\Program Files\ffmpeg\bin\ffmpeg.exe`
4. `C:\ffmpeg\bin\ffmpeg.exe`
5. Download automático via [ffbinaries.com](https://ffbinaries.com)

---

## Versão

**1.2.0**
