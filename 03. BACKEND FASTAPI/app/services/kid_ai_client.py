"""Cliente HTTP único de KIE.ai. Solo dispatcher — sin lógica de selección.

La selección del `model_id` la hace SIEMPRE el `Cinematographer_Node`.
Aquí solamente validamos contra el catálogo y disparamos la llamada.

Modo stub: cuando `kie_api_key` está vacío devuelve un artefacto placeholder
en lugar de lanzar, para que el flujo completo pueda ejecutarse sin clave.

API real (descubierta 2026-05-25):
  POST /api/v1/jobs/createTask  { model, input: { prompt, ... } }
  GET  /api/v1/jobs/recordInfo?taskId=<id>  → polling hasta state=success
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any

import httpx

logger = logging.getLogger(__name__)

from app.core.config import ALLOWED_KID_AI_MODELS, MediaKind, get_settings

# Mapeo: nombre "friendly" del catálogo interno → model_id real de la API KIE.ai
# El Cinematographer elige por nombre friendly; el cliente traduce antes de enviar.
_MODEL_API_NAME: dict[str, str] = {
    "gpt-imagenes-2": "gpt-image-2-text-to-image",
    "seedance-2.0": "bytedance/seedance-2",
    # Los siguientes coinciden con la API (sin cambio conocido):
    "nano-banana-pro": "nano-banana-pro",
    "nano-banana-2": "nano-banana-2",
    "nano-banana-edit": "google/nano-banana-edit",
    "veo3": "veo3",
}

# Headers que eluden la protección Cloudflare bot-detection de api.kie.ai
_CF_BYPASS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://kie.ai",
    "Referer": "https://kie.ai/",
}

_POLL_INTERVAL_S = 3.0
_POLL_TIMEOUT_S = 600.0  # total absoluto: la task sigue viva en KIE hasta aqui
# Presupuesto de poll POR REQUEST HTTP: cada llamada (/generate y /generate/retry) vuelve
# en <=~24s devolviendo task_id si KIE sigue. El frontend sondea /retry en bucle (requests
# cortos) -> ninguna conexion queda retenida minutos -> ningun proxy la corta -> estable.
_REQUEST_BUDGET_S = 24.0


class DisallowedModelError(ValueError):
    """Se intentó llamar a un modelo fuera del catálogo autorizado."""


class KieContentError(Exception):
    """KIE/Gemini bloqueó la generación por política de contenido (input/output sensible)."""
    def __init__(self, message: str):
        self.message = message
        super().__init__(message)


class KieTimeoutError(RuntimeError):
    """Kie no respondió en el tiempo límite. task_id puede seguir procesando."""
    def __init__(self, task_id: str, timeout_s: float):
        self.task_id = task_id
        self.timeout_s = timeout_s
        super().__init__(f"KIE timeout ({timeout_s}s) taskId={task_id}")


class KieAIClient:
    def __init__(self) -> None:
        settings = get_settings()
        self._base = settings.kie_base_url.rstrip("/")
        self._api_prefix = "/api/v1"
        self._api_key = settings.kie_api_key
        self._headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            **_CF_BYPASS_HEADERS,
        }

    @property
    def _stub_mode(self) -> bool:
        return not self._api_key

    async def generate(
        self,
        *,
        media_kind: MediaKind,
        model_id: str,
        prompt: str,
        parameters: dict[str, Any] | None = None,
        reference_images: list[str] | None = None,
    ) -> dict[str, Any]:
        if model_id not in ALLOWED_KID_AI_MODELS:
            raise DisallowedModelError(
                f"Modelo '{model_id}' no está en el catálogo KIE.ai autorizado."
            )

        if self._stub_mode:
            return _stub_response(media_kind, model_id, prompt)

        # Veo3 family uses a dedicated endpoint (/api/v1/veo/generate)
        if model_id in ("veo3", "veo3_fast", "veo3_lite"):
            return await self._generate_veo3(model_id, prompt, parameters, reference_images)

        api_model = _MODEL_API_NAME.get(model_id, model_id)
        task_input: dict[str, Any] = {"prompt": prompt, **(parameters or {})}
        if reference_images:
            _refs = [r for r in reference_images if r and isinstance(r, str) and r.startswith("http")][:9]
            if _refs:
                ml = model_id.lower()
                if "seedance" in ml:
                    # KIE seedance: first/last frame y reference_image_urls son MUTUAMENTE
                    # EXCLUYENTES. Si ya hay un first/last frame (continuidad), el frame manda
                    # y omitimos las reference_image_urls para no romper la tarea.
                    _frame_keys = ("first_frame_url", "first_frame_image", "last_frame_url",
                                   "last_frame_image", "image_url", "image_urls")
                    _has_frame = any(task_input.get(k) for k in _frame_keys)
                    if not _has_frame:
                        task_input["reference_image_urls"] = _refs
                    else:
                        logger.info("kie.seedance: first/last frame presente → omito reference_image_urls (%d)", len(_refs))
                elif "nano-banana-edit" in ml:
                    # Gemini 2.5 Flash edit: param image_urls (max 10), permite personas reales
                    task_input["image_urls"] = _refs[:10]
                elif "nano-banana" in ml:
                    # nano-banana-pro / 2 (Gemini 3): param image_input (max 8)
                    task_input["image_input"] = _refs[:8]
                elif "gpt-image-2-image-to-image" in api_model:
                    # gpt-image-2 i2i ya recibe input_urls via parameters; reference_images redundante
                    pass
                else:
                    task_input["reference_images"] = _refs

        task_id = await self._create_task(api_model, task_input)
        return await self._poll_until_done(task_id, media_kind)

    async def _create_task(self, api_model: str, task_input: dict[str, Any]) -> str:
        url = f"{self._base}{self._api_prefix}/jobs/createTask"
        prompt_len = len(task_input.get("prompt", "") or "")
        logger.info("kie.create_task model=%s prompt_len=%d", api_model, prompt_len)
        backoffs = [3.0, 6.0, 12.0, 25.0, 45.0]  # 5 intentos, hasta ~90s total para soft errors Kie
        data: dict[str, Any] | None = None
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(1, 7):  # 6 intentos max para mejor resiliencia Kie
                try:
                    r = await client.post(
                        url,
                        headers=self._headers,
                        json={"model": api_model, "input": task_input},
                    )
                    if r.status_code in (429, 502, 503):
                        logger.warning(
                            "kie.create_task transient status=%d attempt=%d body=%s",
                            r.status_code, attempt, r.text[:200],
                        )
                        last_exc = RuntimeError(f"KIE createTask HTTP {r.status_code}")
                        if attempt < 6:
                            await asyncio.sleep(backoffs[attempt - 1])
                            continue
                        r.raise_for_status()
                    r.raise_for_status()
                    data = r.json()
                    # Retry on Kie soft errors: code != 200/0 con "server exception" en el msg
                    soft_msg = str(data.get("msg", "")).lower()
                    if data.get("code") not in (200, 0) and ("server exception" in soft_msg or "try again" in soft_msg or "timeout" in soft_msg):
                        logger.warning(
                            "kie.create_task kie_soft_error attempt=%d msg=%s",
                            attempt, data.get("msg"),
                        )
                        last_exc = RuntimeError(f"KIE soft error: {data.get('msg')}")
                        if attempt < 6:
                            await asyncio.sleep(backoffs[attempt - 1])
                            data = None  # forzar siguiente intento
                            continue
                    break
                except httpx.HTTPError as exc:
                    last_exc = exc
                    logger.warning(
                        "kie.create_task http_error attempt=%d err=%s",
                        attempt, str(exc)[:200],
                    )
                    if attempt < 6:
                        await asyncio.sleep(backoffs[attempt - 1])
                        continue
                    raise
        if data is None:
            raise last_exc or RuntimeError("KIE createTask: sin respuesta tras 6 intentos")
        if data.get("code") != 200:
            raw_msg = data.get('msg', data)
            if 'server exception' in str(raw_msg).lower():
                raise RuntimeError("KIE temporalmente caído (Server exception). Reintentar en 1-2 min.")
            raise RuntimeError(f"KIE createTask error: {raw_msg}")
        task_id = (data.get("data") or {}).get("taskId") or (data.get("data") or {}).get("recordId")
        if not task_id:
            raise RuntimeError(f"KIE no devolvió taskId: {json.dumps(data)[:200]}")
        logger.info("kie.task_created taskId=%s", task_id)
        return task_id

    async def _poll_until_done(self, task_id: str, media_kind: MediaKind) -> dict[str, Any]:
        url = f"{self._base}{self._api_prefix}/jobs/recordInfo"
        start = asyncio.get_event_loop().time()
        deadline = start + _REQUEST_BUDGET_S
        consecutive_errors = 0
        MAX_CONSEC = 6
        async with httpx.AsyncClient(timeout=15) as client:
            while asyncio.get_event_loop().time() < deadline:
                await asyncio.sleep(_POLL_INTERVAL_S)
                try:
                    r = await client.get(url, headers=self._headers, params={"taskId": task_id})
                except httpx.HTTPError as exc:
                    consecutive_errors += 1
                    logger.warning("kie.poll_http_exception taskId=%s err=%s consec=%d", task_id, str(exc)[:200], consecutive_errors)
                    if consecutive_errors >= MAX_CONSEC:
                        raise KieTimeoutError(task_id, _POLL_TIMEOUT_S)
                    await asyncio.sleep(min(2 ** consecutive_errors, 20))
                    continue
                if not r.is_success:
                    consecutive_errors += 1
                    logger.warning("kie.poll_http_error status=%d taskId=%s consec=%d", r.status_code, task_id, consecutive_errors)
                    if r.status_code == 404 or consecutive_errors >= MAX_CONSEC:
                        raise KieTimeoutError(task_id, _POLL_TIMEOUT_S)
                    await asyncio.sleep(min(2 ** consecutive_errors, 20))
                    continue
                consecutive_errors = 0
                data = r.json()
                d = (data.get("data") or {})
                state = (d.get("state") or "").lower()
                elapsed = asyncio.get_event_loop().time() - start
                logger.info("kie.poll state=%s taskId=%s elapsed=%.1fs", state, task_id, elapsed)
                if state in ("success", "completed"):
                    logger.info("kie.success taskId=%s elapsed=%.1fs", task_id, elapsed)
                    return _parse_result(d, media_kind, task_id)
                if state in ("failed", "error", "fail"):
                    fail_msg = (d.get("failMsg") or d.get("failReason") or "sin detalle").strip()
                    fail_code = str(d.get("failCode") or "")
                    logger.warning("kie.fail taskId=%s code=%s msg=%s", task_id, fail_code, fail_msg[:200])
                    low = fail_msg.lower()
                    if "sensitive" in low or "flagged" in low or "policy" in low or "copyright" in low or "restricted" in low or fail_code in ("400", "501"):
                        raise KieContentError(fail_msg)
                    raise RuntimeError(f"KIE tarea fallida: {fail_msg}")
        logger.warning("kie.timeout taskId=%s elapsed=%.1fs", task_id, _POLL_TIMEOUT_S)
        raise KieTimeoutError(task_id, _POLL_TIMEOUT_S)

    async def _generate_veo3(
        self,
        model_id: str,
        prompt: str,
        parameters: dict[str, Any] | None,
        reference_images: list[str] | None,
    ) -> dict[str, Any]:
        """Veo3 family uses a dedicated endpoint distinct from /jobs/createTask.

        Spec (Kie 2026-05): POST /api/v1/veo/generate
          body: { prompt, imageUrls, model, aspect_ratio, duration, generationType }
          model in {veo3, veo3_fast, veo3_lite}
          generationType in {TEXT_2_VIDEO, FIRST_AND_LAST_FRAMES_2_VIDEO, REFERENCE_2_VIDEO}
          duration in {4, 6, 8}
        """
        params = parameters or {}
        # Use veo3_fast as the default mapping for the catalog "veo3" alias (cheaper + faster)
        api_model = "veo3_fast" if model_id == "veo3" else model_id
        aspect_ratio = params.get("aspect_ratio") or params.get("aspect") or "16:9"
        duration_raw = params.get("duration", 8)
        try:
            duration = int(duration_raw)
        except (TypeError, ValueError):
            duration = 8
        if duration not in (4, 6, 8):
            duration = 8

        # Collect image URLs (first_frame first, then reference_images)
        img_urls: list[str] = []
        first_frame = params.get("first_frame_image") or params.get("first_frame_url")
        if first_frame and isinstance(first_frame, str) and first_frame.startswith("http"):
            img_urls.append(first_frame)
        if reference_images:
            img_urls.extend([r for r in reference_images if r and isinstance(r, str) and r.startswith("http")])

        body: dict[str, Any] = {
            "prompt": prompt,
            "model": api_model,
            "aspect_ratio": aspect_ratio,
            "duration": duration,
        }
        if img_urls:
            body["imageUrls"] = img_urls
            body["generationType"] = (
                "FIRST_AND_LAST_FRAMES_2_VIDEO" if first_frame else "REFERENCE_2_VIDEO"
            )
        else:
            body["generationType"] = "TEXT_2_VIDEO"

        url = f"{self._base}/api/v1/veo/generate"
        logger.info(
            "kie.veo3.create_task model=%s genType=%s duration=%d aspect=%s imgs=%d",
            api_model, body["generationType"], duration, aspect_ratio, len(img_urls),
        )
        backoffs = [3.0, 6.0, 12.0, 25.0, 45.0]  # veo3 retries iguales
        data: dict[str, Any] | None = None
        last_exc: Exception | None = None
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(1, 7):
                try:
                    r = await client.post(url, headers=self._headers, json=body)
                    if r.status_code in (429, 502, 503):
                        logger.warning(
                            "kie.veo3.create_task transient status=%d attempt=%d body=%s",
                            r.status_code, attempt, r.text[:200],
                        )
                        last_exc = RuntimeError(f"KIE veo3 HTTP {r.status_code}")
                        if attempt < 6:
                            await asyncio.sleep(backoffs[attempt - 1])
                            continue
                        r.raise_for_status()
                    r.raise_for_status()
                    data = r.json()
                    break
                except httpx.HTTPError as exc:
                    last_exc = exc
                    logger.warning(
                        "kie.veo3.create_task http_error attempt=%d err=%s",
                        attempt, str(exc)[:200],
                    )
                    if attempt < 6:
                        await asyncio.sleep(backoffs[attempt - 1])
                        continue
                    raise
        if data is None:
            raise last_exc or RuntimeError("KIE veo3 generate: sin respuesta tras 3 intentos")
        if data.get("code") not in (200, None):
            raise RuntimeError(f"KIE veo3 error: {data.get('msg', data)}")
        task_id = (data.get("data") or {}).get("taskId") or (data.get("data") or {}).get("recordId")
        if not task_id:
            raise RuntimeError(f"KIE veo3 no devolvió taskId: {json.dumps(data)[:200]}")
        logger.info("kie.veo3.task_created taskId=%s", task_id)
        return await self._poll_veo3(task_id, duration)

    async def _poll_veo3(self, task_id: str, duration_s: int) -> dict[str, Any]:
        """Poll /api/v1/veo/record-info until successFlag finalizes.

        successFlag: 0=generating, 1=success, 2=failed, 3=failed
        URL: data.response.fullResultUrls[0] | resultUrls[0]
        """
        url = f"{self._base}/api/v1/veo/record-info"
        start = asyncio.get_event_loop().time()
        deadline = start + _POLL_TIMEOUT_S
        async with httpx.AsyncClient(timeout=15) as client:
            while asyncio.get_event_loop().time() < deadline:
                await asyncio.sleep(_POLL_INTERVAL_S)
                try:
                    r = await client.get(url, headers=self._headers, params={"taskId": task_id})
                except httpx.HTTPError as exc:
                    logger.warning("kie.veo3.poll_http_exception taskId=%s err=%s", task_id, str(exc)[:200])
                    continue
                if not r.is_success:
                    logger.warning(
                        "kie.veo3.poll_http_error status=%d taskId=%s body=%s",
                        r.status_code, task_id, r.text[:200],
                    )
                    continue
                payload = r.json()
                d = (payload.get("data") or {})
                flag = d.get("successFlag")
                elapsed = asyncio.get_event_loop().time() - start
                logger.info("kie.veo3.poll flag=%s taskId=%s elapsed=%.1fs", flag, task_id, elapsed)
                if flag == 1:
                    response = d.get("response") or {}
                    urls = (
                        response.get("fullResultUrls")
                        or response.get("resultUrls")
                        or d.get("resultUrls")
                        or []
                    )
                    result_url = urls[0] if urls else ""
                    if not result_url:
                        raise RuntimeError(f"KIE veo3 success but no URL: {json.dumps(d)[:200]}")
                    logger.info("kie.veo3.success taskId=%s elapsed=%.1fs", task_id, elapsed)
                    return {
                        "url": result_url,
                        "thumbnail_url": result_url,
                        "task_id": task_id,
                        "duration_s": float(duration_s),
                        "cost_credits": 0.0,
                        "stub": False,
                    }
                if flag in (2, 3):
                    err_msg = d.get("errorMessage") or d.get("failMsg") or "veo3 failed"
                    raise RuntimeError(f"KIE veo3 fallida: {err_msg}")
        logger.warning("kie.veo3.timeout taskId=%s elapsed=%.1fs", task_id, _POLL_TIMEOUT_S)
        raise KieTimeoutError(task_id, _POLL_TIMEOUT_S)


    async def resume_polling(self, task_id: str, media_kind: MediaKind) -> dict[str, Any]:
        """Reanuda polling para un task_id existente. Útil tras KieTimeoutError."""
        if self._stub_mode:
            return _stub_response(media_kind, "resume", "")
        logger.info("kie.resume_polling taskId=%s", task_id)
        return await self._poll_until_done(task_id, media_kind)


def _parse_result(d: dict[str, Any], media_kind: MediaKind, task_id: str) -> dict[str, Any]:
    url: str | None = None
    # Extraer URL desde resultJson (formato principal KIE)
    if d.get("resultJson"):
        try:
            parsed = json.loads(d["resultJson"])
            url = (
                (parsed.get("resultUrls") or [None])[0]
                or parsed.get("url")
                or parsed.get("videoUrl")
                or parsed.get("imageUrl")
                or parsed.get("outputUrl")
            )
        except Exception:
            pass
    # Fallbacks directos en el dict del task (algunos modelos lo devuelven aqui)
    if not url:
        url = (
            d.get("resultUrl")
            or d.get("videoUrl")
            or d.get("imageUrl")
            or d.get("outputUrl")
            or (d.get("resultUrls") or [None])[0]
        )
    return {
        "url": url or "",
        "thumbnail_url": url or "",
        "task_id": task_id,
        "duration_s": 0.0 if media_kind == "image" else float(d.get("duration", 0)),
        "cost_credits": float(d.get("credits", 0)),
        "stub": False,
    }


def _stub_response(media_kind: MediaKind, model_id: str, prompt: str) -> dict[str, Any]:
    """Placeholder cuando KIE_API_KEY no está configurada."""
    job_id = str(uuid.uuid4())[:8]
    stub_svg = (
        "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='450' "
        "viewBox='0 0 800 450'%3E%3Crect width='800' height='450' fill='%231E2839'/%3E"
        "%3Ctext x='400' y='190' font-family='monospace' font-size='18' fill='%238F7EE9' "
        "text-anchor='middle'%3ESTUB — KIE_API_KEY no configurada%3C/text%3E"
        "%3Ctext x='400' y='225' font-family='monospace' font-size='13' fill='%23EBEAE4' "
        "text-anchor='middle'%3E" + model_id[:40] + "%3C/text%3E"
        "%3Ctext x='400' y='255' font-family='monospace' font-size='11' fill='%23888' "
        "text-anchor='middle'%3Ejob " + job_id + "%3C/text%3E%3C/svg%3E"
    )
    return {
        "url": stub_svg,
        "thumbnail_url": stub_svg,
        "duration_s": 5.0 if media_kind == "video" else 0.0,
        "cost_credits": 0.0,
        "stub": True,
    }


# backwards-compat alias (production.py importa get_kid_ai)
KidAIClient = KieAIClient

_singleton: KieAIClient | None = None


def get_kid_ai() -> KieAIClient:
    global _singleton
    if _singleton is None:
        _singleton = KieAIClient()
    return _singleton
