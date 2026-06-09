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

import base64
import json
import logging
from typing import Any

import httpx

from anthropic import AsyncAnthropic

from app.core.config import get_settings
from app.schemas.moodboard import Moodboard, MoodboardImage, StyleManifest


_VISION_AUDITOR_SYSTEM = """Eres el Vision_Auditor del creative swarm of the studio.

=== IDIOMA DE RESPUESTA (REGLA ABSOLUTA) ===
TODOS los campos del JSON deben estar EN CASTELLANO, EXCEPTO:
  - "master_style_prompt" → SIEMPRE en inglés (lo usa la IA generativa KIE.ai directamente)
  - "character_prompt" dentro de cada personaje → SIEMPRE en inglés (mismo motivo)
  - "color_palette" → hex codes, idioma no aplica
  - "consistency_score" → número, idioma no aplica
NO traduzcas los valores de "text_content" (transcripción literal de texto visible en imagen).
Todo lo demás (lighting_style, camera_lens_feel, mood_keywords, composition_rules, etc.) → castellano.


Eres un equipo fusionado en una sola mente: Director de Fotografía + Casting Director +
Director de Arte + Tipógrafo + Colorista + Retoucher senior. Analizas con precisión forense.

MISIÓN: extraer el ADN visual COMPLETO y EXHAUSTIVO de las imágenes de referencia para que
cualquier imagen nueva generada con este moodboard sea idéntica en estilo (solo cambia el
contenido que el usuario pida). Debes capturar TODO: capas, letras, fuentes, filtros, colores,
poses, personajes, grano, color grade, composición. NO resumas. Sé concreto y técnico.

=== QUÉ DEBES ANALIZAR (TODO, sin excepción) ===

1. COLOR (color_palette + color_grading):
   - color_palette: 4-8 hex codes EXACTOS, de dominante a acento (mira los píxeles reales).
   - color_grading: temperatura (cálido/frío/neutro), contraste, saturación, cómo se tratan
     sombras/medios/altas luces, referencia de LUT o stock si aplica (teal&orange, Kodak Portra 400,
     bleach bypass, cross-process, matte lifted blacks, etc.).

2. ILUMINACIÓN (lighting_style):
   - Fuente, dirección, calidad (dura/suave), ratio, motivación (natural/estudio/práctica),
     esquema (Rembrandt, butterfly, split, rim, backlit, silhouette, high-key, low-key, chiaroscuro).

3. ÓPTICA Y CÁMARA (camera_lens_feel):
   - Distancia focal aparente (14/24/35/50/85/135mm), apertura/DOF, distorsión, bokeh,
     aberración cromática, anamórfico, ángulo, altura de cámara.

4. TIPOGRAFÍA Y LETRAS (typography + text_content) — CRÍTICO si hay texto:
   - typography: para CADA bloque de texto visible: familia (serif/sans-serif/script/display/mono),
     nombre de fuente si la reconoces, peso (thin/regular/bold/black), caso (mayúsculas/minúsculas),
     tracking/kerning, alineación, posición en el encuadre, color del texto, tamaño relativo,
     efectos (outline, sombra, degradado, contorno).
   - text_content: transcribe LITERALMENTE cada palabra/frase legible tal cual aparece.

5. FILTROS, EFECTOS Y POST-PROCESADO (filters_effects):
   - Grano de película, halación/glow, viñeta, aberración cromática, bloom, blur/sharpening,
     texturas overlay (papel, ruido, scanlines), glitch, dust&scratches, light leaks,
     duotono, HDR, vignette, chromatic shifts. Lista TODO lo que veas aplicado.

6. CAPAS Y COMPOSICIÓN (composition_layers + composition_rules):
   - composition_layers: enumera las capas de adelante hacia atrás (foreground / sujeto /
     midground / background / overlays gráficos / badges / marcos / gradientes / texto encima).
   - composition_rules: rule-of-thirds, centrado, simetría, leading lines, negative space,
     frame-within-frame, golden ratio, etc.

7. PERSONAJES Y POSES (characters) — CRÍTICO si hay personas:
   Para CADA persona/personaje/avatar:
   - identity: quién es (persona real conocida, personaje ficticio, arquetipo profesional, etc.)
   - description: una línea resumen.
   - appearance: age_range, gender, ethnicity, hair (color/longitud/corte/textura),
     clothing (cada prenda con color/tejido/marca), accessories, makeup, distinctive_features.
   - pose: postura corporal exacta, gesto de manos, dirección de mirada, expresión facial,
     ángulo del cuerpo respecto a cámara, energía/actitud transmitida.
   - character_prompt: 30-60 palabras EN INGLÉS (OBLIGATORIO — prompt directo para GPT-Image-2/Seedance).
     Formato: "Subject is [full physical description], wearing [clothing], [pose/expression], [lighting]."
   Sin personas visibles → characters: [].

8. MOOD Y ESTILO (mood_keywords + master_style_prompt + negative_prompt):
   - mood_keywords: 4-8 palabras (editorial, brutal, cinematic, melancholic, luxury, gritty...).
   - master_style_prompt: 50-80 palabras EN INGLÉS (OBLIGATORIO — lo usa la IA generativa),
     denso, prependible a cualquier brief, captura el ADN visual completo.
   - negative_prompt: lo que este estilo NUNCA permite. EN CASTELLANO.

=== CONSISTENCY SCORE (regla estricta) ===
consistency_score = número decimal entre 0.0 y 1.0 (NO uses escala 0-10, NO uses porcentaje).
  - 0.9-1.0: las imágenes comparten claramente luz, color, lente, mood (set muy coherente).
  - 0.6-0.8: comparten la mayoría de rasgos con variaciones menores.
  - 0.3-0.5: estilos mezclados, coherencia parcial.
  - 0.0-0.2: imágenes sin relación visual.
SIEMPRE devuelve un número > 0 si hay al menos una imagen analizable. NUNCA 0.0 salvo set vacío.

=== FORMATO DE SALIDA ===
Devuelve SOLO JSON válido y COMPLETO. Sin backticks, sin markdown, sin comentarios, sin texto extra.
Asegúrate de CERRAR todas las llaves y corchetes. Sé conciso en cada campo para no truncar.

ESQUEMA:
{
  "color_palette": [string],
  "color_grading": string,
  "lighting_style": string,
  "camera_lens_feel": string,
  "typography": [string],
  "text_content": [string],
  "filters_effects": [string],
  "composition_layers": [string],
  "composition_rules": [string],
  "character_traits": [string],
  "mood_keywords": [string],
  "master_style_prompt": string,
  "negative_prompt": string,
  "consistency_score": number,
  "characters": [
    {
      "identity": string,
      "description": string,
      "appearance": {
        "age_range": string,
        "gender": string,
        "ethnicity": string,
        "hair": string,
        "clothing": string,
        "accessories": string,
        "makeup": string,
        "distinctive_features": string
      },
      "pose": string,
      "character_prompt": string
    }
  ]
}
"""


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

