"""Endpoint REST del Style Vault — audita carpetas y devuelve el manifiesto.

Frontend flujo:
  1. Usuario suelta imágenes en una carpeta del MoodboardVault.
  2. Frontend → POST /moodboards/audit  { moodboard_id, name, images[] }
  3. Backend invoca Vision_Auditor → devuelve Moodboard con StyleManifest.
  4. Frontend persiste en el store de Zustand y, si Lock Style está activo,
     lo propaga al siguiente run del Cinematographer.

Persistencia:
  Supabase (tabla `moodboards`) si está configurado; in-memory como fallback.
"""
from __future__ import annotations

import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException

from app.core.config import get_settings
from app.graph.nodes.vision_auditor import FALLBACK_MASTER_STYLE_PROMPT, get_vision_auditor
from app.schemas.moodboard import AuditRequest, AuditResponse, Moodboard, MoodboardImage, StyleManifest

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/moodboards", tags=["moodboards"])

# Fallback in-memory cuando Supabase no está disponible
_MOODBOARDS: dict[str, Moodboard] = {}

# Tareas de auditoría en vuelo — referencias fuertes para que asyncio no las
# recolecte antes de terminar (el análisis corre en background, no en el request).
_AUDIT_TASKS: set[asyncio.Task] = set()

# Lock por moodboard — serializa cada secuencia load→modificar→save y evita
# el pisado entre usuarios (todo el tráfico pasa por este único backend).
_LOCKS: dict[str, asyncio.Lock] = {}


def _lock(name: str) -> asyncio.Lock:
    if name not in _LOCKS:
        _LOCKS[name] = asyncio.Lock()
    return _LOCKS[name]


# ---------------------------------------------------------------------------
# Supabase helpers (mismo patrón que analytics.py)
# ---------------------------------------------------------------------------

def _sb_headers() -> dict[str, str]:
    key = get_settings().supabase_service_key
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


def _sb_url(path: str = "") -> str:
    base = get_settings().supabase_url.rstrip("/")
    return f"{base}/rest/v1/moodboards{path}"


def _sb_available() -> bool:
    s = get_settings()
    return bool(s.supabase_url and s.supabase_service_key)


def _row_to_moodboard(row: dict) -> Moodboard:
    manifest = None
    if row.get("manifest"):
        try:
            manifest = StyleManifest(**row["manifest"])
        except Exception:
            manifest = None
    images = [MoodboardImage(**img) for img in (row.get("images") or [])]
    return Moodboard(
        id=row["id"],
        name=row["name"],
        images=images,
        manifest=manifest,
        audit_status=row.get("audit_status", "idle"),
        locked=row.get("locked", False),
    )


async def _sb_get(moodboard_id: str) -> Moodboard | None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                _sb_url(f"?id=eq.{moodboard_id}&limit=1"),
                headers=_sb_headers(),
            )
            if r.status_code == 200:
                rows = r.json()
                return _row_to_moodboard(rows[0]) if rows else None
    except Exception as exc:
        logger.warning("supabase get error: %s", exc)
    return None


async def _sb_upsert(mb: Moodboard) -> bool:
    # Convertir imágenes base64 a Supabase Storage antes de persistir.
    # Esto garantiza que todos los usuarios vean las mismas imágenes via URL pública.
    images_out = []
    for img in mb.images:
        d = img.model_dump()
        url = d.get("url", "")
        if url.startswith("data:"):
            storage_url = await _upload_img_to_storage(mb.id, d["id"], url)
            if storage_url:
                d["url"] = storage_url
            else:
                continue  # Upload falló → no guardar base64 en DB
        images_out.append(d)
    row = {
        "id": mb.id,
        "name": mb.name,
        "images": images_out,
        "manifest": mb.manifest.model_dump() if mb.manifest else None,
        "audit_status": mb.audit_status,
        "locked": mb.locked,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                _sb_url(),
                headers={**_sb_headers(), "Prefer": "return=representation,resolution=merge-duplicates"},
                json=row,
            )
            return r.status_code in (200, 201)
    except Exception as exc:
        logger.warning("supabase upsert error: %s", exc)
    return False


