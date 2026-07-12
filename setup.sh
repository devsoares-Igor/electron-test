#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
#  Realms Electron — Setup inicial
#  Executa uma única vez para preparar o ambiente de dev/build
#  Uso: bash setup.sh
# ─────────────────────────────────────────────────────────────
set -e

cd "$(dirname "$0")"

# Garante node/npm no PATH (nvm)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node | tail -1)/bin:$PATH"

WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
WIN_DIR_WSL="/mnt/c/Users/$WIN_USER/Realms-electron-app"
WIN_DIR="C:\\Users\\$WIN_USER\\Realms-electron-app"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "           Realms Electron — Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Instalar dependências no WSL ───────────────────────────
echo ""
echo "→ [1/4] Instalando dependências (WSL)..."
npm install
echo "  ✓ node_modules instalado"

# ── 2. Criar estrutura de pastas no Windows ───────────────────
echo ""
echo "→ [2/4] Preparando pasta Windows ($WIN_DIR)..."
mkdir -p "$WIN_DIR_WSL/build"
cp package.json "$WIN_DIR_WSL/package.json"
echo "  ✓ Estrutura criada"

# ── 3. Instalar dependências no Windows ───────────────────────
echo ""
echo "→ [3/4] Instalando dependências (Windows)..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  Set-Location '$WIN_DIR'

  Write-Host '  Instalando npm packages...'
  \$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  npm install --ignore-scripts 2>&1 | Select-Object -Last 3

  Write-Host '  Baixando binário do Electron...'
  node node_modules\\electron\\install.js

  Write-Host '  Baixando binário do FFmpeg...'
  node node_modules\\ffmpeg-static\\install.js

  Write-Host '  Verificando electron-builder...'
  if (Test-Path 'node_modules\\electron-builder') {
    Write-Host '  ✓ electron-builder OK'
  } else {
    Write-Host '  ✗ electron-builder não encontrado'
  }

  \$exePath = 'node_modules\\electron\\dist\\electron.exe'
  if (Test-Path \$exePath) {
    Write-Host \"  ✓ electron.exe OK\"
  } else {
    Write-Host '  ✗ electron.exe não encontrado'
  }
"

# ── 4. Build inicial para verificar ──────────────────────────
echo ""
echo "→ [4/4] Build de verificação (env=school)..."
ELECTRON_ENV=school npx electron-vite build
rsync -a --delete out/ "$WIN_DIR_WSL/out/"
echo "  ✓ Build copiado para Windows"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Setup concluído!"
echo ""
echo "  Próximos passos:"
echo ""
echo "  Dev (abre o app no Windows):"
echo "    bash run-win.sh school"
echo "    bash run-win.sh staging"
echo "    bash run-win.sh local      ← requer Vite rodando"
echo ""
echo "  Gerar installer:"
echo "    bash build-win.sh school"
echo "    bash build-win.sh staging"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
