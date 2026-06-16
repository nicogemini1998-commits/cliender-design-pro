/**
 * CinematographerNode — "Cerebro Técnico" del canvas.
 *
 * Decisiones de diseño:
 *  - Catálogo Kid.ai estricto: el <Select> solo expone los modelos autorizados
 *    + opción "Auto" (delega al agente backend).
 *  - LED de estado en el header (idle | running | done | error).
 *  - Handles personalizados color #8B5CF6 que se expanden en hover.
 *  - Sliders shadcn/ui para Guidance Scale y selector segmentado de Aspect Ratio.
 *
 * Acopla con app/graph/nodes/cinematographer.py del backend:
 *   - `model_id` enviado coincide con ALLOWED_KID_AI_MODELS.
 *   - `parameters.aspect_ratio` y `parameters.guidance_scale` se reenvían tal cual.
 */
"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { Clapperboard, ChevronDown, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Catálogo único — debe coincidir con backend/app/core/config.py
// ---------------------------------------------------------------------------

export const KID_AI_MODELS = [
  { id: "auto",             label: "Auto",            kind: "auto",  hint: "El Cinematographer decide" },
  { id: "gpt-imagenes-2",   label: "gpt-imagenes-2",  kind: "image", hint: "Alto detalle / tipografía" },
  { id: "nano-banana-pro",  label: "nano-banana-pro", kind: "image", hint: "Fotorrealismo máximo" },
  { id: "nano-banana-2",    label: "nano-banana-2",   kind: "image", hint: "Bocetos / estilizado rápido" },
  { id: "veo3",             label: "veo3",            kind: "video", hint: "Físicas realistas / cine" },
  { id: "seedance-2.0",     label: "seedance-2.0",    kind: "video", hint: "Vertical / redes sociales" },
] as const;

export type KidAiModelId = (typeof KID_AI_MODELS)[number]["id"];

const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:5"] as const;
type AspectRatio = (typeof ASPECT_RATIOS)[number];

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type NodeStatus = "idle" | "running" | "done" | "error";