async def _upload_img_to_storage(moodboard_id: str, img_id: str, data_url: str) -> str | None:
    """Sube imagen base64 a Supabase Storage y devuelve URL pública. None si falla."""
    if not _sb_available() or "," not in data_url:
        return None
    try:
        import base64 as _b64
        header, b64data = data_url.split(",", 1)
        if "image/png" in header:
            ext, ct = "png", "image/png"
        elif "image/webp" in header:
            ext, ct = "webp", "image/webp"
        else:
            ext, ct = "jpg", "image/jpeg"
        img_bytes = _b64.b64decode(b64data)
        # M-4: sanitizar ids antes de construir la ruta de Storage (anti path-traversal).
        import re as _re_mb
        _safe = lambda v: _re_mb.sub(r"[^A-Za-z0-9_\-]", "", str(v or ""))[:80] or "x"
        path = f"moodboard-images/{_safe(moodboard_id)}/{_safe(img_id)}.{ext}"
        s = get_settings()
        base = s.supabase_url.rstrip("/")
        bucket = "brand-assets"
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post(
                f"{base}/storage/v1/object/{bucket}/{path}",
                headers={
                    "apikey": s.supabase_service_key,
                    "Authorization": f"Bearer {s.supabase_service_key}",
                    "Content-Type": ct,
                    "x-upsert": "true",
                },
                content=img_bytes,
            )
            if r.status_code in (200, 201):
                return f"{base}/storage/v1/object/public/{bucket}/{path}"
            logger.warning("storage upload status=%d body=%s", r.status_code, r.text[:120])
    except Exception as exc:
        logger.warning("storage upload error: %s", exc)
    return None


async def _sb_list_all(limit: int = 200) -> list[Moodboard]:
    """Lista moodboards incluyendo imágenes (solo URLs, sin base64)."""
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(
                _sb_url(f"?select=id,name,images,manifest,audit_status,locked&order=id.desc&limit={limit}"),
                headers=_sb_headers(),
            )
            if r.status_code == 200:
                result = []
                for row in r.json():
                    if not isinstance(row, dict):
                        continue
                    # Solo imágenes con URL real (nunca base64 en la lista)
                    images_raw = row.get("images") or []
                    clean = [
                        img for img in images_raw
                        if isinstance(img, dict) and img.get("url")
                        and not str(img["url"]).startswith("data:")
                    ]
                    result.append(_row_to_moodboard({**row, "images": clean}))
                return result
    except Exception as exc:
        logger.warning("supabase list_all error: %s", exc)
    return []


async def _sb_list_locked() -> list[Moodboard]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(
                _sb_url("?locked=eq.true"),
                headers=_sb_headers(),
            )
            if r.status_code == 200:
                return [_row_to_moodboard(row) for row in r.json()]
    except Exception as exc:
        logger.warning("supabase list_locked error: %s", exc)
    return []


async def _sb_unlock_others(moodboard_id: str) -> None:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            await client.patch(
                _sb_url(f"?locked=eq.true&id=neq.{moodboard_id}"),
                headers=_sb_headers(),
                json={"locked": False},
            )
    except Exception as exc:
        logger.warning("supabase unlock_others error: %s", exc)


# ---------------------------------------------------------------------------
# Helpers de alto nivel — leen/escriben Supabase o in-memory según disponibilidad
# ---------------------------------------------------------------------------

async def _get_mb(moodboard_id: str) -> Moodboard | None:
    if _sb_available():
        mb = await _sb_get(moodboard_id)
        if mb is not None:
            return mb
    return _MOODBOARDS.get(moodboard_id)


async def _save_mb(mb: Moodboard) -> None:
    _MOODBOARDS[mb.id] = mb
    if _sb_available():
        await _sb_upsert(mb)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

async def _perform_audit(mb: Moodboard) -> None:
    """Corre el Vision_Auditor en BACKGROUND y persiste el resultado.

    El análisis forense de sets grandes (10-20 imágenes) tarda 75-180s. Si se
    hiciera dentro del request HTTP, cualquier timeout de túnel/navegador (y el
    failsafe del frontend) lo cortaría → "se queda analizando y luego error".
    Aquí lo desacoplamos: el endpoint responde al instante con status
    'auditing' y el frontend hace polling a GET /moodboards/{id} hasta
    'ready' | 'error'. Así funciona igual con 2, 10 o 50 imágenes.
    """
    try:
        manifest = await get_vision_auditor().audit(mb)
        mb.manifest = manifest
        mb.audit_status = "ready"
        logger.info(
            "perform_audit.ready moodboard=%s score=%s chars=%d",
            mb.id, manifest.consistency_score, len(manifest.characters or []),
        )
    except Exception as exc:  # noqa: BLE001 — el auditor ya no debería lanzar, blindaje extra
        mb.audit_status = "error"
        logger.exception("perform_audit.failed moodboard=%s error=%s", mb.id, exc)
    finally:
        # Lock solo en el guardado (la llamada larga a Claude no debe bloquear
        # otras mutaciones del mismo moodboard mientras audita).
        async with _lock(mb.id):
            await _save_mb(mb)


