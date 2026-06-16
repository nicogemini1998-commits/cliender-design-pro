"""Entrypoint FastAPI."""
from __future__ import annotations

import logging
import os
import time as _time
from collections import defaultdict

_LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)-8s %(name)s :: %(message)s",
    datefmt="%H:%M:%S",
)
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import agent, analytics, gallery, generate, health, moodboard, store, supercomputer, video
from app.core.config import get_settings
from app.services.http import aclose_http

_RL: dict[str, list[float]] = defaultdict(list)
_RL_PREFIXES = ("/generate", "/agent", "/moodboards", "/video", "/chat", "/store", "/gallery")
_RL_MAX = 25
_RL_WINDOW = 60.0
# Endpoints caros (Supabase/Pillow/Claude Vision): limite propio mas estricto.
_RL_HEAVY = ("/generate/persist-media", "/generate/compose-logo", "/moodboards/audit", "/video/edit", "/video/transcribe", "/chat/render", "/chat/storyboard", "/chat/edit-plan")
_RL_HEAVY_MAX = 20
# media-proxy es GET de assets ya generados → exento.
_RL_EXEMPT = ("/generate/media-proxy",)
# Prefijos protegidos por API key (cuando CDPRO_API_KEY esta definida) — TODOS los metodos.
_AUTH_PREFIXES = ("/generate", "/agent", "/moodboards", "/analytics", "/gallery", "/store", "/video", "/chat")
_RL_LAST_PRUNE = [0.0]
_MAX_BODY = 6 * 1024 * 1024  # 6 MB — techo duro de payload (C-2): evita DoS/abuso de storage
_GET_RL_MAX = 90              # límite de lectura/min por IP (H-3)


def _is_loopback(host: str) -> bool:
    """Peticiones desde el propio contenedor (analytics self-call) — exentas de auth."""
    return host in ("127.0.0.1", "::1", "localhost")


def create_app() -> FastAPI:
    settings = get_settings()
    _startup_key = os.environ.get("CDPRO_API_KEY", "").strip()
    is_prod = str(getattr(settings, "environment", "dev")).lower() in ("prod", "production")
    # C-1: en PRODUCCIÓN la API key es obligatoria (fail-closed). En dev local sigue
    # abierto para no frenar al equipo, pero se avisa en el log.
    if is_prod and not _startup_key:
        raise RuntimeError(
            "CDPRO_API_KEY es obligatoria en producción. "
            'Genérala con: python -c "import secrets; print(secrets.token_hex(32))"'
        )
    if not _startup_key:
        logger.warning("CDPRO_API_KEY no definida — endpoints SIN autenticación (solo aceptable en dev local aislado).")
    app = FastAPI(
        title=settings.app_name,
        docs_url=None if is_prod else "/docs",
        redoc_url=None if is_prod else "/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Content-Type", "X-API-Key", "Authorization"],
    )

    @app.middleware("http")
    async def _guard(request: Request, call_next):
        path = request.url.path
        method = request.method
        if method == "OPTIONS":
            return await call_next(request)  # preflight CORS, nunca bloquear
        client_host = request.client.host if request.client else "?"
        # C-2: techo de payload — rechaza cuerpos enormes antes de procesarlos.
        if method in ("POST", "PUT", "PATCH"):
            cl = request.headers.get("content-length")
            if cl and cl.isdigit() and int(cl) > _MAX_BODY:
                return JSONResponse({"detail": "Payload demasiado grande"}, status_code=413)
        # AUTH: si hay key configurada, exigirla en los prefijos protegidos.
        # Las llamadas loopback (self-call de analytics) quedan exentas (M-2).
        if _startup_key and not _is_loopback(client_host) and any(path.startswith(p) for p in _AUTH_PREFIXES):
            if request.headers.get("X-API-Key") != _startup_key:
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        # RATE LIMIT: escrituras (POST/PUT/DELETE) con límite estricto + lecturas (GET) con límite amplio (H-3).
        is_write = method in ("POST", "PUT", "DELETE")
        is_read = method == "GET"
        if (is_write or is_read) and any(path.startswith(p) for p in _RL_PREFIXES) and not any(path.startswith(e) for e in _RL_EXEMPT) and not _is_loopback(client_host):
            ip = client_host
            now = _time.time()
            if is_write:
                limit = _RL_HEAVY_MAX if any(path.startswith(h) for h in _RL_HEAVY) else _RL_MAX
                bkey = ip
            else:
                limit = _GET_RL_MAX
                bkey = ip + "|GET"
            bucket = _RL[bkey]
            bucket[:] = [t for t in bucket if now - t < _RL_WINDOW]
            if len(bucket) >= limit:
                return JSONResponse({"detail": "Demasiadas peticiones. Espera un momento."}, status_code=429)
            bucket.append(now)
            # Fix memory-leak (_RL crecia sin limite): prune global de buckets vacios cada 5 min.
            if now - _RL_LAST_PRUNE[0] > 300:
                _RL_LAST_PRUNE[0] = now
                for k in list(_RL.keys()):
                    _RL[k][:] = [t for t in _RL[k] if now - t < _RL_WINDOW]
                    if not _RL[k]:
                        del _RL[k]
        return await call_next(request)

    @app.on_event("shutdown")
    async def _shutdown() -> None:
        # Cierra el httpx.AsyncClient compartido (singleton en app/services/http.py)
        await aclose_http()

    app.include_router(health.router)
    app.include_router(supercomputer.router)
    app.include_router(generate.router)
    app.include_router(gallery.router)
    app.include_router(moodboard.router)
    app.include_router(store.router)
    app.include_router(agent.router)
    app.include_router(analytics.router)
    app.include_router(video.router)
    return app


app = create_app()
