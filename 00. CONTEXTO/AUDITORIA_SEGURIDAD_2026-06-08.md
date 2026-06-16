# AUDITORÍA DE SEGURIDAD Y CALIDAD — Cliender Desing Pro V1

> Generada 2026-06-08 · 45 agentes · verificación adversarial · 78 hallazgos brutos → 28 confirmados, 7 falsos positivos descartados, 43 MEDIUM/LOW

## Estado de fixes (sesión 2026-06-08)

**ARREGLADOS Y DESPLEGADOS:**
- ✅ SSRF en `_ref_image_block`, `_rehost_first_frame`, `_image_block` → guard compartido `url_guard.py` (`_is_private_ip` + `follow_redirects=False`)
- ✅ H1 cascada del agente no se detenía en error (stale closure) → bandera local síncrona (gastaba créditos KIE)
- ✅ C5 panel del agente desaparecía (DOM mutation) → React state
- ✅ C4 zoom de canvas saltaba (stale closure onWheel) → setPan dentro del updater de setZoom
- ✅ H3 botones vídeo/audio de referencia muertos → deshabilitados con "Próximamente"

**PENDIENTES (priorizados):**
- ⏳ C6 diálogos `window.prompt/confirm` bloqueantes → modal (UX demo)
- ⏳ C2 auth en GET/PUT/DELETE (no solo POST) + `CDPRO_API_KEY` obligatoria
- ⏳ C1 `SAMPLE_CLIENTS` con datos reales en el bundle (decisión: solo crítico si demo externa)
- ⏳ H4/H5 rate-limit en endpoints caros (persist-media, compose-logo, moodboards/audit)
- ⏳ H7 `_RL` dict sin límite (memory leak) · H8 storyboard secuencial (perf)

---

## Hallazgos confirmados (verificados adversarialmente)

| Sev | Cat | Archivo | Estado | Título |
|-----|-----|---------|--------|--------|
| CRITICAL | security | agent.py:71-112 | ✅ | SSRF en _ref_image_block: cualquier URL http/https sin filtrado de IPs |
| CRITICAL | security | main.py:54-57 | ⏳ | CDPRO_API_KEY completamente opcional: si no está definida no hay auth  |
| CRITICAL | security | analytics.py:523-551 | ⏳ | PUT /analytics/pricing/{model} sin autenticación: cualquiera puede mod |
| CRITICAL | security | config.js:1-207 | ⏳ | All FastAPI backend endpoints unauthenticated — no token on any fetch |
| CRITICAL | security | leftmenu.jsx:308-668 | ⏳ | SAMPLE_CLIENTS contains real production client data and internal team  |
| CRITICAL | ux-flow | app.jsx:1410, 1429, 553 | ⏳ | window.prompt() and window.confirm() block UI during demo flows |
| CRITICAL | bug | app.jsx:1995-2003 | ✅ | Stale zoom closure in onWheel causes canvas viewport jump on zoom |
| CRITICAL | bug | nodes.jsx:526 | ✅ | Direct DOM mutation in PromptNode toggle bypasses React rendering |
| HIGH | security | claude_client.py:173-200 | ✅ | SSRF en ClaudeClient._image_block: URLs http sin validación de IP priv |
| HIGH | security | main.py:55-66 | ⏳ | Autenticación solo en POST: todos los GET/DELETE/PUT sin auth son acce |
| HIGH | security | main.py:30-31 | ⏳ | Rate limiting exento para persist-media y compose-logo: endpoints de a |
| HIGH | security | nginx.conf:23 | ⏳ | CSP requires 'unsafe-eval' and 'unsafe-inline' — negates XSS protectio |
| HIGH | bug | nodes.jsx:1021-1032 | ⏳ | VideoNode video/audio reference upload buttons have no file input and  |
| HIGH | bug | app.jsx:2486 | ⏳ | Agent-failed abort guard reads stale nodes closure — cascade never sto |
| HIGH | security | leftmenu.jsx:1715-1716 | ⏳ | Master password hardcoded in plaintext source — anyone can wipe localS |
| HIGH | security | moodboard.py:1 | ⏳ | POST /moodboards/audit has no rate limiting — multiple Claude Vision c |
| HIGH | bug | kid_ai_client.py:345-397 | ⏳ | Veo3 poll loop silently continues on every HTTP error with no consecut |
| HIGH | perf | supercomputer.py:423-503 | ⏳ | Storyboard scenes generated sequentially — 5x slower than necessary |
| HIGH | perf | claude_client.py:149-153 | ⏳ | Vision image downloads are sequential — up to 6x slower than parallel |
| HIGH | bug | main.py:26 | ⏳ | Rate-limit dict _RL is unbounded — grows forever in memory |
| HIGH | quality | app.jsx:1-4645 | ⏳ | app.jsx is 4645 lines — 5.8x over the 800-line limit |
| MEDIUM | security | generate.py:243-274 | ✅ | SSRF en _rehost_first_frame: IPs privadas no bloqueadas, follow_redire |
| MEDIUM | security | generate.py:367 | ⏳ | CORS Access-Control-Allow-Origin: * en media-proxy permite cross-origi |
| MEDIUM | security | Canvas Prototype.html:12 | ⏳ | Supabase ANON key hardcoded in HTML entry point |
| MEDIUM | security | Canvas Prototype.html:10-12 | ⏳ | Supabase project ID exposed in multiple client files |
| MEDIUM | bug | app.jsx:2867 | ⏳ | findUpstreamReference missing from runNode useCallback deps — stale cl |
| MEDIUM | bug | kid_ai_client.py:208, 213, 236, 355 | ⏳ | asyncio.get_event_loop() deprecated in Python 3.10+ — emits Deprecatio |
| MEDIUM | quality | leftmenu.jsx:308-678 | ⏳ | leftmenu.jsx is 2879 lines with 370+ lines of hardcoded SAMPLE_CLIENTS |

