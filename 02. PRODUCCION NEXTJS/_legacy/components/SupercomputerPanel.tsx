/**
 * SupercomputerPanel.tsx — Chat lateral inmersivo con stream SSE.
 *
 * UX:
 *  - Slide-over desde la derecha (Framer Motion spring).
 *  - bg-[#0A0A0A]/90 + backdrop-blur, borde izquierdo #262626.
 *  - Cada log llega del backend FastAPI vía EventSource → store.appendLog().
 *  - Cada bubble entra con fade + translate-x (initial x:10 → 0).
 *  - Indicador "Pensando…" minimalista (3 puntos animados) mientras
 *    isProcessing y no hay log nuevo en los últimos 800ms.
 *
 * Contrato del backend (FastAPI):
 *   GET /chat/stream?prompt=...  →  text/event-stream
 *   data: {"agentName":"Cinematographer","message":"...","status":"running","meta":{...}}
 *   data: {"final":true,"finalMediaUrl":"https://...","finalModelId":"nano-banana-pro"}
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, type AgentLog, type AgentName } from "@/store/useStore";

const AGENT_COLOR: Record<AgentName | "System", { dot: string; text: string; tag: string }> = {
  MasterDirector:  { dot: "#A78BFA", text: "text-[#C4B5FD]", tag: "MasterDirector"   },
  Scriptwriter:    { dot: "#60A5FA", text: "text-[#93C5FD]", tag: "Scriptwriter"     },
  Cinematographer: { dot: "#8B5CF6", text: "text-[#C4B5FD]", tag: "Cinematographer"  },
  Production:     { dot: "#F59E0B", text: "text-[#FCD34D]", tag: "Production"       },
  Critic:          { dot: "#10B981", text: "text-[#6EE7B7]", tag: "Critic"           },
  System:          { dot: "#52525B", text: "text-gray-400",  tag: "System"           },
};

function StatusGlyph({ status }: { status: AgentLog["status"] }) {
  if (status === "running") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="led-dot" style={{ background: "#8B5CF6", boxShadow: "0 0 8px #8B5CF6" }} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#A78BFA]">running</span>
      </span>
    );
  }
  if (status === "done") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#10B981", boxShadow: "0 0 8px #10B981" }} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#6EE7B7]">done</span>
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "#EF4444", boxShadow: "0 0 8px #EF4444" }} />
        <span className="font-mono text-[10px] uppercase tracking-wider text-[#FCA5A5]">error</span>
      </span>
    );
  }
  return null;
}

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
        Enjambre pensando
      </span>
      <span className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1 w-1 rounded-full bg-[#8B5CF6]"
            animate={{ opacity: [0.2, 1, 0.2], y: [0, -2, 0] }}
            transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18, ease: "easeInOut" }}
          />
        ))}
      </span>
    </div>
  );
}

function LogBubble({ log }: { log: AgentLog }) {
  const palette = AGENT_COLOR[log.agentName];
  return (
    <motion.div
      initial={{ opacity: 0, x: 10, y: 4 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-lg border border-[#1F1F1F] bg-[#0F0F0F] px-3 py-2.5"
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: palette.dot, boxShadow: `0 0 6px ${palette.dot}` }} />
          <span className={`font-mono text-[10.5px] uppercase tracking-wider ${palette.text}`}>
            [{palette.tag}]
          </span>
        </div>
        <StatusGlyph status={log.status} />
      </div>
      <div className="text-[12.5px] leading-relaxed text-gray-200">{log.message}</div>
      {log.meta?.modelId ? (
        <div className="mt-1.5 inline-flex items-center gap-1 rounded border border-[#262626] bg-[#0A0A0A] px-1.5 py-0.5">
          <span className="h-1 w-1 rounded-full bg-[#8B5CF6]" />
          <span className="font-mono text-[10px] text-gray-300">model: {String(log.meta.modelId)}</span>
        </div>
      ) : null}
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Panel principal
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
  /** Base URL del backend FastAPI. Defecto: relativo (cuando se usa proxy /api). */
  apiBase?: string;
}

