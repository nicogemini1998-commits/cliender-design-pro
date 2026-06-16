# Deploy Docker — Cliender Desing Pro V1

> **Sandbox aislado.** No comparte red, volúmenes ni auth con otras apps Cliender.

## Arranque rápido

```bash
cd "09. PROYECTOS EN DESARROLLO/01. Cliender Desing Pro V1/05. DEPLOY DOCKER"
cp .env.example .env       # rellena ANTHROPIC_API_KEY y KID_AI_API_KEY
docker compose up -d --build
docker compose ps
```

## Puertos

| Servicio | Container | Host | Container | URL local |
|---|---|---|---|---|
| Frontend Next.js | `cdpro-frontend` | **1004** | 3000 | <http://localhost:1004> |
| Prototipo HTML | `cdpro-prototype` | **2002** | 80 | <http://localhost:2002> |
| Backend FastAPI | `cdpro-backend` | **3003** | 8000 | <http://localhost:3003/health> |

## Comandos comunes

```bash
# Logs en vivo
docker compose logs -f cdpro-backend
docker compose logs -f cdpro-frontend
docker compose logs -f cdpro-prototype

# Rebuild de un solo servicio
docker compose up -d --build cdpro-backend

# Apagar todo
docker compose down

# Apagar y borrar imágenes locales
docker compose down --rmi local
```

## Verificación

```bash
curl -s http://localhost:3003/health       # → {"status":"ok"}
curl -sI http://localhost:2002/            # → HTTP/1.1 200 OK · Content-Type: text/html
curl -sI http://localhost:1004/            # → HTTP/1.1 200 OK
```

## Red interna (`cdpro-net`)

Los containers se ven por nombre, aislados del resto:

- Next.js → backend: `http://cdpro-backend:8000`
- nginx → backend: `http://cdpro-backend:8000`

`cdpro-net` no se conecta a `cliender-net`, `iuralex-net`, `studio-net`, ni a ninguna otra.

## Regla de oro de modelos (recordatorio)

- **Cognición**: SOLO `claude-*` (Anthropic).
- **Visual**: SOLO `gpt-imagenes-2 · nano-banana-pro · nano-banana-2 · veo3 · seedance-2.0`.
- Lista canónica: [`../03. BACKEND FASTAPI/app/core/config.py`](../03.%20BACKEND%20FASTAPI/app/core/config.py).