---

## Informe ejecutivo del workflow

No voy a usar herramientas: tengo todos los hallazgos verificados en el prompt. Sintetizo directamente.

---

# INFORME EJECUTABLE DE SEGURIDAD Y CALIDAD — Cliender Desing Pro V1

## 1. Resumen ejecutivo (estado real para una demo a clientes)

La herramienta **no está lista para una demo a cliente sin parchear primero**. No por una razón, sino por dos categorías que se solapan:

**(A) El backend es una puerta abierta.** No hay autenticación real. La clave `CDPRO_API_KEY` es opcional: si no está en el entorno, TODO endpoint POST funciona sin clave. Y aunque estuviera, el middleware solo protege POST — todos los GET/PUT/DELETE quedan expuestos por diseño. Cualquiera con acceso de red puede leer la galería completa, modificar precios, borrar moodboards, sobrescribir colecciones compartidas, y disparar APIs caras (Claude + KIE.ai) a tu costa. Además hay SSRF confirmado en tres funciones que descargan URLs arbitrarias sin bloquear IPs privadas — explotable para robar credenciales de metadata cloud si esto sale de Docker local.

**(B) El frontend filtra datos reales de cliente y se rompe en vivo.** El `leftmenu.jsx` lleva embebidos los 11 clientes reales de Cliender con emails internos (`toni@`, `vincent@cliender.com`) y notas de estrategia de marca — visible en DevTools para cualquiera que cargue la app. Y peor para una demo: hay al menos 4 bugs CRITICAL de UX que el cliente verá en pantalla: el zoom de canvas salta, el panel de output del agente desaparece solo, y los diálogos nativos `window.prompt/confirm` congelan la pestaña (o fallan en silencio en navegadores embebidos).

**Veredicto corto:** es un prototipo funcional con arquitectura de seguridad incompleta y varios fallos de UX visibles. Para una demo controlada en local, con red aislada y con ~6 fixes de UX, es presentable. Para cualquier exposición de red o demo "en abierto", es peligroso: filtra datos de clientes reales y permite gasto ilimitado a terceros.

