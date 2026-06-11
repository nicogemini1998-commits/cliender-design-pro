"""Edición de vídeo: subtítulos automáticos (STT local con faster-whisper) +
preservación/mezcla de audio + música de fondo. Todo con ffmpeg, sin servicios externos.

Presets de subtítulos — márgenes optimizados para RRSS verticales (1080×1920):
  classic  — Open Sans Bold, blanco/outline, SRT (personalizable)
  pop      — Open Sans ExtraBold, MAYÚSCULAS, outline grueso, ASS
  box      — Open Sans Regular, fondo semi-transparente, ASS
  karaoke  — Open Sans ExtraBold, palabra a palabra, ASS + word timestamps

Zona segura RRSS: MarginV=180 (desde abajo), MarginL/R=80 (laterales).
"""
from __future__ import annotations

import asyncio
import logging
import os
import subprocess
import tempfile
import uuid
from typing import Any, Optional

import httpx
from fastapi import APIRouter
import re as _re
from pydantic import BaseModel, field_validator

from app.core.config import get_settings
from app.services.url_guard import assert_safe_url, SSRFBlockedError

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/video", tags=["video"])

_MAX_VIDEO_BYTES = 200 * 1024 * 1024
_WHISPER_MODEL = os.getenv("CDPRO_WHISPER_MODEL", "base")
if _WHISPER_MODEL not in ("tiny", "base", "small", "medium", "large", "large-v2", "large-v3"):
    _WHISPER_MODEL = "base"  # L-3: whitelist — evita descargas inesperadas por env mal puesto
_HEX_RE = _re.compile(r"^#[0-9A-Fa-f]{6}$")
_VALID_XFADE = frozenset([
    "dissolve", "fade", "fadeblack", "fadewhite", "wipeleft", "wiperight", "wipeup", "wipedown",
    "slideleft", "slideright", "slideup", "slidedown", "smoothleft", "smoothright", "smoothup",
    "smoothdown", "circleopen", "circleclose", "circlecrop", "rectcrop", "radial", "zoomin",
    "distance", "fadegrays", "squeezeh", "squeezev", "horzopen", "horzclose", "vertopen", "vertclose",
])
_model = None

# Márgenes seguros para RRSS verticales (1080×1920)
_MARGIN_V   = 180   # px desde el borde inferior — evita UI/navegación
_MARGIN_LR  = 80    # px laterales — evita bordes del encuadre
_PLAY_W     = 1080
_PLAY_H     = 1920


# ─── Whisper ────────────────────────────────────────────────────────────────
def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        logger.info("video.whisper cargando modelo=%s", _WHISPER_MODEL)
        _model = WhisperModel(_WHISPER_MODEL, device="cpu", compute_type="int8")
    return _model


def _transcribe_file(audio_path: str, language: Optional[str]) -> dict[str, Any]:
    model = _get_model()
    segments, info = model.transcribe(
        audio_path, language=language or None,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 400},
    )
    segs = []
    for s in segments:
        text = (s.text or "").strip()
        if text:
            segs.append({"start": float(s.start), "end": float(s.end), "text": text})
    return {"segments": segs, "language": getattr(info, "language", language or "es")}


def _transcribe_file_with_words(audio_path: str, language: Optional[str]) -> dict[str, Any]:
    """Transcribe con timestamps por palabra — requerido para preset karaoke."""
    model = _get_model()
    segments, info = model.transcribe(
        audio_path, language=language or None,
        word_timestamps=True,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 400},
    )
    seg_list, word_list = [], []
    for s in segments:
        text = (s.text or "").strip()
        if text:
            seg_list.append({"start": float(s.start), "end": float(s.end), "text": text})
        for w in (s.words or []):
            word = (w.word or "").strip()
            if word:
                word_list.append({"start": float(w.start), "end": float(w.end), "word": word})
    return {
        "segments": seg_list,
        "words": word_list,
        "language": getattr(info, "language", language or "es"),
    }


