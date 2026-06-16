# _ATAJOS — Cliender Desing Pro V1

> Hub local de rutas rápidas dentro de este proyecto. NO contiene información.

## 🔒 Recordatorio

**Sandbox aislado.** No tocar Studio / LeadUp / RStudio / iuralex sin orden de Nico. Ver [CLAUDE.md](./CLAUDE.md) sección "Regla inviolable".

## Estructura

| # | Carpeta | Para qué sirve |
|---|---|---|
| 00 | `00. CONTEXTO/` | Brief, decisiones, chat transcripts |
| 01 | `01. PROTOTIPO HTML/` | UI funcional inmediata (`:2002`) |
| 02 | `02. PRODUCCION NEXTJS/` | Frontend producción Next.js (`:1004`) |
| 03 | `03. BACKEND FASTAPI/` | API + LangGraph (`:3003`) |
| 04 | `04. CONEXIONES ECOSISTEMA/` | **BLOQUEADO** hasta orden explícita |
| 05 | `05. DEPLOY DOCKER/` | compose + .env + comandos |
| 99 | `99. SCRAPS/` | Sandboxes y placeholders |
| — | `_bundle-original/` | Snapshot claude.ai/design |

## Accesos rápidos

- **Bitácora viva**: [`BITACORA.md`](./BITACORA.md)
- **Roadmap**: [`ROADMAP.md`](./ROADMAP.md)
- **Compose**: [`05. DEPLOY DOCKER/docker-compose.yml`](./05.%20DEPLOY%20DOCKER/docker-compose.yml)
- **Env example**: [`05. DEPLOY DOCKER/.env.example`](./05.%20DEPLOY%20DOCKER/.env.example)
- **Lista Kid.ai (REGLA DE ORO)**: [`03. BACKEND FASTAPI/app/core/config.py`](./03.%20BACKEND%20FASTAPI/app/core/config.py)
- **Cinematographer**: [`03. BACKEND FASTAPI/app/graph/nodes/cinematographer.py`](./03.%20BACKEND%20FASTAPI/app/graph/nodes/cinematographer.py)
- **Vision_Auditor (Moodboard)**: [`03. BACKEND FASTAPI/app/graph/nodes/vision_auditor.py`](./03.%20BACKEND%20FASTAPI/app/graph/nodes/vision_auditor.py)
- **app.jsx del prototipo** (lógica UI viva): [`01. PROTOTIPO HTML/prototype/app.jsx`](./01.%20PROTOTIPO%20HTML/prototype/app.jsx)
- **Login**: [`01. PROTOTIPO HTML/Login.html`](./01.%20PROTOTIPO%20HTML/Login.html) (password `Master123`)

## URLs locales (tras `docker compose up -d`)

- Next.js → <http://localhost:1004>
- Prototipo HTML → <http://localhost:2002>
- API health → <http://localhost:3003/health>
- API docs → <http://localhost:3003/docs>

## Containers Docker

```
cdpro-backend     (image: cliender-desingpro/backend:0.1.0)
cdpro-prototype   (image: cliender-desingpro/prototype:0.1.0)
cdpro-frontend    (image: cliender-desingpro/frontend:0.1.0)
Red: cdpro-net (bridge, aislada)
```