**Mitigante real:** según las reglas del proyecto, esto es un sandbox aislado en Docker local (puertos 1004/2002/3003 no expuestos). Eso reduce la explotabilidad inmediata pero NO arregla el código, y un solo `docker run -p` o un túnel ngrok mal puesto convierte cada CRITICAL en producción.

---

## 2. Lista priorizada de fixes

### CRITICAL — bloquean demo abierta y/o cualquier deploy

**C1 · Datos reales de cliente en el bundle frontend** (DEDUP: `real-client-data-in-frontend` + `leftmenu-jsx-oversized-with-hardcoded-data`)
`leftmenu.jsx:308-668`
*Por qué importa:* 11 clientes reales + emails internos del equipo + estrategia de marca, leídos en cada carga por cualquier usuario. Fuga de confidencialidad de cliente y cosecha de emails para phishing. Es lo más grave si la demo se ve fuera del equipo.
*Fix:* Reemplazar `SAMPLE_CLIENTS` por placeholders ficticios (`Empresa Ejemplo SL`, `demo@example.com`) para la demo. Mover el array a `clients-data.js` y, a medio plazo, cargar desde el backend autenticado `/store/clients`. Quitar la URL de Supabase Storage.

**C2 · Backend completamente sin autenticación** (DEDUP: `no-auth-on-backend-api` + `auth-cdpro-api-key-optional` + `auth-missing-on-read-endpoints` + `analytics-pricing-update-unprotected` + `analytics-track-unauthenticated-write` + `store-put-no-item-validation`)
`main.py:54-66`
*Por qué importa:* Es el agujero raíz del que cuelgan 6 hallazgos. `api_key = os.environ.get('CDPRO_API_KEY')` → si falta, `if api_key and ...` es falso → cero auth. Y el guard solo cubre POST: GET/PUT/DELETE de analytics, gallery, moodboards y store quedan abiertos. Cualquiera modifica precios (`PUT /analytics/pricing`), desactiva alertas de gasto, borra galería, sobrescribe colecciones compartidas con `items:[]`, o falsifica telemetría.
*Fix:*
1. `CDPRO_API_KEY` obligatoria en `Settings` con `Field(min_length=32)`; el server debe **fallar en startup** si falta, nunca arrancar en modo inseguro.
2. Convertir el guard en una dependencia FastAPI reutilizable (`def require_api_key(x_api_key: str = Header(...))`) e inyectarla en todos los routers excepto `/health`, cubriendo **todos los métodos** (GET/POST/PUT/DELETE).
3. Documentar `CDPRO_API_KEY` como obligatoria en `.env.example`.
4. Frontend: pasar el JWT de Supabase como `Authorization: Bearer` en cada fetch (config.js, app.jsx, nodes.jsx).

**C3 · SSRF en descarga de URLs de referencia** (DEDUP: `ssrf-agent-ref-image-no-private-ip-block` CRITICAL + `ssrf-claude-client-image-block-no-private-ip` HIGH + `ssrf-rehost-first-frame-no-private-ip-block` MEDIUM — **es el mismo bug en tres funciones**)
`agent.py:71-112`, `claude_client.py:173-200`, `generate.py:243-274`
*Por qué importa:* Las tres funciones validan solo `startswith('http')` y usan `follow_redirects=True`. Un atacante envía `reference_images=['http://169.254.169.254/latest/meta-data/...']` y el backend descarga credenciales de instancia cloud y las envía a Claude o las re-hospeda en Supabase. En Docker local el riesgo es escaneo de la red interna; en producción es robo de credenciales.
*Fix:* Una sola función reutilizable `_is_private_ip(host)` basada en `ipaddress.ip_address(ip).is_private` (+ loopback + link-local). Resolver el hostname con `socket.getaddrinfo` antes del GET y rechazar IPs privadas. `follow_redirects=False` y manejo manual solo de redirecciones HTTPS. Aplicarla en las tres funciones. Validar Content-Type imagen y cap de tamaño **antes** de leer el body en `_rehost_first_frame`.

