import React from 'react'

/* nodes.jsx — V2
 * 4 nodos del canvas: PromptNode, ImageNode, VideoNode, NoteNode, OutputNode
 * Handles disparan onHandleMouseDown/onHandleMouseUp como props — sin window.__handleMouseDown
 */

// ---------------------------------------------------------------------------
// Catálogo Kid.ai
// ---------------------------------------------------------------------------
const KID_IMAGE_MODELS = [
  { id: "gpt-imagenes-2", label: "GPT-2 IMAGE", hint: "alto detalle" },
];
const KID_VIDEO_MODELS = [
  { id: "seedance-2.0", label: "Seedance 2.0", hint: "vertical / social" },
];
const ASPECTS_IMG   = ["1:1", "16:9", "9:16", "4:5", "3:2"];
const VIDEO_RES     = ["480p", "720p", "1080p"];
const VIDEO_ASPECTS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
const VIDEO_DURS    = ["4s", "5s", "7s", "10s", "15s"];

// ---------------------------------------------------------------------------
// Iconos
// ---------------------------------------------------------------------------
const Icon = {
  ImageGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <defs>
        <linearGradient id="imgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7C3AED"/><stop offset="100%" stopColor="#3B82F6"/>
        </linearGradient>
      </defs>
      <rect x="3" y="4" width="18" height="16" rx="3" fill="url(#imgGrad)"/>
      <circle cx="9" cy="10" r="1.6" fill="#fff" opacity="0.95"/>
      <path d="M4.5 17.5l4.2-4.6 3.2 3 3.5-2.6 4.1 4.2v.5H4.5z" fill="#fff" opacity="0.85"/>
    </svg>
  ),
  VideoGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <defs>
        <linearGradient id="vidGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#10B981"/><stop offset="100%" stopColor="#059669"/>
        </linearGradient>
      </defs>
      <rect x="3" y="6" width="14" height="12" rx="2" fill="url(#vidGrad)"/>
      <path d="M17 10l4-2v8l-4-2z" fill="url(#vidGrad)"/>
    </svg>
  ),
  PromptGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <defs>
        <linearGradient id="prGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6366F1"/><stop offset="100%" stopColor="#8B5CF6"/>
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="18" height="18" rx="5" fill="url(#prGrad)"/>
      <path d="M12 7l1.5 3.5L17 12l-3.5 1.5L12 17l-1.5-3.5L7 12l3.5-1.5z" fill="#fff"/>
    </svg>
  ),
  NoteGlyph: (p) => (
    <svg viewBox="0 0 24 24" fill="none" {...p}>
      <rect x="4" y="3" width="16" height="18" rx="2" fill="#F59E0B" opacity="0.95"/>
      <path d="M7 8h10M7 12h10M7 16h6" stroke="#0A0A0A" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  ),
  Chevron:  (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><polyline points="6 9 12 15 18 9" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  Plus:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><line x1="12" y1="5" x2="12" y2="19" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round"/></svg>),
  Minus:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><line x1="5" y1="12" x2="19" y2="12" strokeLinecap="round"/></svg>),
  Play:     (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><polygon points="6 4 20 12 6 20 6 4"/></svg>),
  Close:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" {...p}><line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round"/><line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round"/></svg>),
  Spark:    (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 2l1.6 6.4L20 10l-6.4 1.6L12 18l-1.6-6.4L4 10l6.4-1.6z"/></svg>),
  Heart:    (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.5-7 10-7 10z"/></svg>),
  Dice:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.2" fill="currentColor"/><circle cx="16" cy="16" r="1.2" fill="currentColor"/><circle cx="16" cy="8" r="1.2" fill="currentColor"/><circle cx="8" cy="16" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/></svg>),
  Photo:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2"/><path d="M21 16l-5-5-9 9"/></svg>),
  Film:     (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>),
  Eye:      (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>),
  Trash:    (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>),
  Download: (p) => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>),
};

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