# ─── SRT ────────────────────────────────────────────────────────────────────
def _ts_srt(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    h = int(sec // 3600); m = int((sec % 3600) // 60); s = int(sec % 60)
    ms = int(round((sec - int(sec)) * 1000))
    if ms == 1000:
        ms = 999
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def _build_srt(segments: list[dict[str, Any]]) -> str:
    lines = []
    for i, seg in enumerate(segments, 1):
        lines += [str(i), f"{_ts_srt(seg['start'])} --> {_ts_srt(seg['end'])}", seg["text"], ""]
    return "\n".join(lines)


# ─── ASS ────────────────────────────────────────────────────────────────────
def _ts_ass(sec: float) -> str:
    if sec < 0:
        sec = 0.0
    h = int(sec // 3600); m = int((sec % 3600) // 60); s = int(sec % 60)
    cs = int(round((sec - int(sec)) * 100))
    if cs >= 100:
        cs = 99
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _bgr(rgb_hex: str, alpha: int = 0x00) -> str:
    """#RRGGBB → ASS &HaaBBGGRR (alpha 0x00=opaco, 0xFF=transparente)."""
    c = (rgb_hex or "").lstrip("#")
    if len(c) != 6:
        c = "FFFFFF"
    return f"&H{alpha:02X}{c[4:6]}{c[2:4]}{c[0:2]}".upper()


def _ass_file(style_line: str, events: list[tuple]) -> str:
    header = (
        "[Script Info]\nScriptType: v4.00+\n"
        f"PlayResX: {_PLAY_W}\nPlayResY: {_PLAY_H}\n"
        "WrapStyle: 1\nDefaultFontName: Open Sans\n"
        "ScaledBorderAndShadow: yes\n\n[V4+ Styles]\n"
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding\n"
        + style_line + "\n\n[Events]\n"
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
    )
    lines = [header]
    for start, end, text in events:
        t = (text or "").replace("\\", "\\\\").replace("{", "\\{").replace("}", "\\}").replace("\n", "\\N")
        lines.append(f"Dialogue: 0,{_ts_ass(start)},{_ts_ass(end)},Default,,0,0,0,,{t}\n")
    return "".join(lines)


def _align_num(position: str) -> int:
    return {"bottom": 2, "middle": 5, "top": 8}.get(position, 2)


def _mv(position: str) -> int:
    return {"bottom": _MARGIN_V, "middle": 0, "top": 120}.get(position, _MARGIN_V)


def _build_ass_pop(segments: list, font_size: int, position: str) -> str:
    """Open Sans ExtraBold, MAYÚSCULAS, outline grueso. Estilo anuncio/reel impactante."""
    fs = max(36, int(font_size * 1.25))
    a = _align_num(position); mv = _mv(position)
    style = (
        f"Style: Default,Open Sans,{fs},"
        "&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,"
        f"-1,0,0,0,100,100,1,0,1,5,2,{a},{_MARGIN_LR},{_MARGIN_LR},{mv},1"
    )
    events = [(s["start"], s["end"], s["text"].upper()) for s in segments]
    return _ass_file(style, events)


def _build_ass_box(segments: list, font_size: int, position: str) -> str:
    """Open Sans Regular, caja semi-transparente detrás. Elegante y no invasivo."""
    fs = max(30, font_size)
    a = _align_num(position); mv = _mv(position)
    style = (
        f"Style: Default,Open Sans,{fs},"
        "&H00FFFFFF,&H000000FF,&H00000000,&H80000000,"
        f"0,0,0,0,100,100,0,0,3,10,0,{a},{_MARGIN_LR},{_MARGIN_LR},{mv},1"
    )
    events = [(s["start"], s["end"], s["text"]) for s in segments]
    return _ass_file(style, events)


def _build_ass_karaoke(words: list, font_size: int, position: str) -> str:
    """Open Sans ExtraBold, una palabra a la vez, centrado. TikTok/CapCut style."""
    fs = max(44, int(font_size * 1.5))
    a = _align_num(position); mv = _mv(position)
    style = (
        f"Style: Default,Open Sans,{fs},"
        "&H00FFFFFF,&H000000FF,&H00000000,&HA0000000,"
        f"-1,0,0,0,100,100,0,0,1,4,3,{a},{_MARGIN_LR},{_MARGIN_LR},{mv},1"
    )
    events = []
    for w in words:
        word = (w.get("word") or "").strip()
        if word:
            events.append((w["start"], w["end"] + 0.08, word.upper()))
    return _ass_file(style, events)


def _hex_to_ass_color(color: str, default: str = "FFFFFF") -> str:
    """#RRGGBB → ASS &H00BBGGRR (usado en force_style para classic)."""
    c = (color or "").lstrip("#")
    if len(c) != 6:
        c = default
    rr, gg, bb = c[0:2], c[2:4], c[4:6]
    return f"&H00{bb}{gg}{rr}".upper()


# ─── ffmpeg helpers ──────────────────────────────────────────────────────────
def _has_audio(path: str) -> bool:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries",
             "stream=index", "-of", "csv=p=0", path],
            capture_output=True, text=True, timeout=30,
        )
        return bool(out.stdout.strip())
    except Exception:
        return False


def _get_duration(path: str) -> float:
    try:
        out = subprocess.run(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path],
            capture_output=True, text=True, timeout=30,
        )
        return float(out.stdout.strip())
    except Exception:
        return 10.0