**C4 · Zoom de canvas salta (stale closure)** (DEDUP: `stale-zoom-closure-onwheel` CRITICAL + `onwheel-stale-zoom-pan` LOW — mismo bug)
`app.jsx:1995-2003`
*Por qué importa:* Cada scroll-zoom calcula el pan con el zoom anterior → el viewport salta visiblemente. Lo verá el cliente en el primer segundo de manipular el canvas.
*Fix:* Calcular el nuevo zoom dentro del updater y pasarlo al setPan:
```js
setZoom(z => { const nz = Math.max(0.4, Math.min(1.5, z + delta));
  setPan(p => ({ x: p.x - cursor.x*(nz-z), y: p.y - cursor.y*(nz-z) })); return nz; });
```

**C5 · Panel de output del agente desaparece (DOM mutation)** (DEDUP: `dom-mutation-promptnode-toggle` CRITICAL + `promptnode-dom-manipulation` MEDIUM — mismo bug)
`nodes.jsx:524-535`
*Por qué importa:* `document.getElementById(...).style.display` se sobrescribe en cualquier re-render (editar el brief, arrastrar nodo). El panel del agente desaparece solo durante el flujo core. Bug reportado ya en testing.
*Fix:* `const [showOutput, setShowOutput] = useState(false)` y render condicional `{showOutput && <div className='ao-panel'>...</div>}`.

**C6 · Diálogos nativos bloqueantes** (DEDUP: `blocking-window-prompt-confirm` CRITICAL + `window-prompt-confirm-project` + `native-confirm-logout-and-moodboard-delete` MEDIUM)
`app.jsx:553,1410,1429` · `leftmenu.jsx:1918` · `vault.jsx`
*Por qué importa:* `window.prompt/confirm` congelan la pestaña con un diálogo OS sin branding, y en WebView/Electron/algunos móviles devuelven null/false en silencio → renombrar y borrar fallan sin que el usuario lo sepa. Es la señal de calidad más visible en una demo en vivo.
*Fix:* Reutilizar el patrón `GroupNameModal` (ya existe en app.jsx) para inputs y crear un `ConfirmDialog` con `ReactDOM.createPortal` para confirmaciones. Aplicar en los 5 call sites.

---

### HIGH — deben arreglarse antes de cualquier uso real, no bloquean demo local controlada

**H1 · Cascada del agente no se detiene en error (stale closure)** — `app.jsx:2486`
Tras `patchNodeData({_agentFailed:true})` lee `nodes.find(...)` del closure stale → guard siempre falso → la generación KIE procede con brief sin refinar y gasta créditos. *Fix:* variable local `let agentFailed=false` en vez de releer del estado.

**H2 · CSP con `unsafe-eval` + `unsafe-inline`** — `nginx.conf:23`
Anula toda protección XSS; `connect-src https:` permite exfiltración a cualquier dominio. *Fix:* solo se resuelve migrando a build pipeline (Vite/Next, ya planificado en `02. PRODUCCION NEXTJS/`). Hasta entonces, documentar la restricción y tratar todo input como no confiable.

**H3 · Botones de referencia vídeo/audio muertos** — `nodes.jsx:1021-1032`
Botones sin `onClick`, sin `<input type=file>`, sin handler. La subida de referencias de vídeo es 100% no funcional. *Fix:* añadir input file oculto + onClick + onChange espejando el patrón de keyframes (línea ~1008).

**H4 · Rate-limit exento en endpoints caros** — `main.py:30-31`
`persist-media` (hasta 120MB) y `compose-logo` (35MB + Pillow) sin límite → DoS por saturación de Supabase/CPU. *Fix:* bucket de rate limit propio (~10 req/min), no exención total. `media-proxy` sí puede quedar exento (es GET de assets).

**H5 · `/moodboards/audit` sin rate limit** — `moodboard.py:275`
Doble-click o retry dispara dos Claude Vision (75-180s) en paralelo → coste duplicado. *Fix:* añadir `/moodboards` a `_RL_PREFIXES` o guard por-IP con intervalo mínimo 120s → HTTP 429.

