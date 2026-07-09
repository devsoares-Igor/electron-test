#!/usr/bin/env bash
# Build completo para distribuição Windows (NSIS installer + portable)
# Uso: bash build-win.sh [school|staging|realms]  (padrão: school)
set -e

cd "$(dirname "$0")"

# Garante que node/npm estão no PATH (nvm não carrega quando chamado do PowerShell)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node | tail -1)/bin:$PATH"

ENV=${1:-school}
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
WIN_DIR="/mnt/c/Users/$WIN_USER/Realms-electron-app"
WIN_DIR_WIN="C:\\Users\\$WIN_USER\\Realms-electron-app"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Realms Electron — Build Installer (env=$ENV)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "→ [1/4] Buildando main process (env=$ENV)..."
ELECTRON_ENV=$ENV node scripts/build.mjs

echo "→ [2/4] Preparando pasta Windows ($WIN_DIR)..."
mkdir -p "$WIN_DIR/build"
mkdir -p "$WIN_DIR/static"
rsync -a --delete build/  "$WIN_DIR/build/"
rsync -a --delete static/ "$WIN_DIR/static/"
cp package.json           "$WIN_DIR/package.json"

echo "→ [3/4] Instalando dependências no Windows (se necessário)..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  Set-Location '$WIN_DIR_WIN'
  \$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  if (-not (Test-Path 'node_modules\\electron-builder')) {
    Write-Host '  Instalando npm packages...'
    npm install --ignore-scripts
  }
  if (-not (Test-Path 'node_modules\\electron\\dist\\electron.exe')) {
    Write-Host '  Baixando binário do Electron...'
    node node_modules\\electron\\install.js
  }
  Write-Host '  Dependências OK'
"

echo "→ [4/4] Gerando installer com electron-builder (saída: out/$ENV)..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  Set-Location '$WIN_DIR_WIN'

  # Limpa build anterior deste ambiente para evitar 'Can't open output file'
  if (Test-Path 'out\\$ENV') {
    Write-Host '  Limpando out/$ENV anterior...'
    Remove-Item -Recurse -Force 'out\\$ENV' -ErrorAction SilentlyContinue
  }

  \$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  & cmd.exe /c 'node_modules\\.bin\\electron-builder.cmd' --win --x64 --config.directories.output=out\\$ENV 2>&1
"

echo ""
echo "✓ Installer gerado em: $WIN_DIR_WIN\\out\\$ENV\\"
