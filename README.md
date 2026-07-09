# Realms Desktop — Electron App

Aplicativo desktop do Realms Web, empacotado com Electron.

Carrega a aplicação web diretamente de URLs remotas — sem dependência de build do client.

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
