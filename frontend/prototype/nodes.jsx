/* prototype/nodes.jsx — V2
 * 4 nodos del canvas (basados en mockups Pletor-style):
 *   PromptNode  — brief inicial; TIPO=image/video; cantidad
 *   ImageNode   — imagen Kid.ai (gpt-imagenes-2 / nano-banana-pro / nano-banana-2)
 *   VideoNode   — video  Kid.ai (veo3 / seedance-2.0)
 *   NoteNode    — anotación libre tipo post-it (no participa del flujo)
 *
 * Handles izquierda/derecha personalizados; cada uno dispara
 * window.__handleMouseDown(e, nodeId, side) que app.jsx consume para
 * implementar el connector drag.
 */

// ---------------------------------------------------------------------------
// Catálogo Kid.ai
// ---------------------------------------------------------------------------
const KID_IMAGE_MODELS = [
  { id: "nano-banana-2",   label: "Nano Banana",   hint: "rápido · 2K · texto o referencias (recomendado)" },
  { id: "gpt-imagenes-2",  label: "GPT-2 IMAGE",   hint: "máximo detalle · LENTO (1-6 min)" },
  // Con imágenes de referencia conectadas, el backend usa SIEMPRE nano-banana-2 (2048×2048)
];
const KID_VIDEO_MODELS = [
  { id: "seedance-2.0", label: "Seedance 2.0", hint: "vertical / social" },
  // veo3 — desactivado temporalmente, solo seedance-2.0 activo
];
const ASPECTS_IMG   = ["1:1", "16:9", "9:16", "4:5", "3:2"];
const VIDEO_RES     = ["480p", "720p", "1080p"];
const VIDEO_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const VIDEO_DURS    = ["4s", "5s", "7s", "10s", "15s"];

// ---------------------------------------------------------------------------
// Iconos
// ---------------------------------------------------------------------------
const Icon = {
  /* ── Nodo Imagen — marco con montaña + apertura ── */
  ImageGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="2.5" y="4.5" width="19" height="15" rx="3.5" stroke="#818CF8" strokeWidth="1.6" fill="rgba(99,102,241,0.08)"/>
      <path d="M5 16.5l4.5-5.5 3.5 4 2.5-3 3.5 4.5" stroke="#818CF8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="8" cy="9.5" r="1.8" stroke="#818CF8" strokeWidth="1.4" fill="rgba(129,140,248,0.2)"/>
    </svg>
  ),
  /* ── Nodo Video — cinta de película + play ── */
  VideoGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="2" y="5" width="14" height="14" rx="2.5" stroke="#34D399" strokeWidth="1.6" fill="rgba(16,185,129,0.08)"/>
      <path d="M2 8h3.5M2 16h3.5M12.5 8h-3.5M12.5 16h-3.5" stroke="#34D399" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17.5 9l4.5 3-4.5 3z" stroke="#34D399" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(52,211,153,0.18)"/>
    </svg>
  ),
  /* ── Nodo Prompt — estrella IA cuatro puntas ── */
  PromptGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M12 3.5C12 3.5 13.2 8.8 18.5 12C13.2 15.2 12 20.5 12 20.5C12 20.5 10.8 15.2 5.5 12C10.8 8.8 12 3.5 12 3.5Z" stroke="#A78BFA" strokeWidth="1.5" strokeLinejoin="round" fill="rgba(167,139,250,0.1)"/>
      <circle cx="12" cy="12" r="1.6" fill="#A78BFA"/>
    </svg>
  ),
  /* ── Nodo Nota — documento con esquina doblada ── */
  NoteGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3.5" y="3.5" width="14" height="17" rx="2.5" stroke="#FBBF24" strokeWidth="1.6" fill="rgba(251,191,36,0.08)"/>
      <path d="M7 8.5h10M7 12h10M7 15.5h6" stroke="#FBBF24" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M15 3.5v3.5h3" stroke="#FBBF24" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  /* ── Galería — cuadrícula 2×2 ── */
  GalleryGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="#C4B5FD" strokeWidth="1.5" fill="rgba(167,139,250,0.10)"/>
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="2" stroke="#C4B5FD" strokeWidth="1.5" fill="rgba(167,139,250,0.06)"/>
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="#C4B5FD" strokeWidth="1.5" fill="rgba(167,139,250,0.06)"/>
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2" stroke="#C4B5FD" strokeWidth="1.5" fill="rgba(167,139,250,0.10)"/>
    </svg>
  ),
  /* ── Nodo Voz — 5 barras de audio ── */
  MicGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <path d="M3 12h2" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M7 9v6" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M11 5.5v13" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round"/>
      <path d="M15 9v6" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round"/>
      <path d="M19 12h2" stroke="#FBBF24" strokeWidth="2.2" strokeLinecap="round"/>
    </svg>
  ),
  /* ── Utilidades — trazo fino ── */
  Chevron:  (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Plus:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>),
  Minus:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><path d="M5 12h14" strokeLinecap="round"/></svg>),
  Play:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...p}><path d="M7 4.5v15L19 12z" strokeLinecap="round"/></svg>),
  Close:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...p}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round"/></svg>),
  Spark:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" {...p}><path d="M12 3C12 3 13.4 8.6 19 12C13.4 15.4 12 21 12 21C12 21 10.6 15.4 5 12C10.6 8.6 12 3 12 3Z" strokeLinecap="round"/></svg>),
  Heart:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...p}><path d="M12 21C12 21 3.5 16 3.5 9.5a4.5 4.5 0 0 1 8.5-2 4.5 4.5 0 0 1 8.5 2C20.5 16 12 21 12 21z" strokeLinecap="round"/></svg>),
  Dice:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="3" width="18" height="18" rx="3.5" strokeLinecap="round"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>),
  Photo:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" strokeLinecap="round"/><circle cx="9" cy="11" r="2" strokeLinecap="round"/><path d="M21 16.5L16 11l-9 9" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Film:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...p}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M7 5v14M17 5v14" strokeLinecap="round"/><path d="M3 9h4M3 15h4M17 9h4M17 15h4" strokeLinecap="round"/></svg>),
  Eye:      (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>),
  Trash:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/></svg>),
  Download: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3v13M8 12l4 4 4-4M3 17v2a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-2"/></svg>),
};

