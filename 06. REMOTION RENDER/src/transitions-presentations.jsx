import React from "react";
import { AbsoluteFill } from "remotion";
import { linearTiming, springTiming } from "@remotion/transitions";
import { flip } from "@remotion/transitions/flip";
import { clockWipe } from "@remotion/transitions/clock-wipe";

// ════════════════════════════════════════════════════════════════════════
//  PRESENTATIONS v2 — Cliender Design Pro
//
//  Transiciones de DOS CARAS para TransitionSeries: animan el clip que SALE
//  y el que ENTRA a la vez (el motor anterior solo animaba la entrada).
//
//  Set CINEMATOGRÁFICO PROFESIONAL (restricción + motivación):
//    cut · dissolve · lumafade · dipblack · dipwhite · blurwipe · whip · wipe
//  Set "años 2000" (disponible pero NO por defecto — solo si se pide explícito):
//    slide · slideup · zoom · glitch · flipx · flipy · clockwipe
//
//  Contrato: cada id de TRANSITIONS mapea a una presentation aquí. El timing
//  consume EXACTAMENTE `td` frames, así que el cálculo de duración no cambia.
// ════════════════════════════════════════════════════════════════════════

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const fract = (x) => x - Math.floor(x);

// Estilos por cara (entrante/saliente) en función del progreso 0..1.
// Devuelve { style, flash?, flashKind?, backdrop? }:
//   - style    → transform/opacity/filter de la cara (lleva los children).
//   - backdrop → color SÓLIDO detrás de los children, sin heredar su opacidad
//                (para los dips: el clip se funde revelando este color).
//   - flash    → overlay encima (0..1); flashKind "burn" (gradiente cálido) o "white".
function faceStyle(variant, entering, p, dipColor) {
  const e = easeInOut(p);
  switch (variant) {
    case "dissolve":
      // Crossfade clásico: el entrante se funde encima del saliente.
      return { style: { opacity: entering ? e : 1 } };

    case "lumafade":
      return entering
        ? { style: { opacity: e, filter: `brightness(${1 + (1 - e) * 0.9})` } }
        : { style: { opacity: 1 } };

    case "fade":
    case "dipblack": {
      // Dip a negro (o color): el saliente se va en la 1ª mitad, el entrante
      // llega en la 2ª, revelando el backdrop en el cruce.
      const out = clamp01(1 - p * 2);
      const inn = clamp01((p - 0.5) * 2);
      return {
        style: { opacity: entering ? easeInOut(inn) : easeInOut(out) },
        backdrop: dipColor || "#000000",
      };
    }

    case "dipwhite": {
      // Flash a blanco — impacto / recuerdo / golpe emocional.
      const out = clamp01(1 - p * 2);
      const inn = clamp01((p - 0.5) * 2);
      return {
        style: { opacity: entering ? easeInOut(inn) : easeInOut(out) },
        backdrop: dipColor || "#ffffff",
      };
    }

    case "blurwipe":
      return entering
        ? { style: { opacity: e, filter: `blur(${(1 - e) * 18}px)` } }
        : { style: { opacity: 1 - e * 0.6, filter: `blur(${e * 14}px)` } };

    case "slide":
      return {
        style: { opacity: 1, transform: `translateX(${entering ? (1 - e) * 100 : -e * 100}%)` },
      };

    case "slideup":
      return {
        style: { opacity: 1, transform: `translateY(${entering ? (1 - e) * 100 : -e * 100}%)` },
      };

    case "zoom":
      return entering
        ? { style: { opacity: clamp01(e * 1.4), transform: `scale(${1.32 - 0.32 * e})`, filter: `blur(${(1 - e) * 14}px)` } }
        : { style: { opacity: 1 - clamp01(e * 1.2), transform: `scale(${1 + 0.12 * e})` } };

    case "whip":
      return entering
        ? { style: { opacity: clamp01(e * 1.6), transform: `translateX(${(1 - e) * 55}%)`, filter: `blur(${(1 - e) * 22}px)` } }
        : { style: { opacity: 1 - clamp01(e * 1.3), transform: `translateX(${-e * 55}%)`, filter: `blur(${e * 22}px)` } };

    case "wipe":
      return entering
        ? { style: { opacity: 1, clipPath: `inset(0 ${(1 - e) * 100}% 0 0)` } }
        : { style: { opacity: 1 } };

    case "glitch": {
      const j = fract(Math.sin(p * 1234.5678) * 43758.5453);
      if (entering) {
        return {
          style: {
            opacity: clamp01(e * 1.5),
            transform: `translateX(${(j - 0.5) * (1 - e) * 26}px)`,
            filter: `drop-shadow(${(1 - e) * 8}px 0 0 #ff003c88) drop-shadow(${-(1 - e) * 8}px 0 0 #00e5ff88) saturate(${1 + (1 - e) * 1.5})`,
          },
        };
      }
      return {
        style: {
          opacity: 1 - clamp01(e * 1.4),
          transform: `translateX(${(j - 0.5) * e * 22}px)`,
          filter: `drop-shadow(${e * 7}px 0 0 #ff003c66) drop-shadow(${-e * 7}px 0 0 #00e5ff66)`,
        },
      };
    }

    case "filmburn": {
      // Flash cálido de película quemada — pico en p≈0.45, solo cara entrante.
      const flash = p < 0.45 ? easeInOut(p / 0.45) : 1 - easeInOut((p - 0.45) / 0.55);
      return entering
        ? { style: { opacity: clamp01(e * 1.3) }, flash, flashKind: "burn" }
        : { style: { opacity: 1 - clamp01(e * 0.8) } };
    }

    default:
      return { style: { opacity: entering ? e : 1 } };
  }
}

