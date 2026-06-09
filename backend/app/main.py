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

from app.api.routes import agent, analytics, gallery, generate, health, moodboard, store, supercomputer
from app.core.config import get_settings

_RL: dict[str, list[float]] = defaultdict(list)
_RL_PREFIXES = ("/generate", "/agent", "/moodboards")
_RL_MAX = 25
_RL_WINDOW = 60.0
# Endpoints caros (Supabase/Pillow/Claude Vision): limite propio mas estricto.
_RL_HEAVY = ("/generate/persist-media", "/generate/compose-logo", "/moodboards/audit")
_RL_HEAVY_MAX = 10
# media-proxy es GET de assets ya generados → exento.
_RL_EXEMPT = ("/generate/media-proxy",)
# Prefijos protegidos por API key (cuando CDPRO_API_KEY esta definida) — TODOS los metodos.
_AUTH_PREFIXES = ("/generate", "/agent", "/moodboards", "/analytics", "/gallery", "/store")
_RL_LAST_PRUNE = [0.0]


def create_app() -> FastAPI:
    settings = get_settings()
    is_prod = str(getattr(settings, "environment", "dev")).lower() in ("prod", "production")
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
        api_key = os.environ.get("CDPRO_API_KEY")
        # AUTH: si hay key configurada, exigirla en TODOS los metodos (GET/POST/PUT/DELETE)
        # sobre los prefijos protegidos. /health queda siempre abierto.
        if api_key and any(path.startswith(p) for p in _AUTH_PREFIXES):
            if request.headers.get("X-API-Key") != api_key:
                return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        # RATE LIMIT: aplica a metodos que gastan recursos (POST/PUT/DELETE).
        if method in ("POST", "PUT", "DELETE") and any(path.startswith(p) for p in _RL_PREFIXES) and not any(path.startswith(e) for e in _RL_EXEMPT):
            ip = request.client.host if request.client else "?"
            now = _time.time()
            limit = _RL_HEAVY_MAX if any(path.startswith(h) for h in _RL_HEAVY) else _RL_MAX
            bucket = _RL[ip]
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

    app.include_router(health.router)
    app.include_router(supercomputer.router)
    app.include_router(generate.router)
    app.include_router(gallery.router)
    app.include_router(moodboard.router)
    app.include_router(store.router)
    app.include_router(agent.router)
    app.include_router(analytics.router)
    return app


app = create_app()
