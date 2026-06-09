"""Store compartido — colecciones JSON en Supabase Storage.

Permite que TODOS los usuarios vean/compartan lo que crea cualquiera:
proyectos, moodboards, agentes y plantillas de flujo. Mismo patrón que gallery.py
(un archivo JSON por colección en el bucket `brand-assets`, last-write-wins).

GET  /store/{collection}  → {items:[...], count}
PUT  /store/{collection}  → guarda el array completo (full replace)
"""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.config import get_settings

router = APIRouter(prefix="/store", tags=["store"])
logger = logging.getLogger(__name__)

# Colecciones compartidas permitidas (whitelist). Cada una → un .json en Supabase.
_COLLECTIONS = {"projects", "moodboards", "agents", "flow-templates", "clients"}
_MAX_ITEMS = 2000


def _headers() -> dict[str, str]:
    k = get_settings().supabase_service_key
    return {"apikey": k, "Authorization": "Bearer " + k}


def _url(collection: str) -> str:
    base = get_settings().supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/brand-assets/store/{collection}.json"


async def _load(collection: str) -> list[Any]:
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(_url(collection), headers=_headers())
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
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(_url(collection), headers=h, content=json.dumps(items, ensure_ascii=False).encode("utf-8"))
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
    items = payload.items[:_MAX_ITEMS]
    ok = await _save(collection, items)
    return {"ok": ok, "count": len(items)}
