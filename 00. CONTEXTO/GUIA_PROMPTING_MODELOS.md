# Guía de Prompting por Modelo — Cliender Desing Pro

> Investigación 2026-06 (blogs oficiales, guías especializadas, comunidad). Destilada para los
> agentes de la herramienta. Fuente de verdad para `prompt_brain.py`, `agent.py`, `storyboard_director.py`.

---

## 🎬 SEEDANCE 2.0 (vídeo · ByteDance vía KIE)

**Estructura óptima (en este orden):**
`[shot type] + [subject] + [action] + [environment] + [camera movement] + [lighting] + [visual style] + [aspect ratio]`

**Reglas de oro:**
1. **60-100 palabras.** Muy corto = pierde detalle; muy largo = instrucciones en conflicto.
2. **UN SOLO movimiento de cámara por clip.** Múltiples movimientos → vídeo jittery/incoherente. (El más importante.)
3. **Lenguaje rítmico, NO técnico.** Usar `slow, smooth, stable, gradual, gentle`. NO usar fps, focal length, distancia.
4. **Cortar adjetivos filler:** elimina `beautiful, amazing, stunning, perfect`. Cada palabra debe dar instrucción real.
5. **Opening frame + motion arc + closing frame** (qué cambia de principio a fin).
6. **Iluminación consistente** durante todo el clip (una sola fuente/esquema).
7. **Evitar:** cortes de escena rápidos (modelo de clip único), coreografía multi-persona compleja.

**Timeline prompting (multi-beat):** para clips de 5-10s, dividir en 2-3 beats con micro-direcciones de cámara/acción. Para storyboards de varias escenas en UN vídeo: describir las escenas en orden con transiciones (cut, match-cut, dissolve) — la duración total se reparte entre escenas.

**Movimientos de cámara que entiende mejor:** `slow push-in`, `gentle dolly track right`, `static locked-off`, `subtle handheld drift`, `smooth crane rise`, `arc orbit`, `slow zoom out`, `tilt up`.

---

## 🖼 NANO-BANANA / GEMINI IMAGE (imagen + fusión · KIE: nano-banana-pro / nano-banana-2)

**Reglas de oro:**
1. **Describe la ESCENA COMPLETA en lenguaje natural, NO un montón de keywords.** El modelo entiende prosa.
2. **Dirige como un director de foto:** especifica iluminación explícita (`three-point softbox setup`, `warm window side-light`).
3. **Multi-image fusion (su superpoder):** indica la INTENCIÓN de fusión + qué tomar de cada referencia:
   - `"keep the subject identity from Image A"` / `"use the garment from Image B"` / `"blend the palette of A with the composition of B"`.
4. **Preservación explícita de identidad** cuando importa: `"preserve the exact face/character from the reference, unchanged"`.
5. Hasta 14 imágenes de entrada (nano-banana pro). En la herramienta: hasta 8-9.
6. Workflow por etapas: preview rápido → render final.

**Para la herramienta (fusión de referencias):** el prompt debe ser un BRIEF DE COMPOSICIÓN que se refiere a los elementos de cada referencia y ordena preservarlos, no una descripción text-to-image desde cero.

---

## 🎨 GPT-IMAGE (imagen · KIE: gpt-imagenes-2)

**Reglas de oro:**
1. **Orden consistente:** `background/scene → subject → key details → constraints`.
2. **Indicar el uso** (ad, UI mock, infografía) para fijar el "modo" y nivel de acabado.
3. **Texto en imagen (su fuerte):** texto exacto entre comillas + `render the text verbatim`, `no extra words`, `no duplicate text`. Para copy largo: dividir en líneas. Si falla: menos texto, tipografía más grande.
4. **Aspect ratio explícito SIEMPRE** (default 1:1): `portrait orientation`, `9:16`, `suitable for Instagram (4:5)`.
5. Concreto en materiales/texturas/medio (`photorealistic`, `editorial photography`, `3D render`).
6. Requests complejos: segmentos etiquetados o saltos de línea, no un párrafo monolítico.

---

## 🧠 CLAUDE (cognición de los agentes · SHAQ, vision, storyboard director)

**Reglas de oro:**
1. **XML tags estructuran el prompt** (+20-40% consistencia): `<role>`, `<context>`, `<task>`, `<instructions>`, `<output_format>`.
2. **Orden:** `<role>` y `<context>` PRIMERO, luego `<task>`, luego `<instructions>` y `<output_format>`. El contexto antes de la tarea ayuda a fijar el marco.
3. **Schema-first** para salida estructurada (JSON/campos definidos).
4. **Opus 4.8 necesita guía más MÍNIMA** para creatividad — no sobre-instruir; dar dirección, no recetas rígidas.
5. Rol explícito en el system prompt (la API no trae system por defecto).
6. Few-shot examples dentro de `<example>` cuando el formato importa.

**Implicación para la herramienta:** el system prompt de SHAQ (actualmente ~730 líneas planas) gana consistencia + velocidad si se estructura con secciones claras y se recorta lo redundante. Menos tokens = más rápido y más barato por llamada.

---

## Aplicación a los agentes de la herramienta

| Agente | Modelo destino | Mejoras a aplicar |
|--------|---------------|-------------------|
| SHAQ (PromptNode) imagen | gpt-imagenes-2 / nano-banana | orden scene→subject→constraints, aspect ratio explícito, texto verbatim, fusión con preservación |
| SHAQ vídeo | seedance-2.0 | UN movimiento de cámara, 60-100 palabras, lenguaje rítmico, cortar filler, timeline beats |
| Vision analyst | Claude | XML tags, schema-first |
| Storyboard director | Claude + Seedance | escenas en orden con transiciones, continuidad encadenada |

---

## Fuentes
- Seedance 2.0: seedance.tv/blog, apiyi.com, mindstudio.ai (timeline prompting), docs.byteplus.com (ModelArk), github YouMind-OpenLab/awesome-seedance-2-prompts
- Nano-banana: blog.google (prompting tips), deepmind.google prompt-guide, cloud.google.com, leonardo.ai
- GPT-Image: developers.openai.com cookbook (image-gen prompting guide), fal.ai, promptingguide.ai
- Claude: platform.claude.com/docs prompt-engineering, console.anthropic.com (XML tags)