const CinematicTransition = ({ children, presentationDirection, presentationProgress, passedProps }) => {
  const entering = presentationDirection === "entering";
  const { variant, dipColor } = passedProps;
  const { style, flash, flashKind, backdrop } = faceStyle(variant, entering, presentationProgress, dipColor);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      {backdrop ? <AbsoluteFill style={{ background: backdrop }} /> : null}
      <AbsoluteFill style={style}>{children}</AbsoluteFill>
      {flash && flash > 0.001 ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            opacity: flash,
            background:
              flashKind === "white"
                ? (dipColor || "#ffffff")
                : "radial-gradient(circle 120% at 50% 60%, rgba(255,255,255,0.95) 0%, rgba(255,200,120,0.85) 30%, rgba(255,106,0,0.6) 60%, rgba(180,30,0,0.2) 100%)",
            mixBlendMode: flashKind === "white" ? "normal" : "screen",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

const cinematicPresentation = (variant, dipColor) => ({
  component: CinematicTransition,
  props: { variant, dipColor },
});

// Variantes que ganan con física de muelle (rebote natural de cámara).
const SPRINGY = new Set(["slide", "slideup", "zoom", "whip", "flipx", "flipy"]);

// Presentaciones premium del paquete oficial — flip 3D y clock wipe radial.
// Reciben width/height del contexto (clockWipe los necesita).
export function presentationFor(id, ctx) {
  switch (id) {
    case "flipx":
      return flip({ direction: "from-right", perspective: 1400 });
    case "flipy":
      return flip({ direction: "from-bottom", perspective: 1400 });
    case "clockwipe":
      return clockWipe({ width: ctx.width, height: ctx.height });
    default:
      return cinematicPresentation(id, ctx.dipColor);
  }
}

export function timingFor(id, td) {
  const durationInFrames = Math.max(1, Math.round(td));
  if (SPRINGY.has(id)) {
    return springTiming({ durationInFrames, config: { damping: 200 }, durationRestThreshold: 0.0001 });
  }
  return linearTiming({ durationInFrames });
}
