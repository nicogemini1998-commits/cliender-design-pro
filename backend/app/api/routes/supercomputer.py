"""Endpoints del Supercomputer.

POST /chat   — respuesta única JSON (compatibilidad)
POST /stream — Server-Sent Events con un evento por nodo (producción)
"""
from __future__ import annotations

import json
import logging
import httpx
from typing import Any, AsyncGenerator

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.routes.moodboard import get_active_moodboard
from app.schemas.moodboard import StyleManifest
from app.core.config import ALLOWED_KID_AI_MODELS, get_settings
from app.graph.builder import build_graph
from app.graph.state import init_state
from app.services import storyboard_director
from app.tools.kid_ai_tool import call_kid_ai_api


router = APIRouter(prefix="/chat", tags=["supercomputer"])
logger = logging.getLogger(__name__)
_graph = build_graph()


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str
    pinned_model: str | None = None
    moodboard_id: str | None = None
    client_context: dict[str, Any] | None = None  # brand DNA del cliente seleccionado
    reference_images: list[str] | None = None  # URLs (http/https o data:) subidas por el usuario en el Supercomputer
    ref_manifest: dict[str, Any] | None = None  # Manifest pre-calculado de las refs del Supercomputer (paleta, mood, etc.)


class ChatResponse(BaseModel):
    cinematography: dict | None = None
    artifact: dict | None = None
    critic: dict | None = None
    node_status: dict
    errors: list[str]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_NODE_LABELS: dict[str, str] = {
    "master_director": "MasterDirector",
    "scriptwriter": "Scriptwriter",
    "cinematographer": "Cinematographer",
    "production": "Production",
    "critic": "Critic",
}

_NODE_START_MSGS: dict[str, str] = {
    "master_director": "Analizando petición y contexto del cliente…",
    "scriptwriter": "Generando estrategia creativa…",
    "cinematographer": "Construyendo prompt técnico…",
    "production": "Generando asset con IA…",
    "critic": "Evaluando calidad del resultado…",
}


def _node_done_message(node: str, output: dict[str, Any]) -> str:
    """Construye un mensaje legible a partir del output de cada nodo."""
    if node == "master_director":
        strategy = output.get("creative_strategy") or {}
        intent = strategy.get("creative_intent", "")
        mk = strategy.get("media_kind", "image")
        return f"media_kind={mk} · {intent[:80]}" if intent else f"Plan listo · media_kind={mk}"

    if node == "scriptwriter":
        strategy = output.get("creative_strategy") or {}
        tone = strategy.get("tone", "")
        mood = strategy.get("mood", "")
        client = strategy.get("client_name", "")
        parts = [p for p in [client, tone, mood] if p]
        return "Estrategia: " + " · ".join(parts) if parts else "Estrategia creativa lista."

    if node == "cinematographer":
        cine = output.get("cinematography") or {}
        model_id = cine.get("model_id", "")
        rationale = cine.get("rationale", "")
        return f"Modelo: {model_id} · {rationale[:60]}" if model_id else "Prompt técnico listo."

    if node == "production":
        artifact = output.get("artifact") or {}
        errors = output.get("errors") or []
        if artifact.get("url"):
            stub = " [STUB — sin KIE_API_KEY]" if artifact.get("stub") else ""
            return f"Artefacto recibido{stub} · model={artifact.get('model_id', '')}"
        if errors:
            return f"Error en producción: {errors[-1][:80]}"
        return "Producción completada."

    if node == "critic":
        critic = output.get("critic") or {}
        approved = critic.get("approved", False)
        score = critic.get("score", 0.0)
        issues = critic.get("issues") or []
        if approved:
            return f"Aprobado · score={score:.2f}"
        return f"Rechazado · score={score:.2f} · {issues[0][:60] if issues else ''}"

    return "Completado."


