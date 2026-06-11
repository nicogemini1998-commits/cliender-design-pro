"""Endpoint de generación directa para el prototipo Design Pro.

POST /generate  — genera una imagen o vídeo vía KIE.ai y devuelve la URL.
Usado por el frontend del prototipo (localhost:2002) sin pasar por LangGraph.
"""
from __future__ import annotations

import asyncio
import logging
import time
import re
import uuid
from typing import Any, Optional, Literal

import httpx
from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.config import MediaKind, get_settings
from app.services.kid_ai_client import DisallowedModelError, KieTimeoutError, KieContentError, get_kid_ai
from app.services.url_guard import assert_safe_url as _assert_safe_url, SSRFBlockedError as _SSRFBlockedError

router = APIRouter(prefix="/generate", tags=["generate"])
logger = logging.getLogger(__name__)


class GenerateRequest(BaseModel):
    media_kind: MediaKind
    model_id: str
    prompt: str
    reference_images: Optional[list[str]] = None  # URLs HTTP(S) únicamente
    first_frame_url: Optional[str] = None          # primera imagen para Seedance
    aspect: Optional[str] = None                   # "1:1", "16:9", "9:16", etc.
    duration: Optional[int] = None                 # segundos (solo vídeo)
    seed: Optional[int] = None                     # semilla reproducible -> mismo prompt+seed = mismo resultado


class GenerateResponse(BaseModel):
    url: str
    task_id: str = ""
    stub: bool = False
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Analytics tracking helper — fire-and-forget, nunca bloquea la respuesta
# ---------------------------------------------------------------------------

# Caché de precios KIE — evita una query a model_pricing por cada generación.
# Clave: model_key → (timestamp_monotonic, price_out). TTL 300s.
_PRICING_CACHE: dict[str, tuple[float, float]] = {}
_PRICING_TTL = 300.0


async def _track_kie(model_id: str, media_kind: str, duration_ms: int, status: str = "ok", error: str = "") -> None:
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        return
    # Normalizar model_id a uno de los registros en model_pricing
    model_key = model_id if model_id in {"veo3", "veo3_fast", "veo3_lite"} else (
        "kie-video-default" if media_kind == "video" else "kie-image-default"
    )
    try:
        key = s.supabase_service_key
        headers = {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        }
        base = s.supabase_url.rstrip("/")
        async with httpx.AsyncClient(timeout=5) as client:
            # Obtener precio — caché TTL 300s para no golpear model_pricing en cada llamada
            now = time.monotonic()
            cached = _PRICING_CACHE.get(model_key)
            if cached and now - cached[0] < _PRICING_TTL:
                price_out = cached[1]
            else:
                pr = await client.get(
                    f"{base}/rest/v1/model_pricing?model=eq.{model_key}&provider=eq.kie&limit=1",
                    headers=headers,
                )
                pricing = pr.json()[0] if pr.status_code == 200 and pr.json() else {}
                price_out = float(pricing.get("override_per_1k_out") or pricing.get("price_per_1k_out") or 0)
                _PRICING_CACHE[model_key] = (now, price_out)
            # 1 unidad = tokens_out=1, costo = price_per_1k_out / 1000.
            # En error no hubo media generada → tokens_out=0 y coste 0.
            is_error = status != "ok"
            cost_usd = 0.0 if is_error else round(price_out / 1000, 8)

            row = {
                "session_id": str(uuid.uuid4()),
                "model": model_key,
                "provider": "kie",
                "tokens_in": 0,
                "tokens_out": 0 if is_error else 1,
                "cost_usd": cost_usd,
                "endpoint": "/generate",
                "node_type": media_kind,
                "status": status,
                "error_msg": error[:200] if error else "",
                "duration_ms": duration_ms,
            }
            await client.post(f"{base}/rest/v1/api_calls", headers=headers, json=row)
    except Exception as exc:
        logger.warning("KIE track failed: %s", exc)


