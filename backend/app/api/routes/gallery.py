from __future__ import annotations
import json, logging
from typing import Optional
import httpx
from fastapi import APIRouter
from pydantic import BaseModel
from app.core.config import get_settings

router = APIRouter(prefix="/gallery", tags=["gallery"])
logger = logging.getLogger(__name__)
_GPATH = "gallery/items.json"

def _gh():
    s = get_settings()
    k = s.supabase_service_key
    return {"apikey": k, "Authorization": "Bearer " + k}

def _gurl():
    base = get_settings().supabase_url.rstrip("/")
    return base + "/storage/v1/object/brand-assets/" + _GPATH

async def _gload():
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(_gurl(), headers=_gh())
            if r.status_code == 200:
                d = r.json()
                return d if isinstance(d, list) else []
    except Exception as e:
        logger.warning("gallery.load: %s", e)
    return []

async def _gsave(items):
    try:
        hdrs = dict(_gh())
        hdrs["Content-Type"] = "application/json"
        hdrs["x-upsert"] = "true"
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.post(_gurl(), headers=hdrs, content=json.dumps(items).encode())
            return r.status_code in (200, 201)
    except Exception as e:
        logger.warning("gallery.save: %s", e)
        return False

@router.get("")
async def get_gallery():
    items = await _gload()
    return {"items": items, "count": len(items)}

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
    items = await _gload()
    items = [x for x in items if x.get("id") != item.id]
    items.insert(0, item.model_dump())
    items = items[:500]
    ok = await _gsave(items)
    return {"ok": ok, "count": len(items)}

@router.delete("/item/{item_id}")
async def delete_gallery_item(item_id: str):
    items = await _gload()
    items = [x for x in items if x.get("id") != item_id]
    ok = await _gsave(items)
    return {"ok": ok, "count": len(items)}
