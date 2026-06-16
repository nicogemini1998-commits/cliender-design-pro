# PLAN MAESTRO — SuperComputer V2

> ## ✅ DECISIONES TOMADAS (2026-06-05)
> 1. **Layout:** mono-columna editorial centrada.
> 2. **Enjambre live:** línea de progreso editorial (5 estaciones tipográficas + resultado protagonista).
> 3. **Tipografía:** serif editorial para hero/display + sans actual para UI.
> 4. **Arranque:** backend (F1) y frontend (D0/D1/D2) en paralelo.


> CDPro · Cliender Design Pro V1
> Autor: KAREN (Nico) · Fecha: 2026-06-05
> Objetivo: que el SuperComputer (1) **cree de forma perfecta** y (2) tenga un **diseño nuevo, ordenado, limpio, lujo silencioso** (Apple / Hermès / Louis Vuitton).

---

## 0. TL;DR (lo crudo en 6 líneas)

1. **El "enjambre" es teatro parcial.** El `Critic` es un stub: aprueba con solo ver una URL. El loop de refinamiento NO refina nada. La promesa "el enjambre itera hasta la perfección" hoy es mentira.
2. **El SuperComputer tiene un cerebro más tonto que el PromptNode.** SHAQ (`agent.py`) tiene capas de cliente, moodboard, conocimiento cine/marketing/social y modo storyboard/character-board. El grafo del SuperComputer NO. Genera prompts pobres.
3. **La marca del cliente NO entra al prompt final de imagen.** El `cinematographer` solo fusiona el moodboard. Los HEX, tipografías y tagline del cliente se pierden.
4. **No hay multi-imagen.** "Créame 5 posts" → genera 1. Imposible cumplir lo que el equipo pide.
5. **El layout visual está roto.** El grid reserva una columna para el orbe (`CortexSwarm`) que **nunca se renderiza** → medio stage vacío, formulario descolgado a la derecha.
6. **La estética no es lujo, es "gamer cosmos".** Glassmorphism morado/verde + grano + gradientes a la deriva. CSS con 3 definiciones duplicadas del título y overrides `!important` apilados. Lo opuesto a Apple/Hermès/LV.

---

## 1. AUDITORÍA CRUDA

### 1.1 Funcionamiento (backend — el grafo LangGraph)

Pipeline real: `START → master_director → scriptwriter → cinematographer → production → critic → (loop|END)`

| Nodo | Qué hace HOY | Verdad cruda |
|------|--------------|--------------|
| `master_director` | Decide image/video + intención creativa con Claude. Recibe cliente. | OK, pero solo pasa texto. Decisión image/video por keywords. |
| `scriptwriter` | Estrategia creativa (tono, audiencia, color_direction) con Claude. | OK conceptualmente. Produce texto narrativo, no restricciones duras. |
| `cinematographer` | Traduce a prompt técnico + elige modelo. Fusiona StyleManifest del moodboard. | **GAP CRÍTICO: NO inyecta brand DNA del cliente (HEX/fonts/tagline/CTA).** El cliente se diluye en prosa del scriptwriter; los HEX no se fuerzan. |
| `production` | Llama KIE.ai (`call_kid_ai_api`). | **Skeleton** (línea 18: `TODO Paso 2`). Sin reintentos suaves ni persistencia robusta del job. Genera **1** artefacto. |
| `critic` | Evalúa calidad. | **STUB TOTAL** (`critic.py:13` → `TODO Paso 2`). `approved = bool(artifact.url)`, `score = 1.0`. **No mira la imagen. No critica nada.** |
| `bump_retries` | Incrementa contador y vuelve a cinematographer. | Inútil: como el critic siempre aprueba si hay URL, el loop solo se dispara si la generación **falla**, no si sale **fea**. |

**Consecuencias directas:**
- La calidad final depende 100% de un único prompt del `cinematographer`, que es más pobre que SHAQ.
- "Iteración inteligente del enjambre" = humo. Coste de Claude en 5 nodos sin el beneficio prometido.
- Imágenes mediocres respecto al PromptNode con el mismo cliente.

