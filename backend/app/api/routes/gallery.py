from __future__ import annotations
import asyncio, json, logging
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.core.config import get_settings
from app.services.http import get_http

router = APIRouter(prefix="/gallery", tags=["gallery"])
logger = logging.getLogger(__name__)
_GPATH = "gallery/items.json"

# Lock por colección — serializa cada secuencia load→modificar→save.
# Todo el tráfico pasa por este único backend, así que el lock in-process
# elimina el pisado entre usuarios (last-write-wins) sin necesidad de DDL.
_LOCKS: dict[str, asyncio.Lock] = {}

def _lock(name: str) -> asyncio.Lock:
    if name not in _LOCKS:
        _LOCKS[name] = asyncio.Lock()
    return _LOCKS[name]

def _gh():
    s = get_settings()
    k = s.supabase_service_key
    return {"apikey": k, "Authorization": "Bearer " + k}

def _gurl():
    base = get_settings().supabase_url.rstrip("/")
    return base + "/storage/v1/object/brand-assets/" + _GPATH

class _LoadError(Exception):
    """Supabase ilocalizable o respuesta inválida — NO confundir con galería vacía."""


async def _gload(*, strict: bool = False):
    """Carga la galería. strict=True → si Supabase falla, lanza _LoadError.

    CRÍTICO: antes un fallo de red devolvía [] y el caller (add/delete) hacía
    load→modificar→save — sobrescribiendo TODA la galería con ese [] + 1 item.
    En lectura (GET) degradar a [] es aceptable; en escritura jamás.
    """
    try:
        # Cliente compartido (singleton) — no abrir/cerrar pool por request.
        r = await get_http().get(_gurl(), headers=_gh())
        if r.status_code == 200:
            d = r.json()
            return d if isinstance(d, list) else []
        if r.status_code in (400, 404):
            return []  # el JSON aún no existe → galería vacía real
        raise _LoadError(f"supabase status {r.status_code}")
    except _LoadError:
        raise
    except Exception as e:
        logger.warning("gallery.load: %s", e)
        if strict:
            raise _LoadError(str(e)) from e
    return []

async def _gsave(items):
    try:
        hdrs = dict(_gh())
        hdrs["Content-Type"] = "application/json"
        hdrs["x-upsert"] = "true"
        r = await get_http().post(_gurl(), headers=hdrs, content=json.dumps(items).encode())
        return r.status_code in (200, 201)
    except Exception as e:
        logger.warning("gallery.save: %s", e)
        return False

def _strip_base64(item):
    """Excluye campos cuyo valor empieza por 'data:' (base64) — no inflar la respuesta."""
    if not isinstance(item, dict):
        return item
    return {k: v for k, v in item.items() if not (isinstance(v, str) and v.startswith("data:"))}

@router.get("")
async def get_gallery():
    items = await _gload()
    return {"items": [_strip_base64(x) for x in items], "count": len(items)}

class GalleryItem(BaseModel):
    id: str
    kind: str = "image"
    url: str
    prompt: str = ""
    model: str = ""
    duration: Optional[str] = None
    aspect: Optional[str] = None
    styleLocked: bool = False
    styleSource: Optional[str] = None
    clientId: Optional[str] = None
    moodboardId: Optional[str] = None
    createdAt: int = 0
    addedBy: str = ""

@router.post("/add")
async def add_gallery_item(item: GalleryItem):
    # Lock: evita que dos adds simultáneos se pisen el JSON (race condition).
    async with _lock("gallery"):
        try:
            items = await _gload(strict=True)
        except _LoadError:
            # Storage caído → abortar; escribir ahora destruiría la galería entera.
            raise HTTPException(status_code=503, detail="galería no disponible, reintenta")
        items = [x for x in items if x.get("id") != item.id]
        items.insert(0, item.model_dump())
        items = items[:500]
        ok = await _gsave(items)
    if not ok:
        raise HTTPException(status_code=502, detail="no se pudo persistir la galería")
    return {"ok": True, "count": len(items)}

@router.delete("/item/{item_id}")
async def delete_gallery_item(item_id: str):
    # Lock: misma protección load→modificar→save que en /add.
    async with _lock("gallery"):
        try:
            items = await _gload(strict=True)
        except _LoadError:
            raise HTTPException(status_code=503, detail="galería no disponible, reintenta")
        items = [x for x in items if x.get("id") != item_id]
        ok = await _gsave(items)
    if not ok:
        raise HTTPException(status_code=502, detail="no se pudo persistir el borrado")
    return {"ok": True, "count": len(items)}
