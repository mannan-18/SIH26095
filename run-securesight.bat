@echo off
setlocal

cd /d "%~dp0"

echo SecureSight MVP launcher
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js 22 or newer is required.
  exit /b 1
)

where pnpm >nul 2>nul
if errorlevel 1 (
  echo pnpm was not found. Using Corepack without installing a protected system shim...
  where corepack >nul 2>nul
  if not errorlevel 1 (
    corepack pnpm --version >nul 2>nul
    if not errorlevel 1 (
      set "PNPM_CMD=corepack pnpm"
      goto pnpm_ready
    )
  )
  echo Corepack is unavailable or blocked. Using npm to run pnpm temporarily...
  set "PNPM_CMD=npx --yes pnpm@10.4.1"
)

:pnpm_ready

echo Installing dependencies...
%PNPM_CMD% install
if errorlevel 1 exit /b 1

echo Running TypeScript validation...
%PNPM_CMD% check
if errorlevel 1 exit /b 1

echo Running tests...
%PNPM_CMD% test
if errorlevel 1 exit /b 1

echo Starting SecureSight on http://localhost:3000 ...
%PNPM_CMD% dev

endlocal
