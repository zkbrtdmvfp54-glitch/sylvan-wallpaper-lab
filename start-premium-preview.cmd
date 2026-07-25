@echo off
setlocal
cd /d "%~dp0"

set "NODE_EXE=node"
where node >nul 2>nul
if not errorlevel 1 goto start_preview

set "NODE_EXE=C:\Users\W-SF\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%NODE_EXE%" (
  echo [SYLVAN] Node.js not found.
  echo Please install Node.js 22 or open this project through Codex.
  pause
  exit /b 1
)

:start_preview
start "SYLVAN Premium Server" /min "%NODE_EXE%" server\dev-server.mjs
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:4173/premium/"

echo [SYLVAN] Premium preview started:
echo http://127.0.0.1:4173/premium/
endlocal
