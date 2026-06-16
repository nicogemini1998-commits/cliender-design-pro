# CLAUDE.md — Cliender Desing Pro V1

> Cliender · **Prototipo aislado** · v0.1.0 · 2026-05-22
> Sandbox de construcción, desarrollo y pruebas. Origen: claude.ai/design export `desing-cliender-remix`.

---

## 🔒 REGLA INVIOLABLE — Sandbox aislado

> **Nico (2026-05-22)**: "no vamos a mezclar ni a reemplazar ninguna app esto aun es un prototipo… hasta que yo no diga no se cambia ni se reemplaza ninguna herramienta ni nada".

Este proyecto **NO toca** ni se conecta a Studio, LeadUp, RStudio, iuralex ni a ninguna otra app de Cliender. Vive en:

- Su propia red Docker `cdpro-net` (subred 172.x/16 dedicada)
- Sus propios containers `cdpro-*` (backend / prototype / frontend)
- Sus puertos únicos 1004 / 2002 / 3003
- 0 volúmenes compartidos
- Sin auth Supabase compartida
- Sin naming hooks hacia carpetas de clientes
- Sin Sala Limpia / GHL / brand kit integrados

Cualquier integración futura → **bloqueada hasta orden explícita de Nico**.

---

## ⚡ Atajos rápidos

→ [`_ATAJOS.md`](./_ATAJOS.md) · [`BITACORA.md`](./BITACORA.md) · [`ROADMAP.md`](./ROADMAP.md)

## 📦 Estructura

| # | Carpeta | Para qué sirve |
|---|---|---|
| 00 | [`00. CONTEXTO/`](./00.%20CONTEXTO/) | Brief original, decisiones, chat transcripts |
| 01 | [`01. PROTOTIPO HTML/`](./01.%20PROTOTIPO%20HTML/) | **UI viva** (HTML+React CDN) — sirve en `:2002` |
| 02 | [`02. PRODUCCION NEXTJS/`](./02.%20PRODUCCION%20NEXTJS/) | Migración Next.js — sirve en `:1004` |
| 03 | [`03. BACKEND FASTAPI/`](./03.%20BACKEND%20FASTAPI/) | FastAPI + LangGraph + Claude + Kid.ai — sirve en `:3003` |
| 04 | [`04. CONEXIONES ECOSISTEMA/`](./04.%20CONEXIONES%20ECOSISTEMA/) | **BLOQUEADO** hasta orden explícita |
| 05 | [`05. DEPLOY DOCKER/`](./05.%20DEPLOY%20DOCKER/) | compose · env · comandos |
| 99 | [`99. SCRAPS/`](./99.%20SCRAPS/) | Borradores |
| — | [`_bundle-original/`](./_bundle-original/) | Snapshot tal cual llegó de claude.ai/design |

## 🚦 Puertos asignados

| Servicio | Container | Host | Container | URL |
|---|---|---|---|---|
| Frontend Next.js | `cdpro-frontend` | **1004** | 3000 | <http://localhost:1004> |
| Prototipo HTML | `cdpro-prototype` | **2002** | 80 | <http://localhost:2002> |
| Backend FastAPI | `cdpro-backend` | **3003** | 8000 | <http://localhost:3003/health> |

Registro canónico: [`08. INFRA & DOCKER CLIENDER/00. ARQUITECTURA/PUERTOS.md`](../../../../08.%20INFRA%20%26%20DOCKER%20CLIENDER/00.%20ARQUITECTURA/PUERTOS.md).

## 🎯 Visión (referencia)

Dos modos en una misma app:

1. **Canvas Mode** — Lienzo infinito de nodos (Prompt · Imagen · Video · Nota) tipo n8n. Conexiones funcionales, Style Vault con Vision_Auditor, Galería persistente.
2. **Supercomputer Mode** — Chat inmersivo gobernado por 5 agentes LangGraph: MasterDirector → Scriptwriter → Cinematographer → Production → Critic.

## 🔒 Reglas de modelos (regla de oro técnica)

1. **Cognición SOLO Claude** (Anthropic).
2. **Visual SOLO Kid.ai** con catálogo cerrado: `gpt-imagenes-2 · nano-banana-pro · nano-banana-2 · veo3 · seedance-2.0`. Otro modelo → `DisallowedModelError`.

## ▶️ Levantar el stack

```bash
cd "05. DEPLOY DOCKER"
cp .env.example .env       # rellena ANTHROPIC_API_KEY y KID_AI_API_KEY
docker compose up -d --build
docker compose ps
```

Abre <http://localhost:2002> para la UI funcional.

## 🧭 Stack

| Capa | Tecnología |
|---|---|
| Frontend producción | Next.js · Tailwind · React Flow · Framer Motion |
| Frontend prototipo | HTML + React UMD (CDN) + Babel standalone |
| Backend | Python 3.11 · FastAPI · LangGraph · sse-starlette |
| Cerebro | Anthropic Claude |
| Músculo creativo | Kid.ai (lista cerrada) |
| Deploy | Docker Compose · red `cdpro-net` aislada |

## 📌 Owner

KAREN (Nico) — desarrollo. Decisiones de producto: JARVIS (Toni).
