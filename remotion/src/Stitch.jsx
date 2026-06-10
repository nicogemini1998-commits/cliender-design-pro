import React from "react";
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
  Audio,
  staticFile,
} from "remotion";

export const INTRO_FRAMES = 50;
export const OUTRO_FRAMES = 65;
export const FADE = 12;

// ════════════════════════════════════════════════════════════════════════
//  CINEMATIC ENGINE v2 — Cliender Design Pro
//
//  Sistema de ensamblaje cinematográfico: color grade (split-tone), film
//  grain 16mm, vignette, letterbox 2.39:1, Ken Burns multi-variante,
//  captions editoriales y transiciones de cine con clips solapados.
//  Receta de color basada en AP Classic Cine (orange-teal, lifted blacks).
// ════════════════════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────────────────────────
// LOOKS — color grades cinematográficos.
// `filter` se aplica al clip; `shadowTint`/`highlightTint` generan el
// split-tone con overlays mix-blend-mode (sombras teal, luces amber).
// ──────────────────────────────────────────────────────────────────────────
export const LOOKS = {
  cine: {
    label: "Cine (Teal & Orange)",
    description: "Grade de blockbuster: sombras teal, luces ámbar cálidas, negros levantados estilo película 16mm. El look de cine moderno.",
    filter: "contrast(1.12) saturate(1.18) sepia(0.06) hue-rotate(-5deg) brightness(1.02)",
    shadows: "#0b4a5c", shadowsOpacity: 0.28,
    highlights: "#ffc7a0", highlightsOpacity: 0.22,
    liftBlacks: 0.05,
    grainBoost: 1.0,
  },
  golden: {
    label: "Golden Hour",
    description: "Luz dorada de atardecer: cálido, nostálgico, piel favorecida. Ideal para lifestyle, viajes y momentos humanos.",
    filter: "sepia(0.30) saturate(1.35) contrast(1.05) brightness(1.06) hue-rotate(-11deg)",
    shadows: "#2a2014", shadowsOpacity: 0.30,
    highlights: "#ffd9a0", highlightsOpacity: 0.18,
    liftBlacks: 0.04,
    grainBoost: 0.9,
  },
  noir: {
    label: "Film Noir",
    description: "Blanco y negro de alto contraste con grano marcado. Dramático, atemporal, editorial puro.",
    filter: "grayscale(1) contrast(1.45) brightness(0.96)",
    shadows: null, shadowsOpacity: 0,
    highlights: null, highlightsOpacity: 0,
    liftBlacks: 0.05,
    grainBoost: 1.6,
    vignetteBoost: 1.6,
  },
  vintage: {
    label: "Vintage Film",
    description: "Película analógica tipo Kodak Portra: negros levantados, contraste bajo, piel cálida, grano visible. Nostalgia auténtica.",
    filter: "sepia(0.18) saturate(1.10) contrast(0.92) brightness(1.06) hue-rotate(-6deg)",
    shadows: "#2a2620", shadowsOpacity: 0.5,
    highlights: "#f7ead2", highlightsOpacity: 0.12,
    liftBlacks: 0.07,
    grainBoost: 1.7,
  },
  clean: {
    label: "Clean Commercial",
    description: "Limpio y pulido de anuncio premium: contraste sutil, color fiel, mínimo grano. Para producto y marca.",
    filter: "contrast(1.06) saturate(1.12) brightness(1.03)",
    shadows: null, shadowsOpacity: 0,
    highlights: null, highlightsOpacity: 0,
    liftBlacks: 0.02,
    grainBoost: 0.4,
    vignetteBoost: 0.5,
  },
  none: {
    label: "Sin grade",
    description: "Color original de los clips, sin tratamiento. Solo transiciones y montaje.",
    filter: "none",
    shadows: null, shadowsOpacity: 0,
    highlights: null, highlightsOpacity: 0,
    liftBlacks: 0,
    grainBoost: 0,
    vignetteBoost: 0,
  },
};

const DEFAULT_LOOK = "cine";