async def _build_initial_state(req: ChatRequest):
    pinned = req.pinned_model
    if pinned and pinned not in ALLOWED_KID_AI_MODELS:
        pinned = None

    active_mb = await get_active_moodboard()
    base_manifest = active_mb.manifest if active_mb else None
    # Si el frontend pasó un ref_manifest (análisis previo de las refs del Supercomputer), priorizarlo
    manifest = base_manifest
    if req.ref_manifest:
        try:
            manifest = StyleManifest(
                moodboard_id="user-refs",
                color_palette=req.ref_manifest.get("color_palette") or [],
                lighting_style=req.ref_manifest.get("lighting_style") or "",
                camera_lens_feel=req.ref_manifest.get("camera_lens_feel") or "",
                character_traits=[],
                composition_rules=[],
                mood_keywords=req.ref_manifest.get("mood_keywords") or [],
                master_style_prompt=req.ref_manifest.get("master_style_prompt") or "",
                negative_prompt="",
                consistency_score=float(req.ref_manifest.get("consistency_score") or 0.7),
            )
        except Exception:
            manifest = base_manifest
    # (manifest ya resuelto arriba: ref_manifest > moodboard activo)
    # Refs: priorizar las subidas por el usuario; si no, usar las del moodboard activo.
    user_refs = [u for u in (req.reference_images or []) if u and isinstance(u, str)]
    ref_images = user_refs if user_refs else ([img.url for img in active_mb.images] if active_mb else [])
    active_id = active_mb.id if active_mb else None

    return init_state(
        req.message,
        pinned_model=pinned,
        active_style_manifest=manifest,
        active_reference_images=ref_images,
        active_moodboard_id=active_id,
        client_context=req.client_context,
    )


# ---------------------------------------------------------------------------
# POST /chat — respuesta única (compatibilidad)
# ---------------------------------------------------------------------------

@router.post("", response_model=ChatResponse)
async def chat(req: ChatRequest) -> ChatResponse:
    initial = await _build_initial_state(req)
    final = await _graph.ainvoke(initial)
    return ChatResponse(
        cinematography=final.get("cinematography"),
        artifact=final.get("artifact"),
        critic=final.get("critic"),
        node_status=final.get("node_status") or {},
        errors=final.get("errors") or [],
    )


# ---------------------------------------------------------------------------
# POST /stream — Server-Sent Events por nodo
# ---------------------------------------------------------------------------

@router.post("/stream")
async def stream_chat(req: ChatRequest):
    initial = await _build_initial_state(req)

    async def event_generator() -> AsyncGenerator[str, None]:
        accumulated: dict[str, Any] = {}

        def emit(payload: dict) -> str:
            return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        try:
            # Primer evento: master_director arranca
            yield emit({"type": "node_start", "node": "master_director",
                        "label": "MasterDirector",
                        "message": _NODE_START_MSGS["master_director"]})

            async for chunk in _graph.astream(initial, stream_mode="updates"):
                for node_name, node_output in chunk.items():
                    accumulated.update(node_output)

                    if node_name == "bump_retries":
                        yield emit({"type": "retry", "node": "critic", "label": "Critic",
                                    "message": "Refinando… reintentando cinematographer."})
                        yield emit({"type": "node_start", "node": "cinematographer",
                                    "label": "Cinematographer",
                                    "message": "Mejorando prompt técnico (reintento)…"})
                        continue

                    ns = (node_output.get("node_status") or {}).get(node_name, "done")
                    message = _node_done_message(node_name, node_output)
                    label = _NODE_LABELS.get(node_name, node_name)

                    yield emit({"type": "node_done", "node": node_name, "label": label,
                                "status": ns, "message": message, "data": node_output})

                    # Emitir node_start del siguiente nodo
                    next_node = node_output.get("next_node")
                    if next_node and next_node in _NODE_LABELS:
                        yield emit({"type": "node_start", "node": next_node,
                                    "label": _NODE_LABELS[next_node],
                                    "message": _NODE_START_MSGS.get(next_node, "Procesando…")})

            # Evento final con el artefacto y el resultado del crítico
            yield emit({
                "type": "complete",
                "artifact": accumulated.get("artifact"),
                "critic": accumulated.get("critic"),
                "node_status": accumulated.get("node_status") or {},
                "errors": accumulated.get("errors") or [],
            })

        except Exception as exc:  # noqa: BLE001
            yield emit({"type": "error", "message": str(exc)})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",       # evita buffering en nginx
            "Connection": "keep-alive",
        },
    )



