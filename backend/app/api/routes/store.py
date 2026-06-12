"""Store compartido — colecciones JSON en Supabase Storage.

Permite que TODOS los usuarios vean/compartan lo que crea cualquiera:
proyectos, moodboards, agentes y plantillas de flujo. Mismo patrón que gallery.py
(un archivo JSON por colección en el bucket `brand-assets`, last-write-wins).

GET  /store/{collection}  → {items:[...], count}
PUT  /store/{collection}  → guarda el array completo (full replace)
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings
from app.services.http import get_http

router = APIRouter(prefix="/store", tags=["store"])
logger = logging.getLogger(__name__)

# Colecciones compartidas permitidas (whitelist). Cada una → un .json en Supabase.
_COLLECTIONS = {"projects", "moodboards", "agents", "flow-templates", "clients"}
_MAX_ITEMS = 2000

# Lock por colección — serializa las escrituras al JSON compartido y evita
# que dos usuarios se pisen (todo el tráfico pasa por este único backend).
_LOCKS: dict[str, asyncio.Lock] = {}


def _lock(name: str) -> asyncio.Lock:
    if name not in _LOCKS:
        _LOCKS[name] = asyncio.Lock()
    return _LOCKS[name]


def _headers() -> dict[str, str]:
    k = get_settings().supabase_service_key
    return {"apikey": k, "Authorization": "Bearer " + k}


def _url(collection: str) -> str:
    base = get_settings().supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/brand-assets/store/{collection}.json"


async def _load(collection: str) -> list[Any]:
    try:
        # Cliente compartido (singleton) — no abrir/cerrar pool por request.
        r = await get_http().get(_url(collection), headers=_headers())
        if r.status_code == 200:
            d = r.json()
            return d if isinstance(d, list) else []
    except Exception as e:  # noqa: BLE001
        logger.warning("store.load %s: %s", collection, e)
    return []


async def _save(collection: str, items: list[Any]) -> bool:
    try:
        h = dict(_headers())
        h["Content-Type"] = "application/json"
        h["x-upsert"] = "true"
        r = await get_http().post(_url(collection), headers=h, content=json.dumps(items, ensure_ascii=False).encode("utf-8"))
        return r.status_code in (200, 201)
    except Exception as e:  # noqa: BLE001
        logger.warning("store.save %s: %s", collection, e)
        return False


class StorePayload(BaseModel):
    items: list[Any]


@router.get("/{collection}")
async def get_collection(collection: str):
    if collection not in _COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"colección desconocida: {collection}")
    items = await _load(collection)
    return {"items": items, "count": len(items)}


@router.put("/{collection}")
async def put_collection(collection: str, payload: StorePayload):
    if collection not in _COLLECTIONS:
        raise HTTPException(status_code=404, detail=f"colección desconocida: {collection}")
    if len(payload.items) > _MAX_ITEMS:
        # Antes se truncaba en silencio con ok:true — el usuario creía guardar y perdía la cola.
        raise HTTPException(status_code=422, detail=f"máximo {_MAX_ITEMS} items por colección")
    items = payload.items
    # Lock por colección: serializa escrituras concurrentes al mismo JSON.
    async with _lock(collection):
        ok = await _save(collection, items)
    if not ok:
        # 502 explícito → el retry/backoff del frontend (config.js) se dispara.
        # Antes: 200 + {ok:false} → el cliente lo tomaba como éxito → datos perdidos.
        raise HTTPException(status_code=502, detail=f"no se pudo persistir {collection}")
    return {"ok": True, "count": len(items)}