// ──────────────────────────────────────────────────────────────────────────
// TRANSICIONES — cómo ENTRA cada clip sobre el anterior (solapados).
// ──────────────────────────────────────────────────────────────────────────
export const TRANSITIONS = {
  dissolve: {
    label: "Disolvencia",
    description: "Crossfade suave: el clip nuevo se funde sobre el anterior. Elegante y fluido — el estándar profesional.",
    frames: (fps) => Math.round(fps * 0.5),
  },
  lumafade: {
    label: "Luma fade",
    description: "Fundido por luminancia: las luces del clip nuevo aparecen primero, después las sombras. El crossfade favorito del cine documental.",
    frames: (fps) => Math.round(fps * 0.55),
  },
  filmburn: {
    label: "Film burn",
    description: "Flash cálido de película quemada entre clips, con bloom naranja. Transición orgánica de cine analógico.",
    frames: (fps) => Math.round(fps * 0.45),
  },
  fade: {
    label: "Fundido a negro",
    description: "El clip se oscurece a negro y el siguiente emerge desde negro. Marca un cambio de bloque o de tiempo.",
    frames: (fps) => Math.round(fps * 0.6),
  },
  blurwipe: {
    label: "Blur wipe",
    description: "El clip anterior se desenfoca mientras el nuevo emerge nítido. Suave, premium, muy usado en moda y belleza.",
    frames: (fps) => Math.round(fps * 0.5),
  },
  slide: {
    label: "Deslizamiento",
    description: "El clip nuevo entra empujando desde la derecha. Dinámico y direccional, ideal para ritmo ágil.",
    frames: (fps) => Math.round(fps * 0.45),
  },
  slideup: {
    label: "Deslizamiento vertical",
    description: "El clip nuevo sube desde abajo cubriendo al anterior. Moderno, tipo feed/stories.",
    frames: (fps) => Math.round(fps * 0.45),
  },
  zoom: {
    label: "Zoom punch",
    description: "El clip entra con un golpe de zoom y desenfoque que se resuelve. Energético y viral.",
    frames: (fps) => Math.round(fps * 0.4),
  },
  whip: {
    label: "Whip pan",
    description: "Barrido rápido con desenfoque de movimiento, como un latigazo de cámara. Estilo vlog/reel dinámico.",
    frames: (fps) => Math.round(fps * 0.35),
  },
  wipe: {
    label: "Barrido (wipe)",
    description: "Una cortina revela el clip nuevo de izquierda a derecha. Editorial y limpio.",
    frames: (fps) => Math.round(fps * 0.5),
  },
  glitch: {
    label: "Glitch digital",
    description: "Corte con distorsión RGB y parpadeo breve. Tech, urbano y moderno.",
    frames: (fps) => Math.round(fps * 0.35),
  },
  cut: {
    label: "Corte seco",
    description: "Cambio instantáneo sin transición. Directo y rítmico, el montaje del 80% del cine.",
    frames: () => 0,
  },
};

const DEFAULT_TRANSITION = "dissolve";

export function transitionId(scene) {
  const t = scene && typeof scene.transition === "string" ? scene.transition.toLowerCase() : "";
  return TRANSITIONS[t] ? t : DEFAULT_TRANSITION;
}

function transitionFrames(scene, fps) {
  const id = transitionId(scene);
  const custom = scene && Number(scene.transitionDurationInFrames);
  if (custom && custom > 0) return Math.round(custom);
  return TRANSITIONS[id].frames(fps);
}

const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

// ──────────────────────────────────────────────────────────────────────────
// Timeline con solapes — fuente única para metadata y composición.
// ──────────────────────────────────────────────────────────────────────────
// `branding=false` (default): el montaje contiene SOLO el contenido del usuario
// — sin intro/outro de marca. La primera escena arranca en el frame 0.
function computeTimeline(scenes, fps, branding) {
  const items = [];
  let prevStart = 0;
  let prevDur = branding ? INTRO_FRAMES : 0;
  if (branding) items.push({ type: "intro", from: 0, dur: INTRO_FRAMES, td: 0 });

  scenes.forEach((scene, i) => {
    const dur = Number(scene.durationInFrames) || fps * 5;
    const noPrev = i === 0 && !branding;
    const td = noPrev ? 0 : Math.min(transitionFrames(scene, fps), Math.floor(prevDur * 0.9));
    const start = Math.max(0, prevStart + prevDur - td);
    items.push({ type: "scene", scene, index: i, from: start, dur, td });
    prevStart = start;
    prevDur = dur;
  });

  let total = prevStart + prevDur;
  if (branding) {
    const outroTd = Math.min(TRANSITIONS.dissolve.frames(fps), Math.floor(prevDur * 0.9));
    const outroStart = Math.max(0, prevStart + prevDur - outroTd);
    items.push({ type: "outro", from: outroStart, dur: OUTRO_FRAMES, td: outroTd });
    total = outroStart + OUTRO_FRAMES;
  }
  return { items, total };
}

export function calcStitchMetadata({ props }) {
  const fps = props.fps || 30;
  const scenes = Array.isArray(props.scenes) ? props.scenes : [];
  const branding = !!(props.style && props.style.branding === true);
  const { total } = computeTimeline(scenes, fps, branding);
  return {
    durationInFrames: Math.max(total, fps),
    fps,
    width: props.width || 1080,
    height: props.height || 1920,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// FILM GRAIN — SVG feTurbulence determinista (seed rota con el frame).
// mix-blend-mode overlay simula grano de luminancia 16mm.
// ──────────────────────────────────────────────────────────────────────────
function FilmGrain({ amount = 0.18 }) {
  const frame = useCurrentFrame();
  if (amount <= 0.001) return null;
  const seed = (frame % 16) + 1; // 16 placas de grano en loop — determinista
  return (
    <AbsoluteFill style={{ pointerEvents: "none", mixBlendMode: "overlay", opacity: amount }}>
      <svg width="100%" height="100%">
        <filter id={`grain-${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain-${seed})`} />
      </svg>
    </AbsoluteFill>
  );
}

// Vignette doble capa (look de colorista): elipse suave grande + esquinas
// multiplicadas. Centro al 48% vertical — el peso óptico vive un poco alto.
function Vignette({ amount = 0.32, lift = 0 }) {
  return (
    <>
      <AbsoluteFill style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 90% 75% at 50% 48%, transparent 60%, rgba(0,0,0,${amount}) 100%)`,
      }} />
      <AbsoluteFill style={{
        pointerEvents: "none",
        background: `radial-gradient(ellipse 140% 110% at 50% 50%, transparent 78%, rgba(0,0,0,${amount * 1.5}) 100%)`,
        mixBlendMode: "multiply", opacity: 0.6,
      }} />
      {lift > 0 ? (
        <AbsoluteFill style={{ pointerEvents: "none", background: `rgba(120,120,135,${lift})`, mixBlendMode: "screen" }} />
      ) : null}
    </>
  );
}

// Split-tone real por luminancia: `lighten` solo actúa sobre píxeles más
// oscuros que la capa (tiñe sombras), `darken` solo sobre los más claros
// (tiñe luces). Equivalente CSS de las curvas split-tone de DaVinci.
function SplitTone({ look }) {
  if (!look) return null;
  return (
    <>
      {look.shadows ? (
        <AbsoluteFill style={{ pointerEvents: "none", backgroundColor: look.shadows, mixBlendMode: "lighten", opacity: look.shadowsOpacity }} />
      ) : null}
      {look.highlights ? (
        <AbsoluteFill style={{ pointerEvents: "none", backgroundColor: look.highlights, mixBlendMode: "darken", opacity: look.highlightsOpacity }} />
      ) : null}
    </>
  );
}

// Letterbox cinemascope — barras que entran animadas al principio.
function Letterbox({ enabled, height }) {
  const frame = useCurrentFrame();
  if (!enabled) return null;
  const barH = Math.round(height * 0.075); // 144px en 1920 — cine sutil sin sacrificar pantalla
  const slide = interpolate(frame, [0, 24], [barH, 0], { extrapolateRight: "clamp" });
  const common = { position: "absolute", left: 0, right: 0, height: barH, background: "#000", zIndex: 50 };
  return (
    <>
      <div style={{ ...common, top: 0, transform: `translateY(${-slide}px)` }} />
      <div style={{ ...common, bottom: 0, transform: `translateY(${slide}px)` }} />
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// KEN BURNS — 5 movimientos de cámara, asignados determinísticamente por
// índice de escena (alternancia para que nunca repita dos seguidos).
// Curva casi lineal = cámara real, no zoom digital.
// ──────────────────────────────────────────────────────────────────────────
const KENBURNS = ["zoomin", "zoomout", "panleft", "panright", "diagonal"];

// Curva "cámara real": arranque perceptible y deceleración larga tipo dolly.
// cubic-bezier(0.25, 0.1, 0.25, 1) evaluada analíticamente (aprox. smoothstep sesgado).
function cameraEase(p) {
  const c = clamp01(p);
  return c * c * (3 - 2 * c) * 0.85 + c * 0.15;
}

// Nunca arrancar en scale 1.0 exacto (el primer frame ya tiene tensión) y
// siempre micro-drift acompañando el zoom — la cámara real nunca zoomea centrada.
function kenBurnsStyle(variant, frame, dur) {
  const p = cameraEase(frame / Math.max(1, dur));
  switch (variant) {
    case "zoomout":
      return `scale(${1.14 - 0.09 * p}) translate(${(1 - p) * 1.0}%, ${(1 - p) * 0.6}%)`;
    case "panleft":
      return `scale(1.16) translate(${2.5 - 5 * p}%, ${-0.8 + 1.6 * p}%)`;
    case "panright":
      return `scale(1.16) translate(${-2.5 + 5 * p}%, ${-0.8 + 1.6 * p}%)`;
    case "diagonal":
      return `scale(1.16) translate(${-2.5 + 5 * p}%, ${-1.8 + 3.6 * p}%)`;
    case "zoomin":
    default:
      return `scale(${1.04 + 0.10 * p}) translate(${p * -1.2}%, ${p * -0.8}%)`;
  }
}

// ──────────────────────────────────────────────────────────────────────
// Animación de ENTRADA del clip según transición.
// ──────────────────────────────────────────────────────────────────────────
function enterStyle(type, frame, td) {
  if (td <= 0 || frame >= td) return { wrapper: { opacity: 1 }, flash: 0 };
  const p = clamp01(frame / td);
  const e = easeInOut(p);
  switch (type) {
    case "cut":
      return { wrapper: { opacity: 1 }, flash: 0 };
    case "dissolve":
      return { wrapper: { opacity: e }, flash: 0 };
    case "lumafade": {
      // Luces primero: brightness alta que se asienta mientras sube opacity.
      const bright = 1 + (1 - e) * 0.9;
      return { wrapper: { opacity: e, filter: `brightness(${bright})` }, flash: 0 };
    }
    case "filmburn": {
      // Flash cálido en la primera mitad del solape.
      const flash = p < 0.45 ? easeInOut(p / 0.45) : 1 - easeInOut((p - 0.45) / 0.55);
      return { wrapper: { opacity: clamp01(e * 1.3) }, flash };
    }
    case "fade": {
      const op = clamp01((p - 0.15) / 0.85);
      return { wrapper: { opacity: easeInOut(op) }, flash: 0 };
    }
    case "blurwipe":
      return { wrapper: { opacity: e, filter: `blur(${(1 - e) * 18}px)` }, flash: 0 };
    case "slide":
      return { wrapper: { opacity: 1, transform: `translateX(${(1 - e) * 100}%)` }, flash: 0 };
    case "slideup":
      return { wrapper: { opacity: 1, transform: `translateY(${(1 - e) * 100}%)` }, flash: 0 };
    case "zoom":
      return { wrapper: { opacity: clamp01(e * 1.4), transform: `scale(${1.32 - 0.32 * e})`, filter: `blur(${(1 - e) * 14}px)` }, flash: 0 };
    case "whip":
      return { wrapper: { opacity: clamp01(e * 1.6), transform: `translateX(${(1 - e) * 55}%)`, filter: `blur(${(1 - e) * 22}px)` }, flash: 0 };
    case "wipe":
      return { wrapper: { opacity: 1, clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` }, flash: 0 };
    case "glitch": {
      const jitter = (Math.sin(frame * 12.9898) * 43758.5453) % 1;
      const dx = (jitter - 0.5) * (1 - e) * 26;
      return {
        wrapper: {
          opacity: clamp01(e * 1.5),
          transform: `translateX(${dx}px)`,
          filter: `drop-shadow(${(1 - e) * 8}px 0 0 #ff003c88) drop-shadow(${-(1 - e) * 8}px 0 0 #00e5ff88) saturate(${1 + (1 - e) * 1.5})`,
        },
        flash: 0,
      };
    }
    default:
      return { wrapper: { opacity: e }, flash: 0 };
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Caption editorial — receta omgadrian: peso light, tracking amplio,
// fade-in puro 14 frames, entra ~0.8s tras el inicio del clip, lower third.
// ──────────────────────────────────────────────────────────────────────────
// Píldora de subtítulo — estilo cine compartido por captions manuales y automáticos.
function CaptionPill({ text, accent, opacity, rise, letterbox }) {
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: `0 54px ${letterbox ? 210 : 170}px`, zIndex: 45 }}>
      <div style={{ opacity, transform: `translateY(${rise}px)`, textAlign: "center", maxWidth: "100%" }}>
        <span style={{
          display: "inline-block",
          fontFamily: "Geist, 'Helvetica Neue', system-ui, sans-serif",
          color: "#FFFFFF",
          fontSize: 50,
          fontWeight: 600,
          lineHeight: 1.28,
          letterSpacing: "0.01em",
          padding: "10px 24px 12px",
          borderRadius: 14,
          background: "rgba(6,6,10,0.45)",
          borderBottom: `3px solid ${accent}`,
          textShadow: "0 2px 18px rgba(0,0,0,0.85), 0 0 3px rgba(0,0,0,0.9)",
          maxWidth: "100%",
        }}>{text}</span>
      </div>
    </AbsoluteFill>
  );
}

function CinematicCaption({ text, accent, frame, fps, letterbox, sceneDur }) {
  if (!text) return null;
  // Entra pronto (0.3s) y rápido (10f) — en escenas cortas, desde el frame 0.
  const inStart = Math.min(Math.round(fps * 0.3), Math.max(0, Math.round((sceneDur || fps * 3) * 0.15)));
  const opacity = interpolate(frame, [inStart, inStart + 10], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(frame, [inStart, inStart + 14], [16, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <CaptionPill text={text} accent={accent} opacity={opacity} rise={rise} letterbox={letterbox} />;
}

// Subtítulos AUTOMÁTICOS — segments [{start,end,text}] de la transcripción
// Whisper del propio vídeo. Cada frase aparece sincronizada con la voz.
function TimedCaptions({ segments, accent, frame, fps, letterbox }) {
  const t = frame / fps;
  const seg = segments.find((s) => t >= s.start && t < s.end + 0.08);
  if (!seg || !seg.text) return null;
  const local = frame - Math.round(seg.start * fps);
  const opacity = interpolate(local, [0, 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rise = interpolate(local, [0, 7], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <CaptionPill text={seg.text} accent={accent} opacity={opacity} rise={rise} letterbox={letterbox} />;
}

function isVideoScene(scene) {
  if (scene && typeof scene.kind === "string") return scene.kind.toLowerCase() === "video";
  const u = String((scene && scene.url) || "").split("?")[0].toLowerCase();
  return /\.(mp4|mov|webm|m4v)$/.test(u);
}

// ──────────────────────────────────────────────────────────────────────────
// Escena — clip + grade + Ken Burns + caption + transición de entrada.
// ──────────────────────────────────────────────────────────────────────────
function SceneClip({ scene, index, accent, transition, td, look, style }) {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const isVideo = isVideoScene(scene);
  const { wrapper, flash } = enterStyle(transition, frame, td);

  const kb = scene.kenburns && KENBURNS.includes(scene.kenburns)
    ? scene.kenburns
    : KENBURNS[index % KENBURNS.length];
  const mediaTransform = isVideo ? undefined : kenBurnsStyle(kb, frame, durationInFrames);

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", ...wrapper }}>
        {/* Capa de media con color grade */}
        <AbsoluteFill style={{ filter: look.filter === "none" ? undefined : look.filter }}>
          {isVideo ? (
            <OffthreadVideo src={scene.url} muted={scene.muted !== false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <Img src={scene.url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: mediaTransform }} />
          )}
        </AbsoluteFill>
        <SplitTone look={look} />
        <Vignette amount={style.vignette * (look.vignetteBoost || 1)} lift={look.liftBlacks} />
        {Array.isArray(scene.segments) && scene.segments.length ? (
          <TimedCaptions segments={scene.segments} accent={accent} frame={frame} fps={fps} letterbox={style.letterbox} />
        ) : (
          <CinematicCaption text={scene.caption} accent={accent} frame={frame} fps={fps} letterbox={style.letterbox} sceneDur={durationInFrames} />
        )}
      </AbsoluteFill>
      {/* Flash de film burn — encima de todo el clip */}
      {flash > 0 ? (
        <AbsoluteFill style={{
          pointerEvents: "none",
          opacity: flash,
          background: "radial-gradient(circle 120% at 50% 60%, rgba(255,255,255,0.95) 0%, rgba(255,200,120,0.85) 30%, rgba(255,106,0,0.6) 60%, rgba(180,30,0,0.2) 100%)",
          mixBlendMode: "screen",
        }} />
      ) : null}
    </AbsoluteFill>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Intro/Outro cinematográficos — tracking de letras + glow + grade coherente.
// ──────────────────────────────────────────────────────────────────────────
function BrandCard({ brand, kind }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const accent = (brand && brand.accent) || "#A78BFA";
  const opacity =
    kind === "intro"
      ? interpolate(frame, [0, FADE, durationInFrames - FADE, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [0, FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Tracking-in: las letras se acercan desde un espaciado amplio (look título de cine).
  const tracking = interpolate(frame, [0, Math.min(34, durationInFrames)], [0.62, 0.38], { extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 26], [0.96, 1], { extrapolateRight: "clamp" });
  const glow = interpolate(frame, [0, 24, durationInFrames], [0, 1, 0.75], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#060609", justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(62% 52% at 50% 40%, ${accent}26, transparent 70%)`, opacity: glow }} />
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
        {brand && brand.logoUrl ? (
          <Img src={brand.logoUrl} style={{ width: 132, height: 132, borderRadius: "50%", objectFit: "cover", boxShadow: `0 24px 70px -12px ${accent}88` }} />
        ) : null}
        <div style={{
          fontFamily: "Geist, 'Helvetica Neue', system-ui, sans-serif",
          color: "#F5F0E8", fontSize: 58, fontWeight: 300,
          letterSpacing: `${tracking}em`, textIndent: `${tracking}em`,
          textShadow: `0 0 44px ${accent}55`,
        }}>
          {(brand && brand.name ? brand.name : "CLIENDER").toUpperCase()}
        </div>
        {kind === "outro" ? (
          <div style={{ fontFamily: "monospace", color: accent, fontSize: 19, letterSpacing: "0.34em", textTransform: "uppercase", opacity: 0.9 }}>
            creative supercomputer
          </div>
        ) : null}
      </div>
      <FilmGrain amount={0.14} />
      <Vignette amount={0.4} lift={0.03} />
    </AbsoluteFill>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Composición principal.
// ──────────────────────────────────────────────────────────────────────
// DISEÑO DE SONIDO — SFX sincronizados con cada transición. El sonido entra
// ~0.12s ANTES del corte (J-cut): el oído anticipa lo que el ojo verá.
// Archivos en public/sfx/ (síntesis procedural propia, sin copyright).
// ──────────────────────────────────────────────────────────────────────
const SFX_FOR = {
  dissolve: [["whoosh", 0.32]],
  lumafade: [["whoosh", 0.28]],
  filmburn: [["whoosh", 0.45], ["boom", 0.5]],
  fade: [["whoosh", 0.26]],
  blurwipe: [["whoosh", 0.38]],
  slide: [["whoosh", 0.45]],
  slideup: [["whoosh", 0.45]],
  zoom: [["boom", 0.55], ["whoosh", 0.35]],
  whip: [["whoosh", 0.6]],
  wipe: [["whoosh", 0.4]],
  glitch: [["click", 0.5], ["whoosh", 0.32]],
  cut: [["click", 0.38]],
};

function TransitionSfx({ items, fps }) {
  const lead = Math.round(fps * 0.12);
  return items
    .filter((it) => it.type === "scene" && it.from > 0)
    .map((it) => {
      const sounds = SFX_FOR[transitionId(it.scene)] || [["whoosh", 0.32]];
      return (
        <Sequence key={`sfx${it.index}`} from={Math.max(0, it.from - lead)} durationInFrames={Math.round(fps * 1.5)}>
          {sounds.map(([name, vol]) => (
            <Audio key={name} src={staticFile(`sfx/${name}.wav`)} volume={vol} />
          ))}
        </Sequence>
      );
    });
}

// Fundidos de película cuando no hay intro/outro de marca: negro → imagen al
// arrancar (0.33s) y fundido suave a negro al cerrar (0.4s). Lenguaje de cine
// sin añadir contenido ajeno al del usuario.
function FilmFades({ total, fps }) {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, Math.round(fps * 0.33)], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [total - Math.round(fps * 0.4), total - 1], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const op = Math.max(fadeIn, fadeOut);
  if (op <= 0.001) return null;
  return <AbsoluteFill style={{ pointerEvents: "none", background: "#000", opacity: op, zIndex: 60 }} />;
}

// ──────────────────────────────────────────────────────────────────────
// Composición principal.
//   props.style = { look, grain (0..1), vignette (0..1), letterbox (bool),
//                   sfx (bool, default true), branding (bool, default false) }
// ──────────────────────────────────────────────────────────────────────
export function Stitch({ scenes = [], brand = {}, fps = 30, style: styleProp = {} }) {
  const accent = brand.accent || "#A78BFA";
  const lookId = styleProp.look && LOOKS[styleProp.look] ? styleProp.look : DEFAULT_LOOK;
  const look = LOOKS[lookId];
  const branding = styleProp.branding === true; // default: SOLO contenido del usuario
  const sfx = styleProp.sfx !== false;          // default: sonido cinematográfico ON
  const style = {
    look: lookId,
    grain: typeof styleProp.grain === "number" ? clamp01(styleProp.grain) : 0.18,
    vignette: typeof styleProp.vignette === "number" ? clamp01(styleProp.vignette) : 0.32,
    letterbox: styleProp.letterbox !== false, // ON por defecto: look cine
  };
  const { items, total } = computeTimeline(scenes, fps, branding);
  const { height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {items.map((it) => {
        if (it.type === "intro") {
          return (
            <Sequence key="intro" from={it.from} durationInFrames={it.dur}>
              <BrandCard brand={brand} kind="intro" />
            </Sequence>
          );
        }
        if (it.type === "outro") {
          return (
            <Sequence key="outro" from={it.from} durationInFrames={it.dur}>
              <BrandCard brand={brand} kind="outro" />
            </Sequence>
          );
        }
        return (
          <Sequence key={`s${it.index}`} from={it.from} durationInFrames={it.dur}>
            <SceneClip scene={it.scene} index={it.index} accent={accent} transition={transitionId(it.scene)} td={it.td} look={look} style={style} />
          </Sequence>
        );
      })}
      {/* Capas globales: sonido, grano, letterbox y fundidos de película */}
      {sfx ? <TransitionSfx items={items} fps={fps} /> : null}
      <FilmGrain amount={style.grain * look.grainBoost} />
      <Letterbox enabled={style.letterbox} height={height} />
      {!branding ? <FilmFades total={total} fps={fps} /> : null}
    </AbsoluteFill>
  );
}