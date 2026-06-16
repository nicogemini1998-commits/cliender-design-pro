"""Production_Node — ejecuta `call_kid_ai_api` (skeleton del Paso 1)."""
from __future__ import annotations

import uuid
from typing import Any

from app.graph.state import ProductionArtifact, SwarmState
from app.tools.kid_ai_tool import call_kid_ai_api


async def production_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["production"] = "running"

    plan = state.get("cinematography") or {}
    job_id = str(uuid.uuid4())

    # TODO(Paso 2): manejar errores, reintentos suaves, persistencia del job.
    try:
        result = await call_kid_ai_api(
            media_kind=plan["media_kind"],
            model_id=plan["model_id"],
            prompt=plan["prompt"],
            parameters=plan.get("parameters") or {},
            reference_images=plan.get("reference_images") or None,
        )
        artifact: ProductionArtifact = {
            "job_id": job_id,
            "media_kind": plan["media_kind"],
            "model_id": plan["model_id"],
            "url": result.get("url", ""),
            "thumbnail_url": result.get("thumbnail_url", ""),
            "duration_s": float(result.get("duration_s", 0.0)),
            "cost_credits": float(result.get("cost_credits", 0.0)),
        }
        status["production"] = "done"
        return {"artifact": artifact, "node_status": status, "next_node": "critic"}
    except Exception as exc:  # noqa: BLE001
        status["production"] = "error"
        return {
            "node_status": status,
            "errors": [*(state.get("errors") or []), f"production: {exc!s}"],
            "next_node": "critic",
        }
