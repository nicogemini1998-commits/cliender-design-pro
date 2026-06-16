"""Schemas del Style Vault — Moodboard Engine.

El Vision_Auditor produce un StyleManifest. El Cinematographer_Node lo
fusiona con el prompt del usuario antes de despachar a Kid.ai. Las imágenes
del moodboard se reenvían como `reference_images` (URLs o data: base64).
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class StyleManifest(BaseModel):
    """Resultado del Vision_Auditor — el 'ADN visual' de un moodboard.

    Diseñado para ser fusionado matemáticamente con el prompt del usuario:
    el `master_style_prompt` se PREPENDE al brief, y los campos atómicos
    actúan como vetos/anclas sobre el resto del prompt técnico.
    """
    moodboard_id: str

    color_palette: list[str] = Field(
        default_factory=list,
        description="Hex codes ordenados de dominante a acento (3–7 colores).",
    )
    lighting_style: str = Field(
        default="",
        description="P. ej. 'golden hour rim light, soft falloff, no harsh shadows'.",
    )
    camera_lens_feel: str = Field(
        default="",
        description="P. ej. '50mm anamorphic, shallow DOF, mild chromatic aberration'.",
    )
    character_traits: list[str] = Field(
        default_factory=list,
        description="Rasgos repetidos detectados (físicos, vestuario, props).",
    )
    composition_rules: list[str] = Field(
        default_factory=list,
        description="Reglas compositivas: rule-of-thirds, centered subject, etc.",
    )
    mood_keywords: list[str] = Field(
        default_factory=list,
        description="Palabras clave de mood: editorial, brutal, melancholic, etc.",
    )
    master_style_prompt: str = Field(
        default="",
        description="Una frase compacta (40–60 palabras) que captura el ADN visual.",
    )
    negative_prompt: str = Field(
        default="",
        description="Lo que el estilo NUNCA quiere: 'plastic skin, oversaturated, low-fi'.",
    )
    consistency_score: float = Field(
        default=0.0, ge=0.0, le=1.0,
        description="Qué tan coherente es el set de referencias entre sí.",
    )


class MoodboardImage(BaseModel):
    id: str
    url: str
    width: int | None = None
    height: int | None = None


class Moodboard(BaseModel):
    id: str
    name: str
    images: list[MoodboardImage] = Field(default_factory=list)
    manifest: StyleManifest | None = None
    audit_status: Literal["idle", "auditing", "ready", "error"] = "idle"
    locked: bool = False  # ¿"Lock Style" activo?


class AuditRequest(BaseModel):
    moodboard_id: str
    images: list[MoodboardImage]
    name: str | None = None


class AuditResponse(BaseModel):
    moodboard: Moodboard