function NodeHandle({ nodeId, side, accent, onMouseDown, onMouseUp }) {
  return (
    <div
      className="nh"
      data-node-id={nodeId}
      data-side={side}
      style={{ "--handle-c": accent }}
      onMouseDown={(e) => onMouseDown && onMouseDown(e, nodeId, side)}
      onMouseUp={(e) => onMouseUp && onMouseUp(e, nodeId, side)}
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
      <button className="model-pill" style={{ "--pill-c": accent }}
        onClick={(e) => { e.stopPropagation(); setOpen((s) => !s); }}>
        <span className="model-pill-label mono">{current.label}</span>
        <Icon.Chevron style={{ width: 11, height: 11 }} />
      </button>
      {open && (
        <ul className="model-pill-menu" onMouseDown={(e) => e.stopPropagation()}>
          {options.map((o) => (
            <li key={o.id}>
              <button className={"model-pill-opt " + (o.id === value ? "is-active" : "")}
                onClick={() => { onChange(o.id); setOpen(false); }}>
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
        <button key={o} className={"seg-chip mono " + (value === o ? "is-active" : "")} onClick={() => onChange(o)}>{o}</button>
      ))}
    </div>
  );
}

function Toggle({ checked, onChange, accent = "#8B5CF6" }) {
  return (
    <button className={"toggle " + (checked ? "is-on" : "")} style={{ "--toggle-c": accent }}
      onClick={() => onChange(!checked)} type="button">
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
// AgentPicker
// ---------------------------------------------------------------------------
function AgentPicker({ agentId, onChange, creativeAgents = [] }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const agents = creativeAgents;
  const active = agents.find((a) => a.id === agentId) || agents[0];

  React.useEffect(() => {
    if (!open) return;
    const fn = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, [open]);

  return (
    <div className="agent-picker" ref={ref}>
      <button
        className={"agent-chip" + (open ? " is-open" : "")}
        onClick={() => setOpen((o) => !o)}
        type="button"
        style={{ "--agent-color": active?.accent || "#6366F1" }}
      >
        <span className="agent-chip-avatar" style={{ background: active?.accent || "#6366F1" }}>
          {active?.initials || "?"}
        </span>
        <span className="mono agent-chip-name">/{active?.name?.toLowerCase() || "agente"}</span>
        <svg viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ opacity: 0.6 }}>
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="agent-dropdown">
          <div className="agent-dropdown-label mono">agente creativo</div>
          {agents.length === 0 ? (
            <div className="agent-dropdown-empty mono">Sin agentes — créalos en el menú lateral</div>
          ) : (
            agents.map((a) => (
              <button key={a.id}
                className={"agent-option" + (a.id === (agentId || agents[0]?.id) ? " is-active" : "")}
                onClick={() => { onChange({ agentId: a.id }); setOpen(false); }}
                type="button"
                style={{ "--agent-color": a.accent }}
              >
                <span className="agent-option-avatar" style={{ background: a.accent }}>{a.initials}</span>
                <div className="agent-option-meta">
                  <div className="agent-option-name">/{a.name.toLowerCase()}</div>
                  <div className="agent-option-role mono">{a.role}</div>
                </div>
                {a.id === (agentId || agents[0]?.id) && <span className="agent-option-check">✓</span>}
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
function PromptNode({ node, onChange, onMouseDownHeader, onClose, selected, onGenerate, incomingMedia, activeClient, activeMoodboard, creativeAgents, onHandleMouseDown, onHandleMouseUp, notify }) {
  const accent = "#6366F1";
  const d = node.data;
  const agents = creativeAgents || [];
  const activeAgent = agents.find((a) => a.id === d.agentId) || null;
  const mbScore = activeMoodboard?.manifest?.consistency_score ?? activeMoodboard?.manifest?.consistencyScore;
  const mbReady = !!activeMoodboard?.manifest;
  const hasClient = !!activeClient;
  const hasAgent = !!activeAgent;
  const briefOk = (d.brief || '').trim().length > 0;

  return (
    <div className={"node-v2 prompt-node " + (selected ? "is-selected" : "")} data-accent="indigo">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background: "transparent" }}>
            <Icon.PromptGlyph style={{ width: 22, height: 22 }} />
          </div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Prompt Node</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status} /> <span>{d.status === "running" ? "Procesando" : "Listo"}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <AgentPicker agentId={d.agentId} onChange={onChange} creativeAgents={agents} />
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>
      <div className="node-v2-body">
        {incomingMedia?.url ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: 6, borderRadius: 6, background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}>
            {incomingMedia.kind === "video"
              ? <video src={incomingMedia.url} muted style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              : <img src={incomingMedia.url} alt="ref" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
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
              <span title="Sin cliente activo" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.12)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.35)' }}>
                ⚠ sin cliente
              </span>
            )}
            {activeMoodboard ? (
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: mbReady ? 'rgba(46,204,113,0.12)' : 'rgba(234,179,8,0.12)', color: mbReady ? '#86EFAC' : '#FDE68A', border: '1px solid ' + (mbReady ? 'rgba(46,204,113,0.3)' : 'rgba(234,179,8,0.35)') }}>
                🎨 {activeMoodboard.name}{mbReady && typeof mbScore === 'number' ? ' · ' + Math.round(mbScore * 100) + '%' : (mbReady ? '' : ' · sin manifest')}
              </span>
            ) : null}
            {!hasAgent && (
              <span title="Sin agente" style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: 'rgba(234,179,8,0.12)', color: '#FDE68A', border: '1px solid rgba(234,179,8,0.35)' }}>
                ⚠ sin agente
              </span>
            )}
          </div>
        </div>

        <textarea className="node-input" rows={3} value={d.brief}
          onChange={(e) => onChange({ brief: e.target.value })}
          placeholder={hasAgent
            ? "Brief simple. Ej: 'post para campaña Instagram lanzamiento producto'. El agente añadirá cliente + estilo moodboard."
            : "Describe qué quieres crear. Sin agente seleccionado, este texto va tal cual al modelo."}
        />

        {d.agentOutput && (
          <div className="agent-output-panel">
            <div className="agent-output-label"><span className="agent-output-dot">✦</span>Prompt refinado por el agente</div>
            <div className="agent-output-text">{d.agentOutput}</div>
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
              <button className={"tipo-btn " + (d.tipo === "image" ? "is-active accent-indigo" : "")} onClick={() => onChange({ tipo: "image" })}>
                <Icon.Photo style={{ width: 13, height: 13 }} /> Imagen
              </button>
              <button className={"tipo-btn " + (d.tipo === "video" ? "is-active accent-green" : "")} onClick={() => onChange({ tipo: "video" })}>
                <Icon.Film style={{ width: 13, height: 13 }} /> Video
              </button>
            </div>
          </div>
          <div>
            <div className="field-label">Cantidad</div>
            <Counter value={d.cantidad} onChange={(v) => onChange({ cantidad: v })} />
          </div>
        </div>

        <div className="node-v2-actions">
          <button className="btn-soft">Ver prompts</button>
          <button
            className={"btn-soft btn-primary-light " + (briefOk ? "" : "is-disabled")}
            onClick={() => {
              if (!briefOk) return;
              if (hasAgent && !hasClient) {
                notify?.({ kind: 'warning', icon: '⚠', title: 'Sin cliente activo', body: 'El agente generará un prompt genérico sin marca.' });
              } else if (!hasAgent) {
                notify?.({ kind: 'info', icon: 'ℹ', title: 'Sin agente', body: 'El brief se enviará crudo al modelo sin enriquecer.' });
              } else if (activeMoodboard && !mbReady) {
                notify?.({ kind: 'warning', icon: '🎨', title: 'Moodboard sin manifest', body: 'Sin manifest auditado, el estilo visual no se aplicará con precisión.' });
              }
              onGenerate?.();
            }}
          >
            <Icon.Play style={{ width: 10, height: 10 }} />
            Generar
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IMAGE NODE
// ---------------------------------------------------------------------------
function PersonaChip() {
  return (
    <span className="incoming-chip mono" style={{ color: "var(--text-3)" }}>
      <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:"#8B5CF6", marginRight:4, verticalAlign:"middle" }} />
      directo
    </span>
  );
}

function ImageNode({ node, onChange, onMouseDownHeader, onClose, selected, onGenerate, hasIncomingPrompt, incomingPrompt, incomingMedia, onHandleMouseDown, onHandleMouseUp }) {
  const accent = "#8B5CF6";
  const d = node.data;
  const [configOpen, setConfigOpen] = React.useState(false);

  return (
    <div className={"node-v2 image-node " + (selected ? "is-selected" : "")} data-accent="purple">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon"><Icon.ImageGlyph style={{ width: 22, height: 22 }} /></div>
          <div className="node-v2-titlestack">
            <div className="node-v2-title">Imagen</div>
            <div className="node-v2-substatus">
              <StatusDot status={d.status} /> <span>{d.status === "running" ? "Generando" : "Listo"}</span>
            </div>
          </div>
        </div>
        <div className="node-v2-right">
          <HeaderModelPill value={d.modelId} options={KID_IMAGE_MODELS} onChange={(v) => onChange({ modelId: v })} accent={accent} />
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      <div className="node-v2-body">
        {incomingPrompt ? (
          <div className="incoming-prompt-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.08)" : "rgba(167,139,250,0.08)", border: "1px solid " + (incomingPrompt.status === "error" ? "rgba(251,113,133,0.35)" : "rgba(167,139,250,0.25)") }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.15)" : "rgba(167,139,250,0.15)", display: "grid", placeItems: "center", fontSize: 11, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", fontFamily: "var(--font-mono)" }}>
              {incomingPrompt.agentName ? incomingPrompt.agentName.slice(0,2).toUpperCase() : "··"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span className="mono" style={{ fontSize: 10, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>
                prompt upstream {incomingPrompt.agentName ? "· " + incomingPrompt.agentName : "· sin agente"}
                {incomingPrompt.status === "running" && " · ejecutando…"}
                {incomingPrompt.status === "error" && " · error"}
                {incomingPrompt.hasRefined && " · refinado ✓"}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }} title={incomingPrompt.refined || incomingPrompt.brief || "(brief vacío)"}>
                {incomingPrompt.hasRefined
                  ? (incomingPrompt.refined.slice(0, 60) + (incomingPrompt.refined.length > 60 ? "…" : ""))
                  : incomingPrompt.brief
                    ? ("brief: " + incomingPrompt.brief.slice(0, 50) + (incomingPrompt.brief.length > 50 ? "…" : ""))
                    : "(esperando ejecución)"}
              </span>
            </div>
          </div>
        ) : null}
        {incomingMedia?.url ? (
          <div className="incoming-ref-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.25)" }}>
            <img src={incomingMedia.url} alt="ref" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>ref upstream · {incomingMedia.kind}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>se usará como reference_image</span>
            </div>
          </div>
        ) : null}

        <div className="field-row" style={{ alignItems: "center", marginBottom: 6 }}>
          <div className="field-label" style={{ margin: 0 }}>Prompt</div>
          {hasIncomingPrompt
            ? <span className="incoming-chip mono"><span className="led-dot" style={{ background: "#8B5CF6", boxShadow: "0 0 6px #8B5CF6" }} />hereda brief</span>
            : <PersonaChip />}
        </div>
        <textarea className="node-input" rows={3} value={d.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          placeholder={hasIncomingPrompt ? "(usando brief del Prompt Node)" : "Describe la imagen con detalle..."}
          disabled={hasIncomingPrompt}
        />

        <button className="collapsible" onClick={() => setConfigOpen((s) => !s)} style={{ borderTop: "1px solid var(--line-2)", paddingTop: 10, marginTop: 2 }}>
          <span className="collapsible-bullet">{configOpen ? "▾" : "▸"}</span>
          {configOpen ? "Ocultar configuración" : "Configuración avanzada"}
          <Icon.Chevron style={{ width: 11, height: 11, marginLeft: "auto", transform: configOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
        </button>

        {configOpen && (
          <>
            <div className="field-label">Imagen de referencia ({d.refImages?.length || 0}/1)</div>
            <div className="ref-slot-row">
              {(d.refImages || []).map((url, i) => (
                <div key={i} className="ref-slot ref-slot-sm" style={{ backgroundImage: `url(${url})`, backgroundSize: "cover", backgroundPosition: "center" }}>
                  <button className="ref-slot-remove" onClick={() => onChange({ refImages: (d.refImages || []).filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              {(d.refImages || []).length < 1 && (
                <label className="ref-slot ref-slot-sm">
                  <input type="file" accept="image/*" style={{ display: "none" }}
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
                <select className="native-select mono" value={d.aspect} onChange={(e) => onChange({ aspect: e.target.value })}>
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

        <button className="btn-generate" style={{ "--btn-c": accent }} disabled={d.status === "running"} onClick={onGenerate}>
          {d.status === "running" ? "Generando…" : (<><Icon.Play style={{ width: 11, height: 11 }} />Generar imagen</>)}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VIDEO NODE
// ---------------------------------------------------------------------------
function VideoNode({ node, onChange, onMouseDownHeader, onClose, selected, onGenerate, hasIncomingPrompt, incomingPrompt, incomingMedia, onHandleMouseDown, onHandleMouseUp }) {
  const accent = "#10B981";
  const d = node.data;
  const [tab, setTab] = React.useState("directo");

  return (
    <div className={"node-v2 video-node " + (selected ? "is-selected" : "")} data-accent="green">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
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
          <HeaderModelPill value={d.modelId} options={KID_VIDEO_MODELS} onChange={(v) => onChange({ modelId: v })} accent={accent} />
          <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
            <Icon.Close style={{ width: 11, height: 11 }} />
          </button>
        </div>
      </div>

      <div className="node-v2-body">
        {incomingPrompt ? (
          <div className="incoming-prompt-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.08)" : "rgba(167,139,250,0.08)", border: "1px solid " + (incomingPrompt.status === "error" ? "rgba(251,113,133,0.35)" : "rgba(167,139,250,0.25)") }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, flexShrink: 0, background: incomingPrompt.status === "error" ? "rgba(251,113,133,0.15)" : "rgba(167,139,250,0.15)", display: "grid", placeItems: "center", fontSize: 11, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", fontFamily: "var(--font-mono)" }}>
              {incomingPrompt.agentName ? incomingPrompt.agentName.slice(0,2).toUpperCase() : "··"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
              <span className="mono" style={{ fontSize: 10, color: incomingPrompt.status === "error" ? "#FB7185" : "#A78BFA", letterSpacing: 0.5, textTransform: "uppercase" }}>
                prompt upstream {incomingPrompt.agentName ? "· " + incomingPrompt.agentName : "· sin agente"}
                {incomingPrompt.status === "running" && " · ejecutando…"}
                {incomingPrompt.status === "error" && " · error"}
                {incomingPrompt.hasRefined && " · refinado ✓"}
              </span>
              <span style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }} title={incomingPrompt.refined || incomingPrompt.brief || "(brief vacío)"}>
                {incomingPrompt.hasRefined
                  ? (incomingPrompt.refined.slice(0, 60) + (incomingPrompt.refined.length > 60 ? "…" : ""))
                  : incomingPrompt.brief
                    ? ("brief: " + incomingPrompt.brief.slice(0, 50) + (incomingPrompt.brief.length > 50 ? "…" : ""))
                    : "(esperando ejecución)"}
              </span>
            </div>
          </div>
        ) : null}
        {incomingMedia?.url ? (
          <div className="incoming-ref-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)" }}>
            {incomingMedia.kind === "video"
              ? <video src={incomingMedia.url} muted style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
              : <img src={incomingMedia.url} alt="ref" style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#34D399", letterSpacing: 0.5, textTransform: "uppercase" }}>first_frame · {incomingMedia.kind}</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>se animará desde esta imagen</span>
            </div>
          </div>
        ) : incomingMedia?.pending ? (
          <div className="incoming-ref-preview" style={{ display: "flex", alignItems: "center", gap: 8, padding: 6, marginBottom: 8, borderRadius: 8, background: "rgba(251,191,36,0.08)", border: "1px dashed rgba(251,191,36,0.45)" }}>
            <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(251,191,36,0.15)", display: "grid", placeItems: "center", fontSize: 16, color: "#FBBF24", flexShrink: 0 }}>⤳</div>
            <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
              <span className="mono" style={{ fontSize: 10, color: "#FBBF24", letterSpacing: 0.5, textTransform: "uppercase" }}>first_frame · {incomingMedia.kind} pendiente</span>
              <span style={{ fontSize: 11, color: "var(--text-3)" }}>Ejecuta el nodo upstream primero</span>
            </div>
          </div>
        ) : null}

        <div className="field-row" style={{ alignItems: "center", marginBottom: 6 }}>
          <div className="field-label" style={{ margin: 0 }}>Prompt</div>
          <div className="mini-tabs">
            <button className={"mini-tab " + (tab === "directo" ? "is-active accent-green" : "")} onClick={() => setTab("directo")}>+ Directo</button>
            <button className={"mini-tab " + (tab === "config" ? "is-active accent-green" : "")} onClick={() => setTab(tab === "config" ? "directo" : "config")}>
              {tab === "config" ? "▴ Ocultar" : "▾ Config"}
            </button>
          </div>
        </div>
        <textarea className="node-input" rows={2} value={d.prompt}
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
                <Seg value={d.resolution} onChange={(v) => onChange({ resolution: v })} options={VIDEO_RES} accent={accent} />
              </div>
              <div>
                <div className="field-label">Proporción</div>
                <Seg value={d.aspect} onChange={(v) => onChange({ aspect: v })} options={VIDEO_ASPECTS} accent={accent} />
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
                  <button className="ref-slot-remove" onClick={() => onChange({ keyframes: d.keyframes.filter((_, j) => j !== i) })}>✕</button>
                </div>
              ))}
              {(d.keyframes || []).length < 3 && (
                <label className="ref-slot ref-slot-sm">
                  <input type="file" accept="image/*" style={{ display: "none" }}
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
            <div className="ref-slot ref-slot-sm">
              <button className="ref-slot-btn"><Icon.Plus style={{ width: 16, height: 16 }} /></button>
            </div>

            <Divider label="audio de referencia" />
            <div className="field-row" style={{ marginBottom: 4 }}>
              <div className="field-label" style={{ margin: 0 }}>Audio</div>
              <span className="counter-chip mono">{(d.refAudio || []).length}/2</span>
            </div>
            <div className="ref-slot ref-slot-sm">
              <button className="ref-slot-btn"><Icon.Plus style={{ width: 16, height: 16 }} /></button>
            </div>

            <Divider label="opciones" />
            <div className="options-list">
              {[
                { k: "syncAudio",     label: "Audio sincronizado",       icon: "🔊" },
                { k: "lastFrame",     label: "Retomar último fotograma", icon: "↺" },
                { k: "webSearch",     label: "Búsqueda en línea",        icon: "○" },
                { k: "verifyContent", label: "Verificar contenido",      icon: "✓" },
              ].map((opt) => (
                <button key={opt.k} className={"option-row " + (d.opts?.[opt.k] ? "is-on" : "")}
                  onClick={() => onChange({ opts: { ...(d.opts || {}), [opt.k]: !d.opts?.[opt.k] } })}>
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

        <button className="btn-generate" style={{ "--btn-c": accent }} disabled={d.status === "running"} onClick={onGenerate}>
          {d.status === "running" ? "Renderizando…" : (<><Icon.Play style={{ width: 11, height: 11 }} />Generar</>)}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// OUTPUT NODE
// ---------------------------------------------------------------------------
function OutputNode({ node, onChange, onMouseDownHeader, onClose, selected, onItemAction, onHandleMouseDown, onHandleMouseUp }) {
  const accent = "#34D399";
  const d = node.data;
  const items = d.items || [];
  const kind = d.kind || "image";
  const cols = items.length === 1 ? 1 : items.length <= 4 ? 2 : 3;

  return (
    <div className={"node-v2 output-node " + (selected ? "is-selected" : "")} data-accent="green">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon">
            {kind === "video" ? <Icon.VideoGlyph style={{ width: 22, height: 22 }} /> : <Icon.ImageGlyph style={{ width: 22, height: 22 }} />}
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
        {items.length === 0 && d.status !== "running" ? (
          <div className="output-empty mono">esperando contenido…</div>
        ) : items.length === 0 && d.status === "running" ? (
          <div className="output-loading" style={{ display: "grid", placeItems: "center", padding: 32, minHeight: 200, borderRadius: 12, background: `linear-gradient(135deg, ${accent}10, transparent 50%, ${accent}10)`, border: `1px dashed ${accent}55`, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 0%, ${accent}22 50%, transparent 100%)`, animation: "output-shimmer 1.8s linear infinite", transform: "translateX(-100%)" }} />
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", border: `3px solid ${accent}33`, borderTopColor: accent, animation: "spin 0.8s linear infinite" }} />
              <div className="mono" style={{ fontSize: 11, color: accent, letterSpacing: 1, textTransform: "uppercase" }}>
                {kind === "video" ? "Renderizando vídeo en Kie" : "Generando imagen en Kie"}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-3)", textAlign: "center" }}>
                {kind === "video" ? "30–90s. Seedance 2.0." : "30–60s. gpt-imagenes-2."}
              </div>
            </div>
          </div>
        ) : (
          <div className={"output-grid output-grid-cols-" + cols}>
            {items.map((it, i) => (
              <div key={it.id} className="output-cell">
                {kind === "video" && (
                  <div className="output-video-tag mono">
                    <Icon.Play style={{ width: 9, height: 9 }} />{it.duration || "5s"}
                  </div>
                )}
                {kind === "video" ? (
                  <video src={it.url} className="output-cell-img" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", background: "#000" }}
                    muted loop playsInline autoPlay
                    onLoadedMetadata={(e) => { try { e.currentTarget.play().catch(()=>{}); } catch(_){} }}
                  />
                ) : (
                  <div className="output-cell-img" style={{ backgroundImage: `url(${it.url})` }} />
                )}
                <div className="output-cell-actions">
                  <button title="Previsualizar" className="output-cell-btn" onClick={() => onItemAction?.("preview", node.id, it)}><Icon.Eye style={{ width: 13, height: 13 }} /></button>
                  <button title="Descargar"     className="output-cell-btn" onClick={() => onItemAction?.("download", node.id, it)}><Icon.Download style={{ width: 13, height: 13 }} /></button>
                  <button title="Eliminar"      className="output-cell-btn output-cell-btn-danger" onClick={() => onItemAction?.("delete", node.id, it)}><Icon.Trash style={{ width: 13, height: 13 }} /></button>
                </div>
                <div className="output-cell-index mono">{String(i + 1).padStart(2, "0")}</div>
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
            <button className="btn-soft" onClick={() => onItemAction?.("openGallery", node.id)}>Ver galería →</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NOTE NODE
// ---------------------------------------------------------------------------
function NoteNode({ node, onChange, onMouseDownHeader, onClose, selected, onHandleMouseDown, onHandleMouseUp }) {
  const d = node.data;
  const accent = "#FBBF24";
  return (
    <div className={"node-v2 note-node " + (selected ? "is-selected" : "")} data-accent="amber">
      <NodeHandle nodeId={node.id} side="left"  accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <NodeHandle nodeId={node.id} side="right" accent={accent} onMouseDown={onHandleMouseDown} onMouseUp={onHandleMouseUp} />
      <div className="node-v2-header" onMouseDown={onMouseDownHeader}>
        <div className="node-v2-left">
          <div className="node-v2-icon" style={{ background: "transparent" }}>
            <Icon.NoteGlyph style={{ width: 20, height: 20 }} />
          </div>
          <div className="node-v2-titlestack">
            <input className="note-title" value={d.title} onChange={(e) => onChange({ title: e.target.value })} placeholder="Nota" />
            <div className="node-v2-substatus">
              <span className="mono" style={{ color: "#FCD34D" }}>annotation</span>
            </div>
          </div>
        </div>
        <button className="node-v2-close" onClick={onClose} aria-label="cerrar">
          <Icon.Close style={{ width: 11, height: 11 }} />
        </button>
      </div>
      <div className="node-v2-body">
        <textarea className="note-text" rows={5} value={d.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Escribe tu nota aquí…" />
      </div>
    </div>
  );
}

export {
  KID_IMAGE_MODELS,
  KID_VIDEO_MODELS,
  Icon,
  PromptNode,
  ImageNode,
  VideoNode,
  NoteNode,
  OutputNode,
  StatusDot,
  AgentPicker,
}
