"""Estado compartido del enjambre LangGraph.

LangGraph muta este `TypedDict` a través de los nodos. Cada nodo recibe el
estado completo, devuelve un *partial dict* y LangGraph hace merge.
"""
from __future__ import annotations

from typing import Annotated, Any, Literal, TypedDict

from langgraph.graph.message import add_messages

from app.core.config import MediaKind
from app.schemas.moodboard import StyleManifest


# Status de cada paso del grafo (alimenta los LED del frontend)
NodeStatus = Literal["idle", "running", "done", "error", "rejected"]


class CinematographyPlan(TypedDict, total=False):
    """Plan técnico producido por el Cinematographer."""
    media_kind: MediaKind                # "image" | "video"
    model_id: str                        # debe estar en ALLOWED_KID_AI_MODELS
    prompt: str                          # prompt hiper-técnico final (con fusión de estilo)
    negative_prompt: str
    parameters: dict[str, Any]           # aspect_ratio, duration, seed, ...
    rationale: str                       # por qué este modelo y no otro
    chose_automatically: bool            # True si el usuario no impuso modelo
    style_locked: bool                   # True si se fusionó un StyleManifest
    style_source_moodboard_id: str       # id del moodboard que originó el lock
    reference_images: list[str]          # URLs/base64 pasadas a Kid.ai


class CriticReport(TypedDict, total=False):
    approved: bool
    score: float                         # 0.0 — 1.0
    issues: list[str]
    suggested_fixes: list[str]


class ProductionArtifact(TypedDict, total=False):
    job_id: str
    media_kind: MediaKind
    model_id: str
    url: str
    thumbnail_url: str
    duration_s: float
    cost_credits: float


class SwarmState(TypedDict, total=False):
    """Estado compartido entre los 5 nodos del enjambre."""

    # --- entrada del usuario ---
    user_request: str                    # turno crudo del chat
    user_pinned_model: str | None        # si el usuario fijó un modelo permitido
    conversation: Annotated[list[dict], add_messages]

    # --- contexto de estilo (Style Vault) ---
    active_style_manifest: StyleManifest # ADN visual del moodboard locked
    active_reference_images: list[str]   # URLs/base64 de las refs del moodboard
    active_moodboard_id: str             # id del moodboard locked

    # --- contexto del cliente (inyectado desde frontend) ---
    client_context: dict[str, Any]          # name, industry, palette, typography, tagline...

    # --- producto del MasterDirector ---
    plan: list[str]                      # pasos de alto nivel
    next_node: str                       # ruteo explícito

    # --- producto del Scriptwriter ---
    script: str
    creative_strategy: dict[str, Any]

    # --- producto del Cinematographer ---
    cinematography: CinematographyPlan

    # --- producto de Production ---
    artifact: ProductionArtifact

    # --- producto del Critic ---
    critic: CriticReport
    retries: int                         # # de veces que volvimos a Cinematographer

    # --- telemetría para los LEDs del frontend ---
    node_status: dict[str, NodeStatus]   # {"cinematographer": "running", ...}
    errors: list[str]


def init_state(
    user_request: str,
    pinned_model: str | None = None,
    active_style_manifest: StyleManifest | None = None,
    active_reference_images: list[str] | None = None,
    active_moodboard_id: str | None = None,
    client_context: dict[str, Any] | None = None,
) -> SwarmState:
    return SwarmState(
        user_request=user_request,
        user_pinned_model=pinned_model,
        conversation=[{"role": "user", "content": user_request}],
        active_style_manifest=active_style_manifest,  # type: ignore[arg-type]
        active_reference_images=list(active_reference_images or []),
        active_moodboard_id=active_moodboard_id or "",
        client_context=client_context or {},
        retries=0,
        node_status={
            "master_director": "idle",
            "scriptwriter": "idle",
            "cinematographer": "idle",
            "production": "idle",
            "critic": "idle",
        },
        errors=[],
    )