### 1.2 Dos cerebros divergentes (la raíz del problema)

| | PromptNode (`/agent/run` → SHAQ, `agent.py`) | SuperComputer (`/chat/stream` → grafo) |
|---|---|---|
| Capa cliente (HEX, fonts, CTA, tagline, voz, anti-patterns) | ✅ Completa e inmutable | ❌ Solo prosa del scriptwriter |
| Capa moodboard (StyleManifest 1:1) | ✅ | ✅ (única que sí comparte) |
| Conocimiento cine / óptica / luz / color grading | ✅ Base extensa | ⚠️ Parcial, depende del LLM sin guía |
| Conocimiento social (IG/TikTok/LinkedIn specs) | ✅ | ❌ |
| Reglas de imágenes de referencia (forensic analysis) | ✅ Directiva suprema | ⚠️ Solo pasa URLs |
| Modo storyboard / character board | ✅ (recién añadido) | ❌ |
| Logo overlay zone rule | ✅ | ❌ |

→ **El SuperComputer debe heredar el cerebro de SHAQ.** No tiene sentido mantener dos sistemas de prompt, uno bueno y uno pobre.

### 1.3 Diseño (frontend — `SuperStage` + `liquid.css`)

**Bug de layout (alto impacto visual):**
- `liquid.css:2234-2251`: `.cortex-inner` usa `grid-template-areas: "head head" / "swarm form"`.
- `SuperStage` (`app.jsx:3527-3700`) renderiza solo `cortex-head` + `cortex-form`. **`.cortex-swarm` no existe en el DOM.** El componente `CortexSwarm` (orbe animado, el "wow") está definido pero **muerto**.
- Resultado: la columna izquierda (`minmax(280px,460px)`) queda **vacía**; el formulario flota descolgado a la derecha. Asimetría no intencional.

**Deuda CSS (desorden):**
- `.cortex-title` definido **3 veces** (2267, 4581, 4942). `.cortex-title-soft` **3 veces** (2275, 4588, 4951).
- Overrides `!important` apilados para light theme en 4 bloques distintos (4072, 4260, 4310, 4437, 4848+, 4916+).
- `.cortex-stage { padding-top:0 !important }` parche tardío (4575).
- Señal clara de iteración por parches, no por sistema.

**Estética actual (NO es el objetivo):**
- Fondo: `radial-gradient #15101F → #07070C` + 3 blobs morado/verde a la deriva (`cortex-drift 32s`) + grano `mix-blend overlay`.
- Título con gradiente shimmer animado arcoíris (morado→verde).
- Glassmorphism por todas partes (`blur(18px) saturate(160%)`).
- Veredicto: estética "cosmos tech / gamer". Llamativa pero ruidosa. **Lo contrario al lujo silencioso.**

**Lo que SÍ funciona y hay que conservar:**
- El modal "Enjambre en vivo" (`swarm-modal`) con barra de progreso, badges por agente y log vivo: buena idea de transparencia. Necesita rediseño visual, no quitarse.
- El flujo de referencias visuales (subir hasta 2, análisis ADN) es bueno. Conservar, refinar.
- El contexto heredado del topbar (cliente/moodboard read-only) es correcto.

---

## 2. VISIÓN OBJETIVO — qué es "perfecto"

### 2.1 Funcionamiento perfecto

> Un brief (texto + opcional refs + cliente + moodboard) → el enjambre produce **N piezas** de calidad de agencia, fieles a la marca, **auto-evaluadas de verdad**, y entregadas a Galería.

Principios:
1. **Un solo cerebro.** El SuperComputer usa el mismo motor de prompt que SHAQ (capas cliente + moodboard + cine/social + storyboard/character-board).
2. **Critic real.** Claude Vision mira la imagen generada y puntúa contra criterios (fidelidad al brief, marca, calidad técnica, legibilidad de texto). Rechaza y reintenta con feedback accionable. Máximo N reintentos.
3. **Multi-pieza.** Si el brief pide "5 posts", produce 5 variaciones coherentes (mismo ADN, distinto encuadre/copy).
4. **Marca inviolable.** HEX y fonts del cliente entran como restricciones duras en el prompt final, siempre.
5. **Robustez.** Reintentos suaves ante fallos de KIE, timeouts claros, persistencia del job, errores legibles.