export default function SupercomputerPanel({ open, onClose, apiBase = "" }: Props) {
  const isProcessing  = useStore((s) => s.isProcessing);
  const agentLogs     = useStore((s) => s.agentLogs);
  const currentPrompt = useStore((s) => s.currentPrompt);
  const setPrompt        = useStore((s) => s.setPrompt);
  const startGeneration  = useStore((s) => s.startGeneration);
  const abortGeneration  = useStore((s) => s.abortGeneration);
  const appendLog        = useStore((s) => s.appendLog);

  const scrollRef = useRef<HTMLDivElement>(null);
  const esRef     = useRef<EventSource | null>(null);
  const [lastLogAt, setLastLogAt] = useState(0);

  // Autoscroll al final cuando llega un log nuevo
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    setLastLogAt(Date.now());
  }, [agentLogs.length]);

  // SSE — abrir/cerrar según isProcessing
  useEffect(() => {
    if (!isProcessing) {
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    const url = `${apiBase}/chat/stream?prompt=${encodeURIComponent(currentPrompt)}`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (ev) => {
      try {
        const frame = JSON.parse(ev.data);
        appendLog(frame);
        if (frame.final) {
          es.close();
          esRef.current = null;
        }
      } catch {
        // payload no-JSON: lo tratamos como mensaje de sistema
        appendLog({ agentName: "System", status: "info", message: ev.data });
      }
    };

    es.onerror = () => {
      abortGeneration("Conexión SSE perdida con el backend.");
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [isProcessing, currentPrompt, apiBase, appendLog, abortGeneration]);

  const showThinking = isProcessing && Date.now() - lastLogAt > 700;

  const onSubmit = () => {
    if (!currentPrompt.trim() || isProcessing) return;
    startGeneration();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop sutil — no bloquea el canvas, solo lo atenúa */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-y-0 right-0 z-30 w-[440px] pointer-events-none"
            style={{ background: "linear-gradient(to left, rgba(0,0,0,0.35), transparent)" }}
          />

          {/* Panel */}
          <motion.aside
            key="superpanel"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="
              fixed inset-y-0 right-0 z-40 w-[420px] flex flex-col
              border-l border-[#262626]
              bg-[#0A0A0A]/90 backdrop-blur-xl
              shadow-[0_-1px_60px_rgba(139,92,246,0.08)]
            "
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#1F1F1F] px-4 py-3">
              <div className="flex items-center gap-2.5">
                <div className="relative grid h-7 w-7 place-items-center rounded-md bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/30">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#8B5CF6]"
                        style={{ boxShadow: "0 0 8px #8B5CF6" }} />
                </div>
                <div>
                  <div className="text-[13px] font-medium text-gray-100">Supercomputer</div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-gray-500">
                    {isProcessing ? "swarm · active" : "swarm · idle"}
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-7 w-7 place-items-center rounded-md border border-transparent
                           text-gray-500 hover:border-[#262626] hover:text-gray-200"
                aria-label="Cerrar panel"
              >
                ✕
              </button>
            </div>

            {/* Logs */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2 scroll-thin">
              {agentLogs.length === 0 && !isProcessing && (
                <div className="grid h-full place-items-center text-center px-6">
                  <div>
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-gray-600">
                      enjambre listo
                    </div>
                    <div className="mt-2 text-[13px] text-gray-300">
                      Describe tu petición creativa.
                    </div>
                    <div className="mt-1 text-[11.5px] text-gray-500 max-w-[260px]">
                      MasterDirector planifica, Cinematographer elige modelo Kid.ai,
                      Production ejecuta, Critic aprueba.
                    </div>
                  </div>
                </div>
              )}
              <AnimatePresence initial={false}>
                {agentLogs.map((log) => (
                  <LogBubble key={log.id} log={log} />
                ))}
              </AnimatePresence>
              {showThinking && <ThinkingIndicator />}
            </div>

            {/* Composer */}
            <div className="border-t border-[#1F1F1F] p-3">
              <div className="rounded-lg border border-[#262626] bg-[#0F0F0F] focus-within:border-[#8B5CF6]/60 transition-colors">
                <textarea
                  value={currentPrompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit();
                  }}
                  rows={3}
                  disabled={isProcessing}
                  placeholder="Ej: Spot vertical 9:16 de un perfume con físicas líquidas, cine, neutral cálido…"
                  className="w-full resize-none bg-transparent px-3 py-2.5 text-[13px] text-gray-100
                             placeholder:text-gray-600 focus:outline-none disabled:opacity-60"
                />
                <div className="flex items-center justify-between border-t border-[#1F1F1F] px-2.5 py-2">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-gray-600">
                    ⌘ + ⏎ para enviar
                  </span>
                  <button
                    onClick={onSubmit}
                    disabled={!currentPrompt.trim() || isProcessing}
                    className="
                      relative inline-flex items-center gap-2
                      rounded-md px-3 py-1.5 text-[12px] font-medium
                      text-white bg-[#8B5CF6]
                      shadow-[0_0_18px_rgba(139,92,246,0.45)]
                      hover:shadow-[0_0_24px_rgba(139,92,246,0.65)]
                      disabled:opacity-40 disabled:shadow-none disabled:bg-[#262626]
                      transition-all
                    "
                  >
                    <span className="absolute -inset-px rounded-md ring-1 ring-inset ring-white/15 pointer-events-none" />
                    {isProcessing ? "Generando…" : "Generar"}
                  </button>
                </div>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
