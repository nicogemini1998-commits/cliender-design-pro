/**
 * MoodboardVault.tsx — Style Vault (Bottom Sheet)
 *
 * UX:
 *  - Bottom sheet deslizable que se ancla al borde inferior del viewport.
 *  - Sidebar izquierdo: grid de carpetas (cada tarjeta = un moodboard).
 *  - Panel derecho: detalle del moodboard activo + masonry grid + drag&drop.
 *  - "Lock Style" en cada carpeta — al activarse el borde brilla verde neón
 *    (#10B981) y solo UNA puede estar locked a la vez (gobernada por el store).
 *  - Drag&drop sobre el panel derecho: al soltar imágenes, dispara la
 *    auditoría y muestra el escáner "AUDITANDO ADN VISUAL" en barrido.
 *
 * Contrato backend (FastAPI):
 *   POST /moodboards/audit  →  { moodboard: {...} }
 *   POST /moodboards/:id/lock?locked=true
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  useStore,
  type Moodboard,
  type MoodboardImage,
  type StyleManifest,
} from "@/store/useStore";

// ---------------------------------------------------------------------------
// Helpers — fileToDataURL para drag&drop sin backend de storage.
// ---------------------------------------------------------------------------
function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

async function imagesFromFiles(files: FileList | File[]): Promise<MoodboardImage[]> {
  const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
  const out: MoodboardImage[] = [];
  for (const f of arr) {
    const url = await fileToDataURL(f);
    out.push({ id: `img-${Math.random().toString(36).slice(2)}`, url });
  }
  return out;
}

async function callAudit(opts: {
  apiBase: string;
  moodboardId: string;
  name: string;
  images: MoodboardImage[];
}): Promise<StyleManifest> {
  const res = await fetch(`${opts.apiBase}/moodboards/audit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      moodboard_id: opts.moodboardId,
      name: opts.name,
      images: opts.images,
    }),
  });
  if (!res.ok) throw new Error(`Audit failed: ${res.status}`);
  const data = await res.json();
  const m = data.moodboard.manifest;
  return {
    moodboardId: data.moodboard.id,
    colorPalette: m.color_palette ?? [],
    lightingStyle: m.lighting_style ?? "",
    cameraLensFeel: m.camera_lens_feel ?? "",
    characterTraits: m.character_traits ?? [],
    compositionRules: m.composition_rules ?? [],
    moodKeywords: m.mood_keywords ?? [],
    masterStylePrompt: m.master_style_prompt ?? "",
    negativePrompt: m.negative_prompt ?? "",
    consistencyScore: m.consistency_score ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function ScannerOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-lg"
    >
      <div className="absolute inset-0 bg-[#0A0A0A]/40" />
      <motion.div
        className="absolute left-0 right-0 h-[2px]"
        style={{
          background:
            "linear-gradient(90deg, transparent, #8B5CF6 30%, #C4B5FD 50%, #8B5CF6 70%, transparent)",
          boxShadow: "0 0 18px 4px rgba(139,92,246,0.7)",
        }}
        animate={{ top: ["0%", "100%", "0%"] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#C4B5FD]">
        <span className="relative h-1.5 w-1.5 rounded-full bg-[#8B5CF6]">
          <span className="absolute inset-0 rounded-full bg-[#8B5CF6] opacity-60 animate-ping" />
        </span>
        auditando ADN visual
      </div>
    </motion.div>
  );
}

function LockSwitch({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`
        group inline-flex items-center gap-2 rounded-md px-2.5 py-1
        text-[10.5px] font-mono uppercase tracking-[0.16em] transition-all
        ${locked
          ? "bg-[#10B981]/12 text-[#6EE7B7] ring-1 ring-[#10B981]/45 shadow-[0_0_14px_rgba(16,185,129,0.35)]"
          : "bg-[#0F0F0F] text-gray-500 ring-1 ring-[#262626] hover:text-gray-200 hover:ring-[#8B5CF6]/40"}
      `}
    >
      <span
        className={`relative inline-flex h-[18px] w-[30px] items-center rounded-full transition-colors
                    ${locked ? "bg-[#10B981]/40" : "bg-[#1F1F1F]"}`}
      >
        <motion.span
          layout
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
          className={`h-3 w-3 rounded-full ${locked ? "bg-[#10B981]" : "bg-[#3F3F46]"}`}
          style={{
            marginLeft: locked ? 14 : 3,
            boxShadow: locked ? "0 0 8px #10B981" : "none",
          }}
        />
      </span>
      {locked ? "style locked" : "lock style"}
    </button>
  );
}

function MoodboardCard({
  mb,
  active,
  onSelect,
  onToggleLock,
}: {
  mb: Moodboard;
  active: boolean;
  onSelect: () => void;
  onToggleLock: () => void;
}) {
  const thumbs = mb.images.slice(0, 4);
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`
        relative text-left w-full overflow-hidden rounded-xl border bg-[#0F0F0F] p-3
        transition-all
        ${mb.locked
          ? "border-[#10B981] shadow-[0_0_22px_rgba(16,185,129,0.32)]"
          : active
          ? "border-[#8B5CF6] shadow-[0_0_18px_rgba(139,92,246,0.25)]"
          : "border-[#262626] hover:border-[#8B5CF6]/60"}
      `}
    >
      {/* tira de thumbs */}
      <div className="grid grid-cols-2 gap-1 rounded-lg overflow-hidden bg-[#0A0A0A] aspect-[3/2]">
        {thumbs.length === 0 && (
          <div className="col-span-2 grid place-items-center text-[10px] font-mono uppercase tracking-[0.18em] text-gray-600">
            empty
          </div>
        )}
        {thumbs.map((img, i) => (
          <div
            key={img.id}
            className="bg-cover bg-center"
            style={{
              backgroundImage: `url(${img.url})`,
              gridColumn: thumbs.length === 1 ? "span 2" : undefined,
              gridRow: thumbs.length === 1 ? "span 2" : undefined,
              aspectRatio: thumbs.length === 1 ? "3/2" : "1/1",
            }}
          />
        ))}
        {mb.auditStatus === "auditing" && <ScannerOverlay />}
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] text-gray-100 font-medium">{mb.name}</div>
          <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            {mb.images.length} ref · {mb.auditStatus === "ready"
              ? `consist ${(mb.manifest?.consistencyScore ?? 0).toFixed(2)}`
              : mb.auditStatus}
          </div>
        </div>
        <LockSwitch locked={mb.locked} onToggle={onToggleLock} />
      </div>
    </motion.button>
  );
}

function PaletteStrip({ colors }: { colors: string[] }) {
  if (!colors?.length) return null;
  return (
    <div className="flex items-center gap-1.5">
      {colors.slice(0, 7).map((c, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div
            className="h-7 w-7 rounded-md ring-1 ring-[#262626]"
            style={{ background: c, boxShadow: `0 0 12px ${c}66` }}
          />
          <span className="font-mono text-[9px] uppercase tracking-wider text-gray-500">{c}</span>
        </div>
      ))}
    </div>
  );
}

function MasonryImage({ img, onRemove }: { img: MoodboardImage; onRemove: () => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 8 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="group relative overflow-hidden rounded-lg ring-1 ring-[#262626] hover:ring-[#8B5CF6]/60 transition-all"
      style={{ breakInside: "avoid" }}
    >
      <img src={img.url} alt="" className="block w-full h-auto" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-md
                   bg-black/60 text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity
                   hover:text-white hover:bg-black/80 backdrop-blur"
        aria-label="quitar"
      >
        ✕
      </button>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Componente principal
// ---------------------------------------------------------------------------

interface Props {
  open: boolean;
  onClose: () => void;
  apiBase?: string;
}

export default function MoodboardVault({ open, onClose, apiBase = "" }: Props) {
  const moodboards          = useStore((s) => s.moodboards);
  const createMoodboard     = useStore((s) => s.createMoodboard);
  const addImagesToMoodboard = useStore((s) => s.addImagesToMoodboard);
  const removeImageFromMoodboard = useStore((s) => s.removeImageFromMoodboard);
  const setLock             = useStore((s) => s.setLock);
  const beginAudit          = useStore((s) => s.beginAudit);
  const setManifest         = useStore((s) => s.setManifest);
  const setAuditStatus      = useStore((s) => s.setAuditStatus);
  const renameMoodboard     = useStore((s) => s.renameMoodboard);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Selecciona el locked, sino el primero
  const activeMb = useMemo(
    () =>
      moodboards.find((m) => m.id === activeId) ??
      moodboards.find((m) => m.locked) ??
      moodboards[0],
    [moodboards, activeId],
  );

  useEffect(() => {
    if (open && !activeMb && moodboards.length === 0) {
      const id = createMoodboard("First Style");
      setActiveId(id);
    }
  }, [open, activeMb, moodboards.length, createMoodboard]);

  const runAudit = useCallback(
    async (mb: Moodboard) => {
      if (!mb.images.length) return;
      beginAudit(mb.id);
      try {
        const manifest = await callAudit({
          apiBase,
          moodboardId: mb.id,
          name: mb.name,
          images: mb.images,
        });
        setManifest(mb.id, manifest);
      } catch (err) {
        console.error("audit error", err);
        setAuditStatus(mb.id, "error");
      }
    },
    [apiBase, beginAudit, setManifest, setAuditStatus],
  );

  const handleDrop = useCallback(
    async (files: FileList | File[]) => {
      if (!activeMb) return;
      const imgs = await imagesFromFiles(files);
      if (!imgs.length) return;
      addImagesToMoodboard(activeMb.id, imgs);
      // Re-disparar la auditoría con el set completo (existentes + nuevas)
      setTimeout(() => {
        const updated = useStore.getState().moodboards.find((m) => m.id === activeMb.id);
        if (updated) runAudit(updated);
      }, 30);
    },
    [activeMb, addImagesToMoodboard, runAudit],
  );

  // Listeners de drag&drop global cuando el vault está abierto
  const onDropZoneEvents = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(true);
    },
    onDragLeave: () => setIsDragOver(false),
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      if (e.dataTransfer?.files?.length) handleDrop(e.dataTransfer.files);
    },
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop opaco-suave que oscurece el canvas */}
          <motion.div
            key="vault-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/55"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.section
            key="vault-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 32 }}
            className="
              fixed inset-x-0 bottom-0 z-50
              h-[78vh] max-h-[820px]
              bg-[#0C0C0C] border-t border-[#262626]
              rounded-t-2xl shadow-[0_-30px_80px_rgba(0,0,0,0.7)]
              grid grid-cols-[340px_1fr]
            "
          >
            {/* Drag handle decorativo */}
            <div className="absolute left-1/2 top-2 -translate-x-1/2 h-1 w-12 rounded-full bg-[#262626]" />

            {/* Sidebar — listado de carpetas */}
            <aside className="flex flex-col border-r border-[#1F1F1F]">
              <div className="flex items-center justify-between border-b border-[#1F1F1F] px-4 py-3.5">
                <div>
                  <div className="text-[13px] font-medium text-gray-100">Style Vault</div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                    moodboard engine
                  </div>
                </div>
                <button
                  onClick={() => {
                    const id = createMoodboard();
                    setActiveId(id);
                  }}
                  className="rounded-md border border-[#262626] bg-[#0F0F0F] px-2.5 py-1 text-[11px] text-gray-200
                             hover:border-[#8B5CF6]/60 hover:text-white transition-colors"
                >
                  + new
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3 scroll-thin">
                {moodboards.map((mb) => (
                  <MoodboardCard
                    key={mb.id}
                    mb={mb}
                    active={activeMb?.id === mb.id}
                    onSelect={() => setActiveId(mb.id)}
                    onToggleLock={() => setLock(mb.id, !mb.locked)}
                  />
                ))}
                {moodboards.length === 0 && (
                  <div className="grid place-items-center py-12 text-center">
                    <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-gray-600">
                      sin carpetas todavía
                    </div>
                  </div>
                )}
              </div>
            </aside>

            {/* Panel derecho — detalle */}
            <section
              {...onDropZoneEvents}
              className={`
                relative flex flex-col min-w-0
                ${isDragOver ? "ring-1 ring-inset ring-[#8B5CF6]/45" : ""}
              `}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-[#1F1F1F] px-5 py-3.5">
                <div className="min-w-0">
                  {activeMb ? (
                    <input
                      value={activeMb.name}
                      onChange={(e) => renameMoodboard(activeMb.id, e.target.value)}
                      className="bg-transparent text-[15px] font-medium text-gray-100 focus:outline-none w-full
                                 placeholder:text-gray-600"
                    />
                  ) : (
                    <div className="text-[15px] text-gray-500">Selecciona un moodboard</div>
                  )}
                  {activeMb && (
                    <div className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-gray-500">
                      {activeMb.images.length} refs · {activeMb.auditStatus}
                      {activeMb.manifest && ` · consist ${activeMb.manifest.consistencyScore.toFixed(2)}`}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeMb && (
                    <>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-md border border-[#262626] bg-[#0F0F0F] px-3 py-1.5 text-[11.5px] text-gray-200
                                   hover:border-[#8B5CF6]/60 hover:text-white transition-colors"
                      >
                        + subir imágenes
                      </button>
                      <button
                        disabled={!activeMb.images.length}
                        onClick={() => runAudit(activeMb)}
                        className="rounded-md border border-[#8B5CF6]/40 bg-[#8B5CF6]/12 px-3 py-1.5 text-[11.5px] text-[#C4B5FD]
                                   hover:bg-[#8B5CF6]/22 transition-colors disabled:opacity-40"
                      >
                        re-auditar
                      </button>
                      <LockSwitch
                        locked={activeMb.locked}
                        onToggle={() => setLock(activeMb.id, !activeMb.locked)}
                      />
                    </>
                  )}
                  <button
                    onClick={onClose}
                    className="ml-2 grid h-7 w-7 place-items-center rounded-md text-gray-500
                               hover:text-gray-100 hover:bg-[#1A1A1A]"
                    aria-label="cerrar"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleDrop(e.target.files)}
              />

              {/* Contenido */}
              <div className="flex-1 overflow-hidden">
                <div className="h-full grid grid-cols-[1fr_320px]">
                  {/* Masonry */}
                  <div className="relative overflow-y-auto p-5 scroll-thin">
                    {!activeMb || activeMb.images.length === 0 ? (
                      <div className="grid h-full place-items-center">
                        <div className="text-center max-w-[420px]">
                          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl
                                          bg-[#8B5CF6]/10 ring-1 ring-[#8B5CF6]/30
                                          shadow-[0_0_22px_rgba(139,92,246,0.25)]">
                            <span className="text-[#A78BFA] text-xl">⇪</span>
                          </div>
                          <div className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.22em] text-gray-500">
                            arrastra para subir
                          </div>
                          <div className="mt-2 text-[14px] text-gray-200">
                            Suelta imágenes aquí.
                          </div>
                          <div className="mt-1.5 text-[12px] text-gray-500 leading-relaxed">
                            El <span className="text-[#C4B5FD]">Vision Auditor</span> extrae paleta,
                            luz, lente, rasgos compartidos y construye un master prompt de estilo.
                          </div>
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="mt-4 inline-flex items-center gap-1.5 rounded-md
                                       bg-[#8B5CF6] px-3.5 py-1.5 text-[12px] font-medium text-white
                                       shadow-[0_0_18px_rgba(139,92,246,0.45)]
                                       hover:shadow-[0_0_28px_rgba(139,92,246,0.7)] transition-shadow"
                          >
                            seleccionar archivos
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div
                        className="relative"
                        style={{ columnCount: 3, columnGap: 12 }}
                      >
                        <AnimatePresence initial={false}>
                          {activeMb.images.map((img) => (
                            <div key={img.id} className="mb-3" style={{ breakInside: "avoid" }}>
                              <MasonryImage
                                img={img}
                                onRemove={() => removeImageFromMoodboard(activeMb.id, img.id)}
                              />
                            </div>
                          ))}
                        </AnimatePresence>
                      </div>
                    )}

                    {/* Drag overlay */}
                    {isDragOver && (
                      <div className="pointer-events-none absolute inset-3 rounded-xl border-2 border-dashed
                                      border-[#8B5CF6]/60 bg-[#8B5CF6]/8 grid place-items-center">
                        <div className="text-center">
                          <div className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[#C4B5FD]">
                            soltar para auditar
                          </div>
                          <div className="text-[13px] text-gray-200 mt-1">
                            El Vision Auditor analizará el ADN visual
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Scanner global cuando audit running */}
                    {activeMb?.auditStatus === "auditing" && (
                      <div className="pointer-events-none absolute inset-0 overflow-hidden">
                        <motion.div
                          className="absolute left-0 right-0 h-[3px]"
                          style={{
                            background:
                              "linear-gradient(90deg, transparent, #8B5CF6 30%, #C4B5FD 50%, #8B5CF6 70%, transparent)",
                            boxShadow: "0 0 22px 6px rgba(139,92,246,0.6)",
                          }}
                          animate={{ top: ["-2%", "102%", "-2%"] }}
                          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Inspector — Manifiesto de Estilo */}
                  <aside className="border-l border-[#1F1F1F] bg-[#0A0A0A] overflow-y-auto scroll-thin">
                    <div className="px-4 py-3 border-b border-[#1F1F1F]">
                      <div className="text-[12px] font-medium text-gray-100">Style Manifest</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-gray-500">
                        ADN visual extraído
                      </div>
                    </div>

                    {activeMb?.manifest ? (
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500 mb-2">
                            paleta
                          </div>
                          <PaletteStrip colors={activeMb.manifest.colorPalette} />
                        </div>

                        <div className="grid gap-3">
                          {[
                            ["luz",          activeMb.manifest.lightingStyle],
                            ["lente",        activeMb.manifest.cameraLensFeel],
                            ["mood",         activeMb.manifest.moodKeywords.join(", ")],
                            ["composición",  activeMb.manifest.compositionRules.join(" · ")],
                            ["traits",       activeMb.manifest.characterTraits.join(" · ")],
                          ].map(([k, v]) => v ? (
                            <div key={k as string}>
                              <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-gray-500">
                                {k}
                              </div>
                              <div className="mt-0.5 text-[12px] text-gray-200 leading-relaxed">{v}</div>
                            </div>
                          ) : null)}
                        </div>

                        <div>
                          <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">
                            master style prompt
                          </div>
                          <div className="rounded-md border border-[#262626] bg-[#0F0F0F] p-2.5
                                          font-mono text-[11px] leading-relaxed text-gray-200">
                            {activeMb.manifest.masterStylePrompt}
                          </div>
                        </div>

                        {activeMb.manifest.negativePrompt && (
                          <div>
                            <div className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-gray-500 mb-1.5">
                              negative
                            </div>
                            <div className="rounded-md border border-[#262626] bg-[#0F0F0F] p-2.5
                                            font-mono text-[10.5px] leading-relaxed text-gray-400">
                              {activeMb.manifest.negativePrompt}
                            </div>
                          </div>
                        )}

                        <div className="pt-3 border-t border-[#1F1F1F]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
                              consistencia
                            </span>
                            <span className="font-mono text-[12px] text-gray-100">
                              {activeMb.manifest.consistencyScore.toFixed(2)}
                            </span>
                          </div>
                          <div className="h-1 w-full rounded-full bg-[#1F1F1F] overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${activeMb.manifest.consistencyScore * 100}%`,
                                background: "linear-gradient(90deg, #8B5CF6, #10B981)",
                                boxShadow: "0 0 10px rgba(139,92,246,0.55)",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 text-center">
                        <div className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-gray-600">
                          sin manifiesto
                        </div>
                        <div className="mt-2 text-[12px] text-gray-400 leading-relaxed">
                          Sube imágenes para que el Vision Auditor genere el ADN visual.
                        </div>
                      </div>
                    )}
                  </aside>
                </div>
              </div>
            </section>
          </motion.section>
        </>
      )}
    </AnimatePresence>
  );
}
