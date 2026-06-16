/**
 * AnimatedEdge.tsx — Edge reactiva al estado global del store.
 *
 * - Reposa en gris #333 cuando `isProcessing === false`.
 * - Cuando `isProcessing === true`:
 *     - Color base salta a #8B5CF6
 *     - `stroke-dashoffset` se anima continuamente (flujo direccional)
 *     - Filtro `feGaussianBlur` agrega un glow sutil
 *     - 3 partículas viajan a lo largo del path via <animateMotion>
 *
 * Pensado para usarse desde page.tsx del Canvas con:
 *   const edgeTypes = { animatedFlow: AnimatedEdge }
 */
"use client";

import { BaseEdge, getBezierPath, type EdgeProps } from "@xyflow/react";
import { useStore } from "@/store/useStore";

export default function AnimatedEdge(props: EdgeProps) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    selected,
  } = props;

  const isProcessing = useStore((s) => s.isProcessing);

  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const restColor   = "#333333";
  const activeColor = "#8B5CF6";
  const glowId      = `ae-glow-${id}`;

  return (
    <>
      <defs>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={isProcessing ? 2.4 : 0} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Capa base */}
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: isProcessing ? activeColor : restColor,
          strokeWidth: selected ? 2 : 1.5,
          opacity: isProcessing ? 0.45 : 1,
          transition: "stroke 0.4s ease, opacity 0.4s ease",
        }}
      />

      {/* Capa animada (solo cuando procesa) */}
      {isProcessing && (
        <>
          <path
            d={path}
            fill="none"
            stroke={activeColor}
            strokeWidth={1.75}
            strokeDasharray="8 10"
            filter={`url(#${glowId})`}
            style={{ animation: "edge-flow-dash 1.4s linear infinite" }}
          />
          {[0, 0.55, 1.05].map((begin, i) => (
            <circle
              key={i}
              r={2.6}
              fill="#DDD6FE"
              filter={`url(#${glowId})`}
              style={{ opacity: 0.95 }}
            >
              <animateMotion dur="1.9s" repeatCount="indefinite" begin={`${begin}s`} path={path} />
            </circle>
          ))}
        </>
      )}

      <style>{`
        @keyframes edge-flow-dash {
          to { stroke-dashoffset: -36; }
        }
      `}</style>
    </>
  );
}