async def _concat_with_transitions(
    paths: list[str],
    transition: str,
    tr_dur: float,
    out_path: str,
) -> None:
    """Concatena N clips con xfade entre ellos y sube el resultado."""
    import shutil
    if len(paths) == 1:
        shutil.copy(paths[0], out_path)
        return
    durations = [await asyncio.to_thread(_get_duration, p) for p in paths]
    has_audio_list = [await asyncio.to_thread(_has_audio, p) for p in paths]
    all_have_audio = all(has_audio_list)
    tr_dur = max(0.1, min(float(tr_dur or 0.5), 1.0))
    n = len(paths)
    vf_parts: list[str] = []
    af_parts: list[str] = []
    cumulative = 0.0
    for i in range(n - 1):
        cumulative += durations[i]
        offset = max(0.01, cumulative - tr_dur * (i + 1))
        va = f"[xv{i}]" if i > 0 else "[0:v]"
        vb = f"[{i + 1}:v]"
        vout = "[vout]" if i == n - 2 else f"[xv{i + 1}]"
        vf_parts.append(
            f"{va}{vb}xfade=transition={transition}:duration={tr_dur:.3f}:offset={offset:.3f}{vout}"
        )
        if all_have_audio:
            aa = f"[xa{i}]" if i > 0 else "[0:a]"
            ab = f"[{i + 1}:a]"
            aout = "[aout]" if i == n - 2 else f"[xa{i + 1}]"
            af_parts.append(f"{aa}{ab}acrossfade=d={tr_dur:.3f}{aout}")
    filter_complex = ";".join(vf_parts)
    if af_parts:
        filter_complex += ";" + ";".join(af_parts)
    cmd = ["ffmpeg", "-y"]
    for p in paths:
        cmd += ["-i", p]
    cmd += ["-filter_complex", filter_complex, "-map", "[vout]"]
    if all_have_audio:
        cmd += ["-map", "[aout]"]
    else:
        cmd += ["-an"]
    cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
    if all_have_audio:
        cmd += ["-c:a", "aac", "-b:a", "160k"]
    cmd += [out_path]
    await asyncio.to_thread(_run_ffmpeg, cmd, 900)


def _run_ffmpeg(cmd: list[str], timeout: int = 600) -> None:
    logger.info("video.ffmpeg %s", " ".join(cmd[:12]) + (" ..." if len(cmd) > 12 else ""))
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
    if proc.returncode != 0:
        tail = (proc.stderr or "")[-600:]
        raise RuntimeError(f"ffmpeg fallo ({proc.returncode}): {tail}")


async def _download(url: str, dest: str) -> None:
    assert_safe_url(url)
    size = 0
    async with httpx.AsyncClient(timeout=180, follow_redirects=True) as c:
        async with c.stream("GET", url, headers={"User-Agent": "ClienderDesignPro/1.0"}) as r:
            r.raise_for_status()
            with open(dest, "wb") as f:
                async for chunk in r.aiter_bytes():
                    size += len(chunk)
                    if size > _MAX_VIDEO_BYTES:
                        raise ValueError("archivo demasiado grande (>200MB)")
                    f.write(chunk)


async def _upload_supabase(path: str, ext: str = "mp4", ctype: str = "video/mp4") -> str:
    s = get_settings()
    if not s.supabase_url or not s.supabase_service_key:
        raise RuntimeError("Supabase no configurado: no se puede persistir el vídeo editado")
    with open(path, "rb") as f:
        buf = f.read()
    base = s.supabase_url.rstrip("/")
    key = s.supabase_service_key
    obj = f"generations/edited-{uuid.uuid4().hex}.{ext}"
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": ctype, "x-upsert": "true"}
    async with httpx.AsyncClient(timeout=180) as c:
        up = await c.post(f"{base}/storage/v1/object/brand-assets/{obj}", headers=headers, content=buf)
        up.raise_for_status()
    return f"{base}/storage/v1/object/public/brand-assets/{obj}"


def _cleanup(folder: str) -> None:
    try:
        for f in os.listdir(folder):
            try:
                os.remove(os.path.join(folder, f))
            except Exception:
                pass
        os.rmdir(folder)
    except Exception:
        pass


# ─── Request models ──────────────────────────────────────────────────────────
class TranscribeRequest(BaseModel):
    url: str
    language: Optional[str] = None


class SubtitleStyle(BaseModel):
    # H-6: estos valores van al filtro ffmpeg (force_style). Sin validar, un valor
    # con comillas/; podría romper o inyectar en el grafo de filtros.
    @field_validator("color", "outline_color")
    @classmethod
    def _hex_only(cls, v: str) -> str:
        return v if _HEX_RE.match(str(v) or "") else "#FFFFFF"

    @field_validator("position")
    @classmethod
    def _pos_only(cls, v: str) -> str:
        return v if v in ("bottom", "middle", "top") else "bottom"
    color: str = "#FFFFFF"
    outline_color: str = "#000000"
    font_size: int = 42            # px a resolución nativa (1080×1920)
    bold: bool = True
    position: str = "bottom"      # bottom | middle | top


class VideoEditRequest(BaseModel):
    url: str = ""                           # URL única (legado)
    urls: list[str] = []                    # multi-vídeo — sobreescribe url si len > 1
    transition: str = "dissolve"            # xfade: dissolve|fade|wipeleft|wiperight|slideleft
    transition_duration: float = 0.5        # segundos de crossfade (0.1–1.0)
    burn_subtitles: bool = True
    language: Optional[str] = None
    keep_audio: bool = True
    music_url: Optional[str] = None
    music_volume: float = 0.18
    subtitle_style: SubtitleStyle = SubtitleStyle()
    subtitle_preset: str = "classic"        # classic | pop | box | karaoke

    @field_validator("transition")
    @classmethod
    def _xfade_only(cls, v: str) -> str:
        # M-6: solo transiciones xfade conocidas — evita inyección en el filtro ffmpeg.
        return v if v in _VALID_XFADE else "dissolve"

    @field_validator("subtitle_preset")
    @classmethod
    def _preset_only(cls, v: str) -> str:
        return v if v in ("classic", "pop", "box", "karaoke") else "classic"


# ─── Endpoints ───────────────────────────────────────────────────────────────
@router.post("/transcribe")
async def transcribe(req: TranscribeRequest):
    try:
        assert_safe_url(req.url)
    except SSRFBlockedError as e:
        return {"segments": [], "error": f"url no permitida: {e}"}
    tmp = tempfile.mkdtemp(prefix="cdpro-stt-")
    vid = os.path.join(tmp, "in.mp4")
    wav = os.path.join(tmp, "audio.wav")
    try:
        await _download(req.url, vid)
        await asyncio.to_thread(
            _run_ffmpeg, ["ffmpeg", "-y", "-i", vid, "-vn", "-ac", "1", "-ar", "16000", wav], 300
        )
        result = await asyncio.to_thread(_transcribe_file, wav, req.language)
        result["srt"] = _build_srt(result["segments"])
        result["text"] = " ".join(s["text"] for s in result["segments"])
        return result
    except Exception as e:
        logger.error("video.transcribe error: %s", e, exc_info=True)
        return {"segments": [], "error": str(e)[:240]}
    finally:
        _cleanup(tmp)