@router.post("", response_model=GenerateResponse)
async def generate(req: GenerateRequest) -> GenerateResponse:
    client = get_kid_ai()
    t0 = int(time.monotonic() * 1000)
    try:
        parameters: dict[str, Any] = {}
        if req.seed is not None:
            parameters["seed"] = int(req.seed)  # consistencia: KIE reusa la semilla (modelos que la soportan)
        if req.aspect:
            parameters["aspect_ratio"] = req.aspect
        if req.duration and req.media_kind == "video":
            # Seedance 2.0 standard: 4-15s entero (doc oficial KIE 2026-06-03)
            try:
                d = int(req.duration)
                parameters["duration"] = max(4, min(d, 15))
            except (ValueError, TypeError):
                parameters["duration"] = 5
        if req.media_kind == "video" and req.model_id and "seedance" in req.model_id.lower():
            parameters["resolution"] = "480p"
        if req.first_frame_url and req.media_kind == "video":
            # Re-hospeda en Supabase si la URL no es estable (temp/expirada/proxy) → KIE necesita poder descargarla.
            parameters["first_frame_url"] = await _rehost_first_frame(req.first_frame_url)

        # KIE.ai solo acepta URLs HTTP(S), no data://
        clean_refs = [
            r for r in (req.reference_images or [])
            if r and r.startswith("http")
        ] or None

        # RUTEO INTELIGENTE DE MODELO POR REFERENCIAS (imagen):
        # Si el usuario aporta imagenes de referencia, nano-banana-pro (Gemini 3 Pro Image)
        # es el unico modelo que hace FUSION multi-referencia real + consistencia de identidad
        # (combina hasta 8 imagenes alineando luz/perspectiva/estilo). gpt-image-2 text-to-image
        # IGNORA las referencias. Por eso, con referencias -> forzamos nano-banana-pro.
        actual_model_id = req.model_id
        if clean_refs and req.media_kind == "image":
            # nano-banana-edit (Gemini 2.5 Flash) = fusion multi-referencia + PERMITE personas reales/famosas.
            # nano-banana-pro (Gemini 3) bloquea figuras publicas. Para campañas con talento real usamos edit.
            actual_model_id = "nano-banana-2"  # 2048x2048, permite personas reales, mejor calidad que edit
            parameters["aspect_ratio"] = req.aspect or "1:1"
            parameters["output_format"] = "png"
            parameters["resolution"] = "2K"  # nano-banana-2 soporta 1K/2K/4K
            parameters.pop("input_urls", None)
            logger.info("refs presentes -> nano-banana-2 fusion 2K, %d image_input", len(clean_refs))
        elif req.model_id and "nano-banana" in req.model_id:
            actual_model_id = req.model_id
            parameters.setdefault("aspect_ratio", req.aspect or "1:1")
            parameters.setdefault("output_format", "png")
            if "pro" in req.model_id or req.model_id == "nano-banana-2":
                parameters.setdefault("resolution", "2K")

        from app.services.prompt_sanitizer import sanitize_for_kie as _sanitize_prompt
        prompt_for_kie = req.prompt
        for _pass in range(2):
            try:
                result = await client.generate(
                    media_kind=req.media_kind,
                    model_id=actual_model_id,
                    prompt=prompt_for_kie,
                    parameters=parameters or None,
                    reference_images=clean_refs,
                )
                break  # success
            except KieContentError as _ce:
                if _pass == 0:
                    _san = await _sanitize_prompt(req.prompt)
                    if _san.strip() != req.prompt.strip():
                        prompt_for_kie = _san
                        logger.info("KieContentError → reintento con prompt sanitizado")
                        continue
                raise  # sin sanitización posible o ya en segundo intento
        duration_ms = int(time.monotonic() * 1000) - t0
        if result.get("url"):
            asyncio.create_task(_track_kie(req.model_id, req.media_kind, duration_ms))
        return GenerateResponse(
            url=result["url"],
            task_id=result.get("task_id", ""),
            stub=result.get("stub", False),
        )
    except DisallowedModelError as e:
        return GenerateResponse(url="", error=str(e))
    except KieContentError as e:
        # Registrar el fallo en analytics (status=error, coste 0)
        duration_ms = int(time.monotonic() * 1000) - t0
        asyncio.create_task(_track_kie(req.model_id, req.media_kind, duration_ms, status="error", error="CONTENT_BLOCKED: " + e.message))
        logger.warning("generate content blocked (todos los intentos): %s", e.message)
        return GenerateResponse(url="", error="CONTENT_BLOCKED: " + e.message)
    except KieTimeoutError as e:
        duration_ms = int(time.monotonic() * 1000) - t0
        asyncio.create_task(_track_kie(req.model_id, req.media_kind, duration_ms, status="error", error=f"timeout {e.timeout_s}s task={e.task_id}"))
        return GenerateResponse(
            url="",
            task_id=e.task_id,
            error=f"KIE timeout {e.timeout_s}s — task aún procesando, reintenta con /generate/retry/{e.task_id}",
        )
    except Exception as e:
        duration_ms = int(time.monotonic() * 1000) - t0
        asyncio.create_task(_track_kie(req.model_id, req.media_kind, duration_ms, status="error", error=str(e)))
        logger.error("generate error: %s", e, exc_info=True)
        return GenerateResponse(url="", error=f"Generación falló: {str(e)[:240]}" if str(e) else "Error interno de generación. Inténtalo de nuevo.")


