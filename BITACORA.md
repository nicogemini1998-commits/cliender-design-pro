# BITÁCORA — Cliender Desing Pro V1

> Decisiones cronológicas, blockers, hitos. Owner: KAREN (Nico).

---

## 2026-06-12 · v0.5.2 — Option B: setup para cualquier miembro del equipo

**Owner sesión:** KAREN (Nico). Solicitado por JARVIS (Toni) via email — blocker: CDPro no arrancaba en su máquina.

**Ubicación correcta en OneDrive (tras el move del 2026-06-09):**
```
CLIENDER BRAIN / 06. RECURSOS CLIENDER / 03. HERRAMIENTAS SOFTWARE CLIENDER /
01. APPS PROPIAS CLIENDER / 02. Cliender Desing Pro V1 / 05. DEPLOY DOCKER
```
Antes estaba en `09. PROYECTOS EN DESARROLLO / 01. Cliender Desing Pro V1 /`. La documentación (LEEME) tenía el path viejo.

**Repositorio GitHub:** `cliender-design-pro` (privado, org cliender). El código vive en OneDrive shared y se sincroniza automáticamente al equipo; el repo GitHub es mirror de referencia.

**Cambios aplicados:**

- **`LEEME_EQUIPO.md`:** path corregido a la ruta actual (`06. RECURSOS...`); añadido paso `cp .env.cdpro.example .env.cdpro` antes de arrancar.
- **`.env.cdpro.example`:** creado con todas las variables necesarias (`ANTHROPIC_API_KEY`, `KIE_API_KEY`, `KIE_BASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `CLAUDE_MODEL`, `ENVIRONMENT`, `ANALYTICS_DAILY_LIMIT_USD`). Claves reales: pedir a Nico o consultar 1Password del equipo.
- **`docker-compose.yml`:** `cdpro-frontend` ahora tiene `profiles: [nextjs]` — **no arranca por defecto**. El core stack (backend + prototype + remotion) funciona sin `02. PRODUCCION NEXTJS`. Para levantarlo: `docker compose --profile nextjs up -d --build`.
- **`02. VITE APP/`:** el Dockerfile, package.json y vite.config.js ya existen en OneDrive (añadidos en sesión anterior). Si Toni los ve como cloud-only, forzar sync: click derecho en la carpeta en Explorador → "Mantener siempre en el dispositivo".
- **`01. PROTOTIPO HTML/prototype/`:** si aparece cloud-only, mismo procedimiento: click derecho → "Mantener siempre en el dispositivo". Necesario para el Docker build.

**Para Toni — arranque limpio:**
```bash
# 1. Asegurate de que OneDrive syncó la carpeta (sin iconos de nube)
# 2. Desde 05. DEPLOY DOCKER/
cp .env.cdpro.example .env.cdpro
# 3. Edita .env.cdpro con las claves reales (pedir a Nico)
# 4.
docker compose up -d --build
```



## 2026-06-12 · v0.5.0 — Auditoría v2: conexiones, sesión con refresh, BD anti-pérdida, Login cinematográfico

**Commit `c7a382d`.** Auditoría multi-agente (23 agentes, 5 dimensiones + verificación adversarial). Owner: KAREN (Nico).

> **Adenda v0.5.1 (`911b40a`):** (1) Login — las animaciones quedaban apagadas si el SO tenía "Reducir movimiento"; guard eliminado, animaciones SIEMPRE + blur de entrada restaurado. (2) Edit video — subtítulos TikTok karaoke palabra a palabra (estilos: TikTok/Globo cómic/Neón/Cine) + "Dinamismo automático": la IA detecta silencios del habla (beats) y coloca micro-zooms + SFX justo ahí. (3) Render 2-3x más rápido (x264 veryfast, concurrency 3): 8s de vídeo + Whisper = 40s. Verificado con frames del mp4 real.

- **Seguridad:** `/chat` (endpoints MÁS caros: LangGraph+KIE+Remotion) estaba fuera de auth y rate-limit → protegido. SSRF-via-redirect cerrado en media-proxy/persist-media (validación por hop). Inyección PostgREST vía moodboard_id → regex en 5 endpoints.
- **BD anti-pérdida (CRÍTICO):** con Supabase caído, añadir/borrar de galería sobrescribía TODO el JSON con lista vacía → ahora 503 y aborta. PUT /store fallido devolvía 200 → ahora 502 (dispara el retry del cliente). Moodboard DELETE limpia sus imágenes de Storage.
- **Conexiones:** batch_run fallido ya no cascada con brief crudo (gasto Kid.ai evitado); timeout 180s en agentes (no más nodos colgados); retry+aviso en gallery/add, moodboards upsert/remove y persist-media.
- **Sesión:** refresh_token — la sesión ya NO muere a la hora. 'Recordarme' real (localStorage vs sessionStorage). Errores de red con mensaje claro. signOut limpia todo el estado por-usuario. Logout multi-pestaña.
- **Login cinematográfico:** timeline maestro GSAP, tagline palabra a palabra ('cobra vida' se enciende), aurora viva + polvo de estudio canvas, spinner/check/shake en el CTA, salida con veil circular desde el botón, focus progresivo, tilt 3D ±2°, `prefers-reduced-motion` respetado en CSS+JS.
- **Pendiente (roadmap):** retención/agregación server-side de `api_calls` (>10k filas el resumen miente); full-replace race de /store entre usuarios (ventana 30s — mitigado por merge updatedAt client-side; fix real = tabla con PATCH por item); CSP sin unsafe-inline.


## 2026-06-11 · v0.4.0 — Auditoría seguridad+rendimiento, sin Babel en runtime, fixes ADN/moodboards/duplicados

**Estado: herramienta 100% actualizada y desplegada.** OneDrive (source, auto-sync al equipo) == repo GitHub `cliender-design-pro` (commits `1d6224b` → `c73e9a4`). Containers `cdpro-*` healthy corriendo la última imagen. Owner sesión: KAREN (Nico).

**Cambios de esta sesión:**

- **Seguridad backend** (`1d6224b`): API key obligatoria en prod (fail-closed), techo de payload 6MB, anti-SSRF en compose-logo, rate-limit en GET, validación regex en analytics, sanitización de paths de Storage, whitelist de transición/preset/modelo Whisper, sin fugas de service_key en logs, rechazo de CORS `*` en prod.
- **Rendimiento / infra** (`664b667`): **A1 — fuera Babel del navegador**, el JSX se precompila en el build (Dockerfile multi-stage con Babel `transform-block-scoping` + IIFE; ver fix TDZ `db70f30`). Remotion `shm_size 1GB` (adiós crashes Chromium) + límites mem/cpu. Polls pausados en background. SRI en three.js/gsap. Nodos del canvas memoizados. localStorage de moodboards sin base64.
- **Fix carga** (`db70f30`): la herramienta no abría (`Cannot access 'setEdges' before initialization`) — TDZ al quitar Babel; resuelto compilando con block-scoping (paridad con la semántica que daba Babel).
- **Fix duplicados** (`0d6619b`): imágenes/vídeos salían x2 en el OutputNode (update final reañadía items ya presentes). Deduplicado por id.
- **Fix moodboards fantasma** (`b4d2bf7`): los `temp-*` del modo Supercomputer ya no se persisten; el poll hace al server autoridad de borrados (lo borrado no revive). Store limpiado a 5 reales: EHE, SAVIA, INTEGRA, SIETE FORMACION, cliender P1.
- **ADN visual** (`c73e9a4`): manifest en CASTELLANO salvo `master_style_prompt` y `negative_prompt` (inglés, alimentan KIE.ai). Paleta de color y color grading ahora editables en el Style Vault (ya lo eran iluminación/cámara/mood/composición/character/master/negative).

**⚠️ DEPLOY — cómo lo aplica el equipo (tras sincronizar OneDrive):**

```bash
cd "06. RECURSOS CLIENDER/03. HERRAMIENTAS SOFTWARE CLIENDER/01. APPS PROPIAS CLIENDER/02. Cliender Desing Pro V1/05. DEPLOY DOCKER"
docker compose up -d --build        # backend + prototype + remotion
```

- **CAMBIO IMPORTANTE (A1):** el prototipo (`prototype/*.jsx`) **YA NO es live-edit por hard-refresh** — ahora el JSX se precompila en el build. Editar `.jsx` requiere `docker compose up -d --build cdpro-prototype`. Si el cambio no aparece: `--no-cache` + `--force-recreate`.
- Los moodboards ya auditados conservan su manifest anterior (idioma viejo) hasta re-auditar o editar a mano (ya 100% editable). Audits NUEVOS salen en castellano.


## 2026-06-04 · v0.3.0 — Edit Video (Remotion) + fix referencia imagen→vídeo + UI liquid-glass

**Contexto**: disco de la máquina al 100% (modelos .ollama/.lmstudio) tumbó Docker; tras liberar, se reparó infra y se añadió el pipeline de ensamblaje de vídeo. Owner sesión: KAREN (Nico).

**Cambios (todos en OneDrive — se sincronizan al equipo)**:

- **Nuevo servicio `cdpro-remotion`** (`06. REMOTION RENDER/`): ensambla escenas (imágenes/vídeos) en un mp4 vertical con intro/outro de marca + captions + Ken Burns. Puerto 4010. Sube a Supabase `brand-assets/renders/`.
- **Backend** `POST /chat/render` (`supercomputer.py`) proxya al servicio Remotion; `Settings.remotion_url` nuevo.
- **Galería** (`ui.jsx`): botón **“Edit video”** → selección ordenada de assets → genera vídeo final + preview.
- **Fix nodo Video** (`app.jsx`): ahora toma como `first_frame` la imagen de un **nodo Resultado (output)** conectado, incluso a través de un Prompt intermedio (`Output→Prompt→Video`). Antes solo reconocía nodos `image`.
- **6 mejoras UI liquid-glass púrpura**: topbar canvas/super, filtros galería, +Nuevo proyecto, botones moodboard+ADN, ficha cliente light-mode, galería esquinas/light.
- **Fix infra EDEADLK**: quitados del compose los bind-mount de ARCHIVO único desde OneDrive (`nginx.conf`, `index.html`, `Login.html`) — causaban `Resource deadlock` y página en blanco. Ahora van `COPY` en Dockerfile; solo se monta la carpeta `prototype/` (live-edit).

**⚠️ DEPLOY — cómo lo aplica cada miembro del equipo** (tras sincronizar OneDrive):

```bash
cd "09. PROYECTOS EN DESARROLLO/01. Cliender Desing Pro V1/05. DEPLOY DOCKER"
docker compose up -d --build        # reconstruye backend + remotion con el código nuevo
```

- La UI del prototipo (`prototype/*.jsx|css`) se aplica con **hard-refresh** (Cmd+Shift+R) en <http://localhost:2002> — es bind-mount live, no necesita rebuild.
- Backend y Remotion SÍ necesitan `--build` (las imágenes son por-máquina).
- Requiere `.env.cdpro` con `ANTHROPIC_API_KEY`, `KIE_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` (secreto, fuera de OneDrive — ver `SECRETS_ROTATION.md`).

**Estado final**: stack CDPro 4/4 `healthy` (prototype 2002, backend 3003, frontend 1004, remotion 4010). Render E2E probado: 2 imágenes → mp4 8.38s a Supabase.

---


## 2026-05-28 · v0.2.0 — Auditoría seguridad + fontanería completa

**Contexto**: detectados 3 secretos filtrados en OneDrive shared (`.env` versionado en almacenamiento compartido del equipo): ANTHROPIC_API_KEY, KIE_API_KEY, SUPABASE_SERVICE_KEY. Sesión paralela de 4 agentes para sanear stack end-to-end.

**Agentes lanzados**:

- **A1 — Secretos**: aisló `.env` real a `~/.env.cdpro` (chmod 600, fuera OneDrive). Placeholders en `.env` del proyecto. Creado `05. DEPLOY DOCKER/SECRETS_ROTATION.md` con guía de rotación.
- **A2 — API_BASE**: centralizó URLs hardcoded (`localhost:3003`, dominios mezclados) en `prototype/config.js` exponiendo `window.CDPRO_CONFIG.API_BASE`. Eliminada duplicidad config KID_AI vs KIE.
- **A3 — CORS + healthchecks + Next.js**: corregido CORS backend, añadidos healthchecks a los 3 servicios, arrancado contenedor Next.js en :1004 (estaba caído).
- **A4 — Analytics robusto**: endurecido `/analytics/pricing` con fallback ante claves ausentes (503 controlado en lugar de crash), logging estructurado.

**Archivos modificados**:

- `.env` → placeholders
- `~/.env.cdpro` (nuevo, fuera repo)
- `prototype/config.js` (nuevo)
- `prototype/*.html` (consumo CDPRO_CONFIG)
- `backend/main.py` (CORS, analytics fallback)
- `docker-compose.yml` (healthchecks, env_file)
- `05. DEPLOY DOCKER/SECRETS_ROTATION.md` (nuevo)
- `05. DEPLOY DOCKER/CHECKLIST_NICO_2026-05-28.md` (nuevo)

**Estado final stack**: 3 servicios `healthy`:

- `cdpro-frontend` :1004 (Next.js) ✓
- `cdpro-prototype` :2002 (nginx) ✓
- `cdpro-backend` :3003 (FastAPI) ✓

**Pendiente manual (Nico)**: rotar las 3 claves comprometidas + recargar containers. Ver `05. DEPLOY DOCKER/CHECKLIST_NICO_2026-05-28.md`.

**Patrones detectados (no repetir)**:

1. Secretos en OneDrive shared.
2. URLs hardcoded en frontends.
3. Configs duplicadas (KID_AI vs KIE).

---


## 2026-05-22 · v0.1.0 — Bootstrap + isolation rule + rename

**Origen**: bundle `desing-cliender-remix` exportado por Nico desde claude.ai/design (`https://api.anthropic.com/v1/design/h/NKpAd22v1Vtl3GDcz3FVhA`). Es la versión definitiva del diseño que queremos para reemplazar internamente la herramienta "desing".

**Decisiones**:

1. **Ubicación** → `09. PROYECTOS EN DESARROLLO/01. Cliender Desing Pro V1/`. Carpeta `09.` creada nueva para alojar proyectos en construcción (antes solo 00-08).
2. **Estructura interna** → seis carpetas numeradas + `_bundle-original/` + `99. SCRAPS/`.
3. **Puertos canónicos** (PUERTOS.md global):
   - **1004** → cdpro-frontend (Next.js)
   - **2002** → cdpro-prototype (nginx HTML)
   - **3003** → cdpro-backend (FastAPI)
4. **Docker Compose** con red dedicada `cdpro-net` + healthchecks + labels `cliender.role=prototype-sandbox`. 0 volúmenes, 0 deps compartidas.
5. **REGLA INVIOLABLE de aislamiento (Nico)**: sandbox puro de prototipo / desarrollo / pruebas. **NO** tocar Studio, LeadUp, RStudio, iuralex u otras apps Cliender hasta orden explícita. Auth, Supabase, Sala Limpia, GHL, naming hooks, brand kit → todo BLOQUEADO en `04. CONEXIONES ECOSISTEMA/` y en ROADMAP Fase 6.
6. **Rename** del proyecto (de "Atelier Swarm" a **Cliender Desing Pro V1**) por decisión de Nico (2026-05-22 noche). Carpeta, containers, red, imágenes Docker y compose project renombrados a `cdpro-*` / `cliender-desingpro-*` / `cliender-desingpro-v1`.
7. **Prototipo HTML** → intacto, sirve la UI funcional inmediata mientras se completa el Next.js. Validación visual con Playwright OK (screenshot tomada).
8. **Next.js scaffolding** → mínimo (layout, page, tailwind, postcss, tsconfig, Dockerfile multi-stage `output: standalone`). Los TSX parciales del bundle quedaron en `_legacy/` para integrarse cuando se completen deps (`@xyflow/react`, etc.).
9. **Regla de oro Kid.ai** preservada literal en `config.py`: cualquier modelo fuera del catálogo → `DisallowedModelError`.
10. **Fixes en vuelo**:
    - Dockerfile COPY con espacios en nombre → JSON array form.
    - Healthchecks `wget localhost` → `127.0.0.1` (IPv6 vs IPv4 alpine).
    - nginx servía `application/octet-stream` por bloque `types{}` que sobrescribía MIME defaults → corregido con `default_type text/html` + `include mime.types` heredado del nginx.conf base.
    - tsconfig + .dockerignore excluyen `_legacy/` para que Next no rompa el build con dependencias ausentes.
    - `public/` vacío creado para que `COPY --from=builder /app/public` no falle.
11. **Memoria persistente** actualizada con `feedback_atelier_isolated_prototype.md` (puede renombrarse luego a `feedback_desingpro_isolated_prototype.md`).

**Pendiente próxima sesión**:

- Decidir si migrar `_legacy/` (CinematographerNode, ContextPromptNode, RenderOutputNode, AnimatedFlowEdge, MoodboardVault, SupercomputerPanel, useStore) al Next.js limpio.
- Wire-up real del SSE entre backend (`/chat/stream`) y frontend.
- Cualquier conexión al ecosistema Cliender requiere autorización explícita de Nico.

---

## Plantilla de entrada

```
## YYYY-MM-DD · vX.Y.Z — Título corto

**Contexto**: por qué.
**Cambios**: qué.
**Pendiente**: qué queda.
**Blockers**: si los hay.
```
