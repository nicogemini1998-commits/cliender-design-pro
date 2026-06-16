# Auditoría de estado — Cliender Design Pro V1 · 2026-06-10

> Auditoría completa (mediciones en vivo + 2 revisiones de código en paralelo). 42 hallazgos.
> Estado general: **FUNCIONAL Y SANO en operación**, con deuda estructural clara en 4 frentes:
> base de datos (JSON en Storage), carga del frontend (Babel en navegador), conexiones HTTP del backend y huecos del tracking de costes.

## Mediciones en vivo (2026-06-10)

| Métrica | Valor | Veredicto |
|---|---|---|
| Stack (4 containers) | healthy | ✓ |
| Latencia /health | 2 ms | ✓ |
| Latencia /gallery, /store/*, /moodboards | 150–290 ms | ⚠ cada GET descarga un JSON entero de Supabase Storage |
| JSX transpilado por Babel EN EL NAVEGADOR | 584 KB (~1.2–1.8 s) | ✖ mayor lastre de carga |
| CDN (React dev + Babel + Three.js + fonts) | ~1.7 MB sin gzip | ✖ React versión development |
| Errores backend 24 h | 0 | ✓ |
| Tracking de costes | **REAL**: 254 llamadas · $6.02 total · $3.98/7d · precios desde `model_pricing` | ✓ con huecos (ver abajo) |

## CRÍTICOS (P0)

1. **BD — race condition en galería** (`gallery.py:66-72`): load→filter→save sin transacción. Dos usuarios simultáneos se pisan el JSON → pérdida de items. Igual en moodboards y store/*. **Fix: migrar gallery/store/moodboards a tablas Postgres reales de Supabase** (ya se usan api_calls/model_pricing).
2. **Backend — un `httpx.AsyncClient` NUEVO por request** (36 instancias; analytics.py:66+, claude_client.py:129): agota conexiones bajo carga. **Fix: cliente singleton compartido.**
3. **Costes — Vision Auditor no se trackea** (`vision_auditor.py:246-373`): cada auditoría de moodboard llama a Claude vision sin registrar coste. También fallos de Claude/KIE no se registran (solo éxitos). **Fix: track con status=ok/error en todas las llamadas.**
4. **Frontend — OutputNodes duplicados por carrera** (`app.jsx:2686-2695`) y por doble clic en Generar. **Fix: lock por nodeId con useRef antes del setNodes.**
5. **Frontend — PUT del store silencioso** (`config.js:55-63`): si falla el guardado, nadie se entera; el poll de 30s trae la versión vieja → cambios perdidos. **Fix: retry exponencial + aviso si falla.**

## ALTOS (P1)

- Sin validación de tipos al conectar nodos (cualquier→cualquier; `app.jsx:1837`).
- Edges huérfanos al borrar un nodo en ejecución (`app.jsx:2731`).
- Closures stale residuales (`nodes.find` vs `nodesRef.current`; `app.jsx:2507`).
- Merge multi-usuario sin `updatedAt` en items de OutputNode → pérdidas en colaboración.
- Poll 30s sobreescribe cambios locales sin avisar (banner de conflicto recomendado).
- `model_pricing` consultado en CADA track (sin caché) — `generate.py:65-74`.
- Vision Auditor descarga imágenes en serie (20 imgs ≈ 40 s; con gather ≈ 4 s) — `vision_auditor.py:270-273`.
- Galería cap 500 items silencioso (`gallery.py:70`); sin índices en `api_calls`.
- localStorage de moodboards roza el límite de 5 MB con >40 imágenes.
- Manifest JSON del Vision Auditor falla silencioso → score 0% (subir max_tokens / robustecer parse).

## MEDIOS (P2)

- `/analytics/summary` descarga TODAS las filas del periodo y filtra en Python (paginar).
- Auditoría de moodboard en background sin timeout (frontend cree que sigue "auditing").
- Perfil: avatar no subible (solo 8 presets), email puede quedar stale, rol sin validar, sin ownership de proyectos (RBAC).
- Aviso UX faltante: Image→Video sin Prompt intermedio = resultado genérico (sin marca/moodboard).
- GET /gallery puede devolver base64 embebido (payload gigante).
- Guard del Canvas no revalida el token contra el servidor.

## CONFIRMADO OK

- Precios de coste reales y editables vía `/analytics/pricing` (no hardcodeados).
- Contexto de cliente (brief/colores/logo/manifest) sí llega a los prompts de SHAQ; acceso defensivo con getattr.
- Moodboards con fallback in-memory si Supabase cae; base64→Storage blindado.
- Flujo secuencial vision→SHAQ es dependencia real (no se puede paralelizar).
- Conexión API frontend↔backend estable (sondeo corto + retry, fix 2026-06-09).

## PLAN DE MEJORA PROPUESTO

**Fase 1 — Integridad de datos (1 día):** migrar gallery + store/* + moodboards de JSON-en-Storage a tablas Postgres de Supabase (id PK, updatedAt, índices); retry+aviso en PUT del store; lock anti-duplicados en runNode.
**Fase 2 — Velocidad (1 día):** pre-compilar los JSX (esbuild) y servir JS plano + React production + gzip en nginx (carga 4-6s → <1s); lazy-load Three.js; cachear model_pricing; httpx singleton; gather en vision auditor.
**Fase 3 — Costes 100% reales (medio día):** track de Claude vision + errores con status; dashboard analytics con auto-refresh (poll 30s) = tiempo real efectivo.
**Fase 4 — Flujos y perfiles (1 día):** validación de conexiones por tipo, limpieza de edges al borrar, updatedAt en items, banner de conflicto multi-usuario, avatar subible + ownership de proyectos.
