"""Sanitizador de prompts para KIE.ai.

Reescribe prompts de generación antes de enviarlos a KIE, eliminando referencias
a marcas registradas, personas reales y propiedades intelectuales de terceros
que disparan el filtro de copyright de KIE (HTTP 501 / state=fail).

Usa Claude Haiku (rápido, económico) para preservar la intención visual original.
"""
from __future__ import annotations

import logging

from app.services.claude_client import get_claude

logger = logging.getLogger(__name__)

_HAIKU = "claude-haiku-4-5-20251001"

_SYSTEM = """\
You are a creative production expert who adapts AI video/image generation prompts \
to ensure they never violate copyright restrictions imposed by generation APIs.

RULES (mandatory, apply in order):
1. REPLACE real brand/trademark names (Nike, Adidas, Apple, Coca-Cola, Rolex, \
Zara, Ferrari, McDonald's, etc.) with generic descriptors:
   "luxury sportswear brand", "premium tech company", "iconic fast-food chain"
2. REPLACE real people names (celebrities, athletes, politicians, musicians, \
actors, social media figures) with anonymous physical descriptions:
   "a professional male athlete in his 30s with short dark hair",
   "a renowned female pop singer with platinum blonde hair"
3. REPLACE real logos/trademarks/flags with generic versions:
   "brand logo", "minimalist corporate emblem", "athletic brand symbol"
4. REPLACE named fictional IP characters (Marvel, DC, Disney, Star Wars, \
video game characters, anime characters…) with generic equivalents:
   "a muscular caped superhero character",
   "a young animated princess with long auburn hair"
5. KEEP all visual direction: composition, lighting, camera movement, color \
palette, mood, atmosphere, cinematographic style, location type
6. KEEP all client branding references — these are the client's OWN brand, \
not third-party IP
7. KEEP technical parameters: aspect ratio, duration hints, motion description, \
audio/SFX notes

Return ONLY the rewritten prompt text — no explanations, no preamble, no quotes. \
If the prompt contains NO copyrighted references, return it EXACTLY as received.\
"""


async def sanitize_for_kie(prompt: str, media_kind: str = "video") -> str:
    """Reescribe un prompt para eliminar referencias copyright antes de enviarlo a KIE.

    Usa Claude Haiku (modelo rápido/económico). Si falla, devuelve el original.
    """
    if not prompt or len(prompt.strip()) < 5:
        return prompt
    try:
        result = await get_claude().reason(
            system=_SYSTEM,
            user=f"Sanitize this {media_kind} generation prompt:\n{prompt}",
            model=_HAIKU,
            max_tokens=512,
            endpoint="/sanitize",
            node_type="prompt_sanitizer",
        )
        sanitized = result.strip()
        if sanitized and len(sanitized) > 5:
            if sanitized != prompt:
                logger.info(
                    "prompt_sanitizer: %d → %d chars [%s]",
                    len(prompt),
                    len(sanitized),
                    media_kind,
                )
            return sanitized
    except Exception as exc:
        logger.warning("prompt_sanitizer failed (fallback original): %s", exc)
    return prompt
