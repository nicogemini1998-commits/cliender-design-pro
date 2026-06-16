"""Cinematographer_Node — traduce la estrategia a prompts hiper-técnicos
y decide el `model_id` exacto del catálogo Kid.ai.

Regla de Decisión (de la spec):
  1. Si el usuario fijó explícitamente un modelo permitido en el chat, lo respeta.
  2. Si no, evalúa la necesidad de fotorrealismo / tipo de contenido y elige
     automáticamente el mejor modelo de la lista autorizada.

Nunca, bajo ninguna circunstancia, propone un modelo fuera del catálogo. La
validación final ocurre como assert duro al cierre del nodo.
"""
from __future__ import annotations

import json
from typing import Any

from app.core.config import (
    ALLOWED_IMAGE_MODELS,
    ALLOWED_KID_AI_MODELS,
    ALLOWED_VIDEO_MODELS,
    KidAIImageModel,
    KidAIVideoModel,
    MediaKind,
)
from app.graph.state import CinematographyPlan, SwarmState
from app.services.claude_client import get_claude


# ---------------------------------------------------------------------------
# Heurística determinista (fallback si Claude falla o devuelve algo inválido)
# ---------------------------------------------------------------------------

_PHOTOREAL_HINTS = (
    "fotorrealista", "photorealistic", "realista", "real", "retrato", "portrait",
    "documental", "cinematográfic", "cinematic", "hiperrealismo",
)
_SKETCH_HINTS = (
    "boceto", "sketch", "ilustración", "ilustracion", "anime", "manga",
    "cómic", "comic", "rápido", "estilizado", "low-fi", "thumbnail",
)
_SOCIAL_VIDEO_HINTS = (
    "tiktok", "reel", "instagram", "shorts", "redes sociales", "social",
    "vertical", "9:16", "dinámico",
)


def _auto_pick_model(media_kind: MediaKind, brief: str) -> str:
    b = brief.lower()
    if media_kind == "video":
        if any(h in b for h in _SOCIAL_VIDEO_HINTS):
            return KidAIVideoModel.SEEDANCE_2.value
        return KidAIVideoModel.VEO3.value
    # imagen
    if any(h in b for h in _PHOTOREAL_HINTS):
        return KidAIImageModel.NANO_BANANA_PRO.value
    if any(h in b for h in _SKETCH_HINTS):
        return KidAIImageModel.NANO_BANANA_2.value
    return KidAIImageModel.GPT_IMAGENES_2.value


# ---------------------------------------------------------------------------
# Prompt al cerebro cognitivo
# ---------------------------------------------------------------------------

_CINEMATOGRAPHER_SYSTEM = f"""Eres el Cinematographer_Node de un enjambre creativo.
Tu trabajo es traducir una estrategia creativa en un **prompt hiper-técnico**
listo para enviar a un modelo generativo, y elegir el modelo correcto.

CATÁLOGO ÚNICO DE MODELOS PERMITIDOS (no inventes otros):
  Imagen:
    - "gpt-imagenes-2"   → alto detalle, composiciones complejas, tipografía
    - "nano-banana-pro"  → fotorrealismo máximo, retratos, producto, naturaleza
    - "nano-banana-2"    → bocetos, estilizado rápido, anime, ilustración, drafts
  Video:
    - "veo3"             → físicas realistas, cine, escenas largas y narrativas
    - "seedance-2.0"     → dinámico, vertical, social, ritmo rápido

REGLAS DURAS:
  1. Si el usuario fijó un modelo permitido, úsalo TAL CUAL.
  2. Si no, elige el mejor según fotorrealismo / dinamismo / formato.
  3. El `prompt` debe ser hiper-técnico: encuadre, lente, iluminación, paleta,
     estilo, sujeto, acción, mood. Conciso pero denso (60–120 palabras).
  4. Nunca sugieras nombres de modelos fuera del catálogo. Si no encaja, fuerza
     la mejor opción del catálogo y explica por qué en `rationale`.

Catálogo autorizado (literal): {sorted(ALLOWED_KID_AI_MODELS)}
"""


def _user_prompt(state: SwarmState, media_kind_hint: MediaKind) -> str:
    return json.dumps(
        {
            "user_request": state.get("user_request", ""),
            "user_pinned_model": state.get("user_pinned_model"),
            "creative_strategy": state.get("creative_strategy", {}),
            "script": state.get("script", ""),
            "media_kind_hint": media_kind_hint,
            "previous_critic_feedback": state.get("critic", {}).get("issues", []),
            "expected_schema": {
                "media_kind": "image | video",
                "model_id": "uno del catálogo autorizado",
                "prompt": "string hiper-técnico",
                "negative_prompt": "string",
                "parameters": {
                    "aspect_ratio": "16:9 | 9:16 | 1:1 | 4:5",
                    "duration_s": "solo si media_kind=video, 2..8",
                    "seed": "int opcional",
                },
                "rationale": "1-2 frases justificando elección de modelo",
            },
        },
        ensure_ascii=False,
        indent=2,
    )


def _infer_media_kind(state: SwarmState) -> MediaKind:
    """Heurística rápida — el MasterDirector debería haber decidido esto ya,
    pero defendemos en caso de que falte."""
    strategy = state.get("creative_strategy") or {}
    if isinstance(strategy.get("media_kind"), str):
        if strategy["media_kind"] in ("image", "video"):
            return strategy["media_kind"]  # type: ignore[return-value]

    text = (state.get("user_request") or "").lower()
    video_words = ("video", "vídeo", "clip", "anuncio", "spot", "reel", "shorts", "animación")
    if any(w in text for w in video_words):
        return "video"
    return "image"


# ---------------------------------------------------------------------------
# Nodo
# ---------------------------------------------------------------------------

async def cinematographer_node(state: SwarmState) -> dict[str, Any]:
    """Produce `state['cinematography']` y avanza el ruteo a Production."""
    status = dict(state.get("node_status") or {})
    status["cinematographer"] = "running"

    media_kind = _infer_media_kind(state)
    pinned = state.get("user_pinned_model")

    # --- 0. ¿Hay un StyleManifest activo? (Style Vault locked) -------------
    manifest = state.get("active_style_manifest")
    ref_images: list[str] = list(state.get("active_reference_images") or [])
    style_locked = bool(manifest and getattr(manifest, "master_style_prompt", ""))

    # --- 1. ¿El usuario fijó un modelo válido?
    if pinned and pinned in ALLOWED_KID_AI_MODELS:
        # Coherencia: si el usuario fijó imagen pero pidió video (o viceversa),
        # ganamos hacia el media_kind del modelo fijado.
        if pinned in ALLOWED_VIDEO_MODELS:
            media_kind = "video"
        elif pinned in ALLOWED_IMAGE_MODELS:
            media_kind = "image"
        chosen_model = pinned
        chose_automatically = False
    else:
        chosen_model = _auto_pick_model(media_kind, state.get("user_request") or "")
        chose_automatically = True

    # --- 2. Pedimos a Claude prompt hiper-técnico + (opcionalmente) refinar el modelo
    plan_json: dict[str, Any]
    try:
        plan_json = await get_claude().reason_json(
            system=_CINEMATOGRAPHER_SYSTEM,
            user=_user_prompt(state, media_kind),
        )
    except Exception as exc:  # noqa: BLE001
        # Fallback determinista — el grafo no se rompe si Claude está caído
        plan_json = {
            "media_kind": media_kind,
            "model_id": chosen_model,
            "prompt": state.get("script") or state.get("user_request") or "",
            "negative_prompt": "",
            "parameters": {"aspect_ratio": "16:9"},
            "rationale": f"Fallback determinista (Claude error: {exc!s}).",
        }

    # --- 3. SANEAMIENTO + VALIDACIÓN DURA del modelo
    proposed = str(plan_json.get("model_id", "")).strip()
    if not chose_automatically:
        # Si el usuario fijó modelo, ignoramos cualquier intento de Claude por cambiarlo
        proposed = chosen_model
    if proposed not in ALLOWED_KID_AI_MODELS:
        # Claude alucinó un modelo. Forzamos heurística.
        proposed = chosen_model

    # Coherencia media_kind <-> model_id
    if proposed in ALLOWED_VIDEO_MODELS:
        media_kind = "video"
    elif proposed in ALLOWED_IMAGE_MODELS:
        media_kind = "image"

    # --- 4. FUSIÓN del StyleManifest (si está locked) ----------------------
    user_prompt_str  = str(plan_json.get("prompt") or "").strip()
    user_negative    = str(plan_json.get("negative_prompt") or "").strip()
    style_source_id  = ""

    if style_locked and manifest:
        # Fusión matemática:
        #   final_prompt = master_style_prompt  +  brief_técnico_del_usuario
        #                + paleta literal + lente + luz + composición
        # Los anclas son atómicas (paleta, lente, luz, traits) y van separadas
        # por " | " para que el modelo las pondere como restricciones duras.
        anchors: list[str] = []
        if manifest.color_palette:
            anchors.append("palette: " + ", ".join(manifest.color_palette))
        if manifest.lighting_style:
            anchors.append("lighting: " + manifest.lighting_style)
        if manifest.camera_lens_feel:
            anchors.append("lens: " + manifest.camera_lens_feel)
        if manifest.character_traits:
            anchors.append("character traits: " + "; ".join(manifest.character_traits))
        if manifest.composition_rules:
            anchors.append("composition: " + "; ".join(manifest.composition_rules))
        if manifest.mood_keywords:
            anchors.append("mood: " + ", ".join(manifest.mood_keywords))

        fused = manifest.master_style_prompt.strip()
        if user_prompt_str:
            fused += " — " + user_prompt_str
        if anchors:
            fused += " | " + " | ".join(anchors)

        user_prompt_str = fused
        # Sumamos negatives (sin duplicar)
        merged_neg = {p.strip() for p in (user_negative + "," + manifest.negative_prompt).split(",") if p.strip()}
        user_negative = ", ".join(sorted(merged_neg))
        style_source_id = manifest.moodboard_id

    cinematography: CinematographyPlan = {
        "media_kind": media_kind,
        "model_id": proposed,
        "prompt": user_prompt_str,
        "negative_prompt": user_negative,
        "parameters": dict(plan_json.get("parameters") or {}),
        "rationale": str(plan_json.get("rationale") or "").strip(),
        "chose_automatically": chose_automatically,
        "style_locked": style_locked,
        "style_source_moodboard_id": style_source_id,
        "reference_images": ref_images,
    }

    # Assert final — invariante del proyecto
    assert cinematography["model_id"] in ALLOWED_KID_AI_MODELS, (
        f"Invariante violada: model_id {cinematography['model_id']!r} no autorizado."
    )

    status["cinematographer"] = "done"
    return {
        "cinematography": cinematography,
        "node_status": status,
        "next_node": "production",
    }