@router.post("/edit")
async def edit(req: VideoEditRequest):
    eff_urls = req.urls if len(req.urls) > 1 else ([req.url] if req.url else [])
    if not eff_urls:
        return {"url": "", "error": "Se requiere al menos una URL de vídeo"}
    try:
        for u in eff_urls:
            assert_safe_url(u)
        if req.music_url:
            assert_safe_url(req.music_url)
    except SSRFBlockedError as e:
        return {"url": "", "error": f"url no permitida: {e}"}

    tmp = tempfile.mkdtemp(prefix="cdpro-edit-")
    vid = os.path.join(tmp, "in.mp4")
    wav = os.path.join(tmp, "audio.wav")
    music = os.path.join(tmp, "music.mp3")
    out = os.path.join(tmp, "out.mp4")
    segments: list[dict[str, Any]] = []
    sub_path: Optional[str] = None
    sub_is_ass = False

    try:
        if len(eff_urls) > 1:
            clips = [os.path.join(tmp, f"clip{i}.mp4") for i in range(len(eff_urls))]
            for u, p in zip(eff_urls, clips):
                await _download(u, p)
            await _concat_with_transitions(clips, req.transition, req.transition_duration, vid)
        else:
            await _download(eff_urls[0], vid)
        src_has_audio = await asyncio.to_thread(_has_audio, vid)

        # 1) Transcribir + generar archivo de subtítulos según preset
        if req.burn_subtitles and src_has_audio:
            await asyncio.to_thread(
                _run_ffmpeg, ["ffmpeg", "-y", "-i", vid, "-vn", "-ac", "1", "-ar", "16000", wav], 300
            )
            preset = (req.subtitle_preset or "classic").lower()

            if preset == "karaoke":
                tr = await asyncio.to_thread(_transcribe_file_with_words, wav, req.language)
                segments = tr["segments"]
                words = tr.get("words", [])
            else:
                tr = await asyncio.to_thread(_transcribe_file, wav, req.language)
                segments = tr["segments"]
                words = []

            if segments or words:
                st = req.subtitle_style
                if preset == "pop":
                    content = _build_ass_pop(segments, st.font_size, st.position)
                    sub_path = os.path.join(tmp, "subs.ass")
                    sub_is_ass = True
                elif preset == "box":
                    content = _build_ass_box(segments, st.font_size, st.position)
                    sub_path = os.path.join(tmp, "subs.ass")
                    sub_is_ass = True
                elif preset == "karaoke":
                    src = words if words else segments
                    content = _build_ass_karaoke(src, st.font_size, st.position)
                    sub_path = os.path.join(tmp, "subs.ass")
                    sub_is_ass = True
                else:  # classic — SRT + force_style con Open Sans + márgenes RRSS
                    content = _build_srt(segments)
                    sub_path = os.path.join(tmp, "subs.srt")
                    sub_is_ass = False
                with open(sub_path, "w", encoding="utf-8") as f:
                    f.write(content)

        # 2) Construir filtros ffmpeg
        burn = req.burn_subtitles and bool(sub_path)
        has_music = bool(req.music_url)
        if has_music:
            await _download(req.music_url, music)

        cmd = ["ffmpeg", "-y", "-i", vid]
        if has_music:
            cmd += ["-i", music]

        filter_parts = []

        if burn and sub_is_ass:
            esc = sub_path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
            filter_parts.append(f"[0:v]subtitles='{esc}'[v]")
            vmap = "[v]"
        elif burn:
            st = req.subtitle_style
            a = {"bottom": 2, "middle": 5, "top": 8}.get(st.position, 2)
            mv = _mv(st.position)
            force_style = (
                f"FontName=Open Sans,FontSize={st.font_size},"
                f"PrimaryColour={_hex_to_ass_color(st.color,'FFFFFF')},"
                f"OutlineColour={_hex_to_ass_color(st.outline_color,'000000')},"
                f"BorderStyle=1,Outline=2,Shadow=1,Bold={-1 if st.bold else 0},"
                f"Alignment={a},MarginL={_MARGIN_LR},MarginR={_MARGIN_LR},MarginV={mv}"
            )
            esc = sub_path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'")
            filter_parts.append(f"[0:v]subtitles='{esc}':force_style='{force_style}'[v]")
            vmap = "[v]"
        else:
            vmap = "0:v"

        amap = None
        if req.keep_audio and src_has_audio and has_music:
            filter_parts.append(
                f"[0:a]volume=1.0[a0];[1:a]volume={max(0.0, min(req.music_volume, 1.0))}[a1];"
                f"[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[aout]"
            )
            amap = "[aout]"
        elif req.keep_audio and src_has_audio:
            amap = "0:a"
        elif has_music:
            amap = "1:a"

        if filter_parts:
            cmd += ["-filter_complex", ";".join(filter_parts)]
        cmd += ["-map", vmap]
        if amap:
            cmd += ["-map", amap]

        cmd += ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p"]
        if amap:
            cmd += ["-c:a", "aac", "-b:a", "160k", "-shortest"]
        else:
            cmd += ["-an"]
        cmd += [out]

        await asyncio.to_thread(_run_ffmpeg, cmd, 600)
        url = await _upload_supabase(out)
        return {
            "url": url,
            "subtitles_burned": burn,
            "subtitle_preset": req.subtitle_preset,
            "segments": segments,
            "had_audio": src_has_audio,
            "music_mixed": has_music,
        }
    except Exception as e:
        logger.error("video.edit error: %s", e, exc_info=True)
        return {"url": "", "error": str(e)[:240]}
    finally:
        _cleanup(tmp)