_ALLOWED_MEDIA = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_IMAGE_BYTES = 5 * 1024 * 1024  # 5MB Anthropic cap
_EXT_TO_MEDIA = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
}


def _media_from_url(url: str, content_type: str | None) -> str | None:
    if content_type:
        ct = content_type.split(";", 1)[0].strip().lower()
        if ct in _ALLOWED_MEDIA:
            return ct
    path = url.split("?", 1)[0].lower()
    for ext, mt in _EXT_TO_MEDIA.items():
        if path.endswith(ext):
            return mt
    if "unsplash.com" in url:
        return "image/jpeg"
    return None


async def _image_block(img: MoodboardImage) -> dict[str, Any] | None:
    """Construye el bloque de contenido para la API de Claude.

    Si la fuente es URL http(s), descarga server-side y envía como base64
    (elimina dependencia de que Anthropic alcance la URL). Devuelve None
    si la imagen no puede usarse.
    """
    src = img.url
    if src.startswith("data:"):
        try:
            header, b64 = src.split(",", 1)
            media_type = header.split(":", 1)[1].split(";", 1)[0]
        except ValueError:
            media_type = "image/png"
            b64 = src
        if media_type not in _ALLOWED_MEDIA:
            logger.warning("vision_auditor.skip_image id=%s reason=unsupported_media media=%s", img.id, media_type)
            return None
        return {
            "type": "image",
            "source": {"type": "base64", "media_type": media_type, "data": b64},
        }

    if not (src.startswith("http://") or src.startswith("https://")):
        logger.warning("vision_auditor.skip_image id=%s reason=unknown_scheme url=%s", img.id, src[:80])
        return None

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(src, headers={"User-Agent": "CliendreDesignPro/1.0"})
            r.raise_for_status()
            content = r.content
            content_type = r.headers.get("content-type")
    except Exception as exc:  # noqa: BLE001
        logger.warning("vision_auditor.download_failed id=%s url=%s error=%s", img.id, src[:80], exc)
        return None

    if len(content) > _MAX_IMAGE_BYTES:
        logger.warning("vision_auditor.skip_image id=%s reason=too_large bytes=%d", img.id, len(content))
        return None

    media_type = _media_from_url(src, content_type)
    if media_type not in _ALLOWED_MEDIA:
        logger.warning("vision_auditor.skip_image id=%s reason=unsupported_media content_type=%s", img.id, content_type)
        return None

    b64 = base64.b64encode(content).decode("ascii")
    logger.info("vision_auditor.image_ready id=%s media=%s bytes=%d", img.id, media_type, len(content))
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": b64},
    }


