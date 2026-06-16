"""Settings + constantes inmutables del enjambre.

REGLA DE ORO: la lista ALLOWED_KID_AI_MODELS es la **única** fuente de verdad
sobre qué modelos visuales pueden invocarse. Nada en el sistema debe llamar a
un modelo que no esté aquí.
"""
from __future__ import annotations

import json
from enum import Enum
from functools import lru_cache
from typing import Any, Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# Catálogo único de modelos Kid.ai (REGLA DE ORO — no extender sin aprobación)
# ---------------------------------------------------------------------------

class KidAIImageModel(str, Enum):
    GPT_IMAGENES_2 = "gpt-imagenes-2"        # alto detalle
    NANO_BANANA_PRO = "nano-banana-pro"      # Gemini 3 Pro Image — fusion, PERO bloquea figuras publicas
    NANO_BANANA_2 = "nano-banana-2"          # Gemini 3.1 Flash image
    NANO_BANANA_EDIT = "nano-banana-edit"    # Gemini 2.5 Flash edit — PERMITE personas reales/famosas


class KidAIVideoModel(str, Enum):
    # VEO3 — desactivado temporalmente, solo seedance-2.0 activo
    SEEDANCE_2 = "seedance-2.0"              # dinámico / redes sociales


ALLOWED_IMAGE_MODELS: frozenset[str] = frozenset(m.value for m in KidAIImageModel)
ALLOWED_VIDEO_MODELS: frozenset[str] = frozenset(m.value for m in KidAIVideoModel)
ALLOWED_KID_AI_MODELS: frozenset[str] = ALLOWED_IMAGE_MODELS | ALLOWED_VIDEO_MODELS

MediaKind = Literal["image", "video"]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Servidor
    app_name: str = "creative-supercomputer"
    environment: Literal["dev", "prod"] = "dev"
    cors_origins: list[str] = Field(
        default_factory=lambda: [
            "http://localhost:1004",
            "http://localhost:2002",
            "http://localhost:3000",
            "http://127.0.0.1:1004",
            "http://127.0.0.1:2002",
            "http://127.0.0.1:3000",
        ]
    )

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v: Any) -> Any:
        """Acepta env como JSON string, CSV o lista — normaliza a list[str]."""
        if v is None or v == "":
            return v
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            s = v.strip()
            if s.startswith("["):
                try:
                    parsed = json.loads(s)
                except json.JSONDecodeError:
                    parsed = None
                if isinstance(parsed, list):
                    return [str(item).strip() for item in parsed if str(item).strip()]
            return [part.strip() for part in s.split(",") if part.strip()]
        return v

    # Cerebro cognitivo — SOLO Claude
    @field_validator("cors_origins", mode="after")
    @classmethod
    def _no_wildcard_prod(cls, v: Any, info: Any) -> Any:
        # L-1: en prod, un "*" en cors_origins con allow_credentials=True es crítico.
        if "*" in (v or []) and str(info.data.get("environment", "dev")).lower() in ("prod", "production"):
            raise ValueError("CORS wildcard '*' no permitido en producción")
        return v

    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-6"
    claude_max_tokens: int = 4096

    # Músculo creativo — SOLO KIE.ai
    kie_api_key: str = ""

    kie_base_url: str = "https://api.kie.ai"

    # Grafo
    critic_max_retries: int = 2  # cuántas veces puede reciclar al Cinematographer

    # Ensamblaje de video — servicio Remotion (red interna Docker)
    remotion_url: str = "http://cdpro-remotion:4000"

    # Analytics — Supabase backend
    supabase_url: str = ""
    supabase_service_key: str = ""
    analytics_daily_limit_usd: float = 10.0


@lru_cache
def get_settings() -> Settings:
    return Settings()
