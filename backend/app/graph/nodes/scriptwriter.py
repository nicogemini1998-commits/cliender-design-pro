"""Scriptwriter_Node — genera la estrategia creativa y el guión visual.

Usa Claude para producir un brief creativo completo que incluye:
  - Tono de voz y registro
  - Audiencia objetivo
  - Mensajes clave
  - Lenguaje visual (composición, paleta, atmósfera)
  - Guión/descripción de la pieza

Utiliza el contexto del cliente (marca, paleta, tipografía, industria) para
personalizar la estrategia y hacerla coherente con la identidad de la marca.
"""
from __future__ import annotations

import json
from typing import Any

from app.graph.state import SwarmState
from app.services.claude_client import get_claude

_SYSTEM = """Eres Scriptwriter_Node de un enjambre creativo de publicidad.
Tu trabajo es escribir la ESTRATEGIA CREATIVA y el GUIÓN VISUAL para una pieza
publicitaria, teniendo en cuenta el brief del creativo y la marca del cliente.

CONTEXTO QUE RECIBIRÁS:
- user_request: descripción de lo que quiere crear el creativo
- creative_intent: intención extraída por el MasterDirector
- client: brand DNA completo (nombre, industria, tagline, paleta, tipografía)
- media_kind: "image" o "video"

TU OUTPUT debe ser JSON con:
{
  "tone": "adjetivos del tono (ej: sofisticado, dinámico, cálido)",
  "audience": "descripción del público objetivo",
  "key_messages": ["mensaje 1", "mensaje 2", "mensaje 3"],
  "visual_language": "descripción del estilo visual: composición, luz, atmósfera",
  "script": "guión o descripción narrativa de la pieza en 3-5 frases",
  "color_direction": "cómo usar la paleta del cliente en esta pieza",
  "mood": "1 palabra que define el mood general"
}

REGLAS:
- Personaliza para la marca del cliente. Si el cliente es lujo, el tono es refinado.
- Si hay paleta de colores del cliente, menciónala en color_direction.
- El script debe ser una descripción visual concreta, no abstracta.
- Máximo 200 palabras en total."""


def _user_prompt(state: SwarmState) -> str:
    client = state.get("client_context") or {}
    strategy = state.get("creative_strategy") or {}
    manifest = state.get("active_style_manifest")
    moodboard_info = ""
    if manifest:
        moodboard_info = f"StyleManifest activo (moodboard_id: {state.get('active_moodboard_id', '')})"

    return json.dumps({
        "user_request": state.get("user_request", ""),
        "creative_intent": strategy.get("creative_intent", ""),
        "media_kind": strategy.get("media_kind", "image"),
        "moodboard": moodboard_info,
        "client": {
            "name": client.get("name", "Sin asignar"),
            "industry": client.get("industry", ""),
            "tagline": client.get("tagline", ""),
            "palette": client.get("palette", []),
            "typography": client.get("typography", {}),
            "contact_role": (client.get("contact") or {}).get("role", ""),
        },
    }, ensure_ascii=False)


async def scriptwriter_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["scriptwriter"] = "running"

    client = state.get("client_context") or {}
    client_name = client.get("name", "")

    try:
        result = await get_claude().reason_json(system=_SYSTEM, user=_user_prompt(state))
        script = result.get("script", state.get("user_request", ""))
        strategy = {
            "tone": result.get("tone", ""),
            "audience": result.get("audience", ""),
            "key_messages": result.get("key_messages", []),
            "visual_language": result.get("visual_language", ""),
            "color_direction": result.get("color_direction", ""),
            "mood": result.get("mood", ""),
            "media_kind": (state.get("creative_strategy") or {}).get("media_kind", "image"),
            "client_name": client_name,
        }
    except Exception as exc:  # noqa: BLE001
        script = state.get("user_request", "")
        strategy = {
            "tone": "neutro",
            "audience": "general",
            "media_kind": (state.get("creative_strategy") or {}).get("media_kind", "image"),
            "client_name": client_name,
        }
        status["scriptwriter"] = "done"
        return {
            "script": script,
            "creative_strategy": strategy,
            "next_node": "cinematographer",
            "node_status": status,
            "errors": [*(state.get("errors") or []), f"scriptwriter fallback: {exc!s}"],
        }

    status["scriptwriter"] = "done"
    return {
        "script": script,
        "creative_strategy": strategy,
        "next_node": "cinematographer",
        "node_status": status,
    }
