"""Film Editor — el MONTADOR del SuperComputer creativo de Cliender.

Convierte una instrucción de edición en lenguaje natural ("móntalo tipo trailer,
cortes secos al ritmo, slow-mo en el clímax, dip a negro antes del cierre") en una
EDL (Edit Decision List) ESTRUCTURADA que el motor Remotion (Stitch) renderiza al
100%, sin gimmicks ni efectos que no existan.

Garantía de fidelidad (prioridad del proyecto):
  El agente SOLO puede elegir de un vocabulario cerrado de capacidades reales del
  renderer. `_sanitize_edl` valida cada campo contra ese vocabulario: si Claude
  alucina un efecto inexistente, se degrada a la opción profesional más cercana.
  Resultado: lo que el montador pide es exactamente lo que se renderiza.

Consumido por POST /chat/edit (app/api/routes/supercomputer.py).
"""
from __future__ import annotations

import json
from typing import Any

from app.services.claude_client import get_claude

# ---------------------------------------------------------------------------
# Vocabulario CERRADO de capacidades reales del renderer (Stitch.jsx).
# El system prompt enumera estos valores; el sanitizer los impone.
# ---------------------------------------------------------------------------

# Transiciones que el montador EXPONE (nombres semánticos) → id real en Stitch.
_TRANSITION_MAP = {
    "cut": "cut",
    "dissolve": "dissolve",
    "crossdissolve": "dissolve",
    "lumafade": "lumafade",
    "dipblack": "fade",
    "diptoblack": "fade",
    "fade": "fade",
    "dipwhite": "dipwhite",
    "diptowhite": "dipwhite",
    "flash": "dipwhite",
    "filmburn": "filmburn",
    "burn": "filmburn",
    "blurwipe": "blurwipe",
    "blur": "blurwipe",
    "whip": "whip",
    "whippan": "whip",
    "wipe": "wipe",
    # —— estética "años 2000": solo si el usuario las pide explícitamente ——
    "slide": "slide",
    "slideup": "slideup",
    "zoom": "zoom",
    "glitch": "glitch",
    "flip": "flipx",
    "flipx": "flipx",
    "flipy": "flipy",
    "clock": "clockwipe",
    "clockwipe": "clockwipe",
}

_LOOKS = {"cine", "golden", "noir", "vintage", "clean", "none",
          "kodak", "teal_orange", "muted", "velvia", "bleach", "analog", "dusk", "instagram"}
_KENBURNS = {"zoomin", "zoomout", "panleft", "panright", "diagonal"}
_CAPTIONS = {"clean", "boxed", "bubble", "neon"}
_CAPTION_STYLES = {"pill", "outline", "stamp", "gradient", "minimal", "bold", "kinetic"}
_CAPTION_POSITIONS = {"bottom", "top", "center", "left", "right"}


_EDITOR_SYSTEM = """Eres el DIRECTOR DE MONTAJE del SuperComputer creativo de Cliender: fusión de
Walter Murch (Apocalypse Now, The Godfather), Thelma Schoonmaker (Scorsese), Lee Smith (Nolan)
y Angus Wall (Fincher). Tu trabajo va más allá del montaje técnico: eres el arquitecto emocional
del vídeo. Lees las escenas, detectas el arco narrativo, y construyes una pieza cinematográfica
que trasciende el material bruto. Tu rationale explica la visión, las escenas la ejecutan.

═══ FILOSOFÍA — EL MONTAJE ES RITMO, EMOCIÓN Y SORPRESA ═══
La calidad cinematográfica NO viene de meter muchas transiciones, sino de la disciplina:
- El 80-95% de los cortes del cine profesional son CORTE SECO ("cut"). Tu herramienta principal.
- Cada transición que no sea un corte debe estar MOTIVADA (paso de tiempo, cambio de bloque, énfasis).
- Regla de los 6 de Murch: 1) emoción 2) historia 3) ritmo 4) seguimiento de la mirada
  5) plano 2D 6) continuidad espacial. La emoción manda sobre todo.
- Ritmo: VARÍA las duraciones. Acelera hacia el clímax. Un silencio visual vale más que tres cortes.
- Estructura narrativa: incluso 30s tienen un arco: INICIO (gancho), DESARROLLO (tensión),
  CLÍMAX (pico emocional), RESOLUCIÓN (cierre). Identifícalo y exprésalo con el montaje.

═══ VOCABULARIO PROFESIONAL (por defecto) ═══
- "cut"      → corte seco. Invisible, rítmico, directo. El 80% del montaje profesional.
- "dissolve" → disolvencia 0.3-0.5s. Paso de tiempo o suavizar emoción. Elegante.
- "lumafade" → fundido por luminancia. Documental premium, marca de lujo, slow-life.
- "dipblack" → fundido a negro. Cambio de acto, respiro dramático, cierre. MOTIVADO.
- "dipwhite" → flash a blanco. Impacto, recuerdo, revelación. Úsa con criterio.
- "filmburn" → flash cálido analógico. Nostalgia, calidez, cambio orgánico.
- "blurwipe" → desenfoque entre planos. Moda, belleza, lujo, transición íntima.
- "whip"     → barrido con motion blur. SOLO si hay movimiento de cámara motivado.

═══ EFECTOS "AÑOS 2000" — PROHIBIDOS salvo petición EXPLÍCITA del usuario ═══
NO uses por iniciativa: "slide", "slideup", "zoom", "glitch", "flip", "clock", "wipe".
Si el usuario los pide literalmente, úsalos al 100%.

═══ HERRAMIENTAS DE ALTO NIVEL ═══
- speed: 1.0=normal. 0.25-0.6=slow-mo épico (SOLO en el beat clave). 1.5-2.0=energía alta.
  El slow-mo debe GANARSE. No lo uses en más de 1-2 escenas del montaje.
- look por escena: diferencia un flashback ("noir"), recuerdo cálido ("golden"),
  revelación ("clean"), nostalgia ("kodak"), lujo oscuro ("bleach"). SOLO con motivación narrativa.
- kenburns (imágenes): varía zoomin/zoomout/panleft/panright/diagonal. Nunca el mismo dos veces.
- caption_position: posición del texto en pantalla por escena.
  "bottom" (default), "top" (no tapar acción abajo), "center" (impacto dramático),
  "left"/"right" (cuando la composición deja espacio). VARÍA entre escenas.
- caption_style: el vestido visual del texto por escena.
  "pill" (default, fondo semi), "outline" (elegante sin fondo), "stamp" (bold all-caps angular),
  "gradient" (moderno, degradado accent-blanco), "minimal" (thin editorial),
  "bold" (impacto máximo), "kinetic" (cada letra entra staggered — para títulos cortos clave).
  El style debe reforzar la emoción de la escena.

═══ LOOKS DISPONIBLES ═══
Global: cine (blockbuster, default), golden (cálido sunset), noir (blanco y negro), vintage
        (sepia), clean (neutro), none (sin grade), kodak (indie fílmico), teal_orange (acción),
        muted (moda apagada), velvia (naturaleza saturada), bleach (thriller gritty),
        analog (nosálgico 90s), dusk (onírico), instagram (RRSS cálido).
Elige el look global que mejor case con la EMOCIÓN del conjunto. Es tu firma.

═══ SALIDA — JSON ESTRICTO, SIN ``` ═══
Devuelve EXCLUSIVAMENTE este objeto JSON (sin texto fuera):
{
  "rationale": "<2-4 frases: arco emocional detectado, look elegido y por qué, decisiones de montaje clave. En español>",
  "style": {
    "look": "cine|golden|noir|vintage|clean|none|kodak|teal_orange|muted|velvia|bleach|analog|dusk|instagram",
    "grain": 0.0-1.0,
    "vignette": 0.0-1.0,
    "letterbox": true|false,
    "captions": "clean|boxed|bubble|neon",
    "dip_color": "#000000",
    "branding": true|false,
    "sfx": true|false
  },
  "scenes": [
    {
      "index": <int, 1-based>,
      "transition": "cut|dissolve|lumafade|dipblack|dipwhite|filmburn|blurwipe|whip",
      "transition_duration_s": <0.0-1.2, 0 para corte seco>,
      "duration_s": <segundos de la escena>,
      "kenburns": "zoomin|zoomout|panleft|panright|diagonal",
      "look": "cine|golden|noir|vintage|clean|none|kodak|teal_orange|muted|velvia|bleach|analog|dusk|instagram|null",
      "speed": <0.25-2.0, solo vídeo; 1.0=normal>,
      "caption": "<texto on-screen o ''>",
      "caption_position": "bottom|top|center|left|right",
      "caption_style": "pill|outline|stamp|gradient|minimal|bold|kinetic"
    }
  ]
}
PRIMERA escena: transition="cut" siempre. Una escena por escena de entrada.
VARÍA caption_position y caption_style entre escenas para crear dinamismo visual."""


async def plan_edit(
    *,
    instruction: str,
    scenes: list[dict[str, Any]],
    brand: dict[str, Any] | None = None,
    client_context: dict[str, Any] | None = None,
    total_duration_s: float | None = None,
) -> dict[str, Any]:
    """Pide al montador una EDL para `scenes` siguiendo `instruction`.

    `scenes`: [{url, kind?, duration_s?, caption?, description?}]
    Devuelve una EDL saneada lista para construir el RenderRequest.
    """
    src = _normalize_input_scenes(scenes)
    if not src:
        raise ValueError("scenes vacío: se requiere al menos 1 escena con url")

    user = json.dumps(
        {
            "instruction": instruction or "Móntalo con criterio cinematográfico profesional.",
            "total_duration_s": total_duration_s,
            "brand": brand or {},
            "client_context": client_context or {},
            "scenes": [
                {
                    "index": s["index"],
                    "kind": s["kind"],
                    "duration_s": s["duration_s"],
                    "caption": s["caption"],
                    "description": s["description"],
                }
                for s in src
            ],
            "instruction_for_you": (
                "Decide el montaje profesional de estas escenas siguiendo la instruccion del usuario "
                "al 100%. Devuelve SOLO el JSON de la EDL."
            ),
        },
        ensure_ascii=False,
        indent=2,
    )

    plan = await get_claude().reason_json(system=_EDITOR_SYSTEM, user=user)
    return _sanitize_edl(plan, src)


