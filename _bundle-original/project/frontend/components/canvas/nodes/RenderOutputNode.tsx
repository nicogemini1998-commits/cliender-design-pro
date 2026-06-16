/**
 * RenderOutputNode — Nodo 3: visor de resultados.
 * Estados: idle (placeholder), loading (skeleton con shimmer), ready (media + acciones).
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { Download, Shuffle, Image as ImageIcon } from "lucide-react";
import type { NodeStatus } from "./CinematographerNode";

export interface RenderOutputNodeData {
  status: NodeStatus;
  url?: string;
  mediaKind?: "image" | "video";
  modelId?: string;
}

export function RenderOutputNode({ data, selected }: NodeProps<RenderOutputNodeData>) {
  const { status, url, mediaKind = "image", modelId } = data;
  const ledColor =
    status === "running" ? "#8B5CF6" : status === "done" ? "#10B981" : status === "error" ? "#EF4444" : "#3F3F46";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`
        w-[320px] rounded-xl bg-[#141414] border
        ${selected ? "border-[#8B5CF6]" : "border-[#262626] hover:border-[#8B5CF6]"}
        hover:shadow-[0_0_18px_rgba(139,92,246,0.22)] transition-shadow
      `}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !rounded-full !bg-[#0A0A0A] !border-2 !border-[#8B5CF6]
                   hover:!h-4 hover:!w-4 hover:!shadow-[0_0_12px_2px_rgba(139,92,246,0.6)] transition-all"
      />
      <div className="flex items-center justify-between gap-3 border-b border-[#262626] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[#10B981]/10 ring-1 ring-[#10B981]/30">
            <ImageIcon className="h-3.5 w-3.5 text-[#34D399]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-gray-100">Render Output</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              {modelId ?? "esperando…"}
            </div>
          </div>
        </div>
        <div
          className="h-2.5 w-2.5 rounded-full"
          style={{
            background: ledColor,
            boxShadow: `0 0 10px ${ledColor}66`,
            animation: status === "running" ? "ledBreath 1.4s ease-in-out infinite" : undefined,
          }}
        />
      </div>

      <div className="p-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-md border border-[#262626] bg-[#0A0A0A]">
          {status === "running" && (
            <>
              <div className="absolute inset-0 bg-gradient-to-br from-[#0F0F0F] to-[#161616]" />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(110deg, transparent 0%, rgba(139,92,246,0.18) 45%, transparent 90%)",
                  animation: "shimmer 1.8s linear infinite",
                }}
              />
            </>
          )}
          {status === "done" && url && (
            mediaKind === "video" ? (
              <video src={url} autoPlay muted loop className="h-full w-full object-cover" />
            ) : (
              <img src={url} alt="render" className="h-full w-full object-cover" />
            )
          )}
          {status === "idle" && (
            <div className="grid h-full place-items-center font-mono text-[11px] text-gray-600">
              esperando producción…
            </div>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <button
            disabled={status !== "done"}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md
                       border border-[#262626] bg-[#0A0A0A] px-2.5 py-1.5 text-[11px] text-gray-300
                       hover:border-[#8B5CF6]/60 hover:text-gray-100 disabled:opacity-40"
          >
            <Download className="h-3 w-3" />
            Descargar
          </button>
          <button
            disabled={status !== "done"}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md
                       border border-[#262626] bg-[#0A0A0A] px-2.5 py-1.5 text-[11px] text-gray-300
                       hover:border-[#8B5CF6]/60 hover:text-gray-100 disabled:opacity-40"
          >
            <Shuffle className="h-3 w-3" />
            Variación
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(100%)} }
        @keyframes ledBreath { 0%,100%{opacity:.5;transform:scale(.92)} 50%{opacity:1;transform:scale(1.08)} }
      `}</style>
    </motion.div>
  );
}
