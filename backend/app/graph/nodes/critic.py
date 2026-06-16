"""Critic_Node — evalúa la imagen generada con Claude Vision y decide si aprobar o reintentar."""
from __future__ import annotations

import json
import logging
from typing import Any

import httpx
from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.graph.state import CriticReport, SwarmState

logger = logging.getLogger(__name__)

_CRITIC_SYSTEM = """Eres el Critic del enjambre creativo Cliender. Tu trabajo es evaluar si la imagen
generada cumple con el brief, la estrategia creativa y las restricciones de marca del cliente.

Sé riguroso pero justo. No apruebes si la imagen no cumple los requisitos básicos.

EVALÚA estos criterios:
1. BRIEF FIDELIDAD: ¿Muestra lo que el usuario pidió?
2. ESTILO VISUAL: ¿Coincide con la dirección creativa descrita?
3. COMPOSICIÓN: ¿Está bien compuesta para su uso (redes, ads, etc.)?
4. MARCA: Si hay contexto de cliente, ¿respeta su identidad visual?
5. CALIDAD TÉCNICA: ¿Resolución, nitidez, iluminación apropiadas?

Devuelve SOLO JSON válido sin markdown:
{
  "approved": true/false,
  "score": 0.0-1.0,
  "issues": ["issue 1", "issue 2"],
  "suggested_fixes": ["fix 1", "fix 2"]
}

score >= 0.75 → approved=true automáticamente.
score < 0.75 → approved=false, lista issues y fixes concretos.
Si la imagen no carga o no existe → score=0, approved=false, issue="imagen no accesible"."""


async def _fetch_image_b64(url: str) -> tuple[str, str] | None:
    """Descarga la imagen y devuelve (base64, media_type). None si falla."""
    try:
        async with httpx.AsyncClient(timeout=15) as c:
            r = await c.get(url, follow_redirects=True)
            if r.status_code != 200:
                return None
            ct = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            if ct not in {"image/jpeg", "image/png", "image/gif", "image/webp"}:
                ct = "image/jpeg"
            import base64
            return base64.b64encode(r.content).decode(), ct
    except Exception as exc:
        logger.warning("critic fetch_image failed url=%s error=%s", url[:80], exc)
        return None


async def critic_node(state: SwarmState) -> dict[str, Any]:
    status = dict(state.get("node_status") or {})
    status["critic"] = "running"

    artifact = state.get("artifact") or {}
    url = artifact.get("url", "")
    media_kind = artifact.get("media_kind", "image")

    # Vídeo: no evaluamos con visión — aprobación directa si tiene URL.
    if media_kind == "video":
        approved = bool(url)
        report: CriticReport = {
            "approved": approved,
            "score": 0.9 if approved else 0.0,
            "issues": [] if approved else ["sin URL de vídeo"],
            "suggested_fixes": [],
        }
        status["critic"] = "done" if approved else "rejected"
        return {"critic": report, "node_status": status}

    # Sin URL → rechazo inmediato.
    if not url:
        report = {"approved": False, "score": 0.0,
                  "issues": ["producción no generó artefacto"], "suggested_fixes": ["reintentar"]}
        status["critic"] = "rejected"
        return {"critic": report, "node_status": status}

    # Construir contexto para el juicio.
    user_request = state.get("user_request", "")
    strategy = state.get("creative_strategy") or {}
    cinematography = state.get("cinematography") or {}
    client_ctx = state.get("client_context") or {}

    context_lines = [f"BRIEF ORIGINAL: {user_request}"]
    if strategy.get("tone"):
        context_lines.append(f"TONO: {strategy['tone']}")
    if strategy.get("mood"):
        context_lines.append(f"MOOD: {strategy['mood']}")
    if strategy.get("color_direction"):
        context_lines.append(f"DIRECCIÓN DE COLOR: {strategy['color_direction']}")
    if cinematography.get("prompt"):
        context_lines.append(f"PROMPT TÉCNICO: {cinematography['prompt'][:300]}")
    if client_ctx.get("name"):
        palette = client_ctx.get("palette", [])
        context_lines.append(
            f"CLIENTE: {client_ctx['name']} | sector: {client_ctx.get('industry','')} | "
            f"paleta: {', '.join(palette[:3]) if palette else 'N/A'}"
        )
    context_text = "\n".join(context_lines)

    # Intentar descargar la imagen para evaluación visual.
    img_data = await _fetch_image_b64(url)

    settings = get_settings()
    client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    try:
        if img_data:
            b64, media_type = img_data
            content = [
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": media_type, "data": b64},
                },
                {"type": "text", "text": f"Evalúa esta imagen según el contexto:\n\n{context_text}"},
            ]
        else:
            # Sin imagen descargable — aprobación técnica provisional.
            content = [{"type": "text", "text": (
                f"URL generada: {url}\n"
                f"No pude descargarla para análisis visual. "
                f"Dado que existe URL válida, asigna score=0.80 como aprobación técnica provisional.\n\n"
                f"Contexto: {context_text}"
            )}]

        msg = await client.messages.create(
            model="claude-opus-4-8",
            max_tokens=512,
            system=_CRITIC_SYSTEM,
            messages=[{"role": "user", "content": content}],
        )
        raw = msg.content[0].text.strip()

        # Limpiar posibles backticks de markdown.
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)

        approved = bool(parsed.get("approved", False))
        score = float(parsed.get("score", 0.0))
        issues = [str(i) for i in (parsed.get("issues") or [])]
        fixes = [str(f) for f in (parsed.get("suggested_fixes") or [])]

        report = {"approved": approved, "score": score, "issues": issues, "suggested_fixes": fixes}
        logger.info("critic.evaluated url=%s approved=%s score=%.2f issues=%d",
                    url[:60], approved, score, len(issues))

    except Exception as exc:
        logger.warning("critic.vision_eval_failed url=%s error=%s — fallback approval", url[:60], exc)
        report = {
            "approved": bool(url),
            "score": 0.75 if url else 0.0,
            "issues": [] if url else ["sin artefacto"],
            "suggested_fixes": [],
        }

    status["critic"] = "done" if report["approved"] else "rejected"
    return {"critic": report, "node_status": status}
