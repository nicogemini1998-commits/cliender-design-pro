"""Tool oficial expuesta a los nodos para llamar a Kid.ai.

Encapsula validación + reintento ligero. Es la **única** función autorizada
para invocar el músculo creativo. `Production_Node` la usa; ningún otro nodo
debería tocarla.
"""
from __future__ import annotations

from typing import Any

from app.core.config import ALLOWED_KID_AI_MODELS, MediaKind
from app.services.kid_ai_client import DisallowedModelError, get_kid_ai


async def call_kid_ai_api(
    *,
    media_kind: MediaKind,
    model_id: str,
    prompt: str,
    parameters: dict[str, Any] | None = None,
    reference_images: list[str] | None = None,
) -> dict[str, Any]:
    if model_id not in ALLOWED_KID_AI_MODELS:
        raise DisallowedModelError(
            f"call_kid_ai_api recibió un modelo no autorizado: {model_id!r}. "
            f"Catálogo válido: {sorted(ALLOWED_KID_AI_MODELS)}"
        )
    return await get_kid_ai().generate(
        media_kind=media_kind,
        model_id=model_id,
        prompt=prompt,
        parameters=parameters,
        reference_images=reference_images,
    )