**H6 · Veo3 poll sin cap de errores** — `kid_ai_client.py:345-397`
`_poll_veo3` hace `continue` en cada error sin contador → reintentos infinitos silenciosos hasta el timeout de 600s. *Fix:* copiar el patrón `consecutive_errors>=5` de `_poll_until_done` (líneas 190-210).

**H7 · `_RL` dict sin límite (memory leak)** (DEDUP: `unbounded-rate-limit-dict` HIGH + `memory-leak-rl-dict-unbounded` MEDIUM) — `main.py:26`
Acumula una entrada por IP para siempre. *Fix:* `if not bucket: del _RL[ip]` tras prune, o `cachetools.TTLCache`.

**H8 · Escenas de storyboard secuenciales** — `supercomputer.py:423-503`
For-loop secuencial: 5 escenas = 150-300s en vez de 30-60s. *Fix:* `asyncio.gather` con `_generate_scene` extraída; SSE por escena con `as_completed`.

**H9 · Descargas de visión secuenciales** — `claude_client.py:149-153`
6 imágenes en serie ~1.2s extra. *Fix:* `await asyncio.gather(*[self._image_block(u) for u in urls[:6]])`.

**H10 · `app.jsx` de 4645 líneas** — `app.jsx:1-4645`
5.8x el límite; `runNode` solo son 645 líneas. Cada fix arriesga regresión. *Fix:* extraer `useNodeRunner.js`, `GalleryPanel.jsx`, `modals/`. (No bloquea demo; es deuda que multiplica el coste de los demás fixes.)

**H11 · Master password en texto plano** — `leftmenu.jsx:1715-1716`
`MASTER_PASSWORD='Master123'` legible en DevTools, gatea `localStorage.clear()`. *Fix:* mover el borrado a endpoint backend autenticado; mínimo, hash con salt.

---

### MEDIUM — limpiar antes de salir de sandbox

- **Secretos Supabase en HTML** (DEDUP: `supabase-anon-key-hardcoded` + `supabase-project-id-exposed`) `Canvas Prototype.html:10-12` — la ANON key es pública por diseño; el riesgo real es **RLS débil**. *Fix:* auditar RLS en todas las tablas/buckets (`SELECT tablename, rowsecurity FROM pg_tables`), mover la key a `config.js` por env substitution.
- **Validación de input ausente** (DEDUP: `brief-no-max-length` + `reference-images-no-count-limit` + `build-profile-answers-untyped` + `gallery-item-url-unvalidated`) `agent.py:192,197,650` `gallery.py:50` — sin `max_length` → prompt injection + coste descontrolado. *Fix:* `Field(max_length=4000)` en brief/message, `Field(max_length=10)` en reference_images, schema tipado en answers, `HttpUrl` en url.
- **CORS wildcard en media-proxy** `generate.py:367` — mitigado por whitelist de hosts. *Fix:* `Access-Control-Allow-Origin` = origen propio.
- **Exposición de errores internos** `agent.py:501` y otros — `str(e)` al cliente. *Fix:* mensaje genérico en prod, log detallado en server.
- **persist-media sin validar Content-Type** `generate.py:381-437` — sube cualquier MIME como imagen. *Fix:* validar Content-Type + magic bytes.
- **CORS solo localhost / API_BASE puerto fijo :3003** (DEDUP: `cors-missing-production-domain` + `config-port-hardcoded-api-base`) — rompe tras reverse proxy. *Fix:* warning en startup + fallback a `window.location.origin`.
- **Rate-limit por IP bypasseable tras proxy** `main.py:59` — *Fix:* leer `X-Forwarded-For`.
- **UX flujos:** `runNode` dep faltante (`app.jsx:2867`), drawer de clientes deselecciona cliente al cerrar (`app.jsx:3252`), Run All ignora nodos standalone (`app.jsx:2894`), rubber-band siempre llama "Grupo" (`app.jsx:1916`), ImageRefNode se queda "uploading" sin try/finally (`nodes.jsx:1642`), `moodboardReducer` fallback identidad silencioso (`app.jsx:1557`), SuperStage re-audita al quitar imagen sin abort (`app.jsx:3790`), `asyncio.get_event_loop()` deprecado (`kid_ai_client.py`).
- **Calidad:** JSX duplicado Image/Video node (`nodes.jsx:663,836`), `nodes.jsx` 1777 líneas, `window.__handleMouseDown` re-registra en cada pan (`app.jsx:1738`), migración de galería en serie (`app.jsx:1308`), `console.warn` en paths de producción.
- **Frontend supply chain:** React dev bundles en vez de prod (`Canvas Prototype.html:92`), Three.js sin SRI (`:97`), `window.open` sin noopener (`ui.jsx:258`), fetch sin check `.ok` (`app.jsx:1288`), email de usuario spoofable (`app.jsx:1307`).

