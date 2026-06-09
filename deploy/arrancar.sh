#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────
# Cliender Design Pro — start script
# Usage: ./arrancar.sh          -> start the stack
#        ./arrancar.sh stop     -> stop the stack
#        ./arrancar.sh restart  -> restart all services
#        ./arrancar.sh logs     -> follow logs in real time
# ─────────────────────────────────────────────────────────────────────────
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

case "${1:-}" in
  stop)
    echo "Stopping Cliender Design Pro..."
    docker compose down
    echo "Stopped."
    ;;
  restart)
    echo "Restarting Cliender Design Pro..."
    docker compose down
    docker compose up -d --build
    echo "Restarted. Open http://localhost:2002"
    ;;
  logs)
    docker compose logs -f --tail=100
    ;;
  *)
    echo ""
    echo "  Cliender Design Pro — start"
    echo ""

    # Check Docker
    if ! command -v docker &>/dev/null; then
      echo "  ERROR: Docker is not installed."
      echo "  Get Docker Desktop at https://www.docker.com/products/docker-desktop"
      exit 1
    fi
    if ! docker info &>/dev/null 2>&1; then
      echo "  ERROR: Docker Desktop is not running. Start it first."
      exit 1
    fi

    # Check .env
    if [ ! -f ".env" ]; then
      echo "  ERROR: Missing .env in this folder."
      echo "  Run: cp .env.example .env  and fill in your API keys."
      exit 1
    fi

    echo "  Starting services (first build takes 3-5 min)..."
    docker compose up -d --build

    echo ""
    echo "  Cliender Design Pro is ready!"
    echo ""
    echo "  Open in your browser: http://localhost:2002"
    echo ""
    echo "  Stop:   ./arrancar.sh stop"
    echo "  Logs:   ./arrancar.sh logs"
    echo ""

    open "http://localhost:2002" 2>/dev/null || true
    ;;
esac
