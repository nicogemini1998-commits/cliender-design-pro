# Deploy — Docker

Local Docker stack for Cliender Design Pro.

## Quick start

```bash
cd deploy
cp .env.example .env        # fill in ANTHROPIC_API_KEY and KID_AI_API_KEY
docker compose up -d --build
docker compose ps
```

## Ports

| Service | Container | Host | Container port | Local URL |
|---|---|---|---|---|
| HTML prototype | `cdpro-prototype` | **2002** | 80 | <http://localhost:2002> |
| Backend FastAPI | `cdpro-backend` | **3003** | 8000 | <http://localhost:3003/health> |
| Remotion render | `cdpro-remotion` | **4010** | 4000 | <http://localhost:4010/health> |

## Common commands

```bash
# Live logs
docker compose logs -f cdpro-backend
docker compose logs -f cdpro-prototype

# Rebuild a single service
docker compose up -d --build cdpro-backend

# Stop everything
docker compose down

# Stop and remove local images
docker compose down --rmi local
```

## Verification

```bash
curl -s http://localhost:3003/health    # -> {"status":"ok"}
curl -sI http://localhost:2002/          # -> HTTP/1.1 200 OK
```

## Internal network (`cdpro-net`)

Containers reach each other by name on an isolated bridge network:

- nginx prototype -> backend: `http://cdpro-backend:8000`
- backend -> remotion: `http://cdpro-remotion:4000`

## Model policy

- **Cognition**: Anthropic Claude only (`claude-*`).
- **Visual**: KIE.ai image/video models only. The canonical allow-list lives in
  [`../backend/app/core/config.py`](../backend/app/core/config.py).
