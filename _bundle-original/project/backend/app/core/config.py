"""Settings + constantes inmutables del enjambre.

REGLA DE ORO: la lista ALLOWED_KID_AI_MODELS es la **única** fuente de verdad
sobre qué modelos visuales pueden invocarse. Nada en el sistema debe llamar a
un modelo que no esté aquí.
"""
from __future__ import annotations

from enum import Enum
from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


# ---------------------------------------------------------------------------
# Catálogo único de modelos Kid.ai (REGLA DE ORO — no extender sin aprobación)
# ---------------------------------------------------------------------------

class KidAIImageModel(str, Enum):
    GPT_IMAGENES_2 = "gpt-imagenes-2"        # alto detalle
    NANO_BANANA_PRO = "nano-banana-pro"      # fotorrealismo máximo
    NANO_BANANA_2 = "nano-banana-2"          # bocetos / estilizado rápido


class KidAIVideoModel(str, Enum):
    VEO3 = "veo3"                            # físicas realistas / cine
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
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])

    # Cerebro cognitivo — SOLO Claude
    anthropic_api_key: str = ""
    claude_model: str = "claude-sonnet-4-5"
    claude_max_tokens: int = 4096

    # Músculo creativo — SOLO Kid.ai
    kid_ai_api_key: str = ""
    kid_ai_base_url: str = "https://api.kid.ai/v1"

    # Grafo
    critic_max_retries: int = 2  # cuántas veces puede reciclar al Cinematographer


@lru_cache
def get_settings() -> Settings:
    return Settings()