class VisionAuditor:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        # Vision_Auditor usa Haiku para velocidad — análisis estructurado, no creativo
        self._model = "claude-sonnet-4-6"  # Sonnet: mejor visión y análisis de personajes
        # CAUSA RAÍZ del "0% consistencia": el JSON exhaustivo (typography, filters, layers,
        # poses, multi-personaje) supera 2500 tokens → se trunca → parse falla → fallback 0.0.
        # 16000 da margen amplio para análisis forense COMPLETO de hasta 20 imágenes con
        # múltiples personajes sin truncar (ahora corre en background, el tiempo no es problema).
        self._max_tokens = 16000

    async def audit(self, moodboard: Moodboard) -> StyleManifest:
        if not moodboard.images:
            return StyleManifest(moodboard_id=moodboard.id, consistency_score=0.0)

        logger.info(
            "vision_auditor.start moodboard=%s n_images=%d model=%s",
            moodboard.id, len(moodboard.images), self._model,
        )

        # Construye el mensaje multimodal: instrucción + N imágenes
        content: list[dict[str, Any]] = [
            {
                "type": "text",
                "text": (
                    f"Audita estas {len(moodboard.images)} imágenes de referencia. "
                    f"Extrae el ADN visual compartido Y analiza en profundidad "
                    f"TODOS los personajes visibles: identifícalos, describe su "
                    f"apariencia exacta (ropa, cabello, rasgos) y crea un "
                    f"character_prompt en inglés para replicarlos con IA. "
                    f"Devuelve JSON con el campo 'characters'."
                ),
            },
        ]
        # Limit defensive: Claude maneja ~20 imgs cómodamente
        for img in moodboard.images[:20]:
            block = await _image_block(img)
            if block is not None:
                content.append(block)

        n_images_attached = sum(1 for c in content if c.get("type") == "image")
        if n_images_attached == 0:
            logger.error("vision_auditor.no_images_usable moodboard=%s", moodboard.id)
            return _fallback_manifest(moodboard, error="no_usable_images")
        logger.info("vision_auditor.images_attached moodboard=%s count=%d", moodboard.id, n_images_attached)

        try:
            resp = await self._client.messages.create(
                model=self._model,
                max_tokens=self._max_tokens,
                system=_VISION_AUDITOR_SYSTEM,
                messages=[{"role": "user", "content": content}],
            )
            raw = "".join(b.text for b in resp.content if b.type == "text").strip()
            logger.info(
                "vision_auditor.raw_response moodboard=%s len=%d preview=%s",
                moodboard.id, len(raw), raw[:200].replace("\n", " "),
            )
            data = _parse_json_lenient(raw)
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "vision_auditor.failed moodboard=%s images=%d error=%s",
                moodboard.id, len(moodboard.images), exc,
            )
            return _fallback_manifest(moodboard, error=str(exc))

        # BLINDAJE: si el parse devolvió algo que no es dict (lista, string),
        # no podemos indexar con .get → degradar a {} en vez de reventar.
        if not isinstance(data, dict):
            logger.warning(
                "vision_auditor.non_dict_response moodboard=%s type=%s",
                moodboard.id, type(data).__name__,
            )
            data = {}

        if not data.get("master_style_prompt"):
            logger.warning("vision_auditor.empty_manifest moodboard=%s", moodboard.id)

        raw_chars = data.get("characters")
        characters_out = []
        if isinstance(raw_chars, list):
            for ch in raw_chars[:10]:
                if not isinstance(ch, dict):
                    continue
                appearance = ch.get("appearance")
                if isinstance(appearance, dict):
                    appearance_out: dict = appearance
                elif appearance in (None, ""):
                    appearance_out = {}
                else:
                    appearance_out = {"summary": _stringify(appearance)}
                characters_out.append({
                    "identity": _stringify(ch.get("identity")),
                    "description": _stringify(ch.get("description")),
                    "appearance": appearance_out,
                    "pose": _stringify(ch.get("pose")),
                    "character_prompt": _stringify(ch.get("character_prompt")),
                })

        # BLINDAJE FINAL: construir el manifest NUNCA debe propagar un 500.
        # Todos los campos list[str] pasan por _str_list (coacciona dicts/escalares),
        # los str por _stringify. Si aun así Pydantic se queja, caemos a un
        # manifest mínimo que preserva lo crítico en vez de perder todo el análisis.
        try:
            return StyleManifest(
                moodboard_id=moodboard.id,
                color_palette=_str_list(data.get("color_palette")),
                color_grading=_stringify(data.get("color_grading")),
                lighting_style=_stringify(data.get("lighting_style")),
                camera_lens_feel=_stringify(data.get("camera_lens_feel")),
                typography=_str_list(data.get("typography")),
                text_content=_str_list(data.get("text_content")),
                filters_effects=_str_list(data.get("filters_effects")),
                composition_layers=_str_list(data.get("composition_layers")),
                character_traits=_str_list(data.get("character_traits")),
                composition_rules=_str_list(data.get("composition_rules")),
                mood_keywords=_str_list(data.get("mood_keywords")),
                master_style_prompt=_stringify(data.get("master_style_prompt")),
                negative_prompt=_stringify(data.get("negative_prompt")),
                consistency_score=_safe_score(data.get("consistency_score")),
                characters=characters_out,
            )
        except Exception as exc:  # noqa: BLE001
            logger.exception(
                "vision_auditor.manifest_build_failed moodboard=%s error=%s",
                moodboard.id, exc,
            )
            try:
                return StyleManifest(
                    moodboard_id=moodboard.id,
                    master_style_prompt=(
                        _stringify(data.get("master_style_prompt"))
                        or FALLBACK_MASTER_STYLE_PROMPT
                    ),
                    negative_prompt=_stringify(data.get("negative_prompt")),
                    consistency_score=_safe_score(data.get("consistency_score")),
                )
            except Exception:  # noqa: BLE001
                return _fallback_manifest(moodboard, error=str(exc))


