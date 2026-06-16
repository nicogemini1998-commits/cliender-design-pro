/**
 * AnimatedFlowEdge — edge personalizada con partículas viajeras.
 *
 * Render:
 *   - Trazo base #262626
 *   - Trazo overlay #8B5CF6 con `stroke-dasharray` animado cuando data.active
 *   - 3 partículas <circle> animadas a lo largo del path via SVG <animateMotion>
 */
"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";

interface AnimatedFlowEdgeData {
  active?: boolean;
}

export function AnimatedFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}: EdgeProps<AnimatedFlowEdgeData>) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const active = !!data?.active;

  return (
    <>
      <BaseEdge
        id={id}
        path={path}
        style={{ stroke: "#262626", strokeWidth: 1.5 }}
      />
      {active && (
        <>
          <path
            d={path}
            fill="none"
            stroke="#8B5CF6"
            strokeWidth={1.5}
            strokeDasharray="6 8"
            style={{ animation: "edgeDashFlow 1.4s linear infinite" }}
            opacity={0.85}
          />
          {[0, 0.45, 0.9].map((begin, i) => (
            <circle key={i} r={2.5} fill="#C4B5FD" filter="url(#glowPurple)">
              <animateMotion dur="1.8s" repeatCount="indefinite" begin={`${begin}s`} path={path} />
            </circle>
          ))}
        </>
      )}
      {/* defs únicos del SVG global de React Flow — un solo filter es suficiente */}
      <defs>
        <filter id="glowPurple" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <style>{`
        @keyframes edgeDashFlow {
          to { stroke-dashoffset: -28; }
        }
      `}</style>
    </>
  );
}
