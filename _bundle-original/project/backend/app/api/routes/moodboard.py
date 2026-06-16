"""Endpoint REST del Style Vault — audita carpetas y devuelve el manifiesto.

Frontend flujo:
  1. Usuario suelta imágenes en una carpeta del MoodboardVault.
  2. Frontend → POST /moodboards/audit  { moodboard_id, name, images[] }
  3. Backend invoca Vision_Auditor → devuelve Moodboard con StyleManifest.
  4. Frontend persiste en el store de Zustand y, si Lock Style está activo,
     lo propaga al siguiente run del Cinematographer.

Estado:
  En esta primera versión usamos un store in-memory por proceso. En producción
  se reemplaza por Redis/Postgres sin tocar la firma del endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.graph.nodes.vision_auditor import get_vision_auditor
from app.schemas.moodboard import AuditRequest, AuditResponse, Moodboard


router = APIRouter(prefix="/moodboards", tags=["moodboards"])

# Store en memoria — sustituir por Redis en prod
_MOODBOARDS: dict[str, Moodboard] = {}


@router.post("/audit", response_model=AuditResponse)
async def audit_moodboard(req: AuditRequest) -> AuditResponse:
    if not req.images:
        raise HTTPException(400, "Subir al menos una imagen para auditar.")

    mb = _MOODBOARDS.get(req.moodboard_id) or Moodboard(
        id=req.moodboard_id,
        name=req.name or "Untitled",
        images=[],
    )
    mb.name = req.name or mb.name
    # Merge imágenes (idempotente por id)
    existing_ids = {i.id for i in mb.images}
    for img in req.images:
        if img.id not in existing_ids:
            mb.images.append(img)
    mb.audit_status = "auditing"
    _MOODBOARDS[mb.id] = mb

    try:
        manifest = await get_vision_auditor().audit(mb)
        mb.manifest = manifest
        mb.audit_status = "ready"
    except Exception as exc:  # noqa: BLE001
        mb.audit_status = "error"
        raise HTTPException(500, f"Vision_Auditor falló: {exc!s}") from exc

    _MOODBOARDS[mb.id] = mb
    return AuditResponse(moodboard=mb)


@router.get("/{moodboard_id}", response_model=Moodboard)
async def get_moodboard(moodboard_id: str) -> Moodboard:
    mb = _MOODBOARDS.get(moodboard_id)
    if not mb:
        raise HTTPException(404, "Moodboard not found")
    return mb


@router.post("/{moodboard_id}/lock", response_model=Moodboard)
async def toggle_lock(moodboard_id: str, locked: bool) -> Moodboard:
    mb = _MOODBOARDS.get(moodboard_id)
    if not mb:
        raise HTTPException(404, "Moodboard not found")
    mb.locked = locked
    # Solo puede haber UN moodboard locked a la vez
    if locked:
        for other_id, other in _MOODBOARDS.items():
            if other_id != moodboard_id:
                other.locked = False
    return mb


def get_active_moodboard() -> Moodboard | None:
    """Helper consumido por el Cinematographer_Node para encontrar el
    moodboard con `locked=True` (si existe)."""
    for mb in _MOODBOARDS.values():
        if mb.locked and mb.manifest is not None:
            return mb
    return None
