#!/usr/bin/env bash
# Builda e abre o Electron no Windows
# Uso: bash run-win.sh [local|school|staging|realms] [console]  (padrão: school)
#   console  → mantém o terminal aberto mostrando os logs do Electron
set -e

cd "$(dirname "$0")"

# Garante que node/npm estão no PATH (nvm não carrega quando chamado do PowerShell)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node | tail -1)/bin:$PATH"

ENV=${1:-school}
CONSOLE=${2:-}
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
WIN_DIR_WSL="/mnt/c/Users/$WIN_USER/Realms-electron-app"
WIN_DIR_WIN="C:\\Users\\$WIN_USER\\Realms-electron-app"

echo "→ Buildando (env=$ENV)..."
ELECTRON_ENV=$ENV npx electron-vite build

echo "→ Copiando out/ para Windows..."
mkdir -p "$WIN_DIR_WSL/out/main" "$WIN_DIR_WSL/out/preload" "$WIN_DIR_WSL/out/renderer"
rsync -a --delete out/main/     "$WIN_DIR_WSL/out/main/"
rsync -a --delete out/preload/  "$WIN_DIR_WSL/out/preload/"
rsync -a --delete out/renderer/ "$WIN_DIR_WSL/out/renderer/"

PREV_HASH_FILE="$WIN_DIR_WSL/.pkg_hash"
CURR_HASH=$(md5sum package.json | cut -d' ' -f1)
PREV_HASH=$(cat "$PREV_HASH_FILE" 2>/dev/null || echo "")
cp package.json "$WIN_DIR_WSL/package.json"

if [ "$CURR_HASH" != "$PREV_HASH" ] || [ ! -d "$WIN_DIR_WSL/node_modules" ]; then
  echo "→ Instalando dependências no Windows..."
  powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
    \$env:PATH = 'C:\Program Files\nodejs;' + [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
    Set-Location '$WIN_DIR_WIN'
    npm install --ignore-scripts 2>&1 | Select-Object -Last 3
  "
  echo "$CURR_HASH" > "$PREV_HASH_FILE"
fi

echo "→ Iniciando Electron..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  \$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  Set-Location '$WIN_DIR_WIN'

  if (-not (Test-Path 'node_modules\\electron\\dist\\electron.exe')) {
    Write-Host '→ Baixando binário do Electron...'
    node node_modules\\electron\\install.js
  }

  \$ffmpegBin = (node -e 'process.stdout.write(require(\"ffmpeg-static\"))' 2>\$null)
  if (-not \$ffmpegBin -or -not (Test-Path \$ffmpegBin)) {
    Write-Host '→ Baixando FFmpeg...'
    node node_modules\\ffmpeg-static\\install.js
  }

  # Mata processos anteriores
  Get-Process -Name 'electron','realms' -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 800

  # Verifica se o build existe
  if (-not (Test-Path '$WIN_DIR_WIN\out\main\index.js')) {
    Write-Host 'ERRO: out\main\index.js nao encontrado em $WIN_DIR_WIN'
    exit 1
  }

  # Lança electron
  \$exe  = '$WIN_DIR_WIN\node_modules\electron\dist\electron.exe'
  \$main = '$WIN_DIR_WIN\out\main\index.js'
  if ('$CONSOLE' -eq 'console') {
    Write-Host '→ Modo console: terminal bloqueado até fechar o app'
    \$env:OPEN_DEVTOOLS = '1'
    \$proc = Start-Process -FilePath \$exe -ArgumentList \$main,'--no-sandbox','--disable-gpu' -WorkingDirectory '$WIN_DIR_WIN' -PassThru -Wait
    Write-Host \"→ Electron encerrado (exit code: \$(\$proc.ExitCode))\"
  } else {
    Start-Process -FilePath \$exe -ArgumentList \$main,'--no-sandbox','--disable-gpu' -WorkingDirectory '$WIN_DIR_WIN'
    Write-Host 'OK — logs em Desktop\electron-log.txt'
  }
"

echo "✓ Electron aberto (env=$ENV)${CONSOLE:+ [console]}"