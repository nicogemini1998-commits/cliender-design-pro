"""Endpoint de agente creativo para el prototipo Design Pro.

POST /agent/run  — recibe un brief del usuario + contexto del agente + contexto de cliente
                   y devuelve un prompt refinado listo para enviar a Kid.ai.

El agente usa Claude como motor de razonamiento (regla de oro: cognición SOLO Claude).
"""
from __future__ import annotations

import base64
import logging

import httpx

from typing import Any, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from app.services.claude_client import ClaudeClient
from app.services import prompt_brain
from app.schemas.moodboard import StyleManifest
from anthropic import AsyncAnthropic
from app.core.config import get_settings
from app.services.url_guard import assert_safe_url as _assert_safe_url, SSRFBlockedError as _SSRFBlockedError

logger = logging.getLogger(__name__)

_ALLOWED_REF_MEDIA = {"image/jpeg", "image/png", "image/gif", "image/webp"}
_MAX_REF_BYTES = 5 * 1024 * 1024  # 5MB


def _media_from_ref(url: str, content_type: Optional[str]) -> Optional[str]:
    if content_type:
        ct = content_type.split(";")[0].strip().lower()
        if ct in _ALLOWED_REF_MEDIA:
            return ct
    u = url.lower().split("?")[0]
    if u.endswith(".jpg") or u.endswith(".jpeg"):
        return "image/jpeg"
    if u.endswith(".png"):
        return "image/png"
    if u.endswith(".gif"):
        return "image/gif"
    if u.endswith(".webp"):
        return "image/webp"
    if "unsplash.com" in u:
        return "image/jpeg"
    return None


def _sniff_media_type(content: bytes) -> Optional[str]:
    """Detecta el media_type por MAGIC BYTES del contenido real.

    Crítico: Supabase guarda imágenes con extensión .png pero el contenido puede
    ser JPEG. Anthropic rechaza (400) si el media_type declarado no coincide con
    los bytes reales. La fuente de verdad es SIEMPRE el contenido, no la URL.
    """
    if len(content) < 12:
        return None
    if content[0:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if content[0:8] == b"\x89PNG\r\n\x1a\n":
        return "image/png"
    if content[0:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if content[0:4] == b"RIFF" and content[8:12] == b"WEBP":
        return "image/webp"
    return None


async def _ref_image_block(url: str) -> Optional[dict[str, Any]]:
    """Descarga URL upstream y construye bloque multimodal Claude."""
    if url.startswith("data:"):
        try:
            header, b64data = url.split(",", 1)
            media_type = header.split(";")[0][5:]
            if media_type not in _ALLOWED_REF_MEDIA:
                logger.warning("agent.ref_skip reason=unsupported_data_uri ct=%s", media_type)
                return None
            if len(b64data) * 3 // 4 > _MAX_REF_BYTES:
                logger.warning("agent.ref_skip reason=data_uri_too_large len=%d", len(b64data))
                return None
            return {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64data}}
        except Exception as exc:
            logger.warning("agent.ref_skip reason=invalid_data_uri err=%s", exc)
            return None
    if not (url.startswith("http://") or url.startswith("https://")):
        logger.warning("agent.ref_skip reason=unknown_scheme url=%s", url[:80])
        return None
    # Anti-SSRF: bloquea IPs privadas/loopback/metadata cloud antes de descargar.
    try:
        _assert_safe_url(url)
    except _SSRFBlockedError as exc:
        logger.warning("agent.ref_skip reason=ssrf_blocked url=%s err=%s", url[:80], exc)
        return None
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=False) as client:
            r = await client.get(url, headers={"User-Agent": "CliendreDesignPro/1.0"})
            r.raise_for_status()
            content = r.content
            content_type = r.headers.get("content-type")
    except Exception as exc:  # noqa: BLE001
        logger.warning("agent.ref_skip reason=download_failed url=%s err=%s", url[:80], exc)
        return None
    if len(content) > _MAX_REF_BYTES:
        logger.warning("agent.ref_skip reason=too_large bytes=%d url=%s", len(content), url[:80])
        return None
    # Prioridad: magic bytes del contenido real > content-type header > extensión URL.
    # Supabase sirve .png que en realidad son JPEG → sin sniff, Anthropic da 400.
    media_type = _sniff_media_type(content) or _media_from_ref(url, content_type)
    if media_type not in _ALLOWED_REF_MEDIA:
        logger.warning("agent.ref_skip reason=unsupported_media ct=%s url=%s", content_type, url[:80])
        return None
    b64 = base64.b64encode(content).decode("ascii")
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": b64},
    }


# Cerebro de prompting unificado (SHAQ vive ahora en app/services/prompt_brain.py).
# Reexponemos estos símbolos por compatibilidad: cualquier importador antiguo de
# agent.py sigue funcionando, pero la fuente de verdad es prompt_brain.
_STORYBOARD_KW: frozenset = prompt_brain.STORYBOARD_KW
_CHARACTER_BOARD_KW: frozenset = prompt_brain.CHARACTER_BOARD_KW


def _detect_output_mode(brief: str) -> Optional[str]:
    return prompt_brain.detect_output_mode(brief)

router = APIRouter(prefix="/agent", tags=["agent"])

_claude: Optional[ClaudeClient] = None


def _get_claude() -> ClaudeClient:
    global _claude
    if _claude is None:
        _claude = ClaudeClient()
    return _claude


# ---------------------------------------------------------------------------
# Modelos
# ---------------------------------------------------------------------------

class LogoContext(BaseModel):
    """Datos del logo de marca del cliente."""
    description: Optional[str] = None
    shape: Optional[str] = None
    colors: Optional[dict] = None
    typography: Optional[str] = None
    variants: Optional[list[str]] = None
    usage: Optional[str] = None


class ClientContext(BaseModel):
    """Contexto del cliente activo en el topbar."""
    name: Optional[str] = None
    sector: Optional[str] = None
    palette: Optional[list[str]] = None          # colores hex
    fonts: Optional[list[str]] = None
    colorEmotion: Optional[str] = None           # descripción emocional del color
    toneTemperature: Optional[str] = None        # temperatura de voz
    audience: Optional[list[str]] = None         # audiencia objetivo
    contentPillars: Optional[list[str]] = None   # pilares de contenido
    compositionStyle: Optional[str] = None       # estilo de composición visual
    antiPatterns: Optional[list[str]] = None     # qué evitar
    moodboardName: Optional[str] = None          # nombre del moodboard activo
    logo: Optional[LogoContext] = None           # datos del logo de marca
    style_manifest: Optional[StyleManifest] = None  # ADN visual del moodboard activo
    # --- Campos marketing-aware (opcionales; frontend puede empezar a enviarlos) ---
    cta: Optional[str] = None                    # CTA por defecto del cliente
    tagline: Optional[str] = None                # tagline/claim corto
    slogan: Optional[str] = None                 # slogan de marca
    bio: Optional[str] = None                    # bio/descripción breve
    valueProp: Optional[str] = None              # propuesta de valor
    productList: Optional[list[str]] = None      # productos/servicios destacados
    instagramHandle: Optional[str] = None        # handle IG para piezas Stories
    voice: Optional[list[str]] = None            # voz de marca (adjetivos: innovador, directo…)
    verticals: Optional[list[str]] = None        # líneas/áreas del cliente (ej. MEDIA, SALES, TECH)
    visualReferences: Optional[dict] = None      # referencias visuales: brands, contentStyle,
                                                 # instagramRefs, videoStyle, shootingStyle, avoid


class AgentContext(BaseModel):
    """Perfil del agente creativo seleccionado en el PromptNode."""
    id: str
    name: str
    role: Optional[str] = None
    specialty: Optional[str] = None
    description: Optional[str] = None
    tono: Optional[str] = None
    objetivo: Optional[str] = None


class AgentRunRequest(BaseModel):
    brief: str                                   # lo que escribió el usuario
    agent: AgentContext
    outputType: str = "image"                    # "image" | "video"
    client: Optional[ClientContext] = None
    moodboard: Optional[str] = None              # nombre del moodboard activo
    reference_images: Optional[list[str]] = None  # URLs http(s) upstream


class AgentRunResponse(BaseModel):
    refined_prompt: str
    agent_name: str
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# System prompt builder
# ---------------------------------------------------------------------------

def _build_system(req: AgentRunRequest) -> str:  # noqa: PLR0912,PLR0915
    """SHAQ — Senior Creative Director + Cinematographer + Social Media Strategist.

    Convierte cualquier brief (por mínimo que sea) en un prompt visual de producción
    optimizado para GPT-Image-2 y Seedance 2.0 de KIE.ai.

    SHAQ NO mejora briefs — los REEMPLAZA con prompts creados desde cero usando:
      • Conocimiento cinematográfico (composición, iluminación, óptica, color grading)
      • Conocimiento audiovisual (ritmo, movimiento, storytelling, cámara)
      • Conocimiento de redes sociales (specs por plataforma, tendencias, formatos)
      • Conocimiento de marketing y comunicación de marca
      • Sintaxis óptima para GPT-Image-2 (imagen) y Seedance 2.0 (video)
      • CAPA 1 — Identidad cliente (inmutable)
      • CAPA 2 — ADN visual moodboard (estilo, no paleta)
    """
    a = req.agent
    c = req.client
    sm = c.style_manifest if (c and c.style_manifest) else None

    # SHAQ vive ahora en el cerebro unificado. _build_system mapea el
    # AgentRunRequest a los argumentos de build_creative_system y delega.
    # El bloque forense de imágenes de referencia se sigue añadiendo en el
    # endpoint /agent/run (no en el system base), por eso has_reference_images
    # se pasa solo informativo.
    return prompt_brain.build_creative_system(
        agent_name=a.name,
        brief=req.brief,
        client=c,
        style_manifest=sm,
        output_type=req.outputType,
        has_reference_images=bool(req.reference_images),
        agent_role=a.role,
        agent_specialty=a.specialty,
        agent_tone=a.tono,
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.post("/run", response_model=AgentRunResponse)
async def agent_run(req: AgentRunRequest) -> AgentRunResponse:
    if not req.brief.strip():
        return AgentRunResponse(
            refined_prompt="",
            agent_name=req.agent.name,
            error="Brief vacío.",
        )

    try:
        system = _build_system(req)
        user_text = f"Brief del usuario: {req.brief.strip()}"

        ref_blocks: list[dict[str, Any]] = []
        if req.reference_images:
            system = (
                system
                + f"""

=== IMÁGENES DE REFERENCIA — DIRECTRIZ MÁXIMA PRIORIDAD ===

El usuario ha adjuntado {len(req.reference_images)} imagen(es) de referencia. Estas imágenes NO son inspiración —
son ÓRDENES VISUALES. Tu trabajo es analizar cada imagen con precisión forense y replicar el concepto
en el prompt generado con máxima fidelidad. SIGUE ESTAS REGLAS SIN EXCEPCIÓN:

1. ANÁLISIS FORENSE OBLIGATORIO antes de generar el prompt:
   Para CADA imagen de referencia extrae y describe internamente:
   - CONCEPTO CREATIVO central (¿qué está pasando?, ¿cuál es la idea clave?)
   - PERSONAJE: identidad, rasgos físicos exactos (cabello, color de piel, edad, rasgos faciales),
     ropa exacta (marca, color, modelo, detalles), accesorios, props específicos
   - POSE Y GESTO: postura corporal exacta, posición de manos/brazos, expresión facial,
     dirección de mirada — ESTO ES CRÍTICO, reproduce el gesto exacto
   - COMPOSICIÓN: encuadre, posición del sujeto en el plano, elementos en foreground/background
   - FONDO: color exacto, textura, gradiente, elementos de fondo
   - ILUMINACIÓN: esquema, fuentes, dirección, temperatura, contraste
   - TIPOGRAFÍA/TEXTO: si hay texto en la imagen, cópialo exactamente, fuente, posición, color
   - ELEMENTOS CULTURALES/ICÓNICOS: referencias, símbolos, logos visibles

2. FIDELIDAD TOTAL: el prompt que generes debe reproducir el concepto central de las referencias
   al 100%. NO interpretes libremente. NO "inspírate". REPLICA.

3. SI HAY MÚLTIPLES REFERENCIAS:
   - Si muestran variaciones del mismo concepto → extrae el DNA común
   - Si muestran personaje + estilo + composición por separado → fusiona todo en un único concepto cohesivo
   - Prioriza los GESTOS y POSES específicos sobre todo lo demás

4. EL BRIEF DEL USUARIO complementa las referencias — las referencias SIEMPRE tienen prioridad
   sobre cualquier interpretación libre del brief.

Las imágenes están adjuntas debajo. ANALÍZALAS ANTES DE ESCRIBIR UNA SOLA PALABRA DEL PROMPT.
"""
            )
            for url in req.reference_images:
                block = await _ref_image_block(url)
                if block is not None:
                    ref_blocks.append(block)

        if ref_blocks:
            settings = get_settings()
            anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)

            # ── PASO 1: Análisis forense de referencias (agente de visión dedicado) ──
            # SHAQ tiende a priorizar personaje y se salta el GESTO/POSE central.
            # Separar "entender las imágenes" de "generar el prompt" fuerza fidelidad real.
            vision_system = (
                "Eres un analista forense de imagenes creativas con expertise en publicidad, deporte y cultura popular. "
                "Tu UNICO trabajo: describir con maxima precision lo que ves. NO generes prompts. SOLO describe.\n\n"
                "REGLAS CRITICAS:\n"
                "1. PROPS ICONICOS: Si ves guante de lentejuelas cristales rhinestones u objeto cultural iconico, "
                "describelo EXACTAMENTE. NO lo llames mano desnuda. "
                "Ej: guante de lentejuelas cristal plateado estilo Michael Jackson cubre ojos y frente del sujeto "
                "dedos visibles brilla con reflejo studio. El prop iconico ES el concepto del ad.\n"
                "2. IDENTIDAD vs KIT: Separa quien ES [nombre real si reconoces] de que LLEVA PUESTO [uniforme exacto con escudo marca colores].\n"
                "3. TEXTOS: Copia LITERALMENTE todo texto caracter por caracter.\n"
                "4. MARCAS: Nombra TODOS los logos y escudos con posicion exacta.\n\n"
                "5. STORYBOARD/GRID: Si la imagen es un STORYBOARD (cuadricula de paneles numerados "
                "PANEL 01, PANEL 02...), DEBES describir CADA panel en orden numerico, uno por uno. "
                "Para cada panel indica: numero, tipo de plano (WS/MS/CU...), que ocurre, personajes, "
                "escenario, accion. Lista TODOS los paneles sin resumir ni saltarte ninguno. "
                "El numero total de paneles define el numero de escenas del video final.\n\n"
                "FORMATO por imagen (etiqueta Referencia N):\n"
                "CONCEPTO_CENTRAL: La idea iconica en una frase.\n"
                "PROP_ICONICO_ESTRELLA: El elemento mas inusual con descripcion MAXIMA. Si no hay escribe ninguno.\n"
                "PERSONAJE_IDENTIDAD: Nombre real si reconoces mas rasgos fisicos unicos.\n"
                "ROPA_EXACTA: Cada prenda con marca colores #hex escudo detalles.\n"
                "POSE_GESTO_PRECISO: Posicion EXACTA de CADA mano brazo dedo. Que parte del cuerpo cubre cada mano. Expresion facial. Angulo cabeza. EL GESTO ES LO MAS IMPORTANTE.\n"
                "TEXTO_LITERAL: Copia exacta de todo texto visible. Fuente. Color. Posicion.\n"
                "LOGOS_MARCAS: Todos los logos escudos nombre exacto posicion.\n"
                "FONDO: Color exacto #hex textura plano o profundidad.\n"
                "ILUMINACION: Key light fill temperatura contraste.\n"
                "COMPOSICION: Encuadre posicion sujeto espacio negativo.\n\n"
                "Si hay 2+ referencias agrega al final:\n"
                "SINTESIS - ORIGEN: que elemento viene de cada referencia.\n"
                "CONCEPTO_FUSIONADO: Como combinar exactamente todos los elementos. El prop iconico DEBE aparecer explicito.\n"
                "ELEMENTO_CRITICO_IRRENUNCIABLE: El elemento que NO puede faltar bajo ningun concepto."
            )

            vision_content: list[dict[str, Any]] = [
                {"type": "text", "text": f"Analiza estas {len(ref_blocks)} imagen(es) de referencia. Brief del usuario: {req.brief.strip()}"}
            ] + ref_blocks

            vision_resp = await anthropic.messages.create(
                model="claude-sonnet-4-6",  # Sonnet tiene mejor visión para análisis detallado
                max_tokens=3000,
                system=vision_system,
                messages=[{"role": "user", "content": vision_content}],
            )
            reference_analysis = "".join(b.text for b in vision_resp.content if b.type == "text").strip()
            logger.info("agent_run.vision_analysis len=%d preview=%s", len(reference_analysis), reference_analysis[:200])

            # ── PASO 2: SHAQ genera el prompt con el análisis verificado como instrucción concreta ──
            n_refs = len(ref_blocks)
            if req.outputType == "video":
                # Seedance 2.0: recibe first_frame + prompt de texto SOLAMENTE.
                # NO ve el resto de refs. SHAQ debe describir TODO desde cero.
                shaq_user = f"""{user_text}

=== ANÁLISIS FORENSE DEL STORYBOARD ({n_refs} imagen(es) — agente de visión) ===
{reference_analysis}

=== INSTRUCCIONES PARA PROMPT DE VÍDEO (Seedance 2.0) ===
Seedance 2.0 SOLO recibe: (1) tu prompt de texto + (2) una imagen de primer frame.
NO ve las demás referencias. Tu prompt DEBE describir TODO el contenido visual desde cero.

REGLAS OBLIGATORIAS:
1. PERSONAJES: describe rasgos físicos completos, ropa, estilo visual de animación.
   Si el análisis menciona personajes con derechos ajenos, traduce a descripción visual exacta.
   NO pierdas ningún rasgo visual — solo omite el nombre registrado.
2. ESCENA: entorno, objetos, paleta de colores, composición espacial.
3. CÁMARA: tipo de plano y movimiento (slow push-in, static, tracking, crane, orbit...).
4. ACCIÓN: qué ocurre exactamente en el clip (~4-8 segundos), qué hacen los personajes.
5. ESTILO VISUAL: si el storyboard es animado especifícalo: "2D animation", "cel-shaded",
   "stylized cartoon", "hand-drawn animation", etc. Es crítico para que Seedance replique el estilo.
6. CONTINUIDAD: si el brief pide transiciones, describe el movimiento continuo del clip.

EJEMPLOS DE TRADUCCIÓN COPYRIGHT-SAFE PARA VÍDEO (usa este nivel de detalle):
- "Rick Sanchez" → "eccentric elderly scientist, wild white spiky hair, unibrow, white lab coat,
  cynical expression, stocky build"
- "Morty Smith" → "nervous teenage boy, short brown hair, yellow shirt, blue jeans, wide anxious eyes"
- "Rick and Morty en el sofá" → "2D animated cartoon style with vibrant flat colors and cel-shading.
  Opening frame: an eccentric white-haired elderly scientist and a nervous teenage boy with yellow shirt
  seated together on a living room couch, warm interior light, family home environment"
- "nave de Rick" → "retro-futuristic spacecraft cockpit interior, colorful glowing instruments and
  control panels, sci-fi green portal energy effects, stylized cartoon environment"

REGLA STORYBOARD (CRITICA): Si el analisis describe un STORYBOARD de varios paneles/escenas, tu prompt
DEBE recorrer TODAS las escenas EN ORDEN como UN UNICO video continuo, con transiciones entre ellas
(cut, match-cut, wipe, dissolve). El storyboard define la secuencia OBLIGATORIA: el numero de escenas
del video = numero de paneles del storyboard. IGNORA cualquier parte del brief que sugiera una sola
escena ('una escena', 'un caso', 'un momento') — el storyboard MANDA sobre el texto del brief.
Reparte la duracion entre todas las escenas (ej. 6 paneles en 15s = ~2.5s cada uno).

FORMATO: un párrafo en inglés, descripción cinemática completa para Seedance 2.0.
Devuelve SOLO el prompt, sin explicaciones."""
            else:
                # Para imagen: brief de composición/fusión con referencias que el modelo VE
                shaq_user = f"""{user_text}

=== ANALISIS FORENSE DE LAS {n_refs} REFERENCIAS (agente de vision) ===
{reference_analysis}

=== COMO FUNCIONA LA GENERACION (LEE ESTO) ===
El modelo de imagen (nano-banana-pro / Gemini 3 Pro Image) RECIBIRA LAS {n_refs} IMAGENES DE REFERENCIA
REALES como input visual, ademas de tu prompt. NO estas describiendo desde cero — estas dando
INSTRUCCIONES DE COMPOSICION/FUSION sobre imagenes que el modelo YA VE. Por eso:

REGLAS DE FUSION (OBLIGATORIAS):
1. Tu prompt es un BRIEF DE COMPOSICION, no una descripcion text-to-image. Di al modelo COMO combinar
   las referencias, refiriendote a sus elementos: "the person from the reference", "the exact glove
   shown in the reference", "the layout and typography from the reference ad".
2. PRESERVA EXACTO, NUNCA SUSTITUYAS: si una referencia muestra un guante de cristales/lentejuelas
   estilo Michael Jackson, el prompt debe decir "preserve the EXACT crystal rhinestone sequined glove
   from the reference, do not replace it with a plain or branded glove". JAMAS conviertas un elemento
   de referencia en una version generica o de marca. El elemento de la referencia ES sagrado.
3. IDENTIDAD FIJA: la cara, rasgos, piel, pelo y identidad de la persona de la referencia se mantienen
   IDENTICOS. "Keep the exact same person, same face, same identity from the reference, unchanged."
4. KIT/ROPA: usa la ropa EXACTA que indica el analisis (con su escudo/federacion correctos), no la
   inventes ni la cambies por otra seleccion.
5. FUSION REAL: combina lo mejor de cada referencia en UNA pieza nueva y cohesiva (identidad de una,
   prop iconico de otra, layout/tipografia/fondo de otra). Alinea luz, perspectiva y color entre ellas.
6. TEXTO: reproduce el TEXTO_LITERAL exacto, misma fuente serif, misma posicion.
7. El ELEMENTO_CRITICO_IRRENUNCIABLE del analisis DEBE estar presente, descrito explicitamente.

POLITICA DE CONTENIDO (OBLIGATORIO — el modelo Gemini RECHAZA y bloquea si no cumples):
- NUNCA nombres personas reales, famosos, atletas o celebridades por su nombre (ej: no escribas Lamine Yamal,
  Michael Jackson, ni ningun nombre real). Describelos solo por atributos visuales.
- NUNCA uses palabras: identity, same face, face swap, deepfake, exact same person, likeness, minor, child, kid, teen.
- En su lugar usa: "the male athlete shown in the reference images", "maintain visual consistency with the reference subject",
  "a young adult man (20s) with [rasgos]". Trata al sujeto como un MODELO ANONIMO adulto.
- Para el prop iconico, describelo por su forma/material ("a crystal rhinestone sequined glove") SIN nombrar a su dueno famoso.
- Para el kit deportivo, describelo por colores y diseno del escudo, sin afirmar que pertenece a una federacion/persona real.
- El objetivo es una pieza CREATIVA ORIGINAL inspirada en las referencias, no una copia de identidad de una persona real.

FORMATO DE SALIDA: un solo parrafo en ingles, instrucciones de composicion claras y especificas,
empezando por el concepto y luego cada elemento con su origen (referencia) y la orden de preservarlo.
Devuelve SOLO el prompt, sin explicaciones."""

            resp = await anthropic.messages.create(
                model=settings.claude_model,
                max_tokens=max(settings.claude_max_tokens, 4096),
                system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],  # prompt caching
                messages=[{"role": "user", "content": shaq_user}],
            )
            refined = "".join(b.text for b in resp.content if b.type == "text")
        else:
            claude = _get_claude()
            if req.outputType == "video":
                # Sin referencias: augmentar user_text con instrucciones Seedance + traducción copyright.
                # Sin este bloque SHAQ cae en el ejemplo del storyboard_block (city-skyline corporate).
                _video_user = f"""{user_text}

=== INSTRUCCIONES PARA PROMPT DE VÍDEO (Seedance 2.0) ===
Seedance 2.0 recibe SOLO texto + first_frame. Genera un prompt cinemático completo:
1. PERSONAJES: rasgos físicos, ropa, estilo visual (2D animation, cel-shaded, photorealistic...)
2. ESCENA: entorno, paleta de colores, objetos, composición
3. CÁMARA: tipo de plano + movimiento (slow push-in, static, tracking, crane orbit...)
4. ACCIÓN: qué ocurre exactamente en el clip (~4-8s)
5. ESTILO VISUAL: si el brief pide animación/cartoon escríbelo explícitamente: '2D animation style'

COPYRIGHT TRANSLATION (OBLIGATORIO):
Si el brief menciona personajes o marcas con IP ajena, DESCRÍBELOS VISUALMENTE.
NO los reemplaces por personajes genéricos no relacionados (como 'city skyline' o 'young professional').
El usuario QUIERE ese contenido concreto, sólo expresado sin el nombre registrado.
Ejemplos:
- 'Rick and Morty' -> 'eccentric elderly scientist with wild white spiky hair, unibrow, white lab coat
   + nervous teenage boy with short brown hair, yellow shirt, blue jeans. 2D animated cartoon style,
   vibrant flat colors, cel-shading'
- 'Spider-Man' -> 'agile superhero in tight red-and-blue web-patterned suit, full-face mask'
Preserva TODOS los rasgos, escena y estilo. Solo omite el nombre registrado.

FORMATO: un párrafo en inglés. Devuelve SOLO el prompt, sin explicaciones."""
                final_user = _video_user
            else:
                final_user = user_text
            refined = await claude.reason(
                system=system,
                cache_system=True,  # prompt caching del system grande de SHAQ
                user=final_user,
                endpoint="/agent/run",
                node_type="PromptNode",
                client_name=req.client.name if req.client else "",
                agent_name=req.agent.name if req.agent else "",
            )

        refined = refined.strip().strip('"').strip("'")

        return AgentRunResponse(
            refined_prompt=refined,
            agent_name=req.agent.name,
        )

    except Exception as e:
        # Fallback: devuelve el brief original para no romper el flujo
        return AgentRunResponse(
            refined_prompt=req.brief,
            agent_name=req.agent.name,
            error=str(e),
        )



# ---------------------------------------------------------------------------
# Batch endpoint
# ---------------------------------------------------------------------------

BATCH_MAX = 30


class BatchRunRequest(BaseModel):
    brief: str                              # brief maestro del usuario
    count: int = 1                          # cuántos prompts generar (1-30)
    agent: AgentContext
    outputType: str = "image"               # "image" | "video"
    client: Optional[ClientContext] = None


class BatchPromptItem(BaseModel):
    index: int
    prompt: str


class BatchRunResponse(BaseModel):
    prompts: list[BatchPromptItem]
    agent_name: str
    count_requested: int
    count_generated: int
    error: Optional[str] = None


def _build_batch_system(req: BatchRunRequest) -> str:
    """System prompt para generación de MÚltiples prompts únicos."""
    # Reutilizar el contexto del agente/cliente
    single_req = AgentRunRequest(
        brief=req.brief,
        agent=req.agent,
        outputType=req.outputType,
        client=req.client,
    )
    base = _build_system(single_req)
    count = min(req.count, BATCH_MAX)

    batch_instructions = [
        "",
        "=== MODO BATCH ===",
        f"El usuario quiere {count} prompts DIFERENTES a partir del mismo brief.",
        "REGLAS BATCH:",
        f"- Genera exactamente {count} prompts numerados.",
        "- Cada prompt debe ser visualmente diferente (encuadre, luz, composición, angulo, estilo distinto).",
        "- Formato de respuesta ESTRICTO (sin texto extra, sin explicaciones):",
        "  1. <prompt uno>",
        "  2. <prompt dos>",
        "  ...",
        f"  {count}. <prompt {count}>",
        "- Cada prompt en una sola línea, en inglés, completo y autocontenido.",
        "- Empieza directamente con '1.' sin prólogo.",
    ]
    return base + "\n".join(batch_instructions)


def _parse_batch_response(text: str, expected: int) -> list[BatchPromptItem]:
    """Parsea la respuesta numerada del agente en una lista de BatchPromptItem."""
    items: list[BatchPromptItem] = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line:
            continue
        # Acepta: "1. prompt", "1) prompt", "1 prompt"
        import re
        m = re.match(r'^(\d+)[.)\s]\s*(.*)', line)
        if m:
            idx = int(m.group(1))
            prompt = m.group(2).strip()
            if prompt:
                items.append(BatchPromptItem(index=idx, prompt=prompt))
    # Fallback: si no parsea bien, al menos devuelve lo que hay
    if not items and text.strip():
        items.append(BatchPromptItem(index=1, prompt=text.strip()))
    return items[:expected]


@router.post("/batch_run", response_model=BatchRunResponse)
async def agent_batch_run(req: BatchRunRequest) -> BatchRunResponse:
    count = max(1, min(req.count, BATCH_MAX))

    if not req.brief.strip():
        return BatchRunResponse(
            prompts=[],
            agent_name=req.agent.name,
            count_requested=count,
            count_generated=0,
            error="Brief vacío.",
        )

    try:
        claude = _get_claude()
        system = _build_batch_system(BatchRunRequest(
            brief=req.brief,
            count=count,
            agent=req.agent,
            outputType=req.outputType,
            client=req.client,
        ))
        user_msg = (
            f"Brief: {req.brief.strip()}\n\n"
            f"Genera {count} prompts visuales diferentes basados en este brief."
        )

        raw = await claude.reason(
            system=system,
            user=user_msg,
            endpoint="/agent/batch_run",
            node_type="PromptNode",
            client_name=req.client.name if req.client else "",
            agent_name=req.agent.name if req.agent else "",
        )
        prompts = _parse_batch_response(raw, count)

        return BatchRunResponse(
            prompts=prompts,
            agent_name=req.agent.name,
            count_requested=count,
            count_generated=len(prompts),
        )

    except Exception as e:
        # Fallback: un solo item con el brief original
        return BatchRunResponse(
            prompts=[BatchPromptItem(index=1, prompt=req.brief)],
            agent_name=req.agent.name,
            count_requested=count,
            count_generated=1,
            error=str(e),
        )


# ---------------------------------------------------------------------------
# Build-profile — genera perfil de agente desde wizard usando Claude
# ---------------------------------------------------------------------------

class BuildProfileRequest(BaseModel):
    answers: dict
    suggested_name: Optional[str] = None


class BuildProfileResponse(BaseModel):
    name: str
    role: str
    specialty: str
    description: str
    tono: str
    objetivo: str
    sector: str
    tagline: str
    style: list[str]
    avoid: list[str]
    accent: str
    error: Optional[str] = None


_PROFILE_SYSTEM = """Eres un arquitecto de agentes IA creativos para equipos de marketing.
Construye el perfil profesional completo de un agente IA desde las respuestas de un wizard.
Devuelve SOLO JSON válido, sin bloques de código ni texto extra.

CAMPOS OBLIGATORIOS:
- name: nombre corto memorable (usa el sugerido si es bueno, sino crea uno mejor, máx 2 palabras).
- role: cargo profesional específico (ej: "Director Creativo IA · Fashion" o "Estratega Digital B2B").
- specialty: 2-4 palabras que definen su nicho.
- description: 2-3 frases densas sobre QUÉ hace, CÓMO piensa y PARA QUIÉN trabaja. Sin relleno.
- tono: adjetivos de voz (ej: "Directo, provocador y aspiracional. Sin relleno corporativo.").
- objetivo: KPI principal + CTA (ej: "Engagement orgánico · CTA: Síguenos").
- sector: industria principal (1-3 palabras).
- tagline: frase memorable del agente máx 8 palabras (vacío si no procede).
- style: array 3-5 tags de estilo visual cortos.
- avoid: array 3-5 anti-patrones que nunca hace.
- accent: color hex de la personalidad del agente. Elige de: #8B5CF6 #EC4899 #6366F1 #10B981 #F59E0B #EF4444 #06B6D4 #F97316"""


_PROFILE_ACCENTS = ["#8B5CF6","#EC4899","#6366F1","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"]


@router.post("/build-profile", response_model=BuildProfileResponse)
async def build_profile(req: BuildProfileRequest) -> BuildProfileResponse:
    import json as _json, random as _random
    answers = req.answers or {}
    name_hint = req.suggested_name or answers.get("agent_name") or ""
    if isinstance(name_hint, list):
        name_hint = str(name_hint[0]) if name_hint else ""

    def _fallback() -> BuildProfileResponse:
        return BuildProfileResponse(
            name=str(name_hint or "Aria").strip()[:40] or "Aria",
            role="Agente Creativo IA",
            specialty="Contenido digital",
            description="Agente IA para creación de contenido visual y copy adaptado a la marca y audiencia objetivo.",
            tono="Profesional y directo",
            objetivo="Engagement · CTA: Descúbrelo",
            sector="Marketing Digital",
            tagline="",
            style=["editorial","clean","bold"],
            avoid=["stock photos","lenguaje corporativo"],
            accent=_random.choice(_PROFILE_ACCENTS),
        )

    user_msg = (
        f"Nombre sugerido: {name_hint or '(sin nombre — crea uno)'}\n"
        f"Respuestas del wizard: {answers}\n\n"
        "Construye el perfil JSON completo."
    )
    try:
        settings = get_settings()
        anthropic = AsyncAnthropic(api_key=settings.anthropic_api_key)
        resp = await anthropic.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=_PROFILE_SYSTEM,
            messages=[{"role": "user", "content": user_msg}],
        )
        raw = "".join(b.text for b in resp.content if b.type == "text").strip()
        if raw.startswith("```"):
            raw = raw.strip("`").lstrip("json").strip()
        data = _json.loads(raw)

        def _lst(v, fb=None):
            if isinstance(v, list): return [str(x) for x in v]
            if isinstance(v, str) and v: return [s.strip() for s in v.split(",") if s.strip()]
            return fb or []

        return BuildProfileResponse(
            name=str(data.get("name") or name_hint or "Aria").strip()[:40],
            role=str(data.get("role") or "Agente Creativo IA").strip()[:80],
            specialty=str(data.get("specialty") or "").strip()[:80],
            description=str(data.get("description") or "").strip()[:400],
            tono=str(data.get("tono") or "").strip()[:120],
            objetivo=str(data.get("objetivo") or "").strip()[:120],
            sector=str(data.get("sector") or "").strip()[:60],
            tagline=str(data.get("tagline") or "").strip()[:80],
            style=_lst(data.get("style"), ["editorial"]),
            avoid=_lst(data.get("avoid"), ["stock photos"]),
            accent=str(data.get("accent") or _PROFILE_ACCENTS[0]).strip(),
        )
    except Exception as exc:
        logger.exception("build_profile.failed error=%s", exc)
        return _fallback()