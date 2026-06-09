"""Edges condicionales del grafo."""
from __future__ import annotations

from typing import Literal

from langgraph.graph import END

from app.core.config import get_settings
from app.graph.state import SwarmState


CriticBranch = Literal["cinematographer", "__end__"]


def critic_router(state: SwarmState) -> CriticBranch:
    """Si el Critic rechaza y tenemos presupuesto de reintentos, volvemos al
    Cinematographer. Si aprueba o agotamos retries, terminamos."""
    settings = get_settings()
    critic = state.get("critic") or {}
    retries = int(state.get("retries") or 0)

    if critic.get("approved"):
        return END  # type: ignore[return-value]

    if retries >= settings.critic_max_retries:
        return END  # type: ignore[return-value]

    return "cinematographer"


def bump_retries(state: SwarmState) -> dict:
    """Helper invocado como nodo intermedio cuando reciclamos."""
    return {"retries": int(state.get("retries") or 0) + 1}
