"""Storyboard Director — convierte un brief + imagen(es) de referencia de
secuencia en un plan de vídeo multi-escena, y genera el prompt KIE perfecto por
escena reutilizando el cerebro de prompting (SHAQ / prompt_brain).

Flujo (consumido por POST /chat/storyboard/stream):
  1. read_storyboard(...)  → lee la referencia escena-por-escena con Claude Vision
                             y la fusiona con el brief + duración objetivo.
                             Devuelve un plan estructurado de N escenas.
  2. build_scene_prompt(...) → por cada escena, produce el prompt hiper-técnico
                               (con marca + ADN visual) y el model_id KIE.

El Director decide por escena si necesita VÍDEO real (acción/movimiento) o
IMAGEN animada (plano estático que Remotion mueve con Ken Burns), optimizando
coste sin sacrificar la narrativa.
"""
from __future__ import annotations

import json
from typing import Any

from app.core.config import (
    ALLOWED_IMAGE_MODELS,
    ALLOWED_VIDEO_MODELS,
    KidAIImageModel,
    KidAIVideoModel,
)
from app.services import prompt_brain
from app.services.claude_client import get_claude


# ---------------------------------------------------------------------------
# 1. LECTURA DEL STORYBOARD (Claude Vision)
# ---------------------------------------------------------------------------

_DIRECTOR_SYSTEM = """Eres el Storyboard Director del creative SuperComputer of the studio.
Tu trabajo: leer una imagen de referencia que describe una secuencia de vídeo
ESCENA POR ESCENA (un storyboard, viñetas, o una explicación visual del flujo) y
fusionarla con el brief del usuario para producir un PLAN DE VÍDEO ejecutable.

ENTENDER LA REFERENCIA:
- La imagen puede ser un storyboard formal (paneles numerados), una serie de
  fotogramas, o una explicación visual. LEE el orden y QUÉ pasa en cada momento.
- Si hay texto/flechas/números en la imagen, respétalos como guion de secuencia.
- Extrae: qué se ve, qué se mueve, qué se oye, y el ritmo emocional de la historia.

DECIDIR POR ESCENA (clave de coste/calidad):
- media_kind = "video"  → SOLO si la escena necesita movimiento real, acción,
  cámara dinámica, gesto, o diálogo con lip-sync. Es lo más caro.
- media_kind = "image"  → si es un plano esencialmente estático (producto, retrato,
  texto, paisaje). Remotion le dará movimiento (zoom/paneo) y música. Más barato.
- Equilibra: una historia de 20s suele ser 3-5 escenas; no todas necesitan vídeo.

DURACIÓN:
- Reparte la duración para que la SUMA ≈ total_duration_s pedido.
- Cada escena de vídeo entre 3 y 8 s. Imagen animada entre 2 y 5 s.

CONTINUIDAD:
- Describe en `continuity` qué elemento visual se mantiene de la escena anterior
  (personaje, vestuario, paleta, localización) para que el encadenado sea coherente.

AUDIO:
- `audio`: música/sfx/ambiente que define el tono de la escena.
- `dialogue`: línea hablada SOLO si la escena la pide (lip-sync). Si no, "".

Devuelve EXCLUSIVAMENTE este JSON:
{
  "narrative": "<1-2 frases: el arco de la historia completa>",
  "total_duration_s": <int>,
  "aspect_ratio": "9:16 | 16:9 | 1:1 | 4:5",
  "hook": "<el título/hook on-screen más impactante para el primer frame>",
  "scenes": [
    {
      "index": 1,
      "title": "<nombre corto de la escena>",
      "description": "<TODO lo que se ve, en detalle visual: sujeto, entorno, luz, composición>",
      "action": "<qué ocurre / qué se mueve>",
      "media_kind": "video" | "image",
      "motion": "<movimiento de cámara y sujeto — solo si video, si no ''>",
      "audio": "<música/sfx/ambiente>",
      "dialogue": "<línea hablada o ''>",
      "caption": "<texto on-screen o ''>",
      "duration_s": <int>,
      "continuity": "<qué se mantiene de la escena previa>"
    }
  ]
}
Todo en CASTELLANO excepto que los nombres propios y marcas se mantienen.
El número de escenas y su contenido los decides TÚ según la referencia + el brief."""


