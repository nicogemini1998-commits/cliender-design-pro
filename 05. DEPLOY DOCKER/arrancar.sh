#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# Cliender DesignPro V1 — Script de arranque del equipo
# Uso: ./arrancar.sh          → levanta la herramienta
#      ./arrancar.sh stop     → para la herramienta
#      ./arrancar.sh restart  → reinicia todos los servicios
#      ./arrancar.sh logs     → muestra logs en tiempo real
# ─────────────────────────────────────────────────────────────────────────
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

case "${1:-}" in
  stop)
    echo "Deteniendo Cliender DesignPro..."
    docker compose down
    echo "Detenido."
    ;;
  restart)
    echo "Reiniciando Cliender DesignPro..."
    docker compose down
    docker compose up -d --build
    echo "Reiniciado. Abre http://localhost:2002"
    ;;
  logs)
    docker compose logs -f --tail=100
    ;;
  *)
    echo ""
    echo "  Cliender DesignPro V1 — Arranque"
    echo ""

    # Verificar Docker
    if ! command -v docker &>/dev/null; then
      echo "  ERROR: Docker no esta instalado."
      echo "  Descarga Docker Desktop desde https://www.docker.com/products/docker-desktop"
      exit 1
    fi
    if ! docker info &>/dev/null 2>&1; then
      echo "  ERROR: Docker Desktop no esta corriendo. Abrelo primero."
      exit 1
    fi

    # Verificar .env.cdpro
    if [ ! -f ".env.cdpro" ]; then
      echo "  ERROR: Falta el archivo .env.cdpro en esta carpeta."
      echo "  Asegurate de que OneDrive haya sincronizado correctamente."
      exit 1
    fi

    echo "  Levantando servicios (primera vez tarda 3-5 min)..."
    docker compose up -d --build

    echo ""
    echo "  Cliender DesignPro esta listo!"
    echo ""
    echo "  Abre en tu navegador: http://localhost:2002"
    echo "  Usuario: [tu email]@cliender.com"
    echo "  Contrasena: Cliender123"
    echo ""
    echo "  Para parar:     ./arrancar.sh stop"
    echo "  Para los logs:  ./arrancar.sh logs"
    echo ""

    sleep 3
    open "http://localhost:2002" 2>/dev/null || true
    ;;
esac