# ---------------------------------------------------------------------------
# POST /chat/render — ensambla escenas en un vídeo final (servicio Remotion)
# ---------------------------------------------------------------------------

class RenderScene(BaseModel):
    url: str                              # URL pública de la escena (imagen o vídeo) ya generada
    kind: str | None = None               # "image" | "video" (si None, Remotion lo deduce por extensión)
    duration_s: float | None = None      # duración en segundos (default 5s)
    caption: str | None = None           # subtítulo opcional sobre la escena
    muted: bool = True                    # silenciar audio de la escena
    transition: str | None = None         # transición de ENTRADA: dissolve|fade|slide|slideup|zoom|whip|wipe|glitch|cut
    transition_duration_s: float | None = None  # duración del solape de la transición (override opcional)
    kenburns: str | None = None           # movimiento de cámara en imágenes: zoomin|zoomout|panleft|panright|diagonal


class RenderBrand(BaseModel):
    name: str | None = None
    logoUrl: str | None = None           # URL del logo para intro/outro/overlay
    accent: str | None = None            # color de acento (hex) para captions/marca


class RenderStyle(BaseModel):
    """Estilo cinematográfico global del montaje (Cinematic Engine v2)."""
    look: str | None = None               # cine|golden|noir|vintage|clean|none
    grain: float | None = None            # intensidad film grain 0..1 (default 0.18)
    vignette: float | None = None         # intensidad vignette 0..1 (default 0.32)
    letterbox: bool | None = None         # barras cinemascope (default True)
    sfx: bool | None = None               # efectos de sonido en transiciones (default True)
    branding: bool | None = None          # intro/outro de marca (default False — solo contenido del usuario)
    autosubs: bool | None = None          # subtítulos automáticos: transcribe la voz de los vídeos (faster-whisper)
    language: str | None = None           # idioma para la transcripción (None = autodetectar)


class RenderRequest(BaseModel):
    scenes: list[RenderScene]
    brand: RenderBrand | None = None
    style: RenderStyle | None = None
    fps: int = 30
    width: int = 1080
    height: int = 1920


class RenderResponse(BaseModel):
    url: str
    duration_s: float
    fps: int
    width: int
    height: int
    ms: int