### LOW
HSTS ausente (HTTP-only, OK en local), `console.log` filtra estructura (`vault.jsx:148`), sin límite de tamaño en upload base64 (`nodes.jsx:1647`), `urlDraft` muerto (`nodes.jsx:840`), `liquid.css.backup` servido públicamente, `_galleryApi` recreado por render, lock de moodboard no atómico, store PUT full-replace sin merge, avatar IIFE por render.

---

## 3. Dedup aplicado

Hallazgos unidos como un mismo problema:
- **SSRF** → 3 hallazgos = 1 bug en 3 funciones (C3). Una sola función `_is_private_ip` los cierra todos.
- **Auth backend** → 6 hallazgos (`no-auth-on-backend-api`, `cdpro-api-key-optional`, `auth-missing-on-read`, `pricing-update`, `analytics-track`, `store-put`) = 1 raíz: middleware incompleto + key opcional (C2).
- **Zoom stale closure** → CRITICAL + LOW = 1 bug (C4).
- **DOM mutation PromptNode** → CRITICAL + MEDIUM = 1 bug (C5).
- **window.prompt/confirm** → CRITICAL + 2 MEDIUM = 1 patrón en 5 call sites (C6).
- **Rate-limit dict leak** → HIGH + MEDIUM = 1 bug (H7).
- **Datos cliente hardcoded** → CRITICAL (seguridad) + MEDIUM (calidad) = 1 origen (C1).
- **Supabase ANON key + project ID** → 2 hallazgos = 1 tema (RLS).
- **Validación de input** → 4 hallazgos = 1 tanda de `Field()`.
- **CORS/API_BASE deploy** → 2 hallazgos = 1 tema de config.

**De ~60 hallazgos crudos → ~38 problemas reales.**

---

## 4. Quick wins vs trabajo mayor

**QUICK WINS (alto impacto, < 30 min cada uno):**
- C4 zoom (3 líneas) — elimina el salto visible.
- C5 panel agente (useState, ~5 líneas) — arregla bug reportado.
- H1 agent abort (variable local, 2 líneas) — para gasto de créditos en error.
- H6 Veo3 error cap (copiar 10 líneas de la función de al lado).
- H7 memory leak (`if not bucket: del`).
- C2 paso 1: `CDPRO_API_KEY` obligatoria + fail en startup (~15 líneas).
- Validación de input MEDIUM (`Field(max_length=...)`, una línea por campo).
- `window.open` noopener, borrar `liquid.css.backup`, quitar `urlDraft`.

**MEDIO (1-3 h):**
- C3 SSRF — escribir `_is_private_ip` + aplicar en 3 sitios.
- C6 diálogos — `ConfirmDialog` portal + 5 call sites.
- C2 paso 2 — dependencia `require_api_key` en todos los routers + tokens en frontend.
- H3 botones vídeo/audio muertos.
- H4/H5 rate limits.
- H8/H9 paralelización (gather).

**TRABAJO MAYOR (días):**
- C1 + reemplazo de datos reales por backend autenticado.
- H2 CSP → migración a Next.js/Vite (ya planificada).
- H10 refactor de `app.jsx` 4645 líneas.
- Auditoría RLS completa de Supabase.

