"""Cliente único de razonamiento — Anthropic Claude.

Cualquier nodo que necesite "pensar" pasa por aquí. No existe otro cliente LLM
en el proyecto. Si un nodo intenta razonar fuera de este módulo, es un bug.
"""
from __future__ import annotations

import asyncio
import json
import re
import time
import uuid
from typing import Any

import httpx
from app.services.url_guard import assert_safe_url as _assert_safe_url, SSRFBlockedError as _SSRFBlockedError
from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.services.http import get_http

_ANALYTICS_URL = "http://127.0.0.1:8000/analytics/track"

def _strip_json_fence(text: str) -> str:
    """Elimina bloques markdown ```json ... ``` que Claude añade a veces."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```", text, re.DOTALL)
    if match:
        return match.group(1).strip()
    # Sin fence — buscar primer { o [ hasta el cierre correspondiente
    start = next((i for i, c in enumerate(text) if c in "{["), None)
    if start is not None:
        return text[start:]
    return text


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
        model: str | None = None,        # override del modelo; None = usa self._model
        max_tokens: int | None = None,   # override de max_tokens; None = usa self._max_tokens
        cache_system: bool = False,      # True = cachea el system (prompt caching Anthropic)
        # Metadatos opcionales para analytics (no afectan la respuesta)
        endpoint: str = "",
        node_type: str = "",
        client_name: str = "",
        agent_name: str = "",
    ) -> str:
        """Devuelve el texto de la respuesta de Claude.

        Cuando `json_mode=True` se le instruye a Claude para que devuelva
        JSON estricto; el llamador es responsable de parsearlo.

        Fire-and-forget: registra tokens y coste en /analytics/track.
        """
        if json_mode:
            system = (
                system.rstrip()
                + "\n\nDevuelve EXCLUSIVAMENTE un objeto JSON válido. "
                  "No incluyas backticks, comentarios ni texto fuera del JSON."
            )

        t0 = time.monotonic()
        # Prompt caching: el system grande de SHAQ es ~identico entre llamadas del mismo
        # cliente. Marcarlo con cache_control ahorra ~90% del coste/latencia del system
        # en llamadas dentro del TTL de 5 min (minimo cacheable Anthropic ~1024 tokens).
        _system = system
        if cache_system and isinstance(system, str) and len(system) > 3000:
            _system = [{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}]
        try:
            resp = await self._client.messages.create(
                model=model or self._model,
                max_tokens=max_tokens or self._max_tokens,
                system=_system,
                messages=[{"role": "user", "content": user}],
            )
        except Exception as exc:
            # La llamada falló → registrar fila status="error" (tokens 0: la
            # excepción de Anthropic no trae usage) y re-lanzar al llamador.
            duration_ms = int((time.monotonic() - t0) * 1000)
            asyncio.ensure_future(
                self._track(
                    tokens_in=0,
                    tokens_out=0,
                    duration_ms=duration_ms,
                    endpoint=endpoint,
                    node_type=node_type,
                    client_name=client_name,
                    agent_name=agent_name,
                    status="error",
                    error_msg=str(exc)[:200],
                )
            )
            raise
        duration_ms = int((time.monotonic() - t0) * 1000)

        # Fire-and-forget analytics — nunca bloquea ni falla el flujo
        asyncio.ensure_future(
            self._track(
                tokens_in=resp.usage.input_tokens,
                tokens_out=resp.usage.output_tokens,
                duration_ms=duration_ms,
                endpoint=endpoint,
                node_type=node_type,
                client_name=client_name,
                agent_name=agent_name,
            )
        )

        # API Anthropic: respuesta como lista de bloques de contenido
        return "".join(block.text for block in resp.content if block.type == "text")

    async def _track(
        self,
        *,
        tokens_in: int,
        tokens_out: int,
        duration_ms: int,
        endpoint: str,
        node_type: str,
        client_name: str,
        agent_name: str,
        status: str = "ok",
        error_msg: str = "",
    ) -> None:
        """Envía métricas a /analytics/track. Silencioso en caso de error."""
        try:
            payload = {
                "session_id": str(uuid.uuid4()),
                "model": self._model,
                "provider": "claude",
                "tokens_in": tokens_in,
                "tokens_out": tokens_out,
                "endpoint": endpoint,
                "node_type": node_type,
                "client_name": client_name,
                "agent_name": agent_name,
                "duration_ms": duration_ms,
                "status": status,
                "error_msg": error_msg,
            }
            # Cliente compartido (singleton) — no abrir/cerrar pool por track.
            await get_http().post(_ANALYTICS_URL, json=payload)
        except Exception:  # noqa: BLE001
            pass  # analytics nunca rompe el flujo principal

    async def reason_json(self, *, system: str, user: str) -> dict[str, Any]:
        raw = await self.reason(system=system, user=user, json_mode=True)
        cleaned = _strip_json_fence(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Claude no devolvió JSON válido: {raw[:200]}") from exc

    async def reason_json_vision(
        self,
        *,
        system: str,
        user: str,
        image_urls: list[str] | None = None,
        max_tokens: int | None = None,
    ) -> dict[str, Any]:
        """Razona sobre una o varias imágenes (Claude Vision) y devuelve JSON.

        Descarga cada URL http(s) y la adjunta como bloque image base64; acepta
        también data: URLs directamente. Usado por el Storyboard Director para
        leer una imagen de referencia de secuencia escena-por-escena.
        """
        # Descarga las imagenes en PARALELO (antes secuencial: 6 imgs = 6x mas lento).
        # asyncio.gather preserva el orden de image_urls.
        content: list[dict[str, Any]] = []
        _urls = (image_urls or [])[:6]
        if _urls:
            _blocks = await asyncio.gather(*[self._image_block(u) for u in _urls], return_exceptions=True)
            for block in _blocks:
                if block and not isinstance(block, Exception):
                    content.append(block)
        content.append({"type": "text", "text": user})

        sys_json = (
            system.rstrip()
            + "\n\nDevuelve EXCLUSIVAMENTE un objeto JSON válido. "
              "No incluyas backticks, comentarios ni texto fuera del JSON."
        )
        resp = await self._client.messages.create(
            model=self._model,
            max_tokens=max_tokens or self._max_tokens,
            system=sys_json,
            messages=[{"role": "user", "content": content}],
        )
        raw = "".join(b.text for b in resp.content if b.type == "text")
        cleaned = _strip_json_fence(raw)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Claude (vision) no devolvió JSON válido: {raw[:200]}") from exc

    async def _image_block(self, url: str) -> dict[str, Any] | None:
        """Construye un bloque image para la API Anthropic desde URL http o data:."""
        import base64 as _b64

        if not url or not isinstance(url, str):
            return None
        try:
            if url.startswith("data:"):
                header, b64data = url.split(",", 1)
                media_type = header.split(";")[0].replace("data:", "") or "image/jpeg"
                return {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64data},
                }
            if url.startswith("http"):
                # Anti-SSRF: bloquea IPs privadas/metadata antes de descargar.
                try:
                    _assert_safe_url(url)
                except _SSRFBlockedError:
                    return None
                async with httpx.AsyncClient(timeout=20) as client:
                    r = await client.get(url, follow_redirects=False)
                    if r.status_code != 200:
                        return None
                    ct = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
                    if ct not in {"image/jpeg", "image/png", "image/gif", "image/webp"}:
                        ct = "image/jpeg"
                    return {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": ct,
                            "data": _b64.b64encode(r.content).decode(),
                        },
                    }
        except Exception:
            return None
        return None


_singleton: ClaudeClient | None = None


def get_claude() -> ClaudeClient:
    global _singleton
    if _singleton is None:
        _singleton = ClaudeClient()
    return _singleton