class RetryRequest(BaseModel):
    media_kind: MediaKind


@router.post("/retry/{task_id}", response_model=GenerateResponse)
async def retry(task_id: str, req: RetryRequest) -> GenerateResponse:
    if not re.match(r"^[a-zA-Z0-9_-]{6,80}$", task_id or ""):
        return GenerateResponse(url="", error="task_id invalido")
    client = get_kid_ai()
    t0 = int(time.monotonic() * 1000)
    try:
        result = await client.resume_polling(task_id=task_id, media_kind=req.media_kind)
        duration_ms = int(time.monotonic() * 1000) - t0
        if result.get("url"):
            asyncio.create_task(_track_kie(task_id, req.media_kind, duration_ms))
        return GenerateResponse(
            url=result["url"],
            task_id=task_id,
            stub=result.get("stub", False),
        )
    except KieTimeoutError as e:
        duration_ms = int(time.monotonic() * 1000) - t0
        asyncio.create_task(_track_kie(task_id, req.media_kind, duration_ms, status="error", error=f"retry timeout {e.timeout_s}s"))
        return GenerateResponse(
            url="",
            task_id=task_id,
            error=f"Sigue procesando — reintenta en 30s (timeout {e.timeout_s}s)",
        )
    except Exception as e:
        duration_ms = int(time.monotonic() * 1000) - t0
        asyncio.create_task(_track_kie(task_id, req.media_kind, duration_ms, status="error", error=str(e)))
        logger.error("retry error: %s", e, exc_info=True)
        return GenerateResponse(url="", task_id=task_id, error=str(e)[:300])



# ---------------------------------------------------------------------------
# Logo overlay — compone el logo REAL del cliente sobre la imagen generada.
# Garantiza logo idéntico (píxeles exactos, no generado por IA).
# ---------------------------------------------------------------------------
class ComposeLogoRequest(BaseModel):
    image_url: str
    logo_url: str
    position: Literal["bottom-right", "bottom-left", "top-right", "top-left"] = "bottom-right"
    scale: float = Field(default=0.16, ge=0.05, le=0.5)


async def _upload_composed(png_bytes: bytes) -> str:
    import uuid as _uuid
    s = get_settings()
    key = s.supabase_service_key
    base = s.supabase_url.rstrip("/")
    bucket = "brand-assets"
    path_obj = f"composed/{_uuid.uuid4().hex}.png"
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "image/png", "x-upsert": "true"}
    async with httpx.AsyncClient(timeout=30) as client:
        await client.post(f"{base}/storage/v1/object/{bucket}/{path_obj}", headers=headers, content=png_bytes)
    return f"{base}/storage/v1/object/public/{bucket}/{path_obj}"


