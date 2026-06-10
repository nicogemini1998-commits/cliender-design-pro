import React from "react";
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Img,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export const INTRO_FRAMES = 45;
export const OUTRO_FRAMES = 60;
export const FADE = 12;

// ──────────────────────────────────────────────────────────────────────────
// Catálogo de transiciones profesionales.
//
// Cada transición describe cómo ENTRA un clip sobre el anterior (los dos se
// solapan `frames` durante la transición). `label`/`description` se exponen a
// la UI para que el usuario sepa exactamente qué hace cada una.
//
// `frames(fps)` → duración del solape. `cut` = 0 (corte seco, sin solape).
// ──────────────────────────────────────────────────────────────────────────
export const TRANSITIONS = {
  dissolve: {
    label: "Disolvencia",
    description: "Crossfade suave: el clip nuevo aparece fundiéndose sobre el anterior. Elegante y fluido — el estándar profesional.",
    frames: (fps) => Math.round(fps * 0.5),
  },
  fade: {
    label: "Fundido a negro",
    description: "El clip se oscurece a negro y el siguiente emerge desde negro. Marca un cambio de bloque o de tiempo.",
    frames: (fps) => Math.round(fps * 0.6),
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
    description: "El clip nuevo entra con un golpe de zoom y desenfoque que se resuelve. Energético y viral.",
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
    description: "Cambio instantáneo sin transición. Directo y rítmico, como el montaje clásico.",
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
// Timeline compartido — calcula el `from` de cada elemento con solapes.
// Lo usan tanto calcStitchMetadata como el componente Stitch (misma fuente).
// La transición de cada escena = cómo ENTRA esa escena sobre la anterior, así
// que su solape se resta del cursor acumulado.
// ──────────────────────────────────────────────────────────────────────────
function computeTimeline(scenes, fps) {
  const items = [];
  let prevStart = 0;
  let prevDur = INTRO_FRAMES;
  items.push({ type: "intro", from: 0, dur: INTRO_FRAMES, td: 0 });

  scenes.forEach((scene, i) => {
    const dur = Number(scene.durationInFrames) || fps * 5;
    const td = Math.min(transitionFrames(scene, fps), Math.floor(prevDur * 0.9));
    const start = Math.max(0, prevStart + prevDur - td);
    items.push({ type: "scene", scene, index: i, from: start, dur, td });
    prevStart = start;
    prevDur = dur;
  });

  // outro entra con dissolve fijo
  const outroTd = Math.min(TRANSITIONS.dissolve.frames(fps), Math.floor(prevDur * 0.9));
  const outroStart = Math.max(0, prevStart + prevDur - outroTd);
  items.push({ type: "outro", from: outroStart, dur: OUTRO_FRAMES, td: outroTd });

  const total = outroStart + OUTRO_FRAMES;
  return { items, total };
}

export function calcStitchMetadata({ props }) {
  const fps = props.fps || 30;
  const scenes = Array.isArray(props.scenes) ? props.scenes : [];
  const { total } = computeTimeline(scenes, fps);
  return {
    durationInFrames: Math.max(total, fps),
    fps,
    width: props.width || 1080,
    height: props.height || 1920,
  };
}

function BrandCard({ brand, kind }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const accent = (brand && brand.accent) || "#A78BFA";
  const opacity =
    kind === "intro"
      ? interpolate(frame, [0, FADE, durationInFrames - FADE, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      : interpolate(frame, [0, FADE], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const scale = interpolate(frame, [0, 20], [0.92, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#08080D", justifyContent: "center", alignItems: "center" }}>
      <AbsoluteFill style={{ background: `radial-gradient(60% 50% at 50% 38%, ${accent}22, transparent 70%)` }} />
      <div style={{ opacity, transform: `scale(${scale})`, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 24 }}>
        {brand && brand.logoUrl ? (
          <Img src={brand.logoUrl} style={{ width: 140, height: 140, borderRadius: "50%", objectFit: "cover", boxShadow: `0 20px 60px -10px ${accent}88` }} />
        ) : null}
        <div style={{ fontFamily: "Geist, system-ui, sans-serif", color: "#fff", fontSize: 64, fontWeight: 600, letterSpacing: "0.38em", textIndent: "0.38em" }}>
          {(brand && brand.name ? brand.name : "CLIENDER").toUpperCase()}
        </div>
        {kind === "outro" ? (
          <div style={{ fontFamily: "monospace", color: accent, fontSize: 20, letterSpacing: "0.3em", textTransform: "uppercase" }}>
            creative supercomputer
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}

function isVideoScene(scene) {
  if (scene && typeof scene.kind === "string") return scene.kind.toLowerCase() === "video";
  const u = String((scene && scene.url) || "").split("?")[0].toLowerCase();
  return /\.(mp4|mov|webm|m4v)$/.test(u);
}

// Estilo del wrapper del clip entrante durante sus primeros `td` frames.
// `frame` = frame local del clip (0 = primer frame). Produce la animación de
// entrada de la transición. Pasados los `td` frames, el clip queda normal.
function enterStyle(type, frame, td) {
  if (td <= 0 || frame >= td) return { opacity: 1 };
  const p = clamp01(frame / td);
  const e = easeInOut(p);
  switch (type) {
    case "cut":
      return { opacity: 1 };
    case "dissolve":
      return { opacity: e };
    case "fade": {
      const op = clamp01((p - 0.15) / 0.85);
      return { opacity: easeInOut(op) };
    }
    case "slide":
      return { opacity: 1, transform: `translateX(${(1 - e) * 100}%)` };
    case "slideup":
      return { opacity: 1, transform: `translateY(${(1 - e) * 100}%)` };
    case "zoom":
      return {
        opacity: clamp01(e * 1.4),
        transform: `scale(${1.32 - 0.32 * e})`,
        filter: `blur(${(1 - e) * 14}px)`,
      };
    case "whip": {
      const op = clamp01(e * 1.6);
      return {
        opacity: op,
        transform: `translateX(${(1 - e) * 55}%)`,
        filter: `blur(${(1 - e) * 22}px)`,
      };
    }
    case "wipe":
      return { opacity: 1, clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` };
    case "glitch": {
      const jitter = (Math.sin(frame * 12.9898) * 43758.5453) % 1;
      const dx = (jitter - 0.5) * (1 - e) * 26;
      return {
        opacity: clamp01(e * 1.5),
        transform: `translateX(${dx}px)`,
        filter: `drop-shadow(${(1 - e) * 8}px 0 0 #ff003c88) drop-shadow(${-(1 - e) * 8}px 0 0 #00e5ff88) saturate(${1 + (1 - e) * 1.5})`,
      };
    }
    default:
      return { opacity: e };
  }
}

function SceneClip({ scene, accent, transition, td }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const isVideo = isVideoScene(scene);
  const wrapper = enterStyle(transition, frame, td);
  // Ken Burns sutil para imágenes (zoom lento durante toda la escena).
  const kbScale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <AbsoluteFill style={{ background: "#000", overflow: "hidden", ...wrapper }}>
        {isVideo ? (
          <OffthreadVideo src={scene.url} muted={scene.muted !== false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Img src={scene.url} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${kbScale})` }} />
        )}
        {scene.caption ? (
          <AbsoluteFill style={{ justifyContent: "flex-end", padding: "0 0 120px 64px" }}>
            <div style={{ display: "inline-block", maxWidth: "80%", padding: "12px 22px", borderRadius: 14, background: "rgba(8,8,13,0.55)", borderLeft: `3px solid ${accent}` }}>
              <div style={{ fontFamily: "Geist, system-ui, sans-serif", color: "#fff", fontSize: 30, fontWeight: 500, lineHeight: 1.25 }}>{scene.caption}</div>
            </div>
          </AbsoluteFill>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

export function Stitch({ scenes = [], brand = {}, fps = 30 }) {
  const accent = brand.accent || "#A78BFA";
  const { items } = computeTimeline(scenes, fps);
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
            <SceneClip scene={it.scene} accent={accent} transition={transitionId(it.scene)} td={it.td} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