### 2.2 Diseño perfecto — "Lujo silencioso"

Dirección: **Apple (claridad, espacio, jerarquía) + Hermès (calidez, materialidad, artesanía) + Louis Vuitton (estructura, monograma sutil, confianza).**

ADN visual:
- **Calma, no cosmos.** Fuera blobs a la deriva, grano y shimmer arcoíris. Entra superficie sobria, un acento, mucho aire.
- **Tipografía protagonista.** Una serif editorial para el hero (display) + el sans del producto para UI. Contraste de escala real.
- **Paleta disciplinada.** Marfil/hueso + tinta + UN acento cálido (Cliender). Nada de morado+verde simultáneos.
- **Materialidad sutil.** Sombras suaves largas, bordes 1px hairline, radios consistentes, micro-textura de papel apenas perceptible (no grano digital).
- **Movimiento que aclara.** Entradas suaves, foco en el resultado. El orbe del enjambre se reinterpreta como una pieza **minimal y silenciosa** (o se sustituye por una línea de progreso editorial).
- **Simetría intencional.** Arreglar el grid: o se centra el brief (mono-columna editorial), o se usan las 2 columnas con contenido real en ambas.

---

## 3. PLAN DE EJECUCIÓN — FUNCIONAMIENTO

### Fase F1 — Unificar el cerebro (máxima prioridad)
**Meta:** el grafo genera prompts a nivel SHAQ.
- Extraer el constructor de system prompt de `agent.py` (`_build_system` + capas + storyboard/character-board) a un módulo compartido `app/services/prompt_brain.py`.
- `cinematographer` consume `prompt_brain` en lugar de su `_CINEMATOGRAPHER_SYSTEM` minimalista.
- Inyectar `client_context` completo (HEX, fonts, tagline, CTA, voz, anti-patterns, logo zone) como restricciones duras en el prompt final.
- Pasar `creative_strategy` del scriptwriter como input de contexto, no como sustituto.
- Heredar detección storyboard/character-board en el grafo.
- **Test:** mismo brief en PromptNode y SuperComputer → calidad equivalente.

### Fase F2 — Critic real (Claude Vision)
**Meta:** evaluación honesta + loop que sí mejora.
- `critic_node`: descargar/leer la imagen (URL o data) y pedir a Claude Vision un score 0–1 contra rúbrica:
  - fidelidad al brief, fidelidad a marca (HEX/fonts), calidad técnica (composición/luz), legibilidad de texto, ausencia de artefactos.
- `approved = score >= umbral` (config). Si rechaza → `issues` + `suggested_fixes` accionables que el `cinematographer` consume en el reintento.
- Respetar `critic_max_retries`. Telemetría real del loop al frontend.
- **Test:** imagen deliberadamente mala → rechazada con feedback; reintento mejora.

### Fase F3 — Multi-pieza
**Meta:** "créame N posts" → N piezas.
- `master_director` detecta cantidad (regex/keyword + Claude) → `state["piece_count"]`.
- `production` genera N variaciones (mismo plan, seeds/encuadres/copy distintos). Fan-out controlado (límite + coste visible).
- Frontend: el resultado muestra grid de N piezas, todas a Galería.
- **Test:** "5 posts para X" → 5 assets coherentes.

### Fase F4 — Robustez producción
**Meta:** fiable bajo fallos.
- `production`: reintentos suaves ante error/timeout KIE, backoff, mensajes legibles.
- Persistencia del job (id, estado, coste) — alinear con Supabase ya en uso.
- Manejo de `stub` (sin KIE_API_KEY) claro en UI.
- **Test:** simular fallo KIE → reintento y error legible, sin romper el stream.

