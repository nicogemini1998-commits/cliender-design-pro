/**
 * ContextPromptNode — Nodo 1: entrada de datos.
 * Skeleton listo para extender. Comparte primitivas con CinematographerNode.
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion } from "framer-motion";
import { FileText, ImagePlus } from "lucide-react";
import type { NodeStatus } from "./CinematographerNode";

export interface ContextPromptNodeData {
  status: NodeStatus;
  prompt: string;
  onChange?: (patch: Partial<{ prompt: string }>) => void;
}

export function ContextPromptNode({ data, selected }: NodeProps<ContextPromptNodeData>) {
  const { status, prompt, onChange } = data;
  const ledColor =
    status === "running" ? "#8B5CF6" : status === "done" ? "#10B981" : status === "error" ? "#EF4444" : "#3F3F46";

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`
        w-[300px] rounded-xl bg-[#141414] border
        ${selected ? "border-[#8B5CF6]" : "border-[#262626] hover:border-[#8B5CF6]"}
        hover:shadow-[0_0_18px_rgba(139,92,246,0.22)] transition-shadow
      `}
    >
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !rounded-full !bg-[#0A0A0A] !border-2 !border-[#8B5CF6]
                   hover:!h-4 hover:!w-4 hover:!shadow-[0_0_12px_2px_rgba(139,92,246,0.6)] transition-all"
      />
      <div className="flex items-center justify-between gap-3 border-b border-[#262626] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/30">
            <FileText className="h-3.5 w-3.5 text-[#A78BFA]" />
          </div>
          <div>
            <div className="text-[13px] font-medium text-gray-100">Context & Prompt</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              entrada
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
      <div className="space-y-3 px-4 py-3">
        <textarea
          value={prompt}
          onChange={(e) => onChange?.({ prompt: e.target.value })}
          rows={4}
          placeholder="Describe la idea, marca y lineamientos creativos…"
          className="w-full resize-none rounded-md border border-[#262626] bg-[#0A0A0A] px-3 py-2
                     font-mono text-[12px] text-gray-200 placeholder:text-gray-600
                     focus:border-[#8B5CF6]/60 focus:outline-none"
        />
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A]
                     px-2.5 py-1.5 text-[11px] text-gray-300 hover:border-[#8B5CF6]/60 hover:text-gray-100"
        >
          <ImagePlus className="h-3 w-3" />
          Añadir referencia visual
        </button>
      </div>
      <style>{`@keyframes ledBreath { 0%,100%{opacity:.5;transform:scale(.92)} 50%{opacity:1;transform:scale(1.08)} }`}</style>
    </motion.div>
  );
}
