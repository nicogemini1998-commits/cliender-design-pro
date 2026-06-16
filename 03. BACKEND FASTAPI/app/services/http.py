"""Cliente HTTP compartido — singleton httpx.AsyncClient.

Evita crear y cerrar un AsyncClient (con su pool de conexiones TLS) en cada
request. Lo usan analytics, gallery, store y claude_client._track.

NOTA: kid_ai_client.py y generate.py NO usan este singleton — sus timeouts
difieren (polling largo, descargas pesadas) y funcionan bien como están.
"""
from __future__ import annotations

import httpx

_client: httpx.AsyncClient | None = None


def get_http() -> httpx.AsyncClient:
    """Devuelve el AsyncClient compartido (lazy init, límites por defecto)."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=15)
    return _client


async def aclose_http() -> None:
    """Cierra el cliente compartido — registrado en el shutdown de la app."""
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