---

## 4. PLAN DE EJECUCIÓN — REDISEÑO (Apple / Hermès / LV)

### Fase D0 — Sistema de diseño (tokens) antes de tocar pantallas
Crear `prototype/supercomputer.css` nuevo y aislado (no seguir parcheando `liquid.css`):
- Tokens dedicados: `--sc-ink`, `--sc-paper`, `--sc-accent`, escala tipográfica (`--sc-display`, `--sc-title`, `--sc-body`, `--sc-caption`), espaciado rítmico, radios, sombras hairline.
- Borrar las 3 definiciones duplicadas de `.cortex-*` y los overrides `!important` al migrar.

### Fase D1 — Layout editorial (arreglar el grid roto)
- Decisión de composición (ver §5 — pregunta abierta): **mono-columna editorial centrada** (recomendado) **o** dos columnas con la izquierda viva.
- Eliminar la columna fantasma. Brief como pieza central con aire generoso.
- Jerarquía: kicker discreto → hero serif grande → subcopy → brief → contexto → launch.

### Fase D2 — Estética lujo
- Fondo: superficie marfil/tinta sobria; micro-textura papel opcional muy sutil; fuera blobs/grano/shimmer.
- Tipografía: serif editorial display + sans producto. Contraste de escala real.
- Acento único cálido Cliender. Estados hover/focus "designed" pero discretos.
- Botón launch: sólido, confiado, sin gradiente arcoíris.

### Fase D3 — Reinterpretar el enjambre en vivo
- Opción A: orbe minimal monocromo silencioso (1 acento, sin 18 partículas de colores).
- Opción B (recomendada lujo): sustituir orbe por **línea de progreso editorial** con los 5 pasos como estaciones tipográficas + el resultado como protagonista.
- Rediseñar `swarm-modal` con el mismo sistema (papel, hairline, tipografía).

### Fase D4 — Resultado protagonista
- La pieza generada (o grid de N) ocupa el foco con marco tipo galería, ficha de metadatos sobria y acción de descarga/añadir elegante.

### Fase D5 — Pulido
- Light/dark intencionales (no parches). Responsive 320–1920. Reduced-motion. Accesibilidad (contraste, foco, teclado).

---

## 5. SECUENCIA RECOMENDADA Y DECISIONES ABIERTAS

**Orden sugerido:** F1 → D0 → D1 → F2 → D2 → F3 → D3 → F4 → D4 → D5.
(Primero el cerebro unificado y el esqueleto visual, porque desbloquean todo lo demás; el resto alterna función/diseño.)

**Decisiones que requieren tu OK antes de implementar:**
1. **Composición del stage:** ¿mono-columna editorial centrada (recomendado) o dos columnas?
2. **El enjambre en vivo:** ¿orbe minimal silencioso u línea de progreso editorial (recomendado)?
3. **Tipografía display:** ¿serif editorial (recomendado lujo) o mantener sans actual con más escala?
4. **Multi-pieza:** ¿límite máximo por brief (coste)? Propuesta: 6.
5. **Profundidad ahora:** ¿ejecutamos F1+F2 (núcleo de "creación perfecta") ya, o primero el rediseño visual para enseñar a Pablo?

---

## 6. RIESGOS / NOTAS

- **Coste Claude:** F2 (Vision en cada generación) + F3 (N piezas) suben coste. Mitigar con umbral de critic y límite de piezas.
- **Babel in-browser:** el frontend es live-mount; cambios JSX/CSS sin rebuild. Backend Python sí requiere `docker compose up --build` (regla conocida, EDEADLK OneDrive).
- **No romper PromptNode:** al extraer `prompt_brain`, `agent.py` debe seguir funcionando idéntico (refactor sin regresión).
- **Regla raíz limpia:** todo archivo nuevo a carpeta numerada; CSS nuevo en `prototype/`, módulo backend en `app/services/`.
- **Sin datos inventados:** nada de mocks en producción; stubs solo si falta KIE_API_KEY, señalado en UI.
