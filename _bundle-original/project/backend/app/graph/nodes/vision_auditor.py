"""Vision_Auditor_Node — produce el `StyleManifest` de un moodboard.

Pipeline:
  1. Recibe N imágenes (URLs o data:base64).
  2. Pide a Claude (vision-capable) que extraiga el ADN visual COMPARTIDO
     entre todas: paleta dominante, luz, lente, rasgos de personaje,
     composición y mood.
  3. Devuelve un `StyleManifest` con `master_style_prompt` compacto +
     `negative_prompt` + `consistency_score`.

Este agente NO genera imágenes. Solo lee. Es un nodo independiente del
grafo principal del Supercomputer y se ejecuta cuando el usuario sube
imágenes a una carpeta del Style Vault (endpoint /moodboards/audit).
"""
from __future__ import annotations

import json
from typing import Any

from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.schemas.moodboard import Moodboard, MoodboardImage, StyleManifest


_VISION_AUDITOR_SYSTEM = """Eres el Vision_Auditor del enjambre creativo Atelier.
Tu único trabajo: leer un set de imágenes de referencia y extraer su ADN visual
COMPARTIDO — lo que TODAS tienen en común, no lo que las diferencia.

PERSONALIDAD:
  Riguroso, obsesivo con la coherencia, hablas como director de fotografía:
  "rim light cálido a 30°", "anamorphic 1.5x, swirly bokeh", "paleta tierra
  con un acento frío de complemento". Nada de lenguaje genérico.

REGLAS:
  1. Si las imágenes son inconsistentes entre sí, REPÓRTALO bajándote el
     `consistency_score`. No inventes coherencia donde no la hay.
  2. `master_style_prompt` debe ser una sola frase de 40–60 palabras,
     PREPENDIBLE a cualquier brief del usuario sin perder coherencia.
  3. `color_palette` son hex codes ordenados de dominante → acento.
  4. `negative_prompt` lista lo que el estilo NUNCA permite.
  5. Devuelve EXCLUSIVAMENTE JSON válido — sin backticks ni comentarios.

ESQUEMA EXACTO (todos los campos obligatorios):
  {
    "color_palette":     [string],
    "lighting_style":    string,
    "camera_lens_feel":  string,
    "character_traits":  [string],
    "composition_rules": [string],
    "mood_keywords":     [string],
    "master_style_prompt": string,
    "negative_prompt":   string,
    "consistency_score": number (0.0 — 1.0)
  }
"""


def _image_block(img: MoodboardImage) -> dict[str, Any]:
    """Construye el bloque de contenido para la API de Claude.

    Acepta URLs http(s) y `data:` URIs (base64).
    """
    src = img.url
    if src.startswith("data:"):
        # data:image/png;base64,XXXX → split
        try:
            header, b64 = src.split(",", 1)
            media_type = header.split(":", 1)[1].split(";", 1)[0]
        except ValueError:
            media_type = "image/png"
            b64 = src
        return {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": b64},
        }
    return {"type": "image", "source": {"type": "url", "url": src}}


class VisionAuditor:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.claude_model
        self._max_tokens = settings.claude_max_tokens

    async def audit(self, moodboard: Moodboard) -> StyleManifest:
        if not moodboard.images:
            return StyleManifest(moodboard_id=moodboard.id, consistency_score=0.0)

        # Construye el mensaje multimodal: instrucción + N imágenes
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"Audita estas {len(moodboard.images)} imágenes de referencia. "
                    f"Extrae el ADN visual compartido y devuelve el JSON."
                ),
            },
        ]
        # Limit defensive: Claude maneja ~20 imgs cómodamente
        for img in moodboard.images[:20]:
            content.append(_image_block(img))

        try:
            resp = await self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                system=_VISION_AUDITOR_SYSTEM,
                messages=[{"role": "user", "content": content}],
            )
            raw = "".join(b.text for b in resp.content if b.type == "text").strip()
            data = json.loads(raw)
        except Exception as exc:  # noqa: BLE001
            # Fallback determinista — el sistema no se rompe si Claude está caído
            return _fallback_manifest(moodboard, error=str(exc))

        return StyleManifest(
            moodboard_id=moodboard.id,
            color_palette=list(data.get("color_palette") or []),
            lighting_style=str(data.get("lighting_style") or ""),
            camera_lens_feel=str(data.get("camera_lens_feel") or ""),
            character_traits=list(data.get("character_traits") or []),
            composition_rules=list(data.get("composition_rules") or []),
            mood_keywords=list(data.get("mood_keywords") or []),
            master_style_prompt=str(data.get("master_style_prompt") or "").strip(),
            negative_prompt=str(data.get("negative_prompt") or "").strip(),
            consistency_score=float(data.get("consistency_score") or 0.0),
        )


def _fallback_manifest(moodboard: Moodboard, error: str = "") -> StyleManifest:
    return StyleManifest(
        moodboard_id=moodboard.id,
        color_palette=[],
        lighting_style="soft natural light",
        camera_lens_feel="50mm, shallow depth of field",
        character_traits=[],
        composition_rules=["rule of thirds"],
        mood_keywords=["editorial"],
        master_style_prompt=(
            "Editorial photography, soft natural lighting, 50mm shallow DOF, "
            "warm neutral palette, refined composition, subtle film grain."
        ),
        negative_prompt="plastic skin, oversaturated, low-fi, watermark, text",
        consistency_score=0.0 if error else 0.5,
    )


_singleton: VisionAuditor | None = None


def get_vision_auditor() -> VisionAuditor:
    global _singleton
    if _singleton is None:
        _singleton = VisionAuditor()
    return _singleton