async def read_storyboard(
    *,
    brief: str,
    reference_images: list[str],
    total_duration_s: int,
    client_context: dict[str, Any] | None = None,
    aspect_ratio_hint: str | None = None,
) -> dict[str, Any]:
    """Lee la(s) imagen(es) de referencia + el brief → plan de escenas."""
    client = prompt_brain.normalize_client(client_context)
    ctx = {
        "brief": brief,
        "total_duration_s": total_duration_s,
        "aspect_ratio_hint": aspect_ratio_hint or "9:16",
        "client": {
            "name": client.get("name", ""),
            "sector": client.get("sector", ""),
            "palette": client.get("palette", []),
            "tagline": client.get("tagline", ""),
            "voice": client.get("voice", []),
            "dont": client.get("dont", []),
        },
        "instruction": (
            "Lee la imagen de referencia como una secuencia escena-por-escena y "
            "fusiónala con el brief. Decide media_kind por escena. Devuelve SOLO el JSON."
        ),
    }
    user = json.dumps(ctx, ensure_ascii=False, indent=2)

    plan = await get_claude().reason_json_vision(
        system=_DIRECTOR_SYSTEM,
        user=user,
        image_urls=[u for u in (reference_images or []) if u and isinstance(u, str)],
        max_tokens=4096,
    )
    return _sanitize_plan(plan, total_duration_s, aspect_ratio_hint or "9:16")


def _sanitize_plan(plan: dict[str, Any], total_s: int, ar_default: str) -> dict[str, Any]:
    """Blinda el plan: tipos, duraciones, media_kind válido, índices."""
    raw_scenes = plan.get("scenes")
    if not isinstance(raw_scenes, list) or not raw_scenes:
        # Fallback: una sola escena de imagen animada con el brief.
        raw_scenes = [{
            "title": "Escena 1", "description": plan.get("narrative", ""),
            "action": "", "media_kind": "image", "motion": "",
            "audio": "", "dialogue": "", "caption": plan.get("hook", ""),
            "duration_s": total_s, "continuity": "",
        }]

    scenes: list[dict[str, Any]] = []
    for i, s in enumerate(raw_scenes[:8], start=1):  # cap defensivo: 8 escenas
        if not isinstance(s, dict):
            continue
        mk = str(s.get("media_kind", "image")).lower()
        if mk not in ("image", "video"):
            mk = "image"
        try:
            dur = float(s.get("duration_s") or 0)
        except (TypeError, ValueError):
            dur = 0.0
        if dur <= 0:
            dur = 4.0 if mk == "video" else 3.0
        dur = max(2.0, min(8.0, dur))
        scenes.append({
            "index": i,
            "title": str(s.get("title") or f"Escena {i}")[:80],
            "description": str(s.get("description") or "").strip(),
            "action": str(s.get("action") or "").strip(),
            "media_kind": mk,
            "motion": str(s.get("motion") or "").strip(),
            "audio": str(s.get("audio") or "").strip(),
            "dialogue": str(s.get("dialogue") or "").strip(),
            "caption": str(s.get("caption") or "").strip(),
            "duration_s": dur,
            "continuity": str(s.get("continuity") or "").strip(),
        })

    if not scenes:
        scenes = [{
            "index": 1, "title": "Escena 1", "description": "", "action": "",
            "media_kind": "image", "motion": "", "audio": "", "dialogue": "",
            "caption": "", "duration_s": float(total_s), "continuity": "",
        }]

    ar = str(plan.get("aspect_ratio") or ar_default)
    if ar not in ("9:16", "16:9", "1:1", "4:5"):
        ar = ar_default
    return {
        "narrative": str(plan.get("narrative") or "").strip(),
        "hook": str(plan.get("hook") or "").strip(),
        "total_duration_s": int(total_s),
        "aspect_ratio": ar,
        "scenes": scenes,
    }


# ---------------------------------------------------------------------------
# 2. PROMPT POR ESCENA (reusa el cerebro de prompting / marca + ADN)
# ---------------------------------------------------------------------------

