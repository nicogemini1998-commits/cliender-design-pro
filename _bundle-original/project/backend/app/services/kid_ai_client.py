"""Cliente HTTP único de Kid.ai. Solo dispatcher — sin lógica de selección.

La selección del `model_id` la hace SIEMPRE el `Cinematographer_Node`.
Aquí solamente validamos contra el catálogo y disparamos la llamada.
"""
from __future__ import annotations

from typing import Any

import httpx

from app.core.config import ALLOWED_KID_AI_MODELS, MediaKind, get_settings


class DisallowedModelError(ValueError):
    """Se intentó llamar a un modelo fuera del catálogo autorizado."""


class KidAIClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._base = settings.kid_ai_base_url.rstrip("/")
        self._headers = {
            "Authorization": f"Bearer {settings.kid_ai_api_key}",
            "Content-Type": "application/json",
        }

    async def generate(
        self,
        *,
        media_kind: MediaKind,
        model_id: str,
        prompt: str,
        parameters: dict[str, Any] | None = None,
        reference_images: list[str] | None = None,
    ) -> dict[str, Any]:
        if model_id not in ALLOWED_KID_AI_MODELS:
            raise DisallowedModelError(
                f"Modelo '{model_id}' no está en el catálogo Kid.ai autorizado."
            )

        path = "/images/generate" if media_kind == "image" else "/videos/generate"
        payload: dict[str, Any] = {
            "model": model_id,
            "prompt": prompt,
            **(parameters or {}),
        }
        if reference_images:
            payload["reference_images"] = reference_images

        async with httpx.AsyncClient(timeout=180) as client:
            r = await client.post(f"{self._base}{path}", headers=self._headers, json=payload)
            r.raise_for_status()
            return r.json()


_singleton: KidAIClient | None = None


def get_kid_ai() -> KidAIClient:
    global _singleton
    if _singleton is None:
        _singleton = KidAIClient()
    return _singleton
