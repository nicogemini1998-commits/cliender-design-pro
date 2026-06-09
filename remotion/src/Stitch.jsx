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

export function calcStitchMetadata({ props }) {
  const fps = props.fps || 30;
  const scenes = Array.isArray(props.scenes) ? props.scenes : [];
  const scenesFrames = scenes.reduce(
    (acc, s) => acc + (Number(s.durationInFrames) || fps * 5),
    0
  );
  const total = INTRO_FRAMES + scenesFrames + OUTRO_FRAMES;
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

function SceneClip({ scene, accent }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity = interpolate(
    frame,
    [0, FADE, durationInFrames - FADE, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const isVideo = isVideoScene(scene);
  // Ken Burns sutil para imágenes estáticas (zoom lento)
  const kbScale = interpolate(frame, [0, durationInFrames], [1.0, 1.08], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#000", opacity }}>
      {isVideo ? (
        <OffthreadVideo src={scene.url} muted={!!scene.muted} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
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
  );
}

export function Stitch({ scenes = [], brand = {}, fps = 30 }) {
  const accent = brand.accent || "#A78BFA";
  let cursor = INTRO_FRAMES;
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <BrandCard brand={brand} kind="intro" />
      </Sequence>
      {scenes.map((scene, i) => {
        const dur = Number(scene.durationInFrames) || fps * 5;
        const from = cursor;
        cursor += dur;
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <SceneClip scene={scene} accent={accent} />
          </Sequence>
        );
      })}
      <Sequence from={cursor} durationInFrames={OUTRO_FRAMES}>
        <BrandCard brand={brand} kind="outro" />
      </Sequence>
    </AbsoluteFill>
  );
}