@router.get("", response_model=list[Moodboard])
async def list_moodboards() -> list[Moodboard]:
    """Lista todos los moodboards — prioriza Supabase TABLE, fallback in-memory."""
    if _sb_available():
        items = await _sb_list_all()
        if items is not None:
            return items
    return list(_MOODBOARDS.values())


@router.post("/audit", response_model=AuditResponse)
async def audit_moodboard(req: AuditRequest) -> AuditResponse:
    if not req.images:
        raise HTTPException(400, "Subir al menos una imagen para auditar.")

    # Lock: la secuencia load→merge imágenes→save no debe entrelazarse con
    # otro request del mismo moodboard (race condition = imágenes perdidas).
    async with _lock(req.moodboard_id):
        mb = await _get_mb(req.moodboard_id) or Moodboard(
            id=req.moodboard_id,
            name=req.name or "Untitled",
            images=[],
        )
        mb.name = req.name or mb.name
        existing_ids = {i.id for i in mb.images}
        for img in req.images:
            if img.id not in existing_ids:
                mb.images.append(img)
        mb.audit_status = "auditing"
        await _save_mb(mb)

    # Lanzar el análisis en background y RESPONDER YA (status 'auditing').
    # Referencia fuerte en _AUDIT_TASKS para que no lo recolecte el GC.
    task = asyncio.create_task(_perform_audit(mb))
    _AUDIT_TASKS.add(task)
    task.add_done_callback(_AUDIT_TASKS.discard)

    return AuditResponse(moodboard=mb, audit_error=None)


@router.get("/{moodboard_id}", response_model=Moodboard)
async def get_moodboard(moodboard_id: str) -> Moodboard:
    mb = await _get_mb(moodboard_id)
    if not mb:
        raise HTTPException(404, "Moodboard not found")
    return mb


@router.put("/{moodboard_id}", response_model=Moodboard)
async def upsert_moodboard(moodboard_id: str, mb: Moodboard) -> Moodboard:
    """Upsert directo de moodboard sin disparar audit.

    Usado por el frontend para persistir cross-user TODA mutación local
    (create / rename / add-images / lock / delete-image) sin esperar a que
    el usuario dispare el Vision_Auditor. Si el moodboard ya tiene manifest
    y audit_status='ready', se preserva.
    """
    if mb.id != moodboard_id:
        raise HTTPException(400, "moodboard_id mismatch")
    # Lock: load→merge→save atómico frente a otros requests del mismo moodboard.
    async with _lock(moodboard_id):
        # Preservar manifest/status si el cliente envía 'idle' pero ya hay análisis
        existing = await _get_mb(moodboard_id)
        if existing and existing.manifest and not mb.manifest:
            mb.manifest = existing.manifest
            if existing.audit_status == "ready":
                mb.audit_status = "ready"
        await _save_mb(mb)
    return mb


@router.delete("/{moodboard_id}")
async def delete_moodboard(moodboard_id: str) -> dict:
    """Borra un moodboard de Supabase + in-memory."""
    _MOODBOARDS.pop(moodboard_id, None)
    if _sb_available():
        try:
            async with httpx.AsyncClient(timeout=8) as client:
                await client.delete(
                    _sb_url(f"?id=eq.{moodboard_id}"),
                    headers=_sb_headers(),
                )
        except Exception as exc:
            logger.warning("supabase delete error: %s", exc)
    return {"ok": True, "id": moodboard_id}


@router.post("/{moodboard_id}/lock", response_model=Moodboard)
async def toggle_lock(moodboard_id: str, locked: bool) -> Moodboard:
    # Lock: load→modificar→save atómico para no pisar mutaciones concurrentes.
    async with _lock(moodboard_id):
        mb = await _get_mb(moodboard_id)
        if not mb:
            raise HTTPException(404, "Moodboard not found")
        mb.locked = locked
        if locked:
            # Solo un moodboard locked a la vez — in-memory
            for other_id, other in _MOODBOARDS.items():
                if other_id != moodboard_id:
                    other.locked = False
            # Supabase
            if _sb_available():
                await _sb_unlock_others(moodboard_id)
        await _save_mb(mb)
    return mb


async def get_active_moodboard() -> Moodboard | None:
    """Helper consumido por el Cinematographer_Node."""
    if _sb_available():
        locked = await _sb_list_locked()
        for mb in locked:
            if mb.manifest is not None:
                return mb
    for mb in _MOODBOARDS.values():
        if mb.locked and mb.manifest is not None:
            return mb
    return None