FALLBACK_MASTER_STYLE_PROMPT = (
    "Editorial photography, soft natural lighting, 50mm shallow DOF, "
    "warm neutral palette, refined composition, subtle film grain."
)


def _stringify(val: Any) -> str:
    """Aplana cualquier valor a un string legible, sin lanzar.

    Claude a veces devuelve un campo de texto como dict o lista anidada.
    Convertir a str de forma controlada evita que un tipo inesperado tire
    toda la construcción del manifest (causa de 500 con sets grandes).
    """
    if val is None:
        return ""
    if isinstance(val, str):
        return val.strip()
    if isinstance(val, (list, tuple)):
        return ", ".join(_stringify(x) for x in val if x not in (None, ""))
    if isinstance(val, dict):
        return "; ".join(
            f"{k}={_stringify(v)}" for k, v in val.items() if v not in (None, "", [])
        )
    return str(val)


def _str_list(value: Any) -> list[str]:
    """Coacciona cualquier valor a list[str] sin lanzar excepción.

    BLINDAJE: Claude a menudo devuelve campos declarados como list[str]
    (typography, filters_effects, composition_layers, text_content...) como
    list[dict] o string suelto. Pydantic list[str] rechaza dicts →
    ValidationError → 500. Aquí aplanamos preservando la info:
      - dict suelto      → ["k: v", "k: v", ...]
      - list[dict]       → cada dict comprimido a "k: v · k: v"
      - string suelto    → [string]
      - escalares        → [str(escalar)]
    """
    if value is None:
        return []
    if isinstance(value, str):
        v = value.strip()
        return [v] if v else []
    if isinstance(value, dict):
        out = [
            f"{k}: {_stringify(v)}"
            for k, v in value.items()
            if v not in (None, "", [])
        ]
        return out
    if isinstance(value, (list, tuple)):
        out: list[str] = []
        for item in value:
            if item in (None, ""):
                continue
            if isinstance(item, str):
                s = item.strip()
                if s:
                    out.append(s)
            elif isinstance(item, dict):
                parts = [
                    f"{k}: {_stringify(v)}"
                    for k, v in item.items()
                    if v not in (None, "", [])
                ]
                if parts:
                    out.append(" · ".join(parts))
            else:
                out.append(str(item))
        return out
    return [str(value)]