# ---------------------------------------------------------------------------
# Saneamiento — la capa que GARANTIZA fidelidad (vocabulario cerrado).
# ---------------------------------------------------------------------------

def _normalize_input_scenes(scenes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for i, s in enumerate(scenes or [], start=1):
        if not isinstance(s, dict):
            continue
        url = str(s.get("url") or "").strip()
        if not url:
            continue
        u = url.split("?")[0].lower()
        kind = str(s.get("kind") or "").lower()
        if kind not in ("image", "video"):
            kind = "video" if u.endswith((".mp4", ".mov", ".webm", ".m4v")) else "image"
        try:
            dur = float(s.get("duration_s") or 0)
        except (TypeError, ValueError):
            dur = 0.0
        out.append({
            "index": i,
            "url": url,
            "kind": kind,
            "duration_s": dur if dur > 0 else (4.0 if kind == "video" else 3.0),
            "caption": str(s.get("caption") or "").strip(),
            "description": str(s.get("description") or "").strip(),
        })
    return out


def _clampf(v: Any, lo: float, hi: float, default: float) -> float:
    try:
        f = float(v)
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, f))


def _sanitize_edl(plan: dict[str, Any], src: list[dict[str, Any]]) -> dict[str, Any]:
    """Impone el vocabulario cerrado. `src` (escenas de entrada) es la verdad para
    url/kind: el agente nunca define la fuente, solo el montaje."""
    plan = plan if isinstance(plan, dict) else {}
    raw_scenes = plan.get("scenes")
    by_index: dict[int, dict[str, Any]] = {}
    if isinstance(raw_scenes, list):
        for r in raw_scenes:
            if isinstance(r, dict):
                try:
                    by_index[int(r.get("index"))] = r
                except (TypeError, ValueError):
                    continue

    # —— style global ——
    raw_style = plan.get("style") if isinstance(plan.get("style"), dict) else {}
    look = str(raw_style.get("look") or "cine").lower()
    look = look if look in _LOOKS else "cine"
    captions = str(raw_style.get("captions") or "clean").lower()
    captions = captions if captions in _CAPTIONS else "clean"
    dip_color = str(raw_style.get("dip_color") or "#000000")
    if not (dip_color.startswith("#") and len(dip_color) in (4, 7)):
        dip_color = "#000000"
    style = {
        "look": look,
        "grain": _clampf(raw_style.get("grain"), 0.0, 1.0, 0.18),
        "vignette": _clampf(raw_style.get("vignette"), 0.0, 1.0, 0.32),
        "letterbox": bool(raw_style.get("letterbox", True)),
        "captions": captions,
        "dip_color": dip_color,
        "branding": bool(raw_style.get("branding", False)),
        "sfx": bool(raw_style.get("sfx", True)),
    }

    # —— escenas ——
    scenes_out: list[dict[str, Any]] = []
    for s in src:
        dec = by_index.get(s["index"], {})
        is_first = s["index"] == 1

        # transición: nombre semántico → id real; primera escena siempre corte.
        t_in = str(dec.get("transition") or "").lower().replace(" ", "").replace("-", "").replace("_", "")
        transition = "cut" if is_first else _TRANSITION_MAP.get(t_in, "dissolve")

        td = _clampf(dec.get("transition_duration_s"), 0.0, 1.2, 0.0)
        if transition == "cut":
            td = 0.0
        elif td <= 0.0:
            td = 0.45  # solape por defecto razonable

        dur = _clampf(dec.get("duration_s"), 1.0, 12.0, s["duration_s"])

        kb = str(dec.get("kenburns") or "").lower()
        kb = kb if kb in _KENBURNS else None

        sc_look = str(dec.get("look") or "").lower()
        sc_look = sc_look if sc_look in _LOOKS else None

        speed = _clampf(dec.get("speed"), 0.25, 2.0, 1.0)

        caption = str(dec.get("caption") if dec.get("caption") is not None else s["caption"]).strip()

        cap_pos = str(dec.get("caption_position") or "").lower()
        cap_pos = cap_pos if cap_pos in _CAPTION_POSITIONS else "bottom"

        cap_style = str(dec.get("caption_style") or "").lower()
        cap_style = cap_style if cap_style in _CAPTION_STYLES else "pill"

        scenes_out.append({
            "index": s["index"],
            "url": s["url"],
            "kind": s["kind"],
            "duration_s": round(dur, 2),
            "transition": transition,
            "transition_duration_s": round(td, 2),
            "kenburns": kb,
            "look": sc_look,
            "speed": round(speed, 2),
            "caption": caption,
            "caption_position": cap_pos,
            "caption_style": cap_style,
        })

    return {
        "rationale": str(plan.get("rationale") or "").strip(),
        "style": style,
        "scenes": scenes_out,
    }