// SmartImg — carga imagen con fallback proxy vía React state (no DOM mutation)
function SmartImg({ url, style, className }) {
  const proxy = () => window.__proxied ? window.__proxied(url) : url;
  const [src, setSrc] = React.useState(url);
  const [status, setStatus] = React.useState("loading"); // loading | ok | error
  React.useEffect(() => { setSrc(url); setStatus("loading"); }, [url]);
  return (
    <div className={className} style={{ ...style, position:"relative" }}>
      {status === "loading" && (
        <div style={{ position:"absolute", inset:0, background:"linear-gradient(135deg,rgba(139,92,246,0.08),transparent 60%)", animation:"output-shimmer 1.8s linear infinite" }} />
      )}
      {status === "error" && (
        <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"var(--text-4)", flexDirection:"column", gap:4 }}>
          <span style={{ fontSize:20 }}>🖼</span>
          <span className="mono">preview no disponible</span>
          <a href={url} target="_blank" rel="noopener" style={{ color:"var(--accent)", fontSize:10 }}>abrir URL ↗</a>
        </div>
      )}
      <img
        src={src}
        style={{ width:"100%", height:"100%", objectFit:"cover", display: status==="error" ? "none" : "block" }}
        onLoad={() => setStatus("ok")}
        onError={() => {
          if (src === url && url !== proxy()) {
            setSrc(proxy()); // primer intento: cargar por proxy
          } else {
            setStatus("error"); // proxy también falló — mostrar placeholder
          }
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------
function StatusDot({ status }) {
  const map = {
    idle:    { c: "#52525B", g: "transparent" },
    running: { c: "#8B5CF6", g: "rgba(139,92,246,0.6)" },
    done:    { c: "#10B981", g: "rgba(16,185,129,0.6)" },
    error:   { c: "#EF4444", g: "rgba(239,68,68,0.6)" },
  }[status] || { c: "#52525B", g: "transparent" };
  return (
    <span
      className={status === "running" ? "led-breath" : ""}
      style={{
        display: "inline-block", width: 6, height: 6, borderRadius: "50%",
        background: map.c, boxShadow: `0 0 8px 1px ${map.g}`,
      }}
    />
  );
}

function NodeHandle({ nodeId, side, accent }) {
  return (
    <div
      className="nh"
      data-node-id={nodeId}
      data-side={side}
      style={{ "--handle-c": accent }}
      onMouseDown={(e) => window.__handleMouseDown && window.__handleMouseDown(e, nodeId, side)}
      onMouseUp={(e) => window.__handleMouseUp && window.__handleMouseUp(e, nodeId, side)}
      title={side === "left" ? "input" : "output"}
    />
  );
}

function HeaderModelPill({ value, options, onChange, accent = "#8B5CF6" }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  React.useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const current = options.find((o) => o.id === value) || options[0];
  return (
    <div className="model-pill-wrap" ref={ref}>
      <button
        className="model-pill"
        style={{ "--pill-c": accent }}
        onClick={(e) => { e.stopPropagation(); setOpen((s) => !s); }}
      >
        <span className="model-pill-label mono">{current.label}</span>
        <Icon.Chevron style={{ width: 11, height: 11 }} />
      </button>
      {open && (
        <ul className="model-pill-menu" onMouseDown={(e) => e.stopPropagation()}>
          {options.map((o) => (
            <li key={o.id}>
              <button
                className={"model-pill-opt " + (o.id === value ? "is-active" : "")}
                onClick={() => { onChange(o.id); setOpen(false); }}
              >
                <span className="mono">{o.label}</span>
                <span className="model-pill-hint">{o.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Counter({ value, onChange, min = 1, max = 10 }) {
  return (
    <div className="counter">
      <button className="counter-btn" onClick={() => onChange(Math.max(min, value - 1))}>
        <Icon.Minus style={{ width: 11, height: 11 }} />
      </button>
      <div className="counter-val mono">{value}</div>
      <button className="counter-btn" onClick={() => onChange(Math.min(max, value + 1))}>
        <Icon.Plus style={{ width: 11, height: 11 }} />
      </button>
    </div>
  );
}

function Seg({ value, onChange, options, accent }) {
  return (
    <div className="seg-row" style={{ "--seg-c": accent }}>
      {options.map((o) => (
        <button
          key={o}
          className={"seg-chip mono " + (value === o ? "is-active" : "")}
          onClick={() => onChange(o)}
        >{o}</button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, accent = "#8B5CF6" }) {
  return (
    <button
      className={"toggle " + (checked ? "is-on" : "")}
      style={{ "--toggle-c": accent }}
      onClick={() => onChange(!checked)}
      type="button"
    >
      <span className="toggle-track"><span className="toggle-knob" /></span>
    </button>
  );
}

function Divider({ label }) {
  return (
    <div className="divider-label">
      <span className="divider-line" />
      <span className="divider-text mono">{label}</span>
      <span className="divider-line" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentPicker — dropdown selector de agente creativo en el PromptNode
// ---------------------------------------------------------------------------
function AgentPicker({ agentId, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const agents = (window.__creativeAgents || []);
  // "none" o null/undefined → modo directo (sin agente)
  const isNone = !agentId || agentId === "none";
  const active = isNone ? null : agents.find((a) => a.id === agentId) || null;

  React.useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div className="agent-picker" ref={ref}>
      <button
        className={"agent-chip" + (open ? " is-open" : "") + (isNone ? " is-direct" : "")}
        onClick={() => setOpen((o) => !o)}
        type="button"
        style={{ "--agent-color": active?.accent || "#6B7280" }}
      >
        {isNone ? (
          <>
            <span className="agent-chip-avatar" style={{ background: "rgba(107,114,128,0.35)", fontSize: 11 }}>✎</span>
            <span className="mono agent-chip-name" style={{ color: "var(--text-3)" }}>/directo</span>
          </>
        ) : (
          <>
            <span className="agent-chip-avatar" style={{ background: active?.accent || "#6366F1", padding:0, overflow:"hidden" }}>
              {active?.agentPhoto
                ? <img src={active.agentPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",display:"block"}}
                    onError={e=>{e.currentTarget.style.display="none";e.currentTarget.parentNode.textContent=active.initials||"?";}}/>
                : (active?.initials || "?")}
            </span>
            <span className="mono agent-chip-name">/{active?.name?.toLowerCase() || "agente"}</span>
          </>
        )}
        <svg viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6 }}>
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="agent-dropdown">
          <div className="agent-dropdown-label mono">modo de prompt</div>
          {/* Opción "Sin agente — prompt directo" siempre visible */}
          <button
            className={"agent-option" + (isNone ? " is-active" : "")}
            onClick={() => { onChange({ agentId: "none" }); setOpen(false); }}
            type="button"
            style={{ "--agent-color": "#6B7280" }}
          >
            <span className="agent-option-avatar" style={{ background: "rgba(107,114,128,0.3)", fontSize: 14 }}>✎</span>
            <div className="agent-option-meta">
              <div className="agent-option-name">/directo</div>
              <div className="agent-option-role mono">prompt sin modificar · texto tal cual</div>
            </div>
            {isNone && <span className="agent-option-check">✓</span>}
          </button>
          {agents.length === 0 ? (
            <div className="agent-dropdown-empty mono">Sin agentes — créalos en el menú lateral</div>
          ) : (
            agents.map((a) => (
              <button
                key={a.id}
                className={"agent-option" + (a.id === agentId ? " is-active" : "")}
                onClick={() => { onChange({ agentId: a.id }); setOpen(false); }}
                type="button"
                style={{ "--agent-color": a.accent }}
              >
                <span className="agent-option-avatar" style={{ background: a.accent, padding:0, overflow:"hidden" }}>
                  {a.agentPhoto
                    ? <img src={a.agentPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",display:"block"}}
                        onError={e=>{e.currentTarget.style.display="none";e.currentTarget.parentNode.textContent=a.initials;}}/>
                    : a.initials}
                </span>
                <div className="agent-option-meta">
                  <div className="agent-option-name">/{a.name.toLowerCase()}</div>
                  <div className="agent-option-role mono">{a.role}</div>
                </div>
                {a.id === agentId && <span className="agent-option-check">✓</span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROMPT NODE
// ---------------------------------------------------------------------------
// PromptListModal — visor elegante de prompts del agente con tracking en vivo
// ---------------------------------------------------------------------------
function PromptListModal({ node, onClose }) {
  const d = node.data || {};
  const [copied, setCopied] = React.useState(null);
  // Fuente: d.prompts (estructurado) o fallback al agentOutput plano.
  const prompts = (Array.isArray(d.prompts) && d.prompts.length)
    ? d.prompts
    : (d.agentOutput ? [{ index: 1, prompt: d.agentOutput, status: d.status === "done" ? "done" : "pending" }] : []);
  const doneCount = prompts.filter((p) => p.status === "done").length;
  const runningIdx = prompts.findIndex((p) => p.status === "running");

  const copyOne = (text, key) => {
    try { navigator.clipboard?.writeText(text); } catch (e) {}
    setCopied(key); setTimeout(() => setCopied(null), 1400);
  };
  const copyAll = () => copyOne(prompts.map((p, i) => `${i + 1}. ${p.prompt}`).join("\n\n"), "all");

  const SM = {
    pending: { label: "en cola", color: "#94a3b8", bg: "rgba(148,163,184,0.12)" },
    running: { label: "ejecutando", color: "#A5B4FC", bg: "rgba(99,102,241,0.20)" },
    done:    { label: "hecho",   color: "#86EFAC", bg: "rgba(46,204,113,0.16)" },
    error:   { label: "error",   color: "#FCA5A5", bg: "rgba(239,68,68,0.16)" },
  };
  const pillBtn = { cursor: "pointer", border: "1px solid rgba(99,102,241,0.3)", background: "rgba(99,102,241,0.10)", color: "#A5B4FC", borderRadius: 9, padding: "6px 12px", fontSize: 11.5, fontWeight: 600, transition: "all 140ms ease", fontFamily: "inherit" };

  // Portal a document.body: el canvas usa transform (pan/zoom) y rompe position:fixed.
  const _modal = (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(8,8,16,0.74)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", animation: "cdpModalIn 180ms cubic-bezier(0.16,1,0.3,1)" }}>
      <style>{`@keyframes cdpModalIn{from{opacity:0}to{opacity:1}}@keyframes cdpPanelIn{from{opacity:0;transform:translateY(14px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(740px,92vw)", maxHeight: "86vh", display: "flex", flexDirection: "column", borderRadius: 18, background: "linear-gradient(160deg,#17171f,#0e0e16)", border: "1px solid rgba(99,102,241,0.35)", boxShadow: "0 28px 90px rgba(0,0,0,0.62), inset 0 1px 0 rgba(255,255,255,0.04)", overflow: "hidden", animation: "cdpPanelIn 240ms cubic-bezier(0.16,1,0.3,1)" }}>
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(99,102,241,0.06)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 650, color: "#EBEAE4", letterSpacing: 0.2, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#A5B4FC" }}>✦</span> Prompts del agente
            </div>
            <div style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 4 }}>
              {prompts.length} prompt{prompts.length !== 1 ? "s" : ""} · {doneCount} ejecutado{doneCount !== 1 ? "s" : ""}{runningIdx >= 0 ? ` · ejecutando #${runningIdx + 1}` : ""}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {prompts.length > 1 && (
              <button onClick={copyAll} style={{ ...pillBtn, color: copied === "all" ? "#86EFAC" : "#A5B4FC" }}>{copied === "all" ? "✓ copiado" : "copiar todos"}</button>
            )}
            <button onClick={onClose} style={{ ...pillBtn, padding: "6px 11px" }} aria-label="cerrar">✕</button>
          </div>
        </div>
        <div style={{ overflowY: "auto", padding: "16px 18px", display: "flex", flexDirection: "column", gap: 12 }}>
          {prompts.length === 0 ? (
            <div style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: "34px 0" }}>Aún no hay prompts. Ejecuta el nodo primero.</div>
          ) : prompts.map((p, i) => {
            const sm = SM[p.status] || SM.pending;
            const isRunning = p.status === "running";
            return (
              <div key={i} style={{ borderRadius: 13, border: "1px solid " + (isRunning ? "rgba(99,102,241,0.55)" : "rgba(255,255,255,0.08)"), background: isRunning ? "rgba(99,102,241,0.07)" : "rgba(255,255,255,0.02)", overflow: "hidden", transition: "all 220ms ease", boxShadow: isRunning ? "0 0 0 1px rgba(99,102,241,0.3),0 8px 26px rgba(99,102,241,0.14)" : "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ width: 27, height: 27, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono,monospace)", background: "rgba(99,102,241,0.16)", color: "#A5B4FC", flexShrink: 0 }}>{String(i + 1).padStart(2, "0")}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, padding: "3px 10px", borderRadius: 20, color: sm.color, background: sm.bg }}>
                    {isRunning && <span className="agent-thinking-spinner" style={{ width: 9, height: 9 }} />}
                    {p.status === "done" ? "✓ " : ""}{sm.label}
                  </span>
                  <div style={{ flex: 1 }} />
                  <button onClick={() => copyOne(p.prompt, i)} style={{ ...pillBtn, padding: "5px 11px", fontSize: 11, color: copied === i ? "#86EFAC" : "#A5B4FC" }}>{copied === i ? "✓ copiado" : "⧉ copiar"}</button>
                </div>
                <div style={{ padding: "12px 14px", fontSize: 12.5, lineHeight: 1.6, color: "#CBD5E1", maxHeight: 170, overflowY: "auto", whiteSpace: "pre-wrap", fontFamily: "var(--font-mono,monospace)" }}>{p.prompt}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
  return (typeof ReactDOM !== "undefined" && ReactDOM.createPortal) ? ReactDOM.createPortal(_modal, document.body) : _modal;
}

// ---------------------------------------------------------------------------
function PromptNode({ node, onChange, onMouseDownHeader, onClose, selected, onGenerate, incomingMedia, activeClient, activeMoodboard }) {
  const accent = "#6366F1";
  const d = node.data;
  const [showPrompts, setShowPrompts] = React.useState(false);
  const [showInline, setShowInline] = React.useState(false);
  const _promptCount = (Array.isArray(d.prompts) && d.prompts.length) ? d.prompts.length : (d.agentOutput ? 1 : 0);
  const _hasPrompts = _promptCount > 0;
  const agents = (typeof window !== 'undefined' && window.__creativeAgents) || [];
  const activeAgent = agents.find((a) => a.id === d.agentId) || null;
  const mbScore = activeMoodboard?.manifest?.consistency_score ?? activeMoodboard?.manifest?.consistencyScore;
  const mbReady = !!activeMoodboard?.manifest;
  const hasClient = !!activeClient;
  const hasAgent = !!activeAgent;
  const briefOk = (d.brief || '').trim().length > 0;

  return (
    <div className={"node-v2 prompt-node " + (selected ? "is-selected" : "")} data-accent="indigo">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background: "transparent" }}>
            <Icon.PromptGlyph style={{ width: 22, height: 22 }} />
          </div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Prompt Node</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status} />
              <span>
                {d._batchStatus
                  ? `generando ${d._batchStatus} en cola…`
                  : d.status === "running" ? "Procesando" : "Listo"}
              </span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <AgentPicker agentId={d.agentId} onChange={onChange} />
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>
      <div className="node-v2-body">
        {incomingMedia?.url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: 6, borderRadius: 6, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
            {incomingMedia.kind === "video" ? (
              <video src={incomingMedia.url} muted style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <img src={incomingMedia.url} alt="ref" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>ref upstream · {incomingMedia.kind}</span>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>El agente verá esta pieza para mantener coherencia visual</span>
            </div>
          </div>
        ) : null}
        <div className="field-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
          <span>Brief creativo (mínimo)</span>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {hasClient ? (
              <span title={"Cliente activo: " + activeClient.name} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(99,102,241,0.12)', color: '#A5B4FC', border: '1px solid rgba(99,102,241,0.3)' }}>
                👤 {activeClient.name}
              </span>
            ) : (
              <span title="Sin cliente activo: el agente no sabrá qué marca" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.35)' }}>
                ⚠ sin cliente
              </span>
            )}
            {activeMoodboard ? (
              <span title={(activeMoodboard.manifest?.master_style_prompt || 'moodboard sin manifest auditado').slice(0,120)} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: mbReady ? 'rgba(46,204,113,0.12)' : 'rgba(234,179,8,0.12)', color: mbReady ? '#86EFAC' : '#FDE68A', border: '1px solid ' + (mbReady ? 'rgba(46,204,113,0.3)' : 'rgba(234,179,8,0.35)') }}>
                🎨 {activeMoodboard.name}{mbReady && typeof mbScore === 'number' ? ' · ' + Math.round(mbScore * 100) + '%' : (mbReady ? '' : ' · sin manifest')}
              </span>
            ) : null}
            {!hasAgent && (
              <span title="Sin agente: el brief se enviará crudo a Kid.ai sin enriquecer" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(234,179,8,0.12)', color: '#FDE68A', border: '1px solid rgba(234,179,8,0.35)' }}>
                ⚠ sin agente
              </span>
            )}
          </div>
        </div>
        <textarea
          className="node-input"
          rows={3}
          value={d.brief}
          onChange={(e) => onChange({ brief: e.target.value })}
          placeholder={hasAgent
            ? "Brief simple. Ej: 'post para campaña Instagram lanzamiento producto'. El agente añadirá cliente + estilo moodboard."
            : "Describe qué quieres crear. Sin agente seleccionado, este texto va tal cual al modelo."}
        />


        {d.agentOutput && (
          <div className="agent-output-panel">
            <button
              className="agent-output-toggle"
              onClick={() => setShowInline((v) => !v)}
            >
              <span className="agent-output-dot">✦</span>
              <span>Prompt refinado · SHAQ</span>
              <span className="agent-output-arrow">{showInline ? "▴" : "▾"}</span>
            </button>
            {showInline && (
              <div className="agent-output-text">{d.agentOutput}</div>
            )}
          </div>
        )}
        {d.status === "running" && (
          <div className="agent-thinking-pill">
            <span className="agent-thinking-spinner" />
            {d._batchStatus || "El agente está refinando el brief…"}
          </div>
        )}

        <div className="field-row">
          <div style={{ flex: 1 }}>
            <div className="field-label">Tipo</div>
            <div className="tipo-toggle">
              <button
                className={"tipo-btn " + (d.tipo === "image" ? "is-active accent-indigo" : "")}
                onClick={() => onChange({ tipo: "image" })}
              >
                <Icon.Photo style={{ width: 13, height: 13 }} /> Imagen
              </button>
              <button
                className={"tipo-btn " + (d.tipo === "video" ? "is-active accent-green" : "")}
                onClick={() => onChange({ tipo: "video" })}
              >
                <Icon.Film style={{ width: 13, height: 13 }} /> Video
              </button>
            </div>
          </div>
          <div>
            <div className="field-label">Cantidad</div>
            <Counter value={d.cantidad} onChange={(v) => onChange({ cantidad: v })} />
          </div>
        </div>

        {(d.tipo === "image" || d.tipo === "video") && (
          <div className="field-row" style={{ marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <div className="field-label">Modelo</div>
              <HeaderModelPill
                value={d.modelId || (d.tipo === "image" ? "nano-banana-2" : "seedance-2.0")}
                options={d.tipo === "image" ? KID_IMAGE_MODELS : KID_VIDEO_MODELS}
                onChange={(v) => onChange({ modelId: v })}
                accent={accent}
              />
            </div>
          </div>
        )}

        <div className="node-v2-actions">
          <button
            className={"btn-soft" + (_hasPrompts ? "" : " is-disabled")}
            disabled={!_hasPrompts}
            onClick={() => { if (_hasPrompts) setShowPrompts(true); }}
          >Ver prompts{_promptCount > 1 ? ` (${_promptCount})` : ""}</button>
          <button
            className={"btn-soft btn-primary-light " + (briefOk && d.status !== "running" ? "" : "is-disabled")}
            disabled={d.status === "running"}
            onClick={() => {
              if (!briefOk || d.status === "running") return;
              if (hasAgent && !hasClient) {
                window.__notify?.({ kind: 'warning', icon: '⚠', title: 'Sin cliente activo', body: 'El agente generará un prompt genérico sin marca. Selecciona cliente arriba para mejor resultado.' });
              } else if (!hasAgent) {
                window.__notify?.({ kind: 'info', icon: 'ℹ', title: 'Sin agente', body: 'El brief se enviará crudo al modelo sin enriquecer.' });
              } else if (activeMoodboard && !mbReady) {
                window.__notify?.({ kind: 'warning', icon: '🎨', title: 'Moodboard sin manifest', body: 'Sin manifest auditado, el estilo visual no se aplicará con precisión.' });
              }
              onGenerate?.();
            }}
          >
            <Icon.Play style={{ width: 10, height: 10 }} />
            {d.status === "running" ? "Generando…" : "Generar"}
          </button>

        </div>
      </div>
      {showPrompts && <PromptListModal node={node} onClose={() => setShowPrompts(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// IMAGE NODE
// ---------------------------------------------------------------------------

// PersonaChip — badge simple "directo" cuando no hay Prompt Node upstream
function PersonaChip() {
  return (
    <span className="incoming-chip mono" style={{ color: "var(--text-3)" }}>
      <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%",
                     background:"#8B5CF6", marginRight:4, verticalAlign:"middle" }} />
      directo
    </span>
  );
}

function ImageNode({ node, onChange, onMouseDownHeader, onClose, selected, onGenerate, hasIncomingPrompt, incomingPrompt, incomingMedia, incomingRefImages }) {
  const accent = "#8B5CF6";
  const d = node.data;
  const [configOpen, setConfigOpen] = React.useState(false);

  return (
    <div className={"node-v2 image-node " + (selected ? "is-selected" : "")} data-accent="purple">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon"><Icon.ImageGlyph style={{ width: 22, height: 22 }} /></div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Imagen</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status} /> <span>{d.status === "running" ? "Generando" : d.status === "done" ? "Listo" : "Listo"}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <HeaderModelPill
            value={d.modelId}
            options={KID_IMAGE_MODELS}
            onChange={(v) => onChange({ modelId: v })}
            accent={accent}
          />
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      <div className="node-v2-body">
        {incomingPrompt ? (
          <div className="incoming-prompt-preview" style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: 6, marginBottom: 8, borderRadius: 8,
            background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.08)" : "rgba(167,139,250,0.08)",
            border: "1px solid " + (incomingPrompt.status === "error" ? "rgba(251,113,133,0.35)" : "rgba(167,139,250,0.25)"),
            boxShadow: incomingPrompt.status === "running" ? "0 0 0 0 rgba(167,139,250,0.4)" : "none",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6, flexShrink: 0,
              background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.15)" : "rgba(167,139,250,0.15)",
              display: "grid", placeItems: "center",
              fontSize: 11, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", fontFamily: "var(--font-mono)",
            }}>
              {incomingPrompt.agentName ? incomingPrompt.agentName.slice(0,2).toUpperCase() : "··"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span className="mono" style={{ fontSize: 10, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>
                prompt upstream {incomingPrompt.agentName ? "· " + incomingPrompt.agentName : "· sin agente"}
                {incomingPrompt.status === "running" && " · ejecutando…"}
                {incomingPrompt.status === "error" && " · error"}
                {incomingPrompt.hasRefined && " · refinado ✓"}
              </span>
              <span style={{
                fontSize: 11, color: "var(--text-3)",
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", maxWidth: "100%",
              }} title={incomingPrompt.refined || incomingPrompt.brief || "(brief vacío)"}>
                {incomingPrompt.hasRefined
                  ? (incomingPrompt.refined.slice(0, 60) + (incomingPrompt.refined.length > 60 ? "…" : ""))
                  : incomingPrompt.brief
                    ? ("brief: " + incomingPrompt.brief.slice(0, 50) + (incomingPrompt.brief.length > 50 ? "…" : ""))
                    : "(esperando ejecución)"
                }
              </span>
            </div>
          </div>
        ) : null}
        {incomingMedia?.url ? (
          <div className="incoming-ref-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <img src={incomingMedia.url} alt="ref" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>ref upstream · {incomingMedia.kind}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>se usará como reference_image</span>
            </div>
          </div>
        ) : null}

        {/* Strip de imágenes de referencia del nodo ImageRef conectado */}
        {incomingRefImages?.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 8px", marginBottom:8, borderRadius:8, background:"rgba(249,115,22,0.07)", border:"1px solid rgba(249,115,22,0.25)" }}>
            <span className="mono" style={{ fontSize:9, color:"#FB923C", letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0 }}>🖼 ref</span>
            <div style={{ display:"flex", gap:4, flex:1 }}>
              {incomingRefImages.slice(0,6).map((url, i) => (
                <img key={i} src={url} alt="" style={{ width:26, height:26, borderRadius:4, objectFit:"cover", flexShrink:0, border:"1px solid rgba(249,115,22,0.3)" }}
                  onError={(e)=>{ if(window.__proxied && !e.currentTarget.dataset.p){ e.currentTarget.dataset.p="1"; e.currentTarget.src=window.__proxied(url); } }} />
              ))}
              {incomingRefImages.length > 6 && <span style={{ fontSize:9.5, color:"#FB923C", alignSelf:"center" }}>+{incomingRefImages.length-6}</span>}
            </div>
            <span className="mono" style={{ fontSize:9, color:"var(--text-3)", flexShrink:0 }}>{incomingRefImages.length} activa{incomingRefImages.length>1?"s":""}</span>
          </div>
        )}

        <div className="field-row" style={{ alignItems: "center", marginBottom: 6 }}>
          <div className="field-label" style={{ margin: 0 }}>Prompt</div>
          {hasIncomingPrompt ? (
            <span className="incoming-chip mono">
              <span className="led-dot" style={{ background: "#8B5CF6", boxShadow: "0 0 6px #8B5CF6" }} />
              hereda brief
            </span>
          ) : <PersonaChip />}
        </div>
        <textarea
          className="node-input"
          rows={3}
          value={d.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={hasIncomingPrompt ? "(usando brief del Prompt Node)" : "Describe la imagen con detalle..."}
          disabled={hasIncomingPrompt}
        />

        <button
          className="collapsible"
          onClick={() => setConfigOpen((s) => !s)}
          style={{ borderTop: "1px solid var(--line-2)", paddingTop: 10, marginTop: 2 }}
        >
          <span className="collapsible-bullet">{configOpen ? "▾" : "▸"}</span>
          {configOpen ? "Ocultar configuración" : "Configuración avanzada"}
          <Icon.Chevron style={{ width: 11, height: 11, marginLeft: "auto",
                                  transform: configOpen ? "rotate(180deg)" : "none",
                                  transition: "transform .2s" }} />
        </button>

        {configOpen && (
          <>
            <div className="field-label">Imagen de referencia ({d.refImages?.length || 0}/1)</div>
            <div className="ref-slot-row">
              {(d.refImages || []).map((url, i) => (
                <div key={i} className="ref-slot ref-slot-sm" style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                  <button
                    className="ref-slot-remove"
                    onClick={() => onChange({ refImages: (d.refImages || []).filter((_, j) => j !== i) })}
                  >✕</button>
                </div>
              ))}
              {(d.refImages || []).length < 1 && (
                <label className="ref-slot ref-slot-sm">
                  <input
                    type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => onChange({ refImages: [reader.result] });
                      reader.readAsDataURL(file);
                      if (e.target) e.target.value = '';
                    }}
                  />
                  <span className="ref-slot-btn"><Icon.Plus style={{ width: 16, height: 16 }} /></span>
                </label>
              )}
            </div>

            <div className="row-between">
              <div className="field-label" style={{ margin: 0 }}>Crudo</div>
              <Toggle checked={d.crudo} onChange={(v) => onChange({ crudo: v })} accent={accent} />
            </div>

            <div>
              <div className="field-label">Semilla</div>
              <button className="seed-btn" onClick={() => onChange({ seed: Math.floor(Math.random() * 1e9) })}>
                <Icon.Dice style={{ width: 12, height: 12 }} />
                {d.seed ? <span className="mono">{d.seed}</span> : "Aleatorio"}
              </button>
            </div>

            <div>
              <div className="field-label">Relación de aspecto</div>
              <div className="select-box">
                <select
                  className="native-select mono"
                  value={d.aspect}
                  onChange={(e) => onChange({ aspect: e.target.value })}
                >
                  {ASPECTS_IMG.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <Icon.Chevron style={{ width: 12, height: 12 }} />
              </div>
            </div>

            <div className="row-between">
              <div className="field-label" style={{ margin: 0 }}>Cantidad</div>
              <Counter value={d.cantidad} onChange={(v) => onChange({ cantidad: v })} />
            </div>
          </>
        )}

        <button
          className="btn-generate"
          style={{ "--btn-c": accent }}
          disabled={d.status === "running"}
          onClick={onGenerate}
        >
          {d.status === "running" ? "Generando…" : (<><Icon.Play style={{ width: 11, height: 11 }} />Generar imagen</>)}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIDEO NODE
// ---------------------------------------------------------------------------
function VideoNode({ node, onChange, onMouseDownHeader, onClose, selected, onGenerate, hasIncomingPrompt, incomingPrompt, incomingMedia, incomingRefImages }) {
  const accent = "#10B981";
  const d = node.data;
  const [tab, setTab] = React.useState("directo"); // 'directo' | 'config'
  const [urlDraft, setUrlDraft] = React.useState("https://example.com/image.jpg");

  return (
    <div className={"node-v2 video-node " + (selected ? "is-selected" : "")} data-accent="green">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon"><Icon.VideoGlyph style={{ width: 22, height: 22 }} /></div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Video</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status} /> <span>{d.status === "running" ? "Renderizando" : "Listo"}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <HeaderModelPill
            value={d.modelId}
            options={KID_VIDEO_MODELS}
            onChange={(v) => onChange({ modelId: v })}
            accent={accent}
          />
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      <div className="node-v2-body">
        {incomingPrompt ? (
          <div className="incoming-prompt-preview" style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: 6, marginBottom: 8, borderRadius: 8,
            background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.08)" : "rgba(167,139,250,0.08)",
            border: "1px solid " + (incomingPrompt.status === "error" ? "rgba(251,113,133,0.35)" : "rgba(167,139,250,0.25)"),
            boxShadow: incomingPrompt.status === "running" ? "0 0 0 0 rgba(167,139,250,0.4)" : "none",
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 6, flexShrink: 0,
              background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.15)" : "rgba(167,139,250,0.15)",
              display: "grid", placeItems: "center",
              fontSize: 11, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", fontFamily: "var(--font-mono)",
            }}>
              {incomingPrompt.agentName ? incomingPrompt.agentName.slice(0,2).toUpperCase() : "··"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span className="mono" style={{ fontSize: 10, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>
                prompt upstream {incomingPrompt.agentName ? "· " + incomingPrompt.agentName : "· sin agente"}
                {incomingPrompt.status === "running" && " · ejecutando…"}
                {incomingPrompt.status === "error" && " · error"}
                {incomingPrompt.hasRefined && " · refinado ✓"}
              </span>
              <span style={{
                fontSize: 11, color: "var(--text-3)",
                overflow: "hidden", textOverflow: "ellipsis",
                whiteSpace: "nowrap", maxWidth: "100%",
              }} title={incomingPrompt.refined || incomingPrompt.brief || "(brief vacío)"}>
                {incomingPrompt.hasRefined
                  ? (incomingPrompt.refined.slice(0, 60) + (incomingPrompt.refined.length > 60 ? "…" : ""))
                  : incomingPrompt.brief
                    ? ("brief: " + incomingPrompt.brief.slice(0, 50) + (incomingPrompt.brief.length > 50 ? "…" : ""))
                    : "(esperando ejecución)"
                }
              </span>
            </div>
          </div>
        ) : null}
        {incomingMedia?.url ? (
          <div className="incoming-ref-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
            {incomingMedia.kind === "video" ? (
              <video src={incomingMedia.url} muted style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <img src={incomingMedia.url} alt="ref" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            )}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#34D399", letterSpacing: 0.5, textTransform: "uppercase" }}>{incomingMedia.isStoryboard ? "referencia · storyboard" : ("referencia · " + incomingMedia.kind)}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{incomingMedia.isStoryboard ? "SHAQ recorrerá todas las escenas en un vídeo" : "guía visual de referencia para el vídeo"}</span>
            </div>
          </div>
        ) : incomingMedia?.pending ? (
          <div className="incoming-ref-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px dashed rgba(251,191,36,0.45)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(251,191,36,0.15)", display: "grid", placeItems: "center", fontSize: 16, color: "#FBBF24", flexShrink: 0 }}>⤳</div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#FBBF24", letterSpacing: 0.5, textTransform: "uppercase" }}>first_frame · {incomingMedia.kind} pendiente</span>
              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>Ejecuta el nodo upstream primero</span>
            </div>
          </div>
        ) : null}

        {/* Strip referencias del nodo ImageRef conectado */}
        {incomingRefImages?.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 8px", marginBottom:8, borderRadius:8, background:"rgba(249,115,22,0.07)", border:"1px solid rgba(249,115,22,0.25)" }}>
            <span className="mono" style={{ fontSize:9, color:"#FB923C", letterSpacing:"0.1em", textTransform:"uppercase", flexShrink:0 }}>🖼 ref</span>
            <div style={{ display:"flex", gap:4, flex:1 }}>
              {incomingRefImages.slice(0,6).map((url, i) => (
                <img key={i} src={url} alt="" style={{ width:26, height:26, borderRadius:4, objectFit:"cover", flexShrink:0, border:"1px solid rgba(249,115,22,0.3)" }}
                  onError={(e)=>{ if(window.__proxied && !e.currentTarget.dataset.p){ e.currentTarget.dataset.p="1"; e.currentTarget.src=window.__proxied(url); } }} />
              ))}
              {incomingRefImages.length > 6 && <span style={{ fontSize:9.5, color:"#FB923C", alignSelf:"center" }}>+{incomingRefImages.length-6}</span>}
            </div>
            <span className="mono" style={{ fontSize:9, color:"var(--text-3)", flexShrink:0 }}>{incomingRefImages.length} activa{incomingRefImages.length>1?"s":""}</span>
          </div>
        )}

        <div className="field-row" style={{ alignItems: "center", marginBottom: 6 }}>
          <div className="field-label" style={{ margin: 0 }}>Prompt</div>
          <div className="mini-tabs">
            <button className={"mini-tab " + (tab === "directo" ? "is-active accent-green" : "")} onClick={() => setTab("directo")}>+ Directo</button>
            <button
              className={"mini-tab " + (tab === "config" ? "is-active accent-green" : "")}
              onClick={() => setTab(tab === "config" ? "directo" : "config")}
            >
              {tab === "config" ? "▴ Ocultar" : "▾ Config"}
            </button>
          </div>
        </div>
        <textarea
          className="node-input"
          rows={2}
          value={d.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={hasIncomingPrompt ? "(usando brief del Prompt Node)" : "Escribe el prompt..."}
          disabled={hasIncomingPrompt}
        />

        {tab === "config" && (
          <>
            <Divider label="configuración" />
            <div className="config-grid">
              <div>
                <div className="field-label">Resolución</div>
                <Seg value={d.resolution}  onChange={(v) => onChange({ resolution: v })}  options={VIDEO_RES}     accent={accent} />
              </div>
              <div>
                <div className="field-label">Proporción</div>
                <Seg value={d.aspect}      onChange={(v) => onChange({ aspect: v })}      options={VIDEO_ASPECTS} accent={accent} />
              </div>
            </div>
            <div>
              <div className="field-label">Duración</div>
              <Seg value={d.duration} onChange={(v) => onChange({ duration: v })} options={VIDEO_DURS} accent={accent} />
            </div>

            <Divider label="imágenes de referencia" />
            <div className="field-row" style={{ alignItems: "center", marginBottom: 4 }}>
              <div className="field-label" style={{ margin: 0 }}>Referencias visuales</div>
              <span className="counter-chip mono">{(d.keyframes || []).length}/3</span>
            </div>
            <div className="ref-slot-row">
              {(d.keyframes || []).map((url, i) => (
                <div key={i} className="ref-slot ref-slot-sm" style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                  <button
                    className="ref-slot-remove"
                    onClick={() => onChange({ keyframes: d.keyframes.filter((_, j) => j !== i) })}
                  >✕</button>
                </div>
              ))}
              {(d.keyframes || []).length < 3 && (
                <label className="ref-slot ref-slot-sm">
                  <input
                    type="file" accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = () => onChange({ keyframes: [...(d.keyframes || []), reader.result] });
                      reader.readAsDataURL(file);
                    }}
                  />
                  <span className="ref-slot-btn"><Icon.Plus style={{ width: 16, height: 16 }} /></span>
                </label>
              )}
            </div>

            <Divider label="vídeos de referencia" />
            <div className="field-row" style={{ marginBottom: 4 }}>
              <div className="field-label" style={{ margin: 0 }}>Vídeos</div>
              <span className="counter-chip mono">{(d.refVideos || []).length}/2</span>
            </div>
            <div className="ref-slot ref-slot-sm" title="Próximamente — Seedance aún no admite vídeo de referencia" style={{ opacity: 0.4, cursor: "not-allowed" }}>
              <button className="ref-slot-btn" disabled style={{ cursor: "not-allowed" }}><Icon.Plus style={{ width: 16, height: 16 }} /></button>
            </div>

            <Divider label="audio de referencia" />
            <div className="field-row" style={{ marginBottom: 4 }}>
              <div className="field-label" style={{ margin: 0 }}>Audio</div>
              <span className="counter-chip mono">{(d.refAudio || []).length}/2</span>
            </div>
            <div className="ref-slot ref-slot-sm" title="Próximamente — audio de referencia no disponible aún" style={{ opacity: 0.4, cursor: "not-allowed" }}>
              <button className="ref-slot-btn" disabled style={{ cursor: "not-allowed" }}><Icon.Plus style={{ width: 16, height: 16 }} /></button>
            </div>

            <Divider label="opciones" />
            <div className="options-list">
              {[
                { k: "syncAudio",   label: "Audio sincronizado", icon: "🔊" },
                { k: "lastFrame",   label: "Retomar último fotograma", icon: "↺" },
                { k: "webSearch",   label: "Búsqueda en línea", icon: "○" },
                { k: "verifyContent", label: "Verificar contenido", icon: "✓" },
              ].map((opt) => (
                <button
                  key={opt.k}
                  className={"option-row " + (d.opts?.[opt.k] ? "is-on" : "")}
                  onClick={() => onChange({ opts: { ...(d.opts || {}), [opt.k]: !d.opts?.[opt.k] } })}
                >
                  <span className="opt-check">{d.opts?.[opt.k] ? "✓" : ""}</span>
                  <span className="opt-icon">{opt.icon}</span>
                  <span className="opt-label">{opt.label}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <div className="row-between" style={{ marginTop: 4 }}>
          <div className="field-label" style={{ margin: 0 }}>Cantidad</div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <span className="mono" style={{ fontSize: 10, color: "var(--text-4)" }}>×</span>
            <Counter value={d.cantidad} onChange={(v) => onChange({ cantidad: v })} />
          </div>
        </div>

        <button
          className="btn-generate"
          style={{ "--btn-c": accent }}
          disabled={d.status === "running"}
          onClick={onGenerate}
        >
          {d.status === "running" ? "Renderizando…" : (<><Icon.Play style={{ width: 11, height: 11 }} />Generar</>)}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SHADER LOADER — loader del OutputNode con shader GLSL en Three.js RAW (WebGL)
// ---------------------------------------------------------------------------
// Shader fluido de color extraído del bundle de 21st.dev (designali-in/
// shader-animation). Un quad fullscreen sobre cámara ortográfica pinta capas
// de líneas radiales concéntricas por canal RGB que fluyen hacia afuera con el
// tiempo → efecto tipo aurora / ondas de luz. Uniforms: `resolution` (vec2) y
// `time` (float). SIN TEXTO EN EL MEDIO: el shader llena el nodo limpio.
//
// Three.js RAW (sin r3f, sin bundler): THREE global cargado por Canvas
// Prototype.html (three@0.160.0 UMD) antes de los .jsx. Un solo
// WebGLRenderer por instancia. DPR cap 2. 60fps. ResizeObserver al contenedor.
// prefers-reduced-motion → 1 frame estático (sin rAF). Cleanup completo: cancela
// rAF, dispose() del renderer + geometría + material (sin leaks WebGL).
// Si THREE no existe → degrada a un fondo CSS animado (no rompe).
// ---------------------------------------------------------------------------

const SHADER_MAX_DPR = 2;

// Vertex: quad fullscreen en clip-space, sin transformaciones (cámara orto 2×2).
const SHADER_LOADER_VERT = `
void main() {
  gl_Position = vec4( position, 1.0 );
}
`;

// Fragment: efecto de color/ondas fluidas tal cual el bundle 21st.dev.
// Por cada canal RGB se acumulan 5 líneas radiales cuya distancia al centro
// deriva con `time` → ondas de luz que respiran. `resolution` normaliza el
// aspect ratio para que el efecto no se deforme con el tamaño del nodo.
const SHADER_LOADER_FRAG = `
#define TWO_PI 6.2831853072
#define PI 3.14159265359

precision highp float;
uniform vec2 resolution;
uniform float time;

void main(void) {
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  float t = time * 0.14;
  float lineWidth = 0.0038;

  vec3 color = vec3(0.0);
  for (int j = 0; j < 3; j++) {
    for (int i = 0; i < 5; i++) {
      color[j] += lineWidth * float(i * i) / abs(fract(t - 0.01 * float(j) + float(i) * 0.01) * 5.0 - length(uv) + mod(uv.x + uv.y, 0.2));
    }
  }

  gl_FragColor = vec4(color[0] + 0.018, color[1] + 0.010, color[2] + 0.035, 1.0);
}
`;

function ShaderLoader({ className, style }) {
  const hostRef = React.useRef(null);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    // Fallback duro: si THREE no está disponible, no rompemos — marcamos el host
    // con .shader-loader-fallback (fondo CSS animado) y salimos limpio.
    if (typeof THREE === "undefined" || !THREE || !THREE.WebGLRenderer) {
      host.classList.add("shader-loader-fallback");
      return;
    }

    const reduceMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let renderer = null;
    let geometry = null;
    let material = null;
    let scene = null;
    let camera = null;
    let rafId = 0;
    let running = true;
    let startTime = 0;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, SHADER_MAX_DPR));

      scene = new THREE.Scene();
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

      geometry = new THREE.PlaneGeometry(2, 2);
      material = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
          resolution: { value: new THREE.Vector2(1, 1) },
        },
        vertexShader: SHADER_LOADER_VERT,
        fragmentShader: SHADER_LOADER_FRAG,
        depthWrite: false,
        depthTest: false,
      });

      const quad = new THREE.Mesh(geometry, material);
      scene.add(quad);

      const canvas = renderer.domElement;
      canvas.setAttribute("aria-hidden", "true");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      host.appendChild(canvas);
    } catch (err) {
      // Contexto WebGL no disponible (GPU bloqueada, etc.) → fallback CSS.
      if (renderer) { try { renderer.dispose(); } catch (e) {} }
      host.classList.add("shader-loader-fallback");
      return;
    }

    // Ajusta el renderer + uniform de resolución al tamaño real del contenedor.
    function resize() {
      const rect = host.getBoundingClientRect();
      const cssW = Math.max(1, rect.width);
      const cssH = Math.max(1, rect.height);
      renderer.setSize(cssW, cssH, false);
      const dpr = renderer.getPixelRatio();
      material.uniforms.resolution.value.set(cssW * dpr, cssH * dpr);
    }

    function renderAt(seconds) {
      material.uniforms.time.value = seconds;
      renderer.render(scene, camera);
    }

    function loop(now) {
      if (!running) return;
      if (!startTime) startTime = now;
      renderAt((now - startTime) / 1000);
      rafId = window.requestAnimationFrame(loop);
    }

    resize();

    if (reduceMotion) {
      // Sin rAF: un único frame estático a un instante agradable del efecto.
      renderAt(8.0);
    } else {
      rafId = window.requestAnimationFrame(loop);
    }

    let ro = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        resize();
        if (reduceMotion) renderAt(8.0);
      });
      ro.observe(host);
    }

    // Cleanup: cancela rAF, libera recursos WebGL y quita el canvas (sin leaks).
    return () => {
      running = false;
      if (rafId) window.cancelAnimationFrame(rafId);
      if (ro) ro.disconnect();
      if (geometry) geometry.dispose();
      if (material) material.dispose();
      if (renderer) {
        const dom = renderer.domElement;
        if (dom && dom.parentNode) dom.parentNode.removeChild(dom);
        renderer.dispose();
        if (renderer.forceContextLoss) {
          try { renderer.forceContextLoss(); } catch (e) {}
        }
      }
    };
  }, []);

  return (
    <div
      ref={hostRef}
      className={"shader-loader-host" + (className ? " " + className : "")}
      style={style}
      aria-hidden="true"
    />
  );
}

// ---------------------------------------------------------------------------
// OUTPUT NODE — recibe resultados de Imagen/Video, muestra grid
// ---------------------------------------------------------------------------
function OutputNode({ node, onChange, onMouseDownHeader, onClose, selected, onItemAction }) {
  const accent = "#34D399";
  const d = node.data;
  const items = d.items || [];
  const kind = d.kind || "image";   // 'image' | 'video'
  const pending = (d.status === "running") ? Math.max(0, (d.pending != null ? d.pending : (items.length === 0 ? 1 : 0))) : 0;
  const totalCells = items.length + pending;
  const cols = totalCells <= 1 ? 1 : totalCells <= 4 ? 2 : 3;
  // Doble confirmación de borrado por celda: 1er clic arma (rojo), 2º clic borra de verdad.
  const [armedDel, setArmedDel] = React.useState(null);
  const _armTimer = React.useRef(null);
  const askCellDelete = (it) => {
    if (armedDel === it.id) {
      clearTimeout(_armTimer.current);
      setArmedDel(null);
      onItemAction?.("delete", node.id, it);
    } else {
      setArmedDel(it.id);
      clearTimeout(_armTimer.current);
      _armTimer.current = setTimeout(() => setArmedDel(null), 3000);
    }
  };

  return (
    <div className={"node-v2 output-node " + (selected ? "is-selected" : "")} data-accent="green">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon">
            {kind === "video"
              ? <Icon.VideoGlyph style={{ width: 22, height: 22 }} />
              : <Icon.ImageGlyph style={{ width: 22, height: 22 }} />}
          </div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Resultados</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status || "done"} />
              <span>{items.length} {kind === "video" ? (items.length === 1 ? "video" : "videos") : (items.length === 1 ? "imagen" : "imágenes")}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          {d.modelId && (
            <span className="model-pill" style={{ pointerEvents: "none" }}>
              <span className="mono model-pill-label">{d.modelId}</span>
            </span>
          )}
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      <div className="node-v2-body">
        {totalCells === 0 && d.status === "error" ? (
          <div className="output-empty mono" style={{ color: "#FB7185", lineHeight: 1.5, padding: "10px 12px", textAlign: "left" }}>
            ✖ Generación falló
            {d.error ? <div style={{ marginTop: 6, fontSize: 10, opacity: 0.85, color: "#EBEAE4" }}>{String(d.error).slice(0, 180)}</div> : null}
            <div style={{ marginTop: 6, fontSize: 10, opacity: 0.7 }}>{/copyright|restricc/i.test(String(d.error||"")) ? "El vídeo resultante reproduce un personaje/marca con copyright. Seedance rechaza el OUTPUT — reintentar gastará crédito y volverá a fallar. Usa personajes originales (no IP reconocible)." : (/load failed|first.frame/i.test(String(d.error||"")) ? "Si usas first-frame, no añadas además imágenes de referencia." : "Reintenta el nodo.")}</div>
          </div>
        ) : totalCells === 0 ? (
          <div className="output-empty mono">esperando contenido…</div>
        ) : (
          <div className={"output-grid output-grid-cols-" + cols} style={totalCells > 3 ? { maxHeight: 320, overflowY: 'auto', scrollbarWidth: 'thin' } : undefined}>
            {items.map((it, i) => {
              const isActive = d.lastUrl === it.url;
              return (
              <div key={it.id}
                className={"output-cell" + (isActive ? " output-cell-active" : "")}
                style={{ position: "relative" }}
              >
                {/* Botón top-right: selecciona/deselecciona este ítem como salida activa */}
                <button
                  title={isActive ? "Activa — click para deseleccionar" : "Click para usar como referencia de salida"}
                  onClick={() => onChange({ lastUrl: isActive ? null : it.url })}
                  style={{
                    position: "absolute", top: 4, right: 4, zIndex: 10,
                    width: 20, height: 20, borderRadius: "50%",
                    background: isActive ? "#10B981" : "rgba(0,0,0,0.45)",
                    border: isActive ? "2px solid #10B981" : "1.5px solid rgba(255,255,255,0.3)",
                    cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: isActive ? 10 : 9, color: "#fff",
                    boxShadow: isActive ? "0 0 8px rgba(16,185,129,0.8)" : "none",
                    transition: "all .15s",
                  }}
                >
                  {isActive ? "✓" : "⬡"}
                </button>
                {kind === "video" && (
                  <div className="output-video-tag mono">
                    <Icon.Play style={{ width: 9, height: 9 }} />
                    {it.duration || "5s"}
                  </div>
                )}
                {kind === "video" ? (
                  <video
                    key={it.url}
                    src={it.url}
                    className="output-cell-img"
                    style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000", cursor: "pointer" }}
                    muted loop playsInline preload="auto"
                    onLoadedData={(e) => { e.currentTarget.play && e.currentTarget.play().catch(()=>{}); }}
                    onError={(e) => {
                      const v = e.currentTarget;
                      if (!v.dataset.proxied && window.__proxied) {
                        v.dataset.proxied = "1";
                        v.src = window.__proxied(it.url);
                      }
                    }}
                  />
                ) : (
                  <SmartImg
                    key={it.url}
                    url={it.url}
                    className="output-cell-img"
                    style={{ position:"absolute", inset:0, width:"100%", height:"100%" }}
                  />
                )}
                <div className="output-cell-actions">
                  <button
                    title="Previsualizar"
                    className="output-cell-btn"
                    onClick={() => onItemAction?.("preview", node.id, it)}
                  ><Icon.Eye style={{ width: 13, height: 13 }} /></button>
                  <button
                    title="Descargar"
                    className="output-cell-btn"
                    onClick={() => onItemAction?.("download", node.id, it)}
                  ><Icon.Download style={{ width: 13, height: 13 }} /></button>
                  <button
                    title={armedDel === it.id ? "Confirmar borrado definitivo" : "Eliminar (pide confirmación)"}
                    className="output-cell-btn output-cell-btn-danger"
                    onClick={() => askCellDelete(it)}
                    style={armedDel === it.id ? { background: "#EF4444", color: "#fff", width: "auto", padding: "0 8px", fontSize: 10, fontWeight: 700, boxShadow: "0 0 10px rgba(239,68,68,0.6)" } : undefined}
                  >{armedDel === it.id ? "¿Borrar?" : <Icon.Trash style={{ width: 13, height: 13 }} />}</button>
                </div>
                <div className="output-cell-index mono">{String(i + 1).padStart(2, "0")}</div>
              </div>
              );
            })}
            {Array.from({ length: pending }).map((_, pi) => (
              <div key={"ph-" + pi} className="output-cell" style={{ position: "relative", minHeight: 120, borderRadius: 10, overflow: "hidden", background: "#0c0c14" }}>
                <ShaderLoader className="shader-loader-bg" style={{ position: "absolute", inset: 0 }} />
                <div className="output-cell-index mono" style={{ zIndex: 2 }}>{String(items.length + pi + 1).padStart(2, "0")}</div>
                <div className="shader-loader-status mono" style={{ position: "absolute", left: 0, right: 0, bottom: 6, textAlign: "center", fontSize: 9, zIndex: 2 }}>
                  {kind === "video" ? "renderizando…" : "generando…"}
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="output-foot">
            <span className="mono output-foot-meta">
              <span className="dot" style={{ background: "#10B981", boxShadow: "0 0 6px #10B981" }} />
              guardado en galería
            </span>
            <button className="btn-soft" onClick={() => onItemAction?.("openGallery", node.id)}>
              Ver galería →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
function NoteNode({ node, onChange, onMouseDownHeader, onClose, selected }) {
  const d = node.data;
  const NOTE_COLORS = [
    { id: "amber", dot: "#F59E0B", border: "rgba(245,158,11,0.35)",  accent: "#FBBF24" },
    { id: "blue",  dot: "#3B82F6", border: "rgba(59,130,246,0.35)",  accent: "#93C5FD" },
    { id: "green", dot: "#10B981", border: "rgba(16,185,129,0.35)",  accent: "#6EE7B7" },
    { id: "pink",  dot: "#EC4899", border: "rgba(236,72,153,0.35)",  accent: "#F9A8D4" },
  ];
  const col = NOTE_COLORS.find(c => c.id === (d.color || "amber")) || NOTE_COLORS[0];
  return (
    <div className={"node-v2 note-node " + (selected ? "is-selected" : "")}
         style={{ borderColor: col.border }}
         data-accent="amber">
      <NodeHandle nodeId={node.id} side="left"  accent={col.dot} />
      <NodeHandle nodeId={node.id} side="right" accent={col.dot} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background: "transparent" }}>
            <Icon.NoteGlyph style={{ width: 20, height: 20, color: col.accent }} />
          </div>
          <div className="node-v2-titlestack">
            <input
              className="note-title"
              value={d.title}
              onChange={(e) => onChange({ title: e.target.value })}
              placeholder="Nota"
              style={{ fontWeight: 700, fontSize: 13, color: col.accent }}
            />
            <div className="node-v2-substatus" style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {NOTE_COLORS.map(c => (
                <button
                  key={c.id}
                  title={c.id}
                  onClick={(e) => { e.stopPropagation(); onChange({ color: c.id }); }}
                  style={{
                    width: 9, height: 9, borderRadius: '50%',
                    background: c.dot, border: 'none', cursor: 'pointer', padding: 0,
                    outline: (d.color || 'amber') === c.id ? '2px solid ' + c.dot : 'none',
                    outlineOffset: 2, flexShrink: 0,
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
          <Icon.Close style={{ width: 11, height: 11 }} />
        </button>
      </div>
      <div className="node-v2-body">
        <textarea
          className="note-text"
          rows={5}
          value={d.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="Escribe tu nota aquí…"
          style={{ resize: 'vertical', borderColor: col.border }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VOICE NODE — narración / voz en off sincronizada con video
// ---------------------------------------------------------------------------
function VoiceNode({ node, onChange, onMouseDownHeader, onClose, selected, incomingPrompt }) {
  const accent = "#F59E0B";
  const d = node.data;
  const [copied, setCopied] = React.useState(false);

  const narrationText = (d.script || "").trim();
  const hasScript = narrationText.length > 0;

  // Genera el "narration_prompt" — texto estructurado que el VideoNode usará como voice_prompt
  const handleGenerate = () => {
    if (!hasScript) return;
    const voicePrompt = [
      "VOICE OVER NARRATION:",
      narrationText,
      d.tone ? `\nTone: ${d.tone}` : "",
      d.language ? `Language: ${d.language}` : "",
    ].filter(Boolean).join("\n");

    onChange({ voicePrompt, status: "done" });
    window.__notify?.({
      kind: "success",
      icon: "🎙",
      title: "Narración lista",
      body: "El prompt de voz se pasará al VideoNode conectado.",
    });
  };

  const handleCopy = () => {
    if (!d.voicePrompt) return;
    navigator.clipboard?.writeText(d.voicePrompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };

  const TONES = ["neutral", "cálido", "dramático", "enérgico", "íntimo", "informativo"];
  const LANGS = ["Español", "English", "Português", "Français", "Italiano"];

  return (
    <div className={"node-v2 voice-node " + (selected ? "is-selected" : "")} data-accent="amber">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />

      {/* Header */}
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background: "transparent" }}>
            <Icon.MicGlyph style={{ width: 22, height: 22 }} />
          </div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Voz / Narración</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status || "idle"} />
              <span>{d.status === "done" ? "Prompt listo" : "Guión de voz"}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <span
            className="mono"
            style={{
              fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              padding: "2px 7px", borderRadius: 10,
              background: "rgba(245,158,11,0.14)",
              color: "#FCD34D",
              border: "1px solid rgba(245,158,11,0.35)",
            }}
          >
            narración
          </span>
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="node-v2-body">

        {/* Upstream prompt badge */}
        {incomingPrompt && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: 6, marginBottom: 8, borderRadius: 8,
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.25)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 6, flexShrink: 0,
              background: "rgba(245,158,11,0.15)",
              display: "grid", placeItems: "center",
              fontSize: 11, color: "#FCD34D", fontFamily: "var(--font-mono)",
            }}>
              {incomingPrompt.agentName ? incomingPrompt.agentName.slice(0, 2).toUpperCase() : "··"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span className="mono" style={{ fontSize: 10, color: "#FCD34D", letterSpacing: 0.5, textTransform: "uppercase" }}>
                brief upstream{incomingPrompt.agentName ? " · " + incomingPrompt.agentName : ""}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {incomingPrompt.refined || incomingPrompt.brief || "(sin brief)"}
              </span>
            </div>
          </div>
        )}

        {/* Script textarea */}
        <div className="field-label">Guión de narración</div>
        <textarea
          className="node-input"
          rows={5}
          value={d.script || ""}
          onChange={(e) => onChange({ script: e.target.value, status: "idle", voicePrompt: null })}
          placeholder={"Escribe el texto que se leerá en voz en off.\nEj: Descubre el sabor que lo cambia todo. Una experiencia única, hecha para ti."}
          style={{ resize: "vertical", minHeight: 90 }}
        />

        {/* Tone + Language row */}
        <div className="field-row" style={{ gap: 8, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div className="field-label">Tono</div>
            <div className="select-box">
              <select
                className="native-select mono"
                value={d.tone || "neutral"}
                onChange={(e) => onChange({ tone: e.target.value, status: "idle", voicePrompt: null })}
              >
                {TONES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <Icon.Chevron style={{ width: 11, height: 11 }} />
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="field-label">Idioma</div>
            <div className="select-box">
              <select
                className="native-select mono"
                value={d.language || "Español"}
                onChange={(e) => onChange({ language: e.target.value, status: "idle", voicePrompt: null })}
              >
                {LANGS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              <Icon.Chevron style={{ width: 11, height: 11 }} />
            </div>
          </div>
        </div>

        {/* Voice prompt output preview */}
        {d.voicePrompt && (
          <div style={{
            marginTop: 10,
            padding: "8px 10px",
            borderRadius: 8,
            background: "rgba(245,158,11,0.07)",
            border: "1px solid rgba(245,158,11,0.30)",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 5,
            }}>
              <span className="mono" style={{ fontSize: 9.5, color: "#FCD34D", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                voice_prompt — pasa al VideoNode
              </span>
              <button
                onClick={handleCopy}
                style={{
                  background: "rgba(245,158,11,0.15)", border: "1px solid rgba(245,158,11,0.35)",
                  borderRadius: 6, padding: "1px 7px", cursor: "pointer",
                  fontSize: 9.5, color: "#FCD34D", fontFamily: "var(--font-mono)",
                  letterSpacing: "0.08em",
                }}
              >
                {copied ? "copiado ✓" : "copiar"}
              </button>
            </div>
            <div style={{
              fontSize: 11, color: "var(--text-2)", lineHeight: 1.55,
              maxHeight: 72, overflow: "hidden",
              display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
            }}>
              {d.voicePrompt}
            </div>
          </div>
        )}

        {/* Nota sobre TTS */}
        <div style={{
          marginTop: 8, padding: "6px 8px", borderRadius: 6,
          background: "rgba(245,158,11,0.05)",
          border: "1px dashed rgba(245,158,11,0.25)",
          display: "flex", alignItems: "flex-start", gap: 6,
        }}>
          <span style={{ fontSize: 13, lineHeight: 1, marginTop: 1, flexShrink: 0 }}>💡</span>
          <span className="mono" style={{ fontSize: 9.5, color: "var(--text-3)", lineHeight: 1.5 }}>
            TTS real — próximamente. Por ahora el texto se pasa como <em style={{ color: "#FCD34D" }}>voice_prompt</em> al VideoNode para que el modelo lo use como contexto de narración.
          </span>
        </div>

        {/* Actions */}
        <div className="node-v2-actions" style={{ marginTop: 10 }}>
          <button
            className="btn-soft"
            disabled={!hasScript}
            onClick={() => onChange({ script: "", voicePrompt: null, status: "idle" })}
            style={{ opacity: hasScript ? 1 : 0.4 }}
          >
            Limpiar
          </button>
          <button
            className={"btn-generate " + (!hasScript ? "is-disabled" : "")}
            style={{ "--btn-c": accent, flex: 1 }}
            disabled={!hasScript}
            onClick={handleGenerate}
          >
            <Icon.MicGlyph style={{ width: 11, height: 11 }} />
            {d.status === "done" ? "Actualizar prompt" : "Generar prompt de voz"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ReferenceNode — Personaje / Avatar con fotos de referencia
// Alimenta reference_image_urls a todos los nodos Image/Video downstream
// ---------------------------------------------------------------------------
function ReferenceNode({ node, onChange, onMouseDownHeader, onClose, selected }) {
  const accent = "#F59E0B";
  const d = node.data;
  const images = d.images || [];
  const [copied, setCopied] = React.useState(false);

  const addImage = (file) => {
    if (!file || images.length >= 9) return;
    const reader = new FileReader();
    reader.onload = () => onChange({ images: [...images, reader.result].slice(0, 9) });
    reader.readAsDataURL(file);
  };

  const removeImage = (i) => onChange({ images: images.filter((_, j) => j !== i) });

  const analyze = async () => {
    if (!images.length) return window.__notify?.({ kind: "warning", icon: "⚠", title: "Sin fotos", body: "Sube al menos una foto." });
    onChange({ status: "running" });
    try {
      const mbId = "ref-" + node.id;
      // Audit en background + polling (sets con personaje pueden tardar >60s).
      const manifest = await window.__auditWithPolling({
        moodboard_id: mbId,
        name: d.label || "Personaje",
        images: images.map((url, i) => ({ id: `r${i}`, url })),
      });
      const chars = manifest?.characters || [];
      const cp = chars[0]?.character_prompt || manifest?.master_style_prompt || "";
      onChange({ characterPrompt: cp, status: "done", manifest });
      window.__notify?.({ kind: "success", icon: "🎭", title: "Personaje analizado", body: chars.length ? `${chars.length} personaje(s) detectado(s)` : "Estilo extraído" });
    } catch (e) {
      onChange({ status: "idle" });
      window.__notify?.({ kind: "error", icon: "✕", title: "Error", body: e.message?.slice(0,80) });
    }
  };

  const copyPrompt = () => {
    if (!d.characterPrompt) return;
    navigator.clipboard?.writeText(d.characterPrompt).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800); });
  };

  return (
    <div className={"node-v2 reference-node " + (selected ? "is-selected" : "")} data-accent="amber">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background: "transparent", fontSize: 22 }}>🎭</div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Referencia · Personaje</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status || "idle"} />
              <span>{d.status === "running" ? "Analizando…" : `${images.length} foto${images.length !== 1 ? "s" : ""}`}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <span className="mono" style={{ fontSize:9, letterSpacing:"0.14em", textTransform:"uppercase", padding:"2px 7px", borderRadius:10, background:"rgba(245,158,11,0.14)", color:"#FCD34D", border:"1px solid rgba(245,158,11,0.35)" }}>referencia</span>
          <button className="node-v2-close" onClick={onClose}><Icon.Close style={{ width:11, height:11 }} /></button>
        </div>
      </div>
      <div className="node-v2-body">
        <div className="field-label">Fotos del personaje ({images.length}/9)</div>
        <div className="ref-slot-row">
          {images.map((url, i) => (
            <div key={i} className="ref-slot ref-slot-sm" style={{ backgroundImage:`url(${url})`, backgroundSize:"cover", backgroundPosition:"center" }}>
              <button className="ref-slot-remove" onClick={() => removeImage(i)}>✕</button>
            </div>
          ))}
          {images.length < 9 && (
            <label className="ref-slot ref-slot-sm">
              <input type="file" accept="image/*" style={{ display:"none" }}
                onChange={(e) => { addImage(e.target.files?.[0]); if(e.target) e.target.value=''; }} />
              <span className="ref-slot-btn"><Icon.Plus style={{ width:16, height:16 }} /></span>
            </label>
          )}
        </div>
        <button
          className="btn-generate"
          onClick={analyze}
          disabled={!images.length || d.status === "running"}
          style={{ marginTop:10, background: accent, color:"#000", opacity:(!images.length||d.status==="running")?0.5:1 }}
        >
          <Icon.Spark style={{ width:11, height:11 }} />
          {d.status === "running" ? "Analizando…" : "Identificar personaje"}
        </button>
        {d.characterPrompt && (
          <>
            <div className="field-label" style={{ marginTop:10 }}>Character Prompt · pasa al VideoNode</div>
            <div style={{ padding:8, borderRadius:6, background:"rgba(245,158,11,0.08)", border:"1px solid rgba(245,158,11,0.25)", fontSize:10, color:"var(--text-3)", wordBreak:"break-word", maxHeight:72, overflow:"auto" }}>
              {d.characterPrompt.slice(0,220)}{d.characterPrompt.length > 220 ? "…" : ""}
            </div>
            <button className="btn-soft" onClick={copyPrompt} style={{ marginTop:6, width:"100%", fontSize:11 }}>
              {copied ? "✓ Copiado" : "⎘ Copiar prompt"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageRefNode — nodo de referencia de imágenes puro
// Sube hasta 9 fotos, las pasa como reference_images a PromptNode (SHAQ) e ImageNode (KIE.ai).
// Sin análisis, sin IA — solo almacena y conecta.
// ---------------------------------------------------------------------------
function ImageRefNode({ node, onChange, onMouseDownHeader, onClose, selected }) {
  const accent = "#F97316";
  const d = node.data;
  const images = d.images || [];
  const fileRef = React.useRef(null);

  const addImages = async (files) => {
    const slots = 9 - images.length;
    if (slots <= 0) return;
    const arr = Array.from(files).slice(0, slots);
    const base = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "http://localhost:3003";

    // Marca estado de carga
    onChange({ uploading: true });

    const httpUrls = [];
    for (const file of arr) {
      // 1. Leer como base64
      const b64 = await new Promise((res) => {
        const fr = new FileReader();
        fr.onload = (ev) => res(ev.target.result);
        fr.readAsDataURL(file);
      });
      try {
        // 2. Subir a Supabase vía persist-media para obtener URL http permanente
        const resp = await fetch(base + "/generate/persist-media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: b64, kind: "image" }),
        });
        const data = await resp.json();
        if (data.url && data.persisted) {
          httpUrls.push(data.url);
        } else {
          // Fallback: guardar base64 si persist falla (aún puede usarse en vision)
          httpUrls.push(b64);
        }
      } catch (_) {
        httpUrls.push(b64); // Fallback local
      }
    }
    onChange({ images: [...images, ...httpUrls].slice(0, 9), uploading: false });
  };

  const uploading = !!d.uploading;
  const removeImg = (i) => onChange({ images: images.filter((_, j) => j !== i) });
  const onDrop = (e) => { e.preventDefault(); if (e.dataTransfer.files?.length) addImages(e.dataTransfer.files); };

  return (
    <div className={"node-v2 imageref-node" + (selected ? " is-selected" : "")}
      style={{ "--node-accent": accent }} onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
      <NodeHandle nodeId={node.id} side="left"  accent={accent} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} />

      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background:"transparent", fontSize:18 }}>🖼</div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Referencia · Imágenes</div>
            <div className="node-v2-substatus">
              <StatusDot status={uploading ? "running" : images.length > 0 ? "done" : "idle"} />
              <span className="mono">
                {uploading ? "subiendo…" : `${images.length}/9 foto${images.length !== 1 ? "s" : ""}`}
              </span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <span className="mono" style={{ fontSize:9, letterSpacing:"0.12em", textTransform:"uppercase", padding:"2px 7px", borderRadius:10, background:"rgba(249,115,22,0.14)", color:"#FB923C", border:"1px solid rgba(249,115,22,0.3)" }}>ref</span>
          <button className="node-v2-close" onClick={onClose}><Icon.Close style={{ width:11, height:11 }} /></button>
        </div>
      </div>

      <div className="node-v2-body" style={{ padding:"10px 12px 12px" }}>
        {/* Grid thumbnails */}
        {images.length > 0 && (
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:6, marginBottom:10 }}>
            {images.map((src, i) => (
              <div key={i} style={{ position:"relative", aspectRatio:"1", borderRadius:8, overflow:"hidden", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(249,115,22,0.18)" }}>
                <img src={src} alt="" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
                  onError={(e) => { const el=e.currentTarget; if(!el.dataset.p && window.__proxied){ el.dataset.p="1"; el.src=window.__proxied(src); } }} />
                {!uploading && (
                  <button onClick={() => removeImg(i)}
                    style={{ position:"absolute", top:3, right:3, width:16, height:16, borderRadius:"50%", background:"rgba(0,0,0,0.72)", border:"none", color:"#fff", fontSize:9, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
                )}
                {/* Indicador http = listo para KIE.ai */}
                {src.startsWith("http") && (
                  <span style={{ position:"absolute", bottom:3, left:3, width:6, height:6, borderRadius:"50%", background:"#10B981", boxShadow:"0 0 4px #10B981", display:"block" }} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Upload button */}
        {images.length < 9 && !uploading && (
          <button onClick={() => fileRef.current?.click()}
            style={{ width:"100%", padding:"11px 0", borderRadius:10, border:"1.5px dashed rgba(249,115,22,0.35)", background:"rgba(249,115,22,0.04)", color:"#FB923C", fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}
            onMouseEnter={(e)=>{ e.currentTarget.style.background="rgba(249,115,22,0.09)"; e.currentTarget.style.borderColor="rgba(249,115,22,0.6)"; }}
            onMouseLeave={(e)=>{ e.currentTarget.style.background="rgba(249,115,22,0.04)"; e.currentTarget.style.borderColor="rgba(249,115,22,0.35)"; }}>
            <span style={{ fontSize:16 }}>＋</span>
            <span className="mono" style={{ fontSize:11 }}>
              {images.length === 0 ? "subir fotos de referencia" : `añadir · ${9 - images.length} restantes`}
            </span>
          </button>
        )}
        {uploading && (
          <div style={{ textAlign:"center", padding:"10px 0", color:"#FB923C", fontSize:11 }} className="mono">
            ⟳ subiendo a Supabase…
          </div>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display:"none" }}
          onChange={(e) => { if (e.target.files?.length) addImages(e.target.files); e.target.value=""; }} />

        {images.length > 0 && !uploading && (
          <div className="mono" style={{ fontSize:9.5, opacity:0.4, marginTop:9, textAlign:"center", letterSpacing:"0.04em", lineHeight:1.5 }}>
            🟢 = listo · conecta a Prompt o Imagen para usarlas
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
Object.assign(window, {
  KID_IMAGE_MODELS,
  KID_VIDEO_MODELS,
  Icon,
  PromptNode,
  ImageNode,
  VideoNode,
  VoiceNode,
  NoteNode,
  ReferenceNode,
  ImageRefNode,
  OutputNode,
  StatusDot,
  ShaderLoader,
  AgentPicker,
});
