# ROADMAP — Cliender Desing Pro V1

> Plan de implementación por fases dentro del sandbox aislado.
> **Cualquier salida del sandbox requiere autorización explícita de Nico.**

---

## Fase 0 · Bootstrap (DONE — 2026-05-22)

- [x] Carpeta `09. PROYECTOS EN DESARROLLO/01. Cliender Desing Pro V1/`
- [x] Bundle original en `_bundle-original/`
- [x] Estructura numerada (00–05, 99)
- [x] Puertos 1004 / 2002 / 3003 + PUERTOS.md global actualizado
- [x] Dockerfiles backend · prototipo · frontend
- [x] `docker-compose.yml` con red dedicada `cdpro-net` + isolation labels
- [x] CLAUDE.md · _ATAJOS.md · BITACORA.md
- [x] Stack arriba y verificado con Playwright (UI viva visible en :2002)

## Fase 1 · Estabilización dentro del sandbox

- [ ] `pytest -q` en backend (test_cinematographer) pasando dentro del container
- [ ] Endpoint `/health` + `/docs` accesibles
- [ ] Decidir: ¿el `app.jsx` prototipo es la verdad fuente, o vamos al Next.js?
- [ ] Documentar bugs visuales pendientes del prototipo

## Fase 2 · Migración prototipo → Next.js (dentro del sandbox)

- [ ] Instalar deps reales: `@xyflow/react`, `framer-motion`, `zustand`, `lucide-react`
- [ ] Mover `_legacy/components/canvas/*` → `components/canvas/`
- [ ] Mover `_legacy/store/useStore.ts` → `store/`
- [ ] `app/canvas/page.tsx` operativo con los 3 nodos + Nota
- [ ] Liquid Glass tokens del prototipo (`motion.css`) traducidos a Tailwind + CSS vars
- [ ] Left rail · Topbar · Supercomputer panel · Moodboard Vault · Galería

## Fase 3 · SSE backend ↔ frontend (dentro del sandbox)

- [ ] `/chat/stream` con `sse-starlette` emitiendo eventos de grafo
- [ ] Hook `useGraphStream()` en frontend
- [ ] LEDs respirando + edges con partículas reales

## Fase 4 · Style Vault + Moodboard (dentro del sandbox)

- [ ] `Vision_Auditor` con Claude multimodal → `StyleManifest`
- [ ] Persistencia local de moodboards (JSON en volumen del container, sin DB compartida)
- [ ] Carpeta de fotos + lightbox
- [ ] "Lock Style" propaga `style_locked=true` al Cinematographer

## Fase 5 · Galería persistente (dentro del sandbox)

- [ ] Asset store con metadata (modelo, prompt, moodboard, parent flow)
- [ ] Filtros · vista detalle · regenerar

## ❌ Fase 6 · Conexiones al ecosistema Cliender — **BLOQUEADA**

> Esta fase **no se aborda** hasta que Nico autorice explícitamente. Cada ítem aquí es solo referencia.

- [ ] ~~Auth Supabase compartida con LeadUp/Studio~~ (bloqueado)
- [ ] ~~Naming hook a `04. PROYECTOS CLIENDER/`~~ (bloqueado)
- [ ] ~~Sala Limpia integration~~ (bloqueado)
- [ ] ~~Brand kit "Obsidian & Citrus"~~ (bloqueado)
- [ ] ~~MEMORIA central writes~~ (bloqueado)
- [ ] ~~GHL hidden branding cliente~~ (bloqueado)

## ❌ Fase 7 · Deploy producción — **BLOQUEADA**

Bloqueada hasta que el prototipo esté validado y Nico decida ir a producción.

---

## Decisiones abiertas (solo cuando Nico lo decida)

| Tema | Estado |
|---|---|
| ¿Reemplaza al Studio actual? | **NO** por ahora. Sandbox aislado. |
| ¿Convive con otras apps? | **No conecta.** Aislamiento total. |
| ¿Multi-cliente? | Decidir tras Fase 5 |
| ¿Kid.ai real o mock? | Pendiente confirmación de Toni / Rubén |