---

## 5. Veredicto final

**¿Qué tan lista está?** Es un prototipo que **demuestra bien el concepto pero está crudo en seguridad y tiene fallos de UX que un cliente verá**. No es "casi producción": le falta toda la capa de autenticación real y la migración de build. En seguridad, hoy depende enteramente del aislamiento de Docker — el código en sí es inseguro.

**MÍNIMO INNEGOCIABLE antes de presentarla a un cliente** (todo esto es medio día de trabajo, mayoría quick wins):

1. **C1** — Sacar los datos reales de cliente del frontend. *No negociable: es confidencialidad de tus propios clientes en pantalla.*
2. **C4, C5, C6** — Los 3 bugs de UX visibles (zoom, panel agente, diálogos nativos). *Sin esto la demo se ve rota.*
3. **C2 paso 1** — `CDPRO_API_KEY` obligatoria + fail en startup, y confirmar que la demo corre **en red local aislada, nunca expuesta**. *Sin esto cualquiera en la red gasta tus créditos de Claude/KIE.*
4. **H1** — Para la cascada en error del agente. *Quick win, evita gasto y outputs basura en vivo.*

**Recomendado mismo día si hay tiempo:** C3 (SSRF), H3 (botones muertos), H5 (doble-audit).

**Antes de CUALQUIER exposición de red real (no demo local):** C2 completo, C3, H2, auditoría RLS de Supabase. Hasta entonces, la regla es simple: **esta herramienta no toca una IP pública.**

Si la demo es presencial, en tu máquina, con red controlada, y haces los 4 fixes mínimos → presentable. Si la demo implica que el cliente acceda por su cuenta o por un enlace → no, hasta cerrar la capa de auth y los datos de cliente.

---

## ACTUALIZACIÓN DE FIXES — 3 tandas aplicadas (2026-06-08/09)

### Tanda 1 (seguridad + bugs visibles)
- ✅ SSRF en `_ref_image_block` / `_rehost_first_frame` / `_image_block` → `url_guard.py` (bloquea IP privada/metadata + `follow_redirects=False`)
- ✅ H1 cascada del agente no paraba en error (stale closure) → bandera local síncrona
- ✅ C5 panel del agente desaparecía (DOM mutation) → React state
- ✅ C4 zoom de canvas saltaba → cálculo dentro del updater de setZoom
- ✅ H3 botones vídeo/audio muertos → deshabilitados "Próximamente"

### Tanda 2 (auth + rate-limit)
- ✅ C2 auth en TODOS los métodos (GET/PUT/DELETE, no solo POST) cuando hay `CDPRO_API_KEY`
- ✅ H4/H5 rate-limit propio en endpoints caros (persist-media, compose-logo, moodboards/audit)
- ✅ H7 memory leak `_RL` → prune global cada 5 min
- ✅ C6 diálogos `window.prompt/confirm` → `ConfirmHost` modal (5 call sites)

### Tanda 3 (perf seguro)
- ✅ Vision: descargas de imágenes de referencia en PARALELO (`asyncio.gather`) — antes 6× más lento secuencial

### NO aplicados (decisión técnica)
- ⚠️ H8 paralelizar escenas de storyboard: **rechazado** — cada escena usa el keyframe de la anterior (`prev_keyframe`) como referencia de continuidad encadenada. Paralelizar rompería la coherencia visual. El workflow no detectó esta dependencia. Optimización segura posible (paralelizar solo los vídeos tras los keyframes) = refactor mayor del SSE, pendiente.
- ⚠️ H2 CSP `unsafe-eval`: solo se cierra migrando al build pipeline Next.js (ya planificado en `02. PRODUCCION NEXTJS/`).

### Pendiente con decisión del usuario
- ⏳ C1 `SAMPLE_CLIENTS` datos reales en bundle → depende de si la demo es interna (OK) o externa (ocultar).
- ⏳ 43 hallazgos MEDIUM/LOW (ver tabla arriba).
