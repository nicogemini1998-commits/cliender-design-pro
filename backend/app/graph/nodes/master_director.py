"""MasterDirector_Node — analiza la petición y planifica el pipeline.

Usa Claude para:
  1. Determinar media_kind (image | video) a partir del brief.
  2. Extraer la intención creativa considerando el contexto del cliente.
  3. Decidir si el StyleManifest está activo y debe fusionarse.

Fallback determinista si Claude falla.
"""
from __future__ import annotations

import json
from typing import Any

from app.graph.state import SwarmState
from app.services.claude_client import get_claude

_SYSTEM = """Eres MasterDirector_Node de un enjambre creativo de publicidad.
Tu trabajo es analizar el brief del creativo y el contexto del cliente para decidir
qué tipo de contenido producir y qué pipeline seguir.

CONTEXTO QUE RECIBIRÁS:
- user_request: lo que el creativo (Pablo/Sara) quiere crear
- client: nombre, industria, tagline, paleta, tipografía del cliente asignado
- moodboard_active: si hay un StyleManifest bloqueado (true/false)

REGLAS:
1. Si la petición menciona video/reel/clip/anuncio/spot/shorts → media_kind="video"
2. Si no, media_kind="image"
3. Extrae en 1-2 frases la intención creativa: qué debe transmitir visualmente al público.
4. El plan siempre es: ["scriptwriter","cinematographer","production","critic"]

Devuelve EXCLUSIVAMENTE JSON válido:
{
  "media_kind": "image|video",
  "plan": ["scriptwriter","cinematographer","production","critic"],
  "creative_intent": "frase corta que resume la intención visual y emocional",
  "target_audience": "a quién va dirigido según industria del cliente"
}"""


def _user_prompt(state: SwarmState) -> str:
    client = state.get("client_context") or {}
    manifest = state.get("active_style_manifest")
    return json.dumps({
        "user_request": state.get("user_request", ""),
        "client": {
            "name": client.get("name", "Sin asignar"),
            "industry": client.get("industry", ""),
            "tagline": client.get("tagline", ""),
            "palette": client.get("palette", []),
            "typography": client.get("typography", {}),
        },
        "moodboard_active": bool(manifest),
        "moodboard_id": state.get("active_moodboard_id", ""),
    }, ensure_ascii=False)


async def master_director_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["master_director"] = "running"

    try:
        result = await get_claude().reason_json(system=_SYSTEM, user=_user_prompt(state))
        media_kind = result.get("media_kind", "image")
        if media_kind not in ("image", "video"):
            media_kind = "image"
        plan = result.get("plan") or ["scriptwriter", "cinematographer", "production", "critic"]
        creative_intent = result.get("creative_intent", "")
        target_audience = result.get("target_audience", "")
    except Exception as exc:  # noqa: BLE001
        # Fallback determinista
        req = (state.get("user_request") or "").lower()
        media_kind = "video" if any(w in req for w in ("video","reel","clip","spot","shorts","anuncio")) else "image"
        plan = ["scriptwriter", "cinematographer", "production", "critic"]
        creative_intent = state.get("user_request", "")
        target_audience = ""
        status["master_director"] = "done"
        return {
            "plan": plan,
            "creative_strategy": {"media_kind": media_kind, "creative_intent": creative_intent, "target_audience": target_audience},
            "next_node": "scriptwriter",
            "node_status": status,
            "errors": [*(state.get("errors") or []), f"master_director fallback: {exc!s}"],
        }

    status["master_director"] = "done"
    return {
        "plan": plan,
        "creative_strategy": {
            "media_kind": media_kind,
            "creative_intent": creative_intent,
            "target_audience": target_audience,
        },
        "next_node": "scriptwriter",
        "node_status": status,
    }