@router.post("/render", response_model=RenderResponse)
async def render_video(req: RenderRequest) -> RenderResponse:
    """Recibe N escenas (URLs ya generadas) y las ensambla en un mp4 vertical
    con intro/outro de marca + captions via el servicio Remotion (red interna).
    """
    settings = get_settings()
    fps = req.fps or 30
    scenes = [
        {
            "url": s.url,
            "kind": s.kind,
            "durationInFrames": max(1, int(round((s.duration_s or 5.0) * fps))),
            "caption": s.caption or "",
            "muted": bool(s.muted),
            "transition": (s.transition or None),
            "transitionDurationInFrames": (
                max(1, int(round(s.transition_duration_s * fps)))
                if s.transition_duration_s and s.transition_duration_s > 0
                else None
            ),
            "kenburns": (s.kenburns or None),
        }
        for s in req.scenes
        if s.url and isinstance(s.url, str)
    ]
    if not scenes:
        raise HTTPException(status_code=400, detail="scenes vacío: se requiere al menos 1 escena con url")

    # ── Subtítulos automáticos: transcribir la voz de cada escena de VÍDEO ──
    # Reutiliza el pipeline STT local de /video/transcribe (faster-whisper).
    # Los segments [{start,end,text}] van a Remotion, que los pinta sincronizados.
    # Si un vídeo no tiene voz → segments vacío y cae al caption manual si lo hay.
    if req.style and req.style.autosubs:
        import asyncio as _asyncio
        import os as _os
        import shutil as _shutil
        import tempfile as _tempfile

        from app.api.routes.video import _download, _run_ffmpeg, _transcribe_file

        async def _segments_for(url: str) -> list[dict[str, Any]]:
            tmp = _tempfile.mkdtemp(prefix="cdpro-movie-stt-")
            vid_p = _os.path.join(tmp, "in.mp4")
            wav_p = _os.path.join(tmp, "a.wav")
            try:
                await _download(url, vid_p)
                await _asyncio.to_thread(
                    _run_ffmpeg, ["ffmpeg", "-y", "-i", vid_p, "-vn", "-ac", "1", "-ar", "16000", wav_p], 300
                )
                res = await _asyncio.to_thread(_transcribe_file, wav_p, (req.style.language or None))
                return [
                    {"start": float(s["start"]), "end": float(s["end"]), "text": str(s["text"]).strip()}
                    for s in res.get("segments", [])
                    if str(s.get("text", "")).strip()
                ]
            except Exception as e:  # noqa: BLE001 — sin voz o fallo STT: la película sigue sin subs en esa escena
                logger.warning("movie.autosubs %s: %s", url[:80], e)
                return []
            finally:
                _shutil.rmtree(tmp, ignore_errors=True)

        for sc in scenes:
            u = str(sc["url"]).split("?")[0].lower()
            is_video = (sc.get("kind") or "").lower() == "video" or u.endswith((".mp4", ".mov", ".webm", ".m4v"))
            if is_video:
                segs = await _segments_for(sc["url"])
                if segs:
                    sc["segments"] = segs

    payload: dict[str, Any] = {
        "scenes": scenes,
        "brand": (req.brand.model_dump(exclude_none=True) if req.brand else {}),
        "style": (req.style.model_dump(exclude_none=True) if req.style else {}),
        "fps": fps,
        "width": req.width,
        "height": req.height,
    }

    base = settings.remotion_url.rstrip("/")
    try:
        # render de vídeo puede tardar: timeout amplio (10 min)
        async with httpx.AsyncClient(timeout=600) as client:
            r = await client.post(f"{base}/render", json=payload)
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Remotion inaccesible: {exc!s}") from exc

    if r.status_code != 200:
        raise HTTPException(status_code=502, detail=f"Remotion error {r.status_code}: {r.text[:200]}")

    data = r.json()
    out_fps = int(data.get("fps") or fps)
    frames = int(data.get("durationInFrames") or 0)
    return RenderResponse(
        url=str(data.get("url") or ""),
        duration_s=round(frames / out_fps, 2) if out_fps else 0.0,
        fps=out_fps,
        width=int(data.get("width") or req.width),
        height=int(data.get("height") or req.height),
        ms=int(data.get("ms") or 0),
    )


# ---------------------------------------------------------------------------
# POST /chat/storyboard/stream — VÍDEO MULTI-ESCENA desde un storyboard
# ---------------------------------------------------------------------------
#
# El usuario sube una imagen de referencia que explica la secuencia escena-por-
# escena y un brief ("vídeo de 20s siguiendo esta historia"). El sistema:
#   1. Director (Claude Vision) lee la referencia → plan de N escenas.
#   2. Por escena: genera el prompt KIE perfecto (marca + ADN).
#   3. Por escena: keyframe ENCADENADO (keyframe previo + refs globales como
#      referencia → continuidad de personaje/estética). Si la escena es vídeo,
#      anima el keyframe con seedance; si es imagen, Remotion la mueve (Ken Burns).
#   4. Une todo con Remotion en orden → vídeo final.
# Emite progreso por SSE: storyboard_ready · scene_prompt · scene_done · render_done · complete

# Aspect ratio → dimensiones de render (vertical por defecto para redes)
_AR_DIMS: dict[str, tuple[int, int]] = {
    "9:16": (1080, 1920),
    "16:9": (1920, 1080),
    "1:1": (1080, 1080),
    "4:5": (1080, 1350),
}


