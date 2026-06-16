"""Cliente único de razonamiento — Anthropic Claude.

Cualquier nodo que necesite "pensar" pasa por aquí. No existe otro cliente LLM
en el proyecto. Si un nodo intenta razonar fuera de este módulo, es un bug.
"""
from __future__ import annotations

import json
from typing import Any

from anthropic import AsyncAnthropic

from app.core.config import get_settings


class ClaudeClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.claude_model
        self._max_tokens = settings.claude_max_tokens

    async def reason(
        self,
        *,
        system: str,
        user: str,
        json_mode: bool = False,
    ) -> str:
        """Devuelve el texto de la respuesta de Claude.

        Cuando `json_mode=True` se le instruye a Claude para que devuelva
        JSON estricto; el llamador es responsable de parsearlo.
        """
        if json_mode:
            system = (
                system.rstrip()
                + "\n\nDevuelve EXCLUSIVAMENTE un objeto JSON válido. "
                  "No incluyas backticks, comentarios ni texto fuera del JSON."
            )

        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=self._max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        # API Anthropic: respuesta como lista de bloques de contenido
        return "".join(block.text for block in resp.content if block.type == "text")

    async def reason_json(self, *, system: str, user: str) -> dict[str, Any]:
        raw = await self.reason(system=system, user=user, json_mode=True)
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Claude no devolvió JSON válido: {raw[:200]}") from exc


_singleton: ClaudeClient | None = None


def get_claude() -> ClaudeClient:
    global _singleton
    if _singleton is None:
        _singleton = ClaudeClient()
    return _singleton
