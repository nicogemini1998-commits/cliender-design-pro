"""Tests del invariante crítico: el Cinematographer NUNCA produce un model_id
fuera del catálogo, ni siquiera si Claude alucina."""
from __future__ import annotations

from unittest.mock import patch

import pytest

from app.core.config import (
    ALLOWED_IMAGE_MODELS,
    ALLOWED_KID_AI_MODELS,
    ALLOWED_VIDEO_MODELS,
    KidAIImageModel,
    KidAIVideoModel,
)
from app.graph.nodes.cinematographer import cinematographer_node, _auto_pick_model
from app.graph.state import init_state


@pytest.mark.asyncio
async def test_respects_pinned_model_when_valid():
    state = init_state(
        "Necesito un retrato hiperrealista de un astronauta",
        pinned_model=KidAIImageModel.NANO_BANANA_PRO.value,
    )
    fake_claude = {
        "media_kind": "image",
        "model_id": "midjourney-v999",  # ← Claude alucina un modelo prohibido
        "prompt": "x",
        "negative_prompt": "",
        "parameters": {},
        "rationale": "",
    }
    with patch(
        "app.graph.nodes.cinematographer.get_claude"
    ) as get_claude:
        get_claude.return_value.reason_json.return_value = fake_claude
        out = await cinematographer_node(state)

    cine = out["cinematography"]
    # Aunque Claude propuso un modelo no permitido, el pin del usuario gana.
    assert cine["model_id"] == KidAIImageModel.NANO_BANANA_PRO.value
    assert cine["chose_automatically"] is False
    assert cine["model_id"] in ALLOWED_KID_AI_MODELS


@pytest.mark.asyncio
async def test_falls_back_when_claude_hallucinates():
    state = init_state("Un boceto rápido estilo anime de un dragón")
    fake_claude = {
        "media_kind": "image",
        "model_id": "dalle-3",  # ← prohibido
        "prompt": "x",
        "parameters": {},
        "rationale": "",
    }
    with patch(
        "app.graph.nodes.cinematographer.get_claude"
    ) as get_claude:
        get_claude.return_value.reason_json.return_value = fake_claude
        out = await cinematographer_node(state)

    cine = out["cinematography"]
    assert cine["model_id"] in ALLOWED_KID_AI_MODELS
    # Heurística para "boceto/anime" debe llevarnos a nano-banana-2
    assert cine["model_id"] == KidAIImageModel.NANO_BANANA_2.value


@pytest.mark.asyncio
async def test_video_routes_to_seedance_for_social():
    state = init_state("Un reel vertical dinámico para TikTok")
    with patch(
        "app.graph.nodes.cinematographer.get_claude"
    ) as get_claude:
        get_claude.return_value.reason_json.return_value = {
            "media_kind": "video",
            "model_id": "veo3",
            "prompt": "x",
            "parameters": {"aspect_ratio": "9:16"},
            "rationale": "",
        }
        out = await cinematographer_node(state)

    # Claude propuso veo3 (válido) → se respeta porque el usuario no fijó nada.
    cine = out["cinematography"]
    assert cine["model_id"] in ALLOWED_VIDEO_MODELS


def test_auto_pick_heuristic_covers_catalog():
    # Sanity: cada heurística devuelve un modelo del catálogo.
    cases = [
        ("image", "retrato fotorrealista de una mujer"),
        ("image", "boceto rápido anime"),
        ("image", "cartel tipográfico complejo"),
        ("video", "reel vertical para instagram"),
        ("video", "escena cinematográfica con físicas realistas"),
    ]
    for kind, brief in cases:
        m = _auto_pick_model(kind, brief)
        assert m in ALLOWED_KID_AI_MODELS, (kind, brief, m)
