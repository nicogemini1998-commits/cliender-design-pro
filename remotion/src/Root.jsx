import React from "react";
import { Composition } from "remotion";
import { Stitch, calcStitchMetadata } from "./Stitch.jsx";

export function RemotionRoot() {
  return (
    <Composition
      id="Stitch"
      component={Stitch}
      durationInFrames={300}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={{ scenes: [], brand: {}, fps: 30, style: {} }}
      calculateMetadata={calcStitchMetadata}
    />
  );
}