export interface CinematographerNodeData {
  status: NodeStatus;
  modelId: KidAiModelId;
  aspectRatio: AspectRatio;
  guidance: number;        // 0 — 20
  prompt?: string;         // prompt técnico devuelto por el backend (read-only preview)
  onChange: (patch: Partial<{
    modelId: KidAiModelId;
    aspectRatio: AspectRatio;
    guidance: number;
  }>) => void;
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function StatusLed({ status }: { status: NodeStatus }) {
  const palette = {
    idle:    { core: "#3F3F46", glow: "transparent" },
    running: { core: "#8B5CF6", glow: "rgba(139,92,246,0.55)" },
    done:    { core: "#10B981", glow: "rgba(16,185,129,0.55)" },
    error:   { core: "#EF4444", glow: "rgba(239,68,68,0.55)" },
  }[status];

  return (
    <div className="relative h-2.5 w-2.5">
      <motion.span
        className="absolute inset-0 rounded-full"
        style={{ background: palette.core, boxShadow: `0 0 12px 2px ${palette.glow}` }}
        animate={
          status === "running"
            ? { opacity: [0.45, 1, 0.45], scale: [0.92, 1.08, 0.92] }
            : { opacity: 1, scale: 1 }
        }
        transition={{ duration: 1.4, repeat: status === "running" ? Infinity : 0, ease: "easeInOut" }}
      />
    </div>
  );
}

function CustomHandle({ type, position }: { type: "source" | "target"; position: Position }) {
  return (
    <Handle
      type={type}
      position={position}
      className="
        !h-3 !w-3 !rounded-full
        !bg-[#0A0A0A] !border-2 !border-[#8B5CF6]
        transition-all duration-150
        hover:!h-4 hover:!w-4 hover:!border-[#A78BFA]
        hover:!shadow-[0_0_12px_2px_rgba(139,92,246,0.6)]
      "
    />
  );
}

function ModelSelect({
  value,
  onChange,
}: {
  value: KidAiModelId;
  onChange: (v: KidAiModelId) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = KID_AI_MODELS.find((m) => m.id === value) ?? KID_AI_MODELS[0];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="
          group flex w-full items-center justify-between gap-2
          rounded-md border border-[#262626] bg-[#0A0A0A] px-3 py-2 text-left
          transition-colors hover:border-[#8B5CF6]/60
        "
      >
        <div className="flex items-center gap-2 min-w-0">
          {current.kind === "auto" ? (
            <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6] shrink-0" />
          ) : (
            <span
              className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                current.kind === "video" ? "bg-[#10B981]" : "bg-[#8B5CF6]"
              }`}
            />
          )}
          <span className="font-mono text-[12px] text-gray-100 truncate">{current.label}</span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="
              absolute z-30 mt-1 w-full overflow-hidden
              rounded-md border border-[#262626] bg-[#0F0F0F] shadow-2xl shadow-black/60
            "
          >
            {KID_AI_MODELS.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                  }}
                  className={`
                    flex w-full items-center justify-between gap-2 px-3 py-2 text-left
                    transition-colors hover:bg-[#1A1A1A]
                    ${m.id === value ? "bg-[#161616]" : ""}
                  `}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {m.kind === "auto" ? (
                      <Sparkles className="h-3.5 w-3.5 text-[#8B5CF6] shrink-0" />
                    ) : (
                      <span
                        className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                          m.kind === "video" ? "bg-[#10B981]" : "bg-[#8B5CF6]"
                        }`}
                      />
                    )}
                    <div className="min-w-0">
                      <div className="font-mono text-[12px] text-gray-100 truncate">{m.label}</div>
                      <div className="text-[10.5px] text-gray-500 truncate">{m.hint}</div>
                    </div>
                  </div>
                  {m.kind !== "auto" && (
                    <span className="font-mono text-[10px] uppercase tracking-wider text-gray-600">
                      {m.kind}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function AspectPicker({
  value,
  onChange,
}: {
  value: AspectRatio;
  onChange: (v: AspectRatio) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 rounded-md border border-[#262626] bg-[#0A0A0A] p-1">
      {ASPECT_RATIOS.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={`
            font-mono text-[10.5px] py-1.5 rounded transition-all
            ${
              value === r
                ? "bg-[#8B5CF6]/15 text-[#C4B5FD] ring-1 ring-[#8B5CF6]/40"
                : "text-gray-500 hover:text-gray-200 hover:bg-[#161616]"
            }
          `}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

function GuidanceSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[10.5px] uppercase tracking-wider text-gray-500">
          Guidance Scale
        </span>
        <span className="font-mono text-[11px] text-gray-200 tabular-nums">{value.toFixed(1)}</span>
      </div>
      <input
        type="range"
        min={0}
        max={20}
        step={0.1}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="
          w-full h-1 appearance-none rounded-full bg-[#262626] cursor-pointer
          [&::-webkit-slider-thumb]:appearance-none
          [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3
          [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-[#8B5CF6]
          [&::-webkit-slider-thumb]:shadow-[0_0_8px_rgba(139,92,246,0.6)]
          [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3
          [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-[#8B5CF6]
          [&::-moz-range-thumb]:border-0
        "
        style={{
          background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${(value / 20) * 100}%, #262626 ${
            (value / 20) * 100
          }%, #262626 100%)`,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

export function CinematographerNode({ data, selected }: NodeProps<CinematographerNodeData>) {
  const { status, modelId, aspectRatio, guidance, prompt, onChange } = data;

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`
        relative w-[320px] rounded-xl
        bg-[#141414] border
        ${selected ? "border-[#8B5CF6] shadow-[0_0_24px_rgba(139,92,246,0.35)]"
                   : "border-[#262626] hover:border-[#8B5CF6] hover:shadow-[0_0_18px_rgba(139,92,246,0.22)]"}
        transition-shadow
      `}
    >
      {/* Handles */}
      <CustomHandle type="target" position={Position.Left} />
      <CustomHandle type="source" position={Position.Right} />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-[#262626] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="grid h-7 w-7 place-items-center rounded-md bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/30">
            <Clapperboard className="h-3.5 w-3.5 text-[#A78BFA]" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-gray-100 truncate">Cinematographer</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
              cerebro técnico · kid.ai
            </div>
          </div>
        </div>
        <StatusLed status={status} />
      </div>

      {/* Body */}
      <div className="space-y-3 px-4 py-3">
        <div>
          <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-gray-500">
            Modelo Kid.ai
          </div>
          <ModelSelect value={modelId} onChange={(v) => onChange({ modelId: v })} />
        </div>

        <div>
          <div className="mb-1.5 text-[10.5px] uppercase tracking-wider text-gray-500">
            Aspect Ratio
          </div>
          <AspectPicker value={aspectRatio} onChange={(v) => onChange({ aspectRatio: v })} />
        </div>

        <GuidanceSlider value={guidance} onChange={(v) => onChange({ guidance: v })} />

        {prompt && (
          <div className="mt-2 rounded-md border border-[#262626] bg-[#0A0A0A] p-2.5">
            <div className="mb-1 text-[10px] uppercase tracking-wider text-gray-500">
              Prompt técnico
            </div>
            <div className="font-mono text-[11px] leading-relaxed text-gray-300 line-clamp-4">
              {prompt}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
