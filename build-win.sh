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
ELECTRON_ENV=$ENV npx electron-vite build

echo "→ [2/4] Preparando pasta Windows ($WIN_DIR)..."
mkdir -p "$WIN_DIR/out/main" "$WIN_DIR/out/preload" "$WIN_DIR/out/renderer"
mkdir -p "$WIN_DIR/static"
mkdir -p "$WIN_DIR/assets"
mkdir -p "$WIN_DIR/scripts"
rsync -a --delete out/main/     "$WIN_DIR/out/main/"
rsync -a --delete out/preload/  "$WIN_DIR/out/preload/"
rsync -a --delete out/renderer/ "$WIN_DIR/out/renderer/"
rsync -a --delete static/       "$WIN_DIR/static/"
rsync -a --delete assets/       "$WIN_DIR/assets/"
rsync -a --delete scripts/      "$WIN_DIR/scripts/"

# Copia package.json e detecta se mudou para decidir se roda npm install
PREV_HASH_FILE="$WIN_DIR/.pkg_hash"
CURR_HASH=$(md5sum package.json | cut -d' ' -f1)
PREV_HASH=$(cat "$PREV_HASH_FILE" 2>/dev/null || echo "")
cp package.json "$WIN_DIR/package.json"

echo "→ [3/4] Instalando dependências no Windows (se necessário)..."
if [ "$CURR_HASH" = "$PREV_HASH" ] && [ -d "$WIN_DIR/node_modules" ]; then
  echo "  package.json não mudou — pulando npm install"
else
  echo "  package.json mudou — rodando npm install..."
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
    Set-Location '$WIN_DIR_WIN'
    \$env:PATH = 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
    npm install --ignore-scripts 2>&1 | Select-Object -Last 3
  "
  echo "$CURR_HASH" > "$PREV_HASH_FILE"
fi

powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  Set-Location '$WIN_DIR_WIN'
  \$env:PATH = 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  if (-not (Test-Path 'node_modules\\electron\\dist\\electron.exe')) {
    Write-Host '  Baixando binário do Electron...'
    node node_modules\\electron\\install.js
  }
  \$ffmpegBin = (node -e 'process.stdout.write(require(\"ffmpeg-static\"))' 2>\$null)
  if (-not \$ffmpegBin -or -not (Test-Path \$ffmpegBin)) {
    Write-Host '  Baixando FFmpeg...'
    node node_modules\\ffmpeg-static\\install.js
  }
  Write-Host '  Dependências OK'
"

echo "→ [4/4] Gerando installer com electron-builder (saída: out/$ENV)..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  Set-Location '$WIN_DIR_WIN'

  # Cria pasta de saída do ambiente se ainda não existir
  New-Item -ItemType Directory -Force -Path "out\\$ENV" | Out-Null

  # Remove intermediários .7z do NSIS de builds anteriores para evitar falha de mmap
  Get-ChildItem -Path 'out' -Filter '*.7z' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Get-ChildItem -Path 'out' -Filter '*.blockmap' -ErrorAction SilentlyContinue | Remove-Item -Force -ErrorAction SilentlyContinue
  Remove-Item -Path 'out\win-unpacked'     -Recurse -Force -ErrorAction SilentlyContinue
  Remove-Item -Path 'out\win-ia32-unpacked' -Recurse -Force -ErrorAction SilentlyContinue

  \$env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
  \$env:CSC_LINK = ''
  \$env:WIN_CSC_LINK = ''
  \$env:CSC_KEY_PASSWORD = ''
  \$env:PATH = 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  node node_modules\electron-builder\out\cli\cli.js --win --config.npmRebuild=false 2>&1

  # Move os arquivos gerados para a pasta do ambiente
  Write-Host '  Movendo installer para out\$ENV...'
  New-Item -ItemType Directory -Force -Path "out\\$ENV" | Out-Null
  Get-ChildItem -Path 'out' -Filter '*.exe'      -File | Move-Item -Destination "out\\$ENV" -Force
  Get-ChildItem -Path 'out' -Filter '*.blockmap' -File | Move-Item -Destination "out\\$ENV" -Force
  Get-ChildItem -Path 'out' -Filter '*.yaml'     -File | Move-Item -Destination "out\\$ENV" -Force -ErrorAction SilentlyContinue
  Get-ChildItem -Path 'out' -Filter '*.yml'      -File | Move-Item -Destination "out\\$ENV" -Force -ErrorAction SilentlyContinue
"

echo ""
echo "✓ Installer gerado em: $WIN_DIR_WIN\\out\\$ENV\\"
