<div align="center">

# 🎨 Cliender Design Pro

### The node-based creative supercomputer for AI brand content

**Wire a visual pipeline on an infinite canvas. Drop a brief into one end. Watch a swarm of Claude-powered directors turn it into on-brand cinematic images and video out the other.**

[![FastAPI](https://img.shields.io/badge/API-FastAPI-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![LangGraph](https://img.shields.io/badge/Orchestration-LangGraph-1C3C3C)](https://langchain-ai.github.io/langgraph/)
[![React 18](https://img.shields.io/badge/UI-React%2018-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/3D-Three.js-000000?logo=threedotjs&logoColor=white)](https://threejs.org/)
[![Anthropic Claude](https://img.shields.io/badge/Brain-Anthropic%20Claude-D97757?logo=anthropic&logoColor=white)](https://www.anthropic.com/)
[![KIE.ai](https://img.shields.io/badge/Visual-KIE.ai-7C3AED)](https://kie.ai/)
[![Remotion](https://img.shields.io/badge/Video-Remotion-0B84F3)](https://www.remotion.dev/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

</div>

---

![Cliender Design Pro — node canvas](docs/screenshot.png)

> The dark *quiet-luxury* canvas: drag nodes, wire them together, and watch a single brief flow from concept to rendered media — with an animated astronaut mascot floating in the corner.

---

## Overview

**Cliender Design Pro** is a creative production studio that ditches the single chat box. Instead, you build a small, runnable pipeline on an **infinite node canvas** — *Brand → Prompt → Image → Video → Output* — and execute it. Behind every run, a coordinated team of Claude agents plans the shot, writes the creative prompt, picks the camera language, generates the media through KIE.ai, and **critiques its own output** before it lands in your gallery.

It's built for **agencies, brand teams, and creators** who need a high volume of on-brand visual content without losing consistency. The secret weapon is the **Style Vault**: reusable moodboards that distill a client's brand — palette, lighting, composition, mood — into a master style prompt that every generation respects. Define a brand once; stay on-brand forever.

Technically, it's an interesting study in **agentic media generation**: a [LangGraph](https://langchain-ai.github.io/langgraph/) state machine with a self-correcting critic loop, a vision-auditor that re-reads generated frames, server-sent-event streaming for live progress, and a Remotion render farm that stitches multi-scene storyboards into final MP4s. The whole thing runs as three containers with one `docker compose up`.

---

## ✨ Features

| | Feature | What it does |
|---|---|---|
| 🧩 | **Infinite node canvas** | An n8n-style pannable, zoomable workspace. Wire functional connections — *Prompt → Image → Video → Output* — into a runnable creative graph. |
| 🤖 | **SHAQ multi-agent director swarm** | A LangGraph cycle — **Master Director → Scriptwriter → Cinematographer → Production → Critic** — plans, generates and self-reviews each shot. *SHAQ*, the unified Senior Creative brain, converts a plain brief into a layered cinematic prompt. |
| 🔁 | **Self-correcting critic loop** | The Critic grades each result; on rejection it bumps a retry counter and recycles the Cinematographer (up to `CRITIC_MAX_RETRIES`) before approving and ending. |
| 👁️ | **Vision auditor** | A Claude-vision pass re-reads generated frames against the brief to catch off-brand or off-concept output. |
| 🖼️ | **Image & video generation** | Stills and short clips via curated KIE.ai models — `gpt-imagenes-2`, `nano-banana-pro`, `nano-banana-2`, `nano-banana-edit` (images) and `seedance-2.0` (video). A single allow-list is the only source of truth for which models can be called. |
| 🎨 | **Style Vault & moodboards** | Build moodboards that compile a brand into a reusable **style manifest** — master prompt, palette, lighting, composition rules — lockable so approved looks can't drift. |
| 🎞️ | **Storyboard → coherent video** | `/chat/storyboard/stream` reads a reference image with vision, breaks a concept into scenes, chains keyframes, and feeds them to Seedance + Remotion for a continuous multi-scene video. |
| 🗂️ | **Persistent gallery** | Every generation is collected, previewable and downloadable; scenes can be assembled into a single video. Media is persisted (optionally to Supabase) so it survives restarts. |
| 🎬 | **Remotion assembly** | A dedicated Node + headless-Chromium service stitches scene clips into final MP4s with captions and an automatic logo overlay. |
| 🌌 | **WebGL portal login** | The login screen animates a GSAP-driven card carousel and a "portal" transition that opens into the tool (with a reduced-motion fallback). |
| 📊 | **Cost analytics** | Per-model spend tracking with a configurable daily USD limit and alerts. |
| 🎚️ | **Dark / light themes** | Token-driven theming via `data-theme`, plus liquid-glass surfaces and a Three.js astronaut mascot. |
| 🔒 | **Hardened backend** | Optional shared API-key gate, per-IP rate limiting on heavy endpoints, SSRF-guarded media fetching, and prompt sanitization before models. |

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 (CDN + Babel, zero-build prototype), Three.js, GSAP, custom CSS design tokens, liquid-glass UI |
| **Backend** | FastAPI, LangGraph, Pydantic v2, httpx, Server-Sent Events streaming |
| **Cognition** | Anthropic Claude (Sonnet for direction, vision for auditing) |
| **Visual generation** | KIE.ai — image models (`gpt-imagenes-2`, `nano-banana-*`) + video (`seedance-2.0`) |
| **Video render** | Remotion (Node + headless Chromium) |
| **Storage / auth** | Supabase (optional — shared store, gallery persistence, cost analytics) |
| **Packaging** | Docker + Docker Compose, nginx |

---

## 🏗️ Architecture

Three services on a private Docker network, plus two external AI providers:

```
                       ┌───────────────────────────────────┐
        browser  ◀────▶│  cdpro-prototype  (nginx :2002)    │
                       │  React node canvas + WebGL login   │
                       └────────────────┬──────────────────┘
                                        │  REST + SSE
                       ┌────────────────▼──────────────────┐
                       │  cdpro-backend  (FastAPI :3003)     │
                       │                                     │
                       │  LangGraph swarm (self-correcting): │
                       │   START → Master Director           │
                       │         → Scriptwriter              │
                       │         → Cinematographer ◀──┐      │
                       │         → Production         │retry │
                       │         → Critic ────────────┘      │
                       │            └──→ END (on approval)    │
                       │   (+ Vision Auditor on output)       │
                       └──────┬────────────────────┬─────────┘
                              │                    │
                   Claude (cognition)      KIE.ai (image / video)
                              │
                       ┌──────▼───────────────────┐
                       │  cdpro-remotion (:4010)    │
                       │  scenes → captioned MP4    │
                       │  + automatic logo overlay  │
                       └────────────────────────────┘
```

**Data flow:** brief → SHAQ builds a layered prompt (brand layer + moodboard layer + quality anchors) → director swarm plans & generates → critic loop refines → vision auditor verifies → gallery → (optional) storyboard → Remotion → final video.

**Key API surface** (FastAPI routers):

| Prefix | Purpose |
|---|---|
| `/chat` | Conversational supercomputer: `/chat/stream` (SSE), `/chat/render`, `/chat/storyboard/stream` |
| `/agent` | Direct swarm runs: `/agent/run`, `/agent/batch_run`, `/agent/build-profile` |
| `/generate` | Media ops: `/generate/persist-media`, `/generate/compose-logo`, `/generate/media-proxy`, `/generate/retry/{task_id}` |
| `/moodboards` | Style Vault CRUD + `/moodboards/{id}/lock` + `/moodboards/audit` |
| `/gallery` | Collected generations |
| `/analytics` | Cost tracking: `/track`, `/summary`, `/history`, `/pricing`, `/alerts` |
| `/store` | Shared key-value collections |
| `/health` | Liveness |

---

## 🚀 Getting Started

> ⚠️ **This app is served by Docker — do not open the `.html` files as local files.** Opening `Canvas Prototype.html` straight from disk (`file://`) will *not* work: the React modules, API calls and SSE streams need the nginx + backend stack. Always run it through Docker and open **http://localhost:2002**.

### Prerequisites

- [Docker](https://www.docker.com/products/docker-desktop) + Docker Compose
- An [Anthropic API key](https://console.anthropic.com/) (cognition)
- A [KIE.ai](https://kie.ai/) API key (image + video)
- *(optional)* a Supabase project for auth, shared store, gallery persistence and cost analytics

### Run it

```bash
# 1. Clone
git clone https://github.com/<your-org>/cliender-design-pro.git
cd cliender-design-pro

# 2. Configure secrets
cp .env.example deploy/.env
#    edit deploy/.env → set ANTHROPIC_API_KEY and KID_AI_API_KEY (+ Supabase if used)

# 3. Build & start the stack
cd deploy
docker compose up -d --build

# 4. Open the app (served by nginx — NOT as a file)
open http://localhost:2002
```

| Service | URL |
|---|---|
| 🎨 Canvas / UI | <http://localhost:2002> |
| ⚙️ Backend API + docs | <http://localhost:3003/docs> |
| 🎬 Remotion render | <http://localhost:4010/health> |

> **Supabase (optional):** the browser reads `window.__CDPRO_SUPABASE_URL` and `window.__CDPRO_SUPABASE_ANON_KEY` at runtime. Inject them at deploy time, or leave the `YOUR_SUPABASE_*` placeholders to run the canvas without auth/storage.

---

## 📁 Project Structure

```
.
├── frontend/                   # React node-canvas prototype (served by nginx)
│   ├── Login.html              # WebGL/GSAP portal login + card carousel
│   ├── Canvas Prototype.html   # app shell (loads the React prototype)
│   ├── nginx.conf · Dockerfile
│   └── prototype/
│       ├── app.jsx             # canvas app root (theme, layout)
│       ├── nodes.jsx           # node graph + functional connections
│       ├── vault.jsx           # moodboards / Style Vault
│       ├── analytics.jsx       # cost analytics view
│       ├── astronaut.jsx       # Three.js mascot
│       ├── leftmenu.jsx        # clients, agents, settings
│       ├── *.css               # design tokens + liquid-glass styles
│       └── assets/             # logos + avatars
│
├── backend/                    # FastAPI + LangGraph multi-agent backend
│   └── app/
│       ├── main.py             # app factory, API-key gate, rate limiting
│       ├── core/config.py      # settings + KIE.ai model allow-list (source of truth)
│       ├── api/routes/         # chat, agent, generate, moodboard, gallery, analytics, store
│       ├── graph/              # LangGraph swarm (builder, state, routing, nodes/)
│       │   └── nodes/          # master_director, scriptwriter, cinematographer,
│       │                       #   production, critic, vision_auditor
│       ├── services/           # claude_client, kid_ai_client, prompt_brain (SHAQ),
│       │                       #   storyboard_director, url_guard, prompt_sanitizer
│       └── tools/              # KIE.ai tool wrapper
│
├── remotion/                   # Remotion video render service
│   ├── server.js               # /render + /health
│   └── src/                    # Remotion compositions (Stitch)
│
├── deploy/                     # docker-compose stack + start scripts
│   ├── docker-compose.yml
│   ├── arrancar.sh / arrancar.bat
│   └── .env.example
│
└── docs/                       # screenshots and docs
```

---

## 🔐 Security & Configuration

- **No secrets in the repo.** Every key (Anthropic, KIE.ai, Supabase service key) is read from environment variables. Copy `.env.example` → `deploy/.env` and keep it out of git.
- **Optional shared API gate** — when `CDPRO_API_KEY` is set, every request to protected prefixes (`/generate`, `/agent`, `/moodboards`, `/analytics`, `/gallery`, `/store`) must carry a matching `X-API-Key` header.
- **Per-IP rate limiting** — heavy endpoints (`/generate/persist-media`, `/generate/compose-logo`, `/moodboards/audit`) get a stricter budget; the proxy GET for already-generated assets is exempt.
- **SSRF guard + prompt sanitization** — outbound media fetching is whitelisted, and prompts are sanitized before reaching generation models.
- **Prod hardening** — when `ENVIRONMENT=prod`, the interactive docs (`/docs`, `/redoc`) are disabled.

| Variable | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude cognition (required) |
| `KID_AI_API_KEY` | KIE.ai image/video generation (required) |
| `CLAUDE_MODEL` / `CLAUDE_MAX_TOKENS` | Model + token budget for the director swarm |
| `CRITIC_MAX_RETRIES` | How many times the Critic can recycle the Cinematographer |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_KEY` | Optional auth, store, persistence, analytics |
| `ANALYTICS_DAILY_LIMIT_USD` | Daily cost alert threshold (`0` disables) |
| `CDPRO_API_KEY` | Optional shared backend API gate |
| `CORS_ORIGINS` | Allowed browser origins (JSON array) |

---

## 📄 License

[MIT](LICENSE) © HBD Revolution SL
