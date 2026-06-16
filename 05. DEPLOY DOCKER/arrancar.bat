@echo off
title Cliender DesignPro V1
cd /d "%~dp0"
echo.
echo   Cliender DesignPro V1 -- Arranque
echo.
where docker >nul 2>&1
if errorlevel 1 (
  echo   ERROR: Docker no esta instalado.
  echo   Descarga Docker Desktop desde https://www.docker.com/products/docker-desktop
  pause & exit /b 1
)
docker info >nul 2>&1
if errorlevel 1 (
  echo   ERROR: Docker Desktop no esta corriendo. Abrelo primero.
  pause & exit /b 1
)
if not exist ".env.cdpro" (
  echo   ERROR: Falta .env.cdpro. Asegurate de que OneDrive haya sincronizado.
  pause & exit /b 1
)
echo   Levantando servicios (primera vez tarda 3-5 min)...
for /f %%i in ('powershell -command "[DateTimeOffset]::UtcNow.ToUnixTimeSeconds()"') do set CACHEBUST=%%i
docker compose build --build-arg CACHEBUST=%CACHEBUST% cdpro-prototype
docker compose up -d --build
echo.
echo   Cliender DesignPro esta listo!
echo   Abre: http://localhost:2002
echo   Usuario: [tu email]@cliender.com  ^|  Contrasena: Cliender123
echo.
timeout /t 3 >nul
start http://localhost:2002
pause