def _safe_score(value: Any) -> float:
    """Normaliza consistency_score sea cual sea el formato que devuelva Claude.

    Acepta: 0.85 · 8.5 · 8 · "8/10" · "85%" · "0.85" · "high". Siempre [0.0, 1.0].
    Nunca lanza excepción (evita que un score raro tire toda la construcción → 500).
    """
    if value is None:
        return 0.5  # set analizable sin score explícito → neutro, NO 0
    # Numérico directo
    if isinstance(value, (int, float)):
        v = float(value)
    elif isinstance(value, str):
        s = value.strip().lower()
        labels = {"very high": 0.95, "high": 0.85, "medium": 0.6, "low": 0.3, "very low": 0.1}
        if s in labels:
            return labels[s]
        if "/" in s:  # "8/10"
            try:
                num, den = s.split("/", 1)
                v = float(num.strip()) / float(den.strip() or 1)
                return min(1.0, max(0.0, v))
            except (ValueError, ZeroDivisionError):
                return 0.5
        s = s.rstrip("%").strip()
        try:
            v = float(s)
            if "%" in value:  # era porcentaje
                v = v / 100.0
        except ValueError:
            return 0.5
    else:
        return 0.5
    # Escala 0-10 → 0-1
    if v > 1.0:
        v = v / (100.0 if v > 10.0 else 10.0)
    return min(1.0, max(0.0, v))


def _repair_truncated_json(s: str) -> str:
    """Repara JSON cortado por límite de tokens: cierra strings/llaves/corchetes abiertos.

    El truncamiento es la causa raíz del '0% consistencia': si el JSON se corta a mitad,
    json.loads falla. Aquí cerramos la estructura para recuperar lo máximo posible.
    """
    # Cortar en la última coma/valor completo razonable si la cola está rota
    in_str = False
    escape = False
    stack: list[str] = []
    last_safe = 0  # índice tras el último char "seguro" (fin de valor en nivel raíz/objeto)
    for i, ch in enumerate(s):
        if escape:
            escape = False
            continue
        if ch == "\\":
            escape = True
            continue
        if ch == '"':
            in_str = not in_str
            continue
        if in_str:
            continue
        if ch in "{[":
            stack.append("}" if ch == "{" else "]")
        elif ch in "}]":
            if stack:
                stack.pop()
        if ch == "," and not stack[-1:] == ["]"]:
            last_safe = i  # coma fuera de string a nivel de objeto → punto de corte limpio
    # Si quedó string abierta, recortar hasta el último corte limpio conocido
    if in_str and last_safe:
        s = s[:last_safe]
        # recomputar stack tras el recorte
        stack = []
        in_str = False
        escape = False
        for ch in s:
            if escape:
                escape = False
                continue
            if ch == "\\":
                escape = True
                continue
            if ch == '"':
                in_str = not in_str
                continue
            if in_str:
                continue
            if ch in "{[":
                stack.append("}" if ch == "{" else "]")
            elif ch in "}]" and stack:
                stack.pop()
    # Cerrar lo que quede abierto, en orden inverso
    return s + "".join(reversed(stack))


def _parse_json_lenient(raw: str) -> dict[str, Any]:
    """Parsea JSON tolerante: quita code-fences, extrae el objeto y repara truncamiento."""
    s = raw.strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s.startswith("json"):
            s = s[4:]
        s = s.strip()
    # Encuentra el primer { y último } balanceado
    start = s.find("{")
    end = s.rfind("}")
    if start != -1:
        s = s[start : end + 1] if (end != -1 and end > start) else s[start:]
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        # JSON truncado por límite de tokens → intentar reparar y reparsear
        repaired = _repair_truncated_json(s)
        try:
            data = json.loads(repaired)
            logger.warning("vision_auditor.json_repaired recovered_keys=%d", len(data))
            return data
        except json.JSONDecodeError:
            raise  # deja que el caller caiga al fallback


def _fallback_manifest(moodboard: Moodboard, error: str = "") -> StyleManifest:
    return StyleManifest(
        moodboard_id=moodboard.id,
        color_palette=[],
        lighting_style="soft natural light",
        camera_lens_feel="50mm, shallow depth of field",
        character_traits=[],
        composition_rules=["rule of thirds"],
        mood_keywords=["editorial"],
        master_style_prompt=FALLBACK_MASTER_STYLE_PROMPT,
        negative_prompt="plastic skin, oversaturated, low-fi, watermark, text",
        consistency_score=0.0 if error else 0.5,
    )


_singleton: VisionAuditor | None = None


def get_vision_auditor() -> VisionAuditor:
    global _singleton
    if _singleton is None:
        _singleton = VisionAuditor()
    return _singleton