_SCENE_OUTPUT_CONTRACT = """

=== OVERRIDE DE SALIDA (Storyboard Director — prompt por escena) ===
IGNORA la regla previa de 'devuelve solo el prompt'. Devuelve EXCLUSIVAMENTE un
objeto JSON válido (sin ```), con esta forma EXACTA:
{
  "prompt": "<prompt hiper-técnico de producción EN INGLÉS para ESTA escena: sujeto, entorno, luz, lente, composición, paleta HEX de marca literal, y para vídeo el movimiento de cámara/sujeto. Denso y cinematográfico.>",
  "negative_prompt": "<comma-separated de lo que NO debe aparecer>",
  "motion_prompt": "<SOLO si es vídeo: descripción del movimiento y audio/ambiente para el clip. Si es imagen, ''>"
}
El prompt DEBE respetar la marca del cliente (paleta HEX, tipografías, tagline/CTA)
como restricción dura y mantener CONTINUIDAD con la escena previa descrita.

COPYRIGHT SAFETY (OBLIGATORIO — KIE rechaza automáticamente lo contrario):
- NUNCA menciones marcas registradas reales (Nike, Apple, Coca-Cola, Rolex…) → usa
  descriptores genéricos: "luxury sportswear brand", "premium tech company"
- NUNCA nombres de personas reales, famosos, deportistas, políticos → usa
  "a professional male athlete in his 30s", "a renowned female musician"
- NUNCA logotipos o símbolos de empresas reales → "brand logo", "corporate emblem"
- NUNCA personajes de IP ajena (Marvel, Disney, Star Wars, videojuegos…) → usa
  "a muscular caped superhero character", "an animated princess"
- SÍ mantén toda la intención visual, cinematográfica y el branding propio del cliente"""


async def build_scene_prompt(
    *,
    scene: dict[str, Any],
    brief: str,
    client_context: dict[str, Any] | None,
    style_manifest: Any | None,
    has_reference: bool,
) -> dict[str, Any]:
    """Genera el prompt KIE perfecto para una escena reutilizando prompt_brain."""
    media_kind = scene.get("media_kind", "image")
    base_system = prompt_brain.build_creative_system(
        agent_name="Storyboard Director",
        brief=brief,
        client=client_context,
        style_manifest=style_manifest,
        output_type=media_kind,  # "image" | "video"
        has_reference_images=has_reference,
        board_mode=None,
        agent_role="Senior Cinematographer & Storyboard Director",
        agent_specialty="Cinematic multi-scene advertising, AI video sequences, brand storytelling",
        agent_tone="Visionary, precise, production-ready",
    )
    system = base_system + _SCENE_OUTPUT_CONTRACT

    user = json.dumps(
        {
            "scene": scene,
            "global_brief": brief,
            "instruction": (
                "Crea el prompt de producción para ESTA escena concreta. Respeta la "
                "continuidad descrita y la marca del cliente. Devuelve SOLO el JSON."
            ),
        },
        ensure_ascii=False,
        indent=2,
    )

    try:
        out = await get_claude().reason_json(system=system, user=user)
    except Exception:
        # Fallback determinista: compone el prompt desde los campos de la escena.
        desc = scene.get("description") or scene.get("action") or brief
        motion = scene.get("motion") or ""
        out = {
            "prompt": f"{desc}. {motion}".strip(),
            "negative_prompt": "",
            "motion_prompt": motion if media_kind == "video" else "",
        }

    # Elección de modelo KIE por escena (código decide, nunca el LLM)
    if media_kind == "video":
        model_id = KidAIVideoModel.SEEDANCE_2.value
        assert model_id in ALLOWED_VIDEO_MODELS
    else:
        # nano-banana-edit permite personas reales/famosas; gpt-imagenes-2 alto detalle.
        # Si hay referencia (personaje real), preferimos el modo edit que las permite.
        model_id = (
            KidAIImageModel.NANO_BANANA_EDIT.value
            if has_reference
            else KidAIImageModel.GPT_IMAGENES_2.value
        )
        assert model_id in ALLOWED_IMAGE_MODELS

    return {
        "media_kind": media_kind,
        "model_id": model_id,
        "prompt": str(out.get("prompt") or "").strip(),
        "negative_prompt": str(out.get("negative_prompt") or "").strip(),
        "motion_prompt": str(out.get("motion_prompt") or "").strip(),
    }