async def _rehost_first_frame(url: str) -> str:
    """Re-hospeda una imagen en Supabase si su URL no es ya Supabase público.
    KIE NO puede descargar URLs temporales/expiradas (p.ej. tempfile.aiquickdraw.com)
    ni proxies internos → fallan los vídeos con first_frame. Re-hospedando garantizamos
    una URL pública estable y accesible por KIE. Si falla, devuelve la URL original.
    """
    if not url or not url.startswith("http"):
        return url
    s = get_settings()
    if ".supabase.co" in url or not (s.supabase_url and s.supabase_service_key):
        return url  # ya estable, o sin Supabase configurado
    # Anti-SSRF: no rehospedar URLs internas/privadas.
    try:
        _assert_safe_url(url)
    except _SSRFBlockedError:
        logger.warning("rehost_first_frame: url bloqueada anti-SSRF %s", url[:80])
        return url
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as c:
            r = await c.get(url)
            if r.status_code != 200 or not r.content or len(r.content) > 12_000_000:
                logger.warning("rehost_first_frame: descarga fallida status=%s len=%s", r.status_code, len(r.content or b""))
                return url
            ctype = (r.headers.get("content-type", "image/png").split(";")[0].strip()) or "image/png"
            ext = {"image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp"}.get(ctype, "png")
            key = s.supabase_service_key
            base = s.supabase_url.rstrip("/")
            path_obj = f"firstframes/{uuid.uuid4().hex}.{ext}"
            hdrs = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": ctype, "x-upsert": "true"}
            up = await c.post(f"{base}/storage/v1/object/brand-assets/{path_obj}", headers=hdrs, content=r.content)
            if up.status_code in (200, 201):
                public = f"{base}/storage/v1/object/public/brand-assets/{path_obj}"
                logger.info("rehost_first_frame: %s -> %s", url[:60], public)
                return public
            logger.warning("rehost_first_frame: upload status=%s", up.status_code)
    except Exception as e:  # noqa: BLE001
        logger.warning("rehost_first_frame error: %s", e)
    return url


@router.post("/compose-logo")
async def compose_logo(req: ComposeLogoRequest):
    import io
    if not (req.image_url.startswith("https://") and _proxy_host_ok(req.image_url)):
        return {"url": req.image_url, "logo_applied": False, "error": "image_url no permitida"}
    if not (req.logo_url.startswith("https://") and _proxy_host_ok(req.logo_url)):
        return {"url": req.image_url, "logo_applied": False, "error": "logo_url no permitida"}
    # H-1: además del whitelist de host, verificar anti-SSRF (resolución IP, rangos privados).
    for _f, _u in (("image_url", req.image_url), ("logo_url", req.logo_url)):
        try:
            _assert_safe_url(_u)
        except _SSRFBlockedError as _e:
            return {"url": req.image_url, "logo_applied": False, "error": f"{_f} bloqueada anti-SSRF: {_e}"}
    _MAX = 25 * 1024 * 1024
    async def _dl(c, url, cap):
        buf = b""
        async with c.stream("GET", url) as r:
            r.raise_for_status()
            async for chunk in r.aiter_bytes():
                buf += chunk
                if len(buf) > cap:
                    raise ValueError("archivo demasiado grande")
        return buf
    try:
        # Import dentro del try: si Pillow no está instalado, devolvemos la imagen
        # original (logo_applied=False) en vez de propagar un 500 que rompa el nodo.
        from PIL import Image
        async with httpx.AsyncClient(timeout=40) as c:
            bimg = await _dl(c, req.image_url, _MAX)
            blogo = await _dl(c, req.logo_url, 10 * 1024 * 1024)
        base_img = Image.open(io.BytesIO(bimg)).convert("RGBA")
        if base_img.width > 8000 or base_img.height > 8000:
            return {"url": req.image_url, "logo_applied": False, "error": "imagen demasiado grande"}
        logo = Image.open(io.BytesIO(blogo)).convert("RGBA")
        W, H = base_img.size
        lw = max(48, int(W * req.scale))
        lh = int(logo.height * lw / logo.width)
        logo = logo.resize((lw, lh), Image.LANCZOS)
        pad = int(W * 0.045)
        if req.position == "bottom-left":
            pos = (pad, H - lh - pad)
        elif req.position == "top-right":
            pos = (W - lw - pad, pad)
        elif req.position == "top-left":
            pos = (pad, pad)
        else:  # bottom-right
            pos = (W - lw - pad, H - lh - pad)
        base_img.alpha_composite(logo, pos)
        out = io.BytesIO()
        base_img.convert("RGB").save(out, "PNG")
        url = await _upload_composed(out.getvalue())
        return {"url": url, "logo_applied": True}
    except Exception as e:
        # Si falla el overlay, devolver la imagen original (no romper el flujo)
        return {"url": req.image_url, "logo_applied": False, "error": str(e)}



# ---------------------------------------------------------------------------
# Media proxy — sirve imagenes/videos de CDNs externos a traves del backend.
# El navegador del usuario puede no alcanzar tempfile.aiquickdraw.com / supabase
# directamente; el backend SI tiene red. Resuelve el "cuadro negro".
# Whitelist de dominios para evitar SSRF / open proxy.
# ---------------------------------------------------------------------------
_PROXY_ALLOWED = (
    "tempfile.aiquickdraw.com",
    "file.aiquickdraw.com",
    "templateb.aiquickdraw.com",
    ".supabase.co",
    "images.unsplash.com",
)