class StoryboardRequest(BaseModel):
    message: str                                       # brief del usuario
    reference_images: list[str]                        # storyboard + refs de personaje (http/data:)
    total_duration_s: int = 20                         # duración objetivo del vídeo
    client_context: dict[str, Any] | None = None       # ADN de marca del cliente seleccionado
    ref_manifest: dict[str, Any] | None = None         # manifest de estilo (paleta, mood) opcional
    fps: int = 30


async def _remotion_render(
    scenes: list[dict[str, Any]],
    brand: dict[str, Any],
    fps: int,
    width: int,
    height: int,
) -> dict[str, Any]:
    """Llama al servicio Remotion interno para ensamblar las escenas. Devuelve el JSON crudo."""
    settings = get_settings()
    base = settings.remotion_url.rstrip("/")
    payload = {"scenes": scenes, "brand": brand or {}, "fps": fps, "width": width, "height": height}
    async with httpx.AsyncClient(timeout=600) as client:
        r = await client.post(f"{base}/render", json=payload)
    if r.status_code != 200:
        raise RuntimeError(f"Remotion error {r.status_code}: {r.text[:200]}")
    return r.json()


@router.post("/storyboard/stream")
async def storyboard_stream(req: StoryboardRequest):
    """Orquesta un vídeo multi-escena a partir de un storyboard de referencia (SSE)."""

    # Resolver manifest de estilo (ref_manifest del frontend > moodboard activo)
    initial = await _build_initial_state(
        ChatRequest(
            message=req.message,
            client_context=req.client_context,
            reference_images=req.reference_images,
            ref_manifest=req.ref_manifest,
        )
    )
    style_manifest = initial.get("active_style_manifest")
    global_refs = [u for u in (req.reference_images or []) if u and isinstance(u, str)]
    fps = req.fps or 30

    async def gen() -> AsyncGenerator[str, None]:
        def emit(payload: dict) -> str:
            return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        try:
            # ---- 1. Director lee el storyboard ----
            yield emit({"type": "director_start",
                        "message": "Leyendo el storyboard de referencia escena por escena…"})
            plan = await storyboard_director.read_storyboard(
                brief=req.message,
                reference_images=global_refs,
                total_duration_s=req.total_duration_s,
                client_context=req.client_context,
                aspect_ratio_hint="9:16",
            )
            ar = plan["aspect_ratio"]
            width, height = _AR_DIMS.get(ar, (1080, 1920))
            yield emit({"type": "storyboard_ready", "plan": plan,
                        "message": f"{len(plan['scenes'])} escenas · {ar} · {plan['total_duration_s']}s"})

            # ---- 2-3. Por escena: prompt → keyframe encadenado → (vídeo|imagen) ----
            rendered_scenes: list[dict[str, Any]] = []
            scene_artifacts: list[dict[str, Any]] = []
            prev_keyframe: str | None = None

            for scene in plan["scenes"]:
                idx = scene["index"]
                yield emit({"type": "scene_start", "index": idx, "title": scene["title"],
                            "media_kind": scene["media_kind"],
                            "message": f"Escena {idx}/{len(plan['scenes'])} · {scene['title']}"})

                # refs para el keyframe: refs globales + keyframe previo (continuidad)
                keyframe_refs = [*global_refs] + ([prev_keyframe] if prev_keyframe else [])
                has_ref = bool(keyframe_refs)

                # 2. prompt perfecto de la escena
                sp = await storyboard_director.build_scene_prompt(
                    scene=scene, brief=req.message,
                    client_context=req.client_context,
                    style_manifest=style_manifest, has_reference=has_ref,
                )
                yield emit({"type": "scene_prompt", "index": idx,
                            "model_id": sp["model_id"], "media_kind": sp["media_kind"],
                            "prompt": sp["prompt"][:400]})

                # 3a. keyframe (imagen) encadenado — nano-banana-edit acepta refs (personas reales)
                try:
                    from app.core.config import KidAIImageModel
                    kf_model = (KidAIImageModel.NANO_BANANA_EDIT.value if has_ref
                                else KidAIImageModel.GPT_IMAGENES_2.value)
                    kf = await call_kid_ai_api(
                        media_kind="image", model_id=kf_model,
                        prompt=sp["prompt"],
                        parameters={"aspect_ratio": ar},
                        reference_images=keyframe_refs or None,
                    )
                    keyframe_url = kf.get("url", "")
                except Exception as exc:  # noqa: BLE001
                    yield emit({"type": "scene_error", "index": idx,
                                "message": f"keyframe falló: {exc!s}"[:160]})
                    continue

                if not keyframe_url:
                    yield emit({"type": "scene_error", "index": idx, "message": "keyframe sin URL"})
                    continue

                scene_url = keyframe_url
                scene_kind = "image"

                # 3b. si la escena es vídeo, anima el keyframe con seedance
                if scene["media_kind"] == "video":
                    motion = sp.get("motion_prompt") or sp["prompt"]
                    try:
                        vid = await call_kid_ai_api(
                            media_kind="video", model_id=sp["model_id"],  # seedance-2.0
                            prompt=motion,
                            parameters={"aspect_ratio": ar, "duration": int(round(scene["duration_s"]))},
                            reference_images=[keyframe_url],
                        )
                        if vid.get("url"):
                            scene_url = vid["url"]
                            scene_kind = "video"
                    except Exception as exc:  # noqa: BLE001
                        # Degradación elegante: si el vídeo falla, usamos el keyframe (Ken Burns)
                        yield emit({"type": "scene_warn", "index": idx,
                                    "message": f"vídeo falló, uso keyframe animado: {exc!s}"[:160]})

                # el ENCADENADO de continuidad usa siempre el keyframe (still), no el vídeo
                prev_keyframe = keyframe_url

                rendered_scenes.append({
                    "url": scene_url,
                    "kind": scene_kind,
                    "durationInFrames": max(1, int(round(scene["duration_s"] * fps))),
                    "caption": scene.get("caption") or "",
                    "muted": scene_kind != "video",  # mantener audio nativo del vídeo
                })
                scene_artifacts.append({
                    "index": idx, "title": scene["title"], "url": scene_url,
                    "kind": scene_kind, "duration_s": scene["duration_s"],
                    "caption": scene.get("caption") or "", "keyframe_url": keyframe_url,
                })
                yield emit({"type": "scene_done", "index": idx, "url": scene_url,
                            "kind": scene_kind, "keyframe_url": keyframe_url,
                            "duration_s": scene["duration_s"],
                            "message": f"Escena {idx} lista ({scene_kind})"})

            if not rendered_scenes:
                yield emit({"type": "error", "message": "Ninguna escena se generó con éxito."})
                return

            # ---- 4. Ensamblar con Remotion ----
            yield emit({"type": "render_start",
                        "message": f"Uniendo {len(rendered_scenes)} escenas con Remotion…"})
            client = storyboard_director.prompt_brain.normalize_client(req.client_context)
            brand = {
                "name": client.get("name") or "",
                "accent": (client.get("palette") or [None, None])[1] if client.get("palette") else "",
                "logoUrl": (client.get("logo") or {}).get("url", "") if isinstance(client.get("logo"), dict) else "",
            }
            try:
                data = await _remotion_render(rendered_scenes, brand, fps, width, height)
            except Exception as exc:  # noqa: BLE001
                yield emit({"type": "render_error", "message": str(exc)[:200],
                            "scenes": scene_artifacts})
                return

            out_fps = int(data.get("fps") or fps)
            frames = int(data.get("durationInFrames") or 0)
            final_url = str(data.get("url") or "")
            yield emit({"type": "render_done", "url": final_url,
                        "duration_s": round(frames / out_fps, 2) if out_fps else 0.0,
                        "width": int(data.get("width") or width),
                        "height": int(data.get("height") or height),
                        "message": "Vídeo final ensamblado"})

            yield emit({"type": "complete", "url": final_url, "plan": plan,
                        "scenes": scene_artifacts,
                        "duration_s": round(frames / out_fps, 2) if out_fps else 0.0})

        except Exception as exc:  # noqa: BLE001
            yield emit({"type": "error", "message": str(exc)[:300]})

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )