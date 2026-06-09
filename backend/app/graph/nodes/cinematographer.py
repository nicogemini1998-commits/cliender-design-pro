"""Cinematographer_Node — traduce la estrategia a prompts hiper-técnicos
y decide el `model_id` exacto del catálogo Kid.ai.

Regla de Decisión (de la spec):
  1. Si el usuario fijó explícitamente un modelo permitido en el chat, lo respeta.
  2. Si no, evalúa la necesidad de fotorrealismo / tipo de contenido y elige
     automáticamente el mejor modelo de la lista autorizada.

Nunca, bajo ninguna circunstancia, propone un modelo fuera del catálogo. La
validación final ocurre como assert duro al cierre del nodo.

CEREBRO UNIFICADO (F1): el `prompt` final se construye con el MISMO cerebro de
prompting que el PromptNode (SHAQ) — `app.services.prompt_brain`. Eso inyecta la
marca del cliente (HEX, fuentes, tagline, CTA, anti-patterns…) como restricción
dura, además del ADN visual del moodboard (StyleManifest). El nodo sigue siendo
responsable de elegir/validar el `model_id` y mantiene un fallback determinista
si Claude falla.
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
from app.services import prompt_brain
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
        return KidAIVideoModel.SEEDANCE_2.value  # único video activo
    # imagen
    if any(h in b for h in _PHOTOREAL_HINTS):
        return KidAIImageModel.GPT_IMAGENES_2.value  # único imagen activo
    if any(h in b for h in _SKETCH_HINTS):
        return KidAIImageModel.GPT_IMAGENES_2.value  # único imagen activo
    return KidAIImageModel.GPT_IMAGENES_2.value


# ---------------------------------------------------------------------------
# Instrucción de salida estructurada para el cerebro unificado
# ---------------------------------------------------------------------------
#
# `prompt_brain.build_creative_system` devuelve el system prompt completo de SHAQ
# (cuya regla normal es "devuelve SOLO el prompt en inglés, sin nada más"). El
# Cinematographer necesita además metadatos (aspect_ratio, duración…). Por eso
# AÑADIMOS una directriz de salida JSON que el modelo respeta sobre la base SHAQ.

def _output_contract(media_kind: MediaKind) -> str:
    duration_line = (
        '  "duration_s": <int 2..8 SOLO si media_kind=video>,\n'
        if media_kind == "video"
        else ""
    )
    return (
        "\n\n=== OVERRIDE DE FORMATO DE SALIDA (Cinematographer / SuperComputer) ===\n"
        "IGNORA la regla previa de 'devuelve solo el prompt'. En su lugar, devuelve EXCLUSIVAMENTE "
        "un objeto JSON válido (sin ```), con esta forma EXACTA:\n"
        "{\n"
        f'  "media_kind": "{media_kind}",\n'
        '  "prompt": "<el prompt hiper-técnico de producción, en inglés, denso y completo — '
        "el MISMO nivel de craft del PromptNode, con HEX de marca, fuentes, texto entre comillas, "
        'zona de logo, etc.>",\n'
        '  "negative_prompt": "<lista separada por comas de lo que NO debe aparecer>",\n'
        '  "parameters": {\n'
        '    "aspect_ratio": "16:9 | 9:16 | 1:1 | 4:5",\n'
        f"{duration_line}"
        '    "seed": <int opcional>\n'
        "  },\n"
        '  "rationale": "<1-2 frases justificando decisiones creativas clave>"\n'
        "}\n"
        "El campo `prompt` DEBE incorporar la identidad de marca del cliente (paleta HEX literal, "
        "tipografías nombradas, tagline/CTA si existen) como restricciones DURAS. No inventes modelos."
    )


# ---------------------------------------------------------------------------
# Construcción del system + user para el cerebro unificado
# ---------------------------------------------------------------------------

_CINEMA_AGENT_NAME = "Cinematographer"
_CINEMA_AGENT_ROLE = "Senior Cinematographer & Creative Director"
_CINEMA_AGENT_SPECIALTY = (
    "Cinematic advertising, brand content, social campaigns, AI image/video generation"
)
_CINEMA_AGENT_TONE = "Visionary, precise, production-ready"


def _build_brain_system(state: SwarmState, media_kind: MediaKind) -> str:
    """System prompt completo de SHAQ + override de salida JSON del Cinematographer."""
    client_ctx = state.get("client_context") or {}
    manifest = state.get("active_style_manifest")
    ref_images = list(state.get("active_reference_images") or [])
    brief = state.get("user_request") or ""
    board_mode = prompt_brain.detect_output_mode(brief)

    base_system = prompt_brain.build_creative_system(
        agent_name=_CINEMA_AGENT_NAME,
        brief=brief,
        client=client_ctx,
        style_manifest=manifest,
        output_type=media_kind,
        has_reference_images=bool(ref_images),
        board_mode=board_mode,
        agent_role=_CINEMA_AGENT_ROLE,
        agent_specialty=_CINEMA_AGENT_SPECIALTY,
        agent_tone=_CINEMA_AGENT_TONE,
    )
    return base_system + _output_contract(media_kind)


def _user_prompt(state: SwarmState, media_kind_hint: MediaKind) -> str:
    """Mensaje de usuario con el brief y el contexto de estrategia del grafo."""
    return json.dumps(
        {
            "user_request": state.get("user_request", ""),
            "creative_strategy": state.get("creative_strategy", {}),
            "script": state.get("script", ""),
            "media_kind_hint": media_kind_hint,
            "previous_critic_feedback": state.get("critic", {}).get("issues", []),
            "instruction": (
                "Crea el prompt de producción para este brief siguiendo TODAS las reglas del system "
                "(marca del cliente como restricción dura + ADN del moodboard). Devuelve SOLO el JSON pedido."
            ),
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


def _client_palette(state: SwarmState) -> list[str]:
    """Extrae los HEX de marca del client_context (varias claves posibles)."""
    c = prompt_brain.normalize_client(state.get("client_context"))
    pal = c.get("palette")
    if isinstance(pal, list):
        return [str(p) for p in pal if p]
    return []


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

    # --- 2. Cerebro unificado: SHAQ construye el prompt con marca + moodboard
    plan_json: dict[str, Any]
    try:
        plan_json = await get_claude().reason_json(
            system=_build_brain_system(state, media_kind),
            user=_user_prompt(state, media_kind),
        )
    except Exception as exc:  # noqa: BLE001
        # Fallback determinista — el grafo no se rompe si Claude está caído.
        # Aun en fallback, inyectamos los HEX de marca al final del prompt.
        palette = _client_palette(state)
        base_prompt = state.get("script") or state.get("user_request") or ""
        if palette:
            base_prompt = f"{base_prompt} | brand palette: {', '.join(palette)}".strip(" |")
        plan_json = {
            "media_kind": media_kind,
            "model_id": chosen_model,
            "prompt": base_prompt,
            "negative_prompt": "",
            "parameters": {"aspect_ratio": "16:9"},
            "rationale": f"Fallback determinista (Claude error: {exc!s}).",
        }

    # --- 3. SANEAMIENTO + VALIDACIÓN DURA del modelo
    # El modelo lo decide/valida el CÓDIGO (no Claude): el cerebro unificado no
    # devuelve model_id, así que partimos del elegido en el paso 1.
    proposed = chosen_model
    if proposed not in ALLOWED_KID_AI_MODELS:
        proposed = _auto_pick_model(media_kind, state.get("user_request") or "")

    # Coherencia media_kind <-> model_id
    if proposed in ALLOWED_VIDEO_MODELS:
        media_kind = "video"
    elif proposed in ALLOWED_IMAGE_MODELS:
        media_kind = "image"

    # --- 4. Prompt final (ya viene del cerebro con marca + moodboard fusionados)
    user_prompt_str = str(plan_json.get("prompt") or "").strip()
    user_negative = str(plan_json.get("negative_prompt") or "").strip()
    style_source_id = ""

    # Red de seguridad: garantizamos que los HEX de marca aparezcan literalmente
    # en el prompt aunque el modelo los hubiera omitido.
    palette = _client_palette(state)
    if palette and user_prompt_str:
        missing = [hex_ for hex_ in palette if hex_.lower() not in user_prompt_str.lower()]
        if missing:
            user_prompt_str = (
                f"{user_prompt_str} | brand palette (mandatory): {', '.join(missing)}"
            )

    # Si hay StyleManifest locked, sumamos sus negatives (sin duplicar) y
    # reportamos el moodboard de origen. El ADN visual ya está embebido en el
    # system prompt (LAYER 2), aquí solo cerramos los vetos.
    if style_locked and manifest:
        merged_neg = {
            p.strip()
            for p in (user_negative + "," + (manifest.negative_prompt or "")).split(",")
            if p.strip()
        }
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
