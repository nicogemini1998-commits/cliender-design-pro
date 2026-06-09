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
    characters: list[dict] = Field(
        default_factory=list,
        description="Personajes identificados: identity, description, appearance, pose, character_prompt.",
    )
    # --- Análisis exhaustivo (capas, letras, fuentes, filtros, post) ---
    typography: list[str] = Field(
        default_factory=list,
        description="Tipografías y tratamiento de texto detectados: familia (serif/sans/script/display), "
                    "peso, caso, kerning, posición, color del texto y contenido literal si es legible.",
    )
    filters_effects: list[str] = Field(
        default_factory=list,
        description="Filtros, grano de película, halación, viñeta, aberración cromática, bloom, "
                    "LUT/color grade, texturas overlay, glitch, blur, sharpening, dust/scratches.",
    )
    composition_layers: list[str] = Field(
        default_factory=list,
        description="Capas compositivas de adelante a atrás: foreground, subject, midground, "
                    "background, overlays gráficos, badges, marcos, gradientes superpuestos.",
    )
    color_grading: str = Field(
        default="",
        description="Descripción del color grade: temperatura, contraste, saturación, "
                    "tono de sombras/medios/altas luces, referencia de stock/LUT (ej. teal&orange, Portra 400).",
    )
    text_content: list[str] = Field(
        default_factory=list,
        description="Textos literales legibles en las imágenes (headlines, claims, palabras), "
                    "tal cual aparecen, para entender el lenguaje verbal del estilo.",
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
    audit_error: str | None = None
