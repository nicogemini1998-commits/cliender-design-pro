"""Scriptwriter_Node — guion/estrategia creativa (skeleton del Paso 1)."""
from __future__ import annotations

from typing import Any

from app.graph.state import SwarmState


async def scriptwriter_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["scriptwriter"] = "running"

    # TODO(Paso 2): pedir a Claude la estrategia creativa estructurada.
    script = state.get("user_request", "")
    strategy = {"tone": "neutral", "audience": "general"}

    status["scriptwriter"] = "done"
    return {
        "script": script,
        "creative_strategy": strategy,
        "next_node": "cinematographer",
        "node_status": status,
    }
