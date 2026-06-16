"""Critic_Node — evalúa y decide si recicla (skeleton del Paso 1)."""
from __future__ import annotations

from typing import Any

from app.graph.state import CriticReport, SwarmState


async def critic_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["critic"] = "running"

    # TODO(Paso 2): pedir a Claude que evalúe la URL del artefacto.
    artifact = state.get("artifact") or {}
    approved = bool(artifact.get("url"))

    report: CriticReport = {
        "approved": approved,
        "score": 1.0 if approved else 0.0,
        "issues": [] if approved else ["sin artefacto"],
        "suggested_fixes": [] if approved else ["reintentar con prompt más detallado"],
    }

    status["critic"] = "done" if approved else "rejected"
    return {"critic": report, "node_status": status}
