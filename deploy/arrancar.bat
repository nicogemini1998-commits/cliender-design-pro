@echo off
title Cliender Design Pro
cd /d "%~dp0"
echo.
echo   Cliender Design Pro -- start
echo.
where docker >nul 2>&1
if errorlevel 1 (
  echo   ERROR: Docker is not installed.
  echo   Get Docker Desktop at https://www.docker.com/products/docker-desktop
  pause & exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo   ERROR: Docker Desktop is not running. Start it first.
  pause & exit /b 1
)
if not exist ".env" (
  echo   ERROR: Missing .env. Run: copy .env.example .env  and fill in your API keys.
  pause & exit /b 1
)
echo   Starting services (first build takes 3-5 min)...
docker compose up -d --build
echo.
echo   Cliender Design Pro is ready!
echo   Open: http://localhost:2002
echo.
timeout /t 3 >nul
start http://localhost:2002
pause
