"""Endpoint REST del Supercomputer (POST /chat). Streaming SSE en Paso 3."""
from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.moodboard import get_active_moodboard
from app.core.config import ALLOWED_KID_AI_MODELS
from app.graph.builder import build_graph
from app.graph.state import init_state


router = APIRouter(prefix="/chat", tags=["supercomputer"])
_graph = build_graph()


class ChatRequest(BaseModel):
    message: str
    pinned_model: str | None = None  # opcional — debe estar en ALLOWED_KID_AI_MODELS
    moodboard_id: str | None = None  # si viene, intentamos cargar su manifiesto


class ChatResponse(BaseModel):
    cinematography: dict | None = None
    artifact: dict | None = None
    critic: dict | None = None
    node_status: dict
    errors: list[str]


@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    pinned = req.pinned_model
    if pinned and pinned not in ALLOWED_KID_AI_MODELS:
        # No abortamos: tratamos como si no hubiera pin; el Cinematographer elegirá.
        pinned = None

    # Carga el moodboard activo (locked) si existe — o el pedido explícitamente
    active_mb = get_active_moodboard()
    manifest = active_mb.manifest if active_mb else None
    ref_images = [img.url for img in active_mb.images] if active_mb else []
    active_id = active_mb.id if active_mb else None

    initial = init_state(
        req.message,
        pinned_model=pinned,
        active_style_manifest=manifest,
        active_reference_images=ref_images,
        active_moodboard_id=active_id,
    )
    final = await _graph.ainvoke(initial)

    return ChatResponse(
        cinematography=final.get("cinematography"),
        artifact=final.get("artifact"),
        critic=final.get("critic"),
        node_status=final.get("node_status") or {},
        errors=final.get("errors") or [],
    )