def _proxy_host_ok(url: str) -> bool:
    from urllib.parse import urlparse
    try:
        host = (urlparse(url).hostname or "").lower()
    except Exception:
        return False
    if not host:
        return False
    return any(host == d or host.endswith(d) for d in _PROXY_ALLOWED)


@router.get("/media-proxy")
async def media_proxy(url: str = Query(...)):
    if not url.startswith("https://") or not _proxy_host_ok(url):
        raise HTTPException(status_code=400, detail="URL no permitida")
    try:
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
            r = await c.get(url, headers={"User-Agent": "CliendreDesignPro/1.0"})
            r.raise_for_status()
            ctype = r.headers.get("content-type", "application/octet-stream")
            return Response(
                content=r.content,
                media_type=ctype,
                headers={
                    "Access-Control-Allow-Origin": "*",
                    "Cache-Control": "public, max-age=86400",
                },
            )
    except Exception as e:
        raise HTTPException(status_code=502, detail="No se pudo cargar el medio")



class PersistMediaRequest(BaseModel):
    url: str
    kind: str = "image"


@router.post("/persist-media")
async def persist_media(req: PersistMediaRequest):
    import base64 as _b64, uuid as _u2

    # Rama data:base64 — imágenes subidas localmente desde nodo ImageRef
    if req.url.startswith("data:"):
        try:
            header, b64data = req.url.split(",", 1)
            mime = header.split(":")[1].split(";")[0] if ":" in header else "image/png"
            ext_map = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif"}
            ext = ext_map.get(mime, "png")
            buf = _b64.b64decode(b64data)
            if len(buf) > 30 * 1024 * 1024:
                return {"url": req.url, "persisted": False, "error": "imagen demasiado grande"}
            s = get_settings()
            key = s.supabase_service_key
            base_url = s.supabase_url.rstrip("/")
            path_obj = f"references/{_u2.uuid4().hex}.{ext}"
            hdrs = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": mime, "x-upsert": "true"}
            async with httpx.AsyncClient(timeout=60) as c:
                up = await c.post(f"{base_url}/storage/v1/object/brand-assets/{path_obj}", headers=hdrs, content=buf)
                up.raise_for_status()
            return {"url": f"{base_url}/storage/v1/object/public/brand-assets/{path_obj}", "persisted": True}
        except Exception as exc:
            logger.error("persist_media.base64 error: %s", exc)
            return {"url": req.url, "persisted": False, "error": str(exc)}

    if not (req.url.startswith("https://") and _proxy_host_ok(req.url)):
        return {"url": req.url, "persisted": False, "error": "url no permitida"}
    if ".supabase.co" in req.url:
        return {"url": req.url, "persisted": True}
    is_video = req.kind == "video"
    ext = "mp4" if is_video else "png"
    ctype = "video/mp4" if is_video else "image/png"
    cap = 120 * 1024 * 1024 if is_video else 30 * 1024 * 1024
    try:
        buf = b""
        async with httpx.AsyncClient(timeout=180, follow_redirects=True) as c:
            async with c.stream("GET", req.url, headers={"User-Agent": "CliendreDesignPro/1.0"}) as r:
                r.raise_for_status()
                async for chunk in r.aiter_bytes():
                    buf += chunk
                    if len(buf) > cap:
                        raise ValueError("archivo demasiado grande")
        import uuid as _u
        s = get_settings()
        key = s.supabase_service_key
        base = s.supabase_url.rstrip("/")
        path_obj = f"generations/{_u.uuid4().hex}.{ext}"
        headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": ctype, "x-upsert": "true"}
        async with httpx.AsyncClient(timeout=180) as c:
            up = await c.post(f"{base}/storage/v1/object/brand-assets/{path_obj}", headers=headers, content=buf)
            up.raise_for_status()
        return {"url": f"{base}/storage/v1/object/public/brand-assets/{path_obj}", "persisted": True}
    except Exception as e:
        logger.error("persist_media error: %s", e)
        return {"url": req.url, "persisted": False, "error": "no se pudo persistir"}
