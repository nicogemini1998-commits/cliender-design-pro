"""MasterDirector_Node — rutea y planifica desde el chat (skeleton del Paso 1)."""
from __future__ import annotations

from typing import Any

from app.graph.state import SwarmState


async def master_director_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["master_director"] = "running"

    # TODO(Paso 2): llamar a Claude para planificar pasos y decidir media_kind.
    plan = ["scriptwriter", "cinematographer", "production", "critic"]

    status["master_director"] = "done"
    return {
        "plan": plan,
        "next_node": "scriptwriter",
        "node_status": status,
    }
