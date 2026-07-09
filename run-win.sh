#!/usr/bin/env bash
# Builda e abre o Electron no Windows
# Uso: bash run-win.sh [local|school|staging|realms]  (padrão: school)
set -e

cd "$(dirname "$0")"

# Garante que node/npm estão no PATH (nvm não carrega quando chamado do PowerShell)
export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
export PATH="$NVM_DIR/versions/node/$(ls $NVM_DIR/versions/node | tail -1)/bin:$PATH"

ENV=${1:-school}
WIN_USER=$(cmd.exe /c "echo %USERNAME%" 2>/dev/null | tr -d '\r')
WIN_DIR_WSL="/mnt/c/Users/$WIN_USER/Realms-electron-app"
WIN_DIR_WIN="C:\\Users\\$WIN_USER\\Realms-electron-app"

echo "→ Buildando (env=$ENV)..."
ELECTRON_ENV=$ENV node scripts/build.mjs

echo "→ Copiando build/ para Windows..."
rsync -a --delete build/ "$WIN_DIR_WSL/build/"

echo "→ Iniciando Electron..."
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  \$env:PATH = [System.Environment]::GetEnvironmentVariable('PATH','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('PATH','User')
  Set-Location '$WIN_DIR_WIN'

  # 0. Garante que o binário existe (baixa se necessário)
  if (-not (Test-Path 'node_modules\\electron\\dist\\electron.exe')) {
    Write-Host '→ Baixando binário do Electron...'
    node node_modules\\electron\\install.js
  }

  # 0b. Garante ffmpeg-static (binário Windows para captura DirectShow)
  if (-not (Test-Path 'node_modules\\ffmpeg-static')) {
    Write-Host '→ Instalando ffmpeg-static...'
    npm install ffmpeg-static --no-save 2>&1
  }

  # 0c. Garante cross-env (necessário para npm run dist:school no Windows)
  if (-not (Test-Path 'node_modules\\cross-env')) {
    Write-Host '→ Instalando cross-env...'
    npm install cross-env --no-save 2>&1
  }

  # 1. Mata processos antes de copiar o exe
  Get-Process -Name 'electron','realms' -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 800

  # 2. Cria/atualiza realms.exe (cópia do electron.exe com ícone customizado)
  \$rcedit  = 'node_modules\\rcedit\\bin\\rcedit-x64.exe'
  \$realms  = 'node_modules\\electron\\dist\\realms.exe'
  \$icoPath = Resolve-Path 'build\\icons\\icon.ico' | Select-Object -ExpandProperty Path
  Copy-Item 'node_modules\\electron\\dist\\electron.exe' \$realms -Force
  if (Test-Path \$rcedit) { & \$rcedit \$realms --set-icon \$icoPath }

  # 3. Lança (sem flags de runtime — ambiente está baked no build)
  Start-Process -FilePath \$realms -ArgumentList 'build/main.js' -WorkingDirectory '$WIN_DIR_WIN'
  Write-Host 'OK'
"

echo "✓ Electron aberto (env=$ENV)"