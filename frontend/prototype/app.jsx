/* prototype/app.jsx — App principal con canvas funcional tipo n8n.
 *
 * Funcionalidades:
 *  - 4 tipos de nodos (Prompt, Imagen, Video, Nota) añadibles desde el dock
 *  - Connector drag-to-link (mousedown handle → arrastra → mouseup en otro handle)
 *  - Ejecución por nodo: click "Generar" → resuelve upstream → mock generation → galería
 *  - Galería persistente con filtros
 *  - Notificaciones para cada evento relevante
 *  - Style Vault + Supercomputer panel siguen disponibles
 */

const { useState, useRef, useEffect, useCallback, useMemo, useReducer } = React;

// ─────────────────────────────────────────────────────────────────
// Garantiza que supercomputer.css (rediseño SuperStage "lujo silencioso")
// esté cargado. El <link> vive en "Canvas Prototype.html", pero ese archivo
// va COPY en el Dockerfile (no bind-mount), mientras prototype/ sí es live.
// Este guard lo inyecta en runtime si falta, para que el rediseño aplique sin
// rebuild del contenedor nginx. Idempotente: no duplica si ya existe.
(function ensureSupercomputerStylesheet() {
  try {
    const HREF = "prototype/supercomputer.css";
    const already = [...document.styleSheets].some((s) => s.href && s.href.includes("supercomputer.css"))
      || !!document.querySelector('link[href*="supercomputer.css"]');
    if (already) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = HREF;
    document.head.appendChild(link); // último → gana cascada sobre liquid.css
  } catch (e) { /* no-op: el rediseño cae al baked HTML si esto falla */ }
})();

// ─────────────────────────────────────────────────────────────────
// AUDIT CON POLLING (global, compartido por Vault / Reference / Supercomputer)
// El backend procesa el moodboard en BACKGROUND y responde al instante con
// status "auditing". Aquí hacemos POST y luego polling a GET /moodboards/{id}
// hasta "ready" | "error". Esto elimina el timeout de túnel/navegador que
// hacía fallar los sets grandes (10+ imágenes tardan 75-180s).
// Devuelve el manifest crudo (snake_case) o lanza Error. onTick(status) opcional.
// ─────────────────────────────────────────────────────────────────
window.__auditWithPolling = async function (payload, opts) {
  opts = opts || {};
  const maxMs = opts.maxMs || 360000;       // 6 min cap duro
  const onTick = typeof opts.onTick === "function" ? opts.onTick : null;
  const base = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "http://localhost:3003";

  const res = await fetch(base + "/moodboards/audit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("audit http " + res.status);
  const json = await res.json();

  // Atajo: si el backend devolvió manifest ya listo (procesado rápido), úsalo.
  const immStatus = json && json.moodboard && json.moodboard.audit_status;
  const immManifest = (json && json.moodboard && json.moodboard.manifest) || (json && json.manifest);
  if (immManifest && immStatus === "ready") return immManifest;

  // Polling a GET /moodboards/{id}
  const pollUrl = base + "/moodboards/" + encodeURIComponent(payload.moodboard_id);
  const deadline = Date.now() + maxMs;
  let delay = 2500;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay + 500, 6000);   // backoff suave
    let pr;
    try { pr = await fetch(pollUrl, { headers: { Accept: "application/json" } }); }
    catch (e) { continue; }                 // red intermitente → reintentar
    if (!pr || !pr.ok) continue;
    let pj;
    try { pj = await pr.json(); } catch (e) { continue; }
    const status = pj && pj.audit_status;
    if (onTick) { try { onTick(status); } catch (e) {} }
    if (status === "ready") {
      if (pj.manifest) return pj.manifest;
      throw new Error("audit ready pero sin manifest");
    }
    if (status === "error") throw new Error("Vision_Auditor reportó error");
    // status "auditing" | "idle" → seguir esperando
  }
  throw new Error("audit timeout (>6min)");
};

// Hoist globals from sibling babel scripts
const LeftRail = window.LeftRail;
const NodesPanel = window.NodesPanel;
const ClientsPanel = window.ClientsPanel;
const ProjectsPanel = window.ProjectsPanel;
const SettingsPanel = window.SettingsPanel;
const NewClientPopup = window.NewClientPopup;
const NewMoodboardForm = window.NewMoodboardForm;
const SAMPLE_CLIENTS = window.SAMPLE_CLIENTS;
const MoodboardVault = window.MoodboardVault;
const moodboardReducer = window.moodboardReducer;
const SAMPLE_MOODBOARDS = window.SAMPLE_MOODBOARDS;
const GalleryPanel = window.GalleryPanel;
const NotificationProvider = window.NotificationProvider;
const fakeMediaUrlForGeneration = window.fakeMediaUrlForGeneration;
const PromptNode = window.PromptNode;
const ImageNode = window.ImageNode;
const VideoNode = window.VideoNode;
const VoiceNode = window.VoiceNode;
const NoteNode = window.NoteNode;
const ReferenceNode = window.ReferenceNode;
const ImageRefNode  = window.ImageRefNode;
const OutputNode = window.OutputNode;
const Icon = window.Icon;
const StatusDot = window.StatusDot;
const AgentsPanel  = window.AgentsPanel;
const SAMPLE_AGENTS = window.SAMPLE_AGENTS;


// ---------------------------------------------------------------------------
// Constantes / catálogo
// ---------------------------------------------------------------------------
const ALLOWED_KID_AI_MODELS = ["gpt-imagenes-2", "nano-banana-pro", "nano-banana-2", "veo3", "seedance-2.0"];

const NODE_DEFAULTS = {
  prompt: () => ({
    status: "idle",
    brief: "",
    tipo: "image",
    cantidad: 1,
    agentId: "ag-shaq",
    modelId: "gpt-imagenes-2",
  }),
  image: () => ({
    status: "idle",
    prompt: "",
    modelId: "gpt-imagenes-2",
    aspect: "1:1",
    crudo: false,
    seed: null,
    cantidad: 1,
    refImages: [],
    scenarios: ["Editorial cálido", "Cinemático nocturno", "Boceto rápido"],
    lastUrl: null,
  }),
  video: () => ({
    status: "idle",
    prompt: "",
    modelId: "seedance-2.0",
    resolution: "720p",
    aspect: "16:9",
    duration: "5s",
    keyframes: [],
    refVideos: [],
    refAudio: [],
    opts: { syncAudio: false, lastFrame: false, webSearch: false, verifyContent: false },
    cantidad: 1,
    lastUrl: null,
  }),
  note: () => ({
    title: "Nota",
    text: "",
    color: "amber",
  }),
  voice: () => ({
    status: "idle",
    script: "",
    tone: "neutral",
    language: "Español",
    voicePrompt: null,
  }),
  output: () => ({
    status: "done",
    kind: "image",
    modelId: null,
    items: [],
  }),
  reference: () => ({
    images: [],
    label: "Personaje",
    characterPrompt: null,
    status: "idle",
    manifest: null,
  }),
  imageref: () => ({
    images: [],  // array de data:base64 o URLs http
    label: "Referencias",
  }),
};

const NODE_SIZE = {
  prompt:    { w: 360, h: 280 },
  image:     { w: 360, h: 760 },
  video:     { w: 380, h: 940 },
  voice:     { w: 360, h: 420 },
  note:      { w: 260, h: 220 },
  output:    { w: 420, h: 380 },
  group:     { w: 600, h: 400 },
  reference: { w: 320, h: 420 },
  imageref: { w: 300, h: 340 },
};

// ---------------------------------------------------------------------------
// Bezier path utility (for edges)
// ---------------------------------------------------------------------------
function bezierPath(sx, sy, tx, ty) {
  const dx = Math.max(50, Math.abs(tx - sx) * 0.55);
  return `M ${sx},${sy} C ${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
}

function nodePortPos(node, side) {
  const w = NODE_SIZE[node.type]?.w || 320;
  // Handles are fixed at top:24px (center of header) via CSS
  return {
    x: node.x + (side === "right" ? w + 6 : -6),
    y: node.y + 30,
  };
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// ProfilePopup — edit user profile
// ---------------------------------------------------------------------------
function ProfilePopup({ profile, onSave, onClose }) {
  const [draft, setDraft] = useState(profile);
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Auto-update initials when name changes
  useEffect(() => {
    if (draft.name && draft.name !== profile.name) {
      const init = draft.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
      if (init) setDraft((d) => ({ ...d, initials: init }));
    }
  }, [draft.name]);
  const avatarColors = [
    { id: "violet", color: "linear-gradient(135deg, #A78BFA, #818CF8)" },
    { id: "teal",   color: "linear-gradient(135deg, #34D399, #06B6D4)" },
    { id: "amber",  color: "linear-gradient(135deg, #FBBF24, #FB7185)" },
    { id: "rose",   color: "linear-gradient(135deg, #FB7185, #C084FC)" },
    { id: "blue",   color: "linear-gradient(135deg, #7DD3FC, #818CF8)" },
    { id: "sand",   color: "linear-gradient(135deg, #D9B58C, #A47551)" },
  ];
  const selectedAvatar = avatarColors.find((a) => a.id === draft.avatarColor) || avatarColors[0];
  return (
    <div className="form-popup-backdrop" onClick={onClose}>
      <div className="form-popup form-popup-lg" onClick={(e) => e.stopPropagation()}>
        <div className="form-popup-head">
          <div>
            <div className="form-popup-kicker mono">cuenta · personal</div>
            <div className="form-popup-title">Mi perfil</div>
          </div>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>

        <div className="form-stage">
          {/* Header con avatar actual + nombre (sin subir foto) */}
          <div style={{ display:"flex", alignItems:"center", gap:16, padding:"18px 20px 14px", borderBottom:"1px solid var(--line,rgba(255,255,255,0.07))" }}>
            <div style={{ width:60, height:60, borderRadius:16, overflow:"hidden", flexShrink:0, border:"2px solid rgba(167,139,250,0.35)", boxShadow:"0 4px 16px rgba(124,58,237,0.25)" }}>
              {draft.avatarPhoto
                ? <img src={draft.avatarPhoto} alt="avatar" style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top", display:"block" }}/>
                : <div style={{ width:"100%", height:"100%", background:selectedAvatar.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#fff" }}>{(draft.initials||"?").slice(0,2)}</div>
              }
            </div>
            <div>
              <div style={{ fontSize:17, fontWeight:600, letterSpacing:"-0.02em", color:"var(--text-1)" }}>{draft.name || "Sin nombre"}</div>
              <div className="mono" style={{ fontSize:10, color:"var(--text-3)", letterSpacing:"0.1em", textTransform:"uppercase", marginTop:3 }}>{draft.role || "Workspace"}</div>
            </div>
          </div>

          {/* ── Avatar presets — 8 avatares 3D para escoger ── */}
          <div className="form-section" style={{ paddingBottom: 0 }}>
            <div className="field-label" style={{ marginBottom: 10, fontSize: 11, opacity: .65 }}>
              Elige tu avatar
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, marginBottom: 4 }}>
              {Array.from({ length: 8 }, (_, i) => {
                const url = `prototype/assets/avatars/avatar-${i+1}.png`;
                const isSelected = draft.avatarPhoto === url;
                return (
                  <button
                    key={i} type="button"
                    onClick={() => set({ avatarPhoto: url })}
                    title={`Avatar ${i+1}`}
                    style={{
                      padding: 0, border: "none", background: "none", cursor: "pointer",
                      borderRadius: 12, overflow: "hidden", position: "relative",
                      boxShadow: isSelected
                        ? "0 0 0 3px var(--accent, #A78BFA), 0 4px 16px rgba(167,139,250,0.45)"
                        : "0 0 0 1px rgba(255,255,255,0.08)",
                      transition: "box-shadow .2s, transform .2s",
                      transform: isSelected ? "scale(1.08)" : "scale(1)",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.transform = "scale(1.05)"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.transform = "scale(1)"; }}
                  >
                    <img src={url} alt={`Avatar ${i+1}`}
                      style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                      onError={e => { e.currentTarget.style.opacity = ".3"; }}
                    />
                    {isSelected && (
                      <span style={{
                        position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: "rgba(167,139,250,0.3)", fontSize: 14, color: "#fff",
                      }}>✓</span>
                    )}
                  </button>
                );
              })}
            </div>
            {/* No hay opción de quitar avatar — siempre debe haber uno seleccionado */}
          </div>

          <div className="form-section">
            <FormField label="Nombre">
              <input className="form-input" autoFocus value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Tu nombre" />
            </FormField>
            <FormGrid>
              <FormField label="Iniciales" hint="auto">
                <input className="form-input form-input-sm" maxLength={2} value={draft.initials} onChange={(e) => set({ initials: e.target.value.toUpperCase() })} />
              </FormField>
              <FormField label="Rol" wide>
                <input className="form-input" value={draft.role} onChange={(e) => set({ role: e.target.value })} placeholder="Creative Director" />
              </FormField>
            </FormGrid>
            <FormField label="Email corporativo">
              <div className="form-input" style={{ cursor:"not-allowed", opacity:.7, display:"flex", alignItems:"center", gap:6, userSelect:"none" }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M20 13V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v7"/><path d="M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0"/><path d="M2 20h20"/></svg>
                {draft.email || localStorage.getItem("cdpro-user-email") || "—"}
              </div>
            </FormField>
            <FormField label="Bio" hint="breve descripción">
              <textarea className="form-input" rows={3} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="¿Qué haces en ClienderDesign?" />
            </FormField>
            {/* Color de avatar eliminado — el usuario siempre elige un avatar 3D */}
          </div>

          <div className="form-foot">
            <button type="button" className="form-btn-ghost" onClick={onClose}>Cancelar</button>
            <button type="button" className="form-btn-primary" disabled={!draft.name?.trim()} onClick={() => onSave(draft)}>
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const FormField  = window.FormField  || (({ label, hint, children, wide }) => <div className={"form-field " + (wide ? "is-wide" : "")}><div className="form-field-head"><span className="form-label mono">{label}</span>{hint && <span className="form-hint mono">{hint}</span>}</div>{children}</div>);
const FormGrid   = window.FormGrid   || (({ children }) => <div className="form-grid">{children}</div>);

function TopBar({ mode, onMode, isProcessing, onRunAll, theme, onThemeToggle, onOpenProfile, onOpenAnalytics, userInitials, userEmail, userPhoto,
  clients, moodboards, activeClient, activeMoodboard, setCtxClient, setCtxMoodboard }) {
  const [clientOpen, setClientOpen] = React.useState(false);
  const [mbOpen, setMbOpen] = React.useState(false);
  const closeAll = () => { setClientOpen(false); setMbOpen(false); };

  React.useEffect(() => {
    if (!clientOpen && !mbOpen) return;
    const handler = (e) => { if (!e.target.closest('.ctx-pill')) closeAll(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [clientOpen, mbOpen]);

  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Cliender<sup>design</sup></div>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--text-3)', textTransform: 'uppercase', marginTop: 2 }}>
            creative supercomputer
          </div>
        </div>
      </div>

      <div className="mode-tabs">
        <button className={'mode-tab ' + (mode === 'canvas' ? 'is-active' : '')} onClick={() => onMode('canvas')}>
          <span className="mode-tab-dot" /> Canvas
        </button>
        <button className={'mode-tab ' + (mode === 'supercomputer' ? 'is-active' : '')} onClick={() => onMode('supercomputer')}>
          <span className="mode-tab-dot" /> Supercomputer
        </button>
      </div>

      {/* Contexto activo */}
      <div className="ctx-center">
        <span className="ctx-center-label">trabajando en</span>

        {/* Pill cliente */}
        <div className={'ctx-pill' + (clientOpen ? ' is-open' : '')}>
          <button className={'ctx-pill-btn' + (activeClient ? ' has-value' : '')}
            onClick={() => { setClientOpen((v) => !v); setMbOpen(false); }}>
            {activeClient ? (
              <>
                <div className="ctx-pill-dot" style={{ background: activeClient.bgGradient || 'var(--accent)' }} />
                <span>{activeClient.name}</span>
                <svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg>
                <span>Cliente</span>
                <svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </>
            )}
          </button>

          {clientOpen && (
            <div className="ctx-drop">
              <div className="ctx-drop-header">
                <span className="ctx-drop-title">Selecciona cliente</span>
                {activeClient && (
                  <button className="ctx-drop-clear" onClick={() => { setCtxClient(null); setCtxMoodboard(null); closeAll(); }}>× Limpiar</button>
                )}
              </div>
              <div className="ctx-drop-list">
                {(clients || []).map((c) => (
                  <button key={c.id} className={'ctx-drop-row' + (activeClient?.id === c.id ? ' is-active' : '') + (c._pinned ? ' ctx-drop-row--pinned' : '')}
                    style={c._pinned ? { borderLeft: '2px solid #A78BFA', paddingLeft: 10, marginBottom: 2 } : {}}
                    onClick={() => { setCtxClient(c.id); setCtxMoodboard(null); closeAll(); }}>
                    <div className="ctx-drop-avatar" style={{ background: c.bgGradient || 'var(--accent)' }}>{c.initials}</div>
                    <div className="ctx-drop-info">
                      <div className="ctx-drop-name" style={c._pinned ? { color: '#C4B5FD', display: 'flex', alignItems: 'center', gap: 6 } : {}}>
                        {c.name}
                        {c._pinned && <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#A78BFA', background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.35)', padding: '1px 5px', borderRadius: 10 }}>nosotros</span>}
                      </div>
                      <div className="ctx-drop-sub">{c.tagline || ''}</div>
                    </div>
                    {activeClient?.id === c.id && (
                      <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5"/></svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <svg viewBox="0 0 6 10" width="5" height="9" fill="none" style={{ opacity: .2, flexShrink: 0 }}>
          <path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>

        {/* Pill moodboard */}
        <div className={'ctx-pill' + (mbOpen ? ' is-open' : '')}>
          <button className={'ctx-pill-btn' + (activeMoodboard ? ' has-value' : '')}
            onClick={() => { setMbOpen((v) => !v); setClientOpen(false); }}>
            {activeMoodboard ? (
              <>
                <div className="ctx-pill-dot ctx-pill-dot-sq" style={{ background: activeMoodboard.manifest?.colorPalette?.[0] || 'var(--accent-2)' }} />
                <span>{activeMoodboard.name}</span>
                {activeMoodboard.manifest ? (
                  <span
                    title={(activeMoodboard.manifest.master_style_prompt || 'ADN visual listo').slice(0, 80)}
                    style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 12, height: 12, borderRadius: '50%', background: 'var(--accent-green, #2ecc71)', color: '#fff', fontSize: 9, fontWeight: 700, lineHeight: 1, marginLeft: 2 }}
                  >✓</span>
                ) : activeMoodboard.auditStatus === 'auditing' ? (
                  <span
                    title="Analizando estilo…"
                    style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', border: '1.5px solid var(--accent-2, #888)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', marginLeft: 2 }}
                  />
                ) : null}
                <svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
                  <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
                </svg>
                <span>Moodboard</span>
                <svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </>
            )}
          </button>

          {mbOpen && (
            <div className="ctx-drop ctx-drop-mb">
              <div className="ctx-drop-header">
                <span className="ctx-drop-title">Estilo visual</span>
                {activeMoodboard && (
                  <button className="ctx-drop-clear" onClick={() => { setCtxMoodboard(null); closeAll(); }}>× Limpiar</button>
                )}
              </div>
              {(moodboards || []).length === 0 ? (
                <div className="ctx-drop-empty">Sin moodboards. Crea uno en el Vault.</div>
              ) : (
                <div className="ctx-drop-list">
                  {(moodboards || []).map((m) => (
                    <button key={m.id} className={'ctx-drop-row' + (activeMoodboard?.id === m.id ? ' is-active' : '')}
                      onClick={() => { setCtxMoodboard(m.id); closeAll(); }}>
                      <div className="ctx-drop-mb-pal">
                        {(m.manifest?.colorPalette || ['#A78BFA', '#7DD3FC']).slice(0, 4).map((c, i, a) => (
                          <div key={i} style={{ background: c, flex: 1,
                            borderRadius: i === 0 ? '4px 0 0 4px' : i === a.length - 1 ? '0 4px 4px 0' : 0 }} />
                        ))}
                      </div>
                      <div className="ctx-drop-info">
                        <div className="ctx-drop-name">{m.name}</div>
                        <div className="ctx-drop-sub">{m.images?.length || 0} refs{m.manifest ? ' · ADN ✓' : ' · sin ADN'}</div>
                      </div>
                      {activeMoodboard?.id === m.id && (
                        <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5"/></svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {(activeClient || activeMoodboard) && (
          <div className="ctx-status-badge" title="Contexto activo">
            <div className="ctx-status-dot" />
          </div>
        )}
      </div>

      <div className="topbar-right">
        <button className="theme-toggle-btn" onClick={onThemeToggle}
          title={theme === 'dark' ? 'Cambiar a Light' : 'Cambiar a Dark'} aria-label="theme toggle">
          {theme === 'dark'
            ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>
        <button className="theme-toggle-btn" onClick={onOpenAnalytics} title="Analytics de costes API" style={{ fontSize: 14 }}>
          📊
        </button>
        {mode !== 'supercomputer' && (
          <button className="btn-primary" onClick={onRunAll}>
            <Icon.Play style={{ width: 11, height: 11 }} />
            Run All
          </button>
        )}
        {/* Avatar — siempre visible, solo imagen sin email */}
        <button className="user-avatar-btn" onClick={onOpenProfile} title="Mi perfil"
          style={{ padding: 0, overflow: 'hidden', border: userPhoto ? '2px solid rgba(167,139,250,0.4)' : '2px solid rgba(255,255,255,0.15)', flexShrink: 0 }}>
          {userPhoto
            ? <img src={userPhoto} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', display: 'block', borderRadius: 'inherit' }}
                onError={e => { e.currentTarget.style.display='none'; e.currentTarget.nextSibling.style.display='flex'; }}
              />
            : null}
          <span style={{ display: userPhoto ? 'none' : 'flex', alignItems:'center', justifyContent:'center', width:'100%', height:'100%', fontSize: 11, fontWeight: 600 }}>
            {userInitials}
          </span>
        </button>
        {/* Logout — solo si hay sesión Supabase activa */}
        {window.__cdproSignOut && (
          <button
            title={`Cerrar sesión · ${userEmail || ''}`}
            onClick={() => {
              window.__confirm('¿Cerrar sesión?', { confirmText: 'Cerrar sesión' }).then((ok) => { if (ok) window.__cdproSignOut(); });
            }}
            style={{
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '4px 8px', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 11, letterSpacing: '0.06em',
              fontFamily: 'var(--font-mono)', transition: 'all .15s',
              display: 'flex', alignItems: 'center', gap: 4,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(251,113,133,0.5)'; e.currentTarget.style.color = '#FCA5A5'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-3)'; }}
          >
            <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2H3a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M10 11l3-3-3-3M13 8H6"/>
            </svg>
            salir
          </button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draggable wrapper (re-used across node types)
// ---------------------------------------------------------------------------
function DraggableWrap({ node, selected, onSelect, onDrag, onDragStart, children }) {
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const onMouseDownHeader = (e) => {
    if (e.button !== 0) return;
    // No interferir con inputs/textareas dentro del header
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(node.id, e);
    onDragStart?.(node.id);
    const origin = { x: node.x, y: node.y };
    dragRef.current = { sx: e.clientX, sy: e.clientY, origin };

    function onMove(ev) {
      const zoom = window.__zoom || 1;
      const dx = (ev.clientX - dragRef.current.sx) / zoom;
      const dy = (ev.clientY - dragRef.current.sy) / zoom;
      onDrag(node.id, dragRef.current.origin.x + dx, dragRef.current.origin.y + dy);
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (wrapRef.current) wrapRef.current.classList.remove("is-dragging");
      dragRef.current = null;
    }
    if (wrapRef.current) wrapRef.current.classList.add("is-dragging");
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };
  return (
    <div
      ref={wrapRef}
      className={"node-wrap" + (node.type === "group" ? " group-wrap" : "")}
      data-node-id={node.id}
      style={{ left: node.x, top: node.y }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id, e); }}
    >
      {children({ onMouseDownHeader })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupNode — contenedor de subproyecto, va por debajo de los hijos
// ---------------------------------------------------------------------------
function GroupNode({ node, onChange, onMouseDownHeader, onClose, selected, onResizeCorner }) {
  // 4 handles de esquina — onMouseDown inicia el resize
  const corners = [
    { cls: "grp-resize-nw", cursor: "nwse-resize", corner: "nw" },
    { cls: "grp-resize-ne", cursor: "nesw-resize", corner: "ne" },
    { cls: "grp-resize-sw", cursor: "nesw-resize", corner: "sw" },
    { cls: "grp-resize-se", cursor: "nwse-resize", corner: "se" },
  ];
  return (
    <div
      className={"node-v2 group-node " + (selected ? "is-selected" : "")}
      style={{ width: node.data.w, height: node.data.h, position: "absolute", left: 0, top: 0 }}
    >
      <div className="group-node-header" onMouseDown={onMouseDownHeader}>
        <span className="group-node-icon">▢</span>
        <input
          className="group-node-name"
          value={node.data.name}
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button className="node-v2-close" onClick={onClose}>✕</button>
      </div>
      {/* Handles de resize en las 4 esquinas */}
      {corners.map(({ cls, cursor, corner }) => (
        <div
          key={corner}
          className={"grp-resize-handle " + cls}
          style={{ cursor }}
          onMouseDown={(e) => { e.stopPropagation(); onResizeCorner?.(e, node.id, corner); }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupNameModal — nombre de subproyecto sin window.prompt()
// ---------------------------------------------------------------------------
function GroupNameModal({ defaultName, count, onConfirm, onCancel }) {
  const [name, setName] = React.useState(defaultName || "Subproyecto");
  const inputRef = React.useRef(null);
  React.useEffect(() => { setTimeout(() => inputRef.current?.select(), 60); }, []);
  const confirm = () => onConfirm(name.trim() || "Subproyecto");
  return (
    <div className="new-agent-popup-overlay" onClick={onCancel}>
      <div className="new-agent-popup" onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 360 }}>
        <p className="new-agent-popup-title">Nombrar grupo</p>
        <p className="mono" style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>
          {count} nodo{count !== 1 ? "s" : ""} seleccionado{count !== 1 ? "s" : ""}
        </p>
        <div className="new-agent-field">
          <label>Nombre del subproyecto</label>
          <input
            ref={inputRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); confirm(); }
              if (e.key === "Escape") onCancel();
            }}
            placeholder="Subproyecto"
          />
        </div>
        <div className="new-agent-popup-actions">
          <button className="new-agent-popup-cancel" type="button" onClick={onCancel}>Cancelar</button>
          <button className="new-agent-popup-submit" type="button" onClick={confirm}>
            ▢ Agrupar
          </button>
        </div>
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// CanvasNode dispatcher
// ---------------------------------------------------------------------------
function CanvasNode({ node, selected, onSelect, onDrag, onGroupDragStart, onDataChange, onClose, onGenerate, hasIncomingPrompt, incomingPrompt, incomingMedia, incomingRefImages, onOutputAction, activeClient, activeMoodboard, onResizeCorner }) {
  return (
    <DraggableWrap node={node} selected={selected} onSelect={onSelect} onDrag={onDrag} onDragStart={node.type === 'group' ? onGroupDragStart : undefined}>
      {({ onMouseDownHeader }) => {
        const common = {
          node,
          onChange: (p) => onDataChange(node.id, p),
          onMouseDownHeader,
          onClose: () => onClose(node.id),
          selected,
        };
        if (node.type === "prompt") return <PromptNode {...common} onGenerate={() => onGenerate(node.id)} incomingMedia={incomingMedia} activeClient={activeClient} activeMoodboard={activeMoodboard} />;
        if (node.type === "image")  return <ImageNode  {...common} onGenerate={() => onGenerate(node.id)} hasIncomingPrompt={hasIncomingPrompt} incomingPrompt={incomingPrompt} incomingMedia={incomingMedia} incomingRefImages={incomingRefImages} />;
        if (node.type === "video")  return <VideoNode  {...common} onGenerate={() => onGenerate(node.id)} hasIncomingPrompt={hasIncomingPrompt} incomingPrompt={incomingPrompt} incomingMedia={incomingMedia} incomingRefImages={incomingRefImages} />;
        if (node.type === "voice")     return <VoiceNode     {...common} incomingPrompt={incomingPrompt} />;
        if (node.type === "reference") return <ReferenceNode {...common} />;
        if (node.type === "imageref")  return <ImageRefNode  {...common} />;
        if (node.type === "note")      return <NoteNode      {...common} />;
        if (node.type === "output")    return <OutputNode    {...common} onItemAction={onOutputAction} />;
        if (node.type === "group")     return <GroupNode     {...common} onResizeCorner={onResizeCorner} />;
        return null;
      }}
    </DraggableWrap>
  );
}

// ---------------------------------------------------------------------------
// EdgesLayer (with temp edge for in-progress drag)
// ---------------------------------------------------------------------------
function EdgesLayer({ nodes, edges, draggingEdge, runningEdgeIds, newEdgeIds, selectedEdgeId, onSelectEdge, onDeleteEdge }) {
  return (
    <svg className="edges-svg">
      <defs>
        <filter id="edgeGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <filter id="edgeGlowStrong" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
        <linearGradient id="edge-stream-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="30%"  stopColor="var(--accent-2)" stopOpacity="0.85" />
          <stop offset="65%"  stopColor="#fff" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {edges.map((e) => {
        const src = nodes.find((n) => n.id === e.source);
        const tgt = nodes.find((n) => n.id === e.target);
        if (!src || !tgt) return null;
        const s = nodePortPos(src, "right");
        const t = nodePortPos(tgt, "left");
        const d = bezierPath(s.x, s.y, t.x, t.y);
        const mx = (s.x + t.x) / 2;
        const my = (s.y + t.y) / 2;
        const isRunning = runningEdgeIds.has(e.id);
        const isJustCreated = newEdgeIds.has(e.id);
        const isSelected = selectedEdgeId === e.id;
        const sourceHasData = !!(src?.data?.lastUrl || (src?.type === "prompt" && src?.data?.agentOutput));
        return (
          <g key={e.id} className={(isJustCreated ? "edge-just-created" : "") + (isSelected ? " edge-selected" : "") + (sourceHasData ? " edge-has-data" : "")}>
            {/* invisible thick hit area */}
            <path
              d={d}
              stroke="transparent"
              strokeWidth="14"
              fill="none"
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onClick={(ev) => { ev.stopPropagation(); onSelectEdge?.(e.id); }}
            />
            <path d={d} className={"edge-base " + (isRunning || isJustCreated || isSelected ? "is-active" : "")} />
            {/* Subtle continuous pixel-art stream */}
            {!isJustCreated && (
              <path d={d} className="edge-stream" />
            )}
            {!isRunning && !isJustCreated && (
              <circle r="2.4" className="edge-stream-pixel">
                <animateMotion dur="3.2s" repeatCount="indefinite" path={d} />
                <animate attributeName="opacity" values="0.2;1;0.2" dur="3.2s" repeatCount="indefinite" />
              </circle>
            )}
            {(isRunning || isJustCreated) && (
              <>
                <path
                  d={d}
                  className="edge-dash"
                  filter={isJustCreated ? "url(#edgeGlowStrong)" : "url(#edgeGlow)"}
                />
                {[0, 0.55, 1.05].map((begin, i) => (
                  <circle key={i} r={isJustCreated ? "3.6" : "2.8"} className="edge-particle">
                    <animateMotion dur={isJustCreated ? "0.9s" : "1.9s"} repeatCount="indefinite" begin={`${begin}s`} path={d} />
                  </circle>
                ))}
              </>
            )}
            {isSelected && (
              <g
                className="edge-delete-btn"
                transform={`translate(${mx},${my})`}
                style={{ cursor: "pointer", pointerEvents: "all" }}
                onClick={(ev) => { ev.stopPropagation(); onDeleteEdge?.(e.id); }}
              >
                <circle r="12" fill="#FB7185" filter="url(#edgeGlowStrong)" />
                <circle r="11" fill="#0F1018" />
                <circle r="11" fill="none" stroke="#FB7185" strokeWidth="1.5" />
                <line x1="-4" y1="-4" x2="4" y2="4" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
                <line x1="-4" y1="4"  x2="4" y2="-4" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
          </g>
        );
      })}
      {draggingEdge && (
        <path
          d={bezierPath(draggingEdge.sx, draggingEdge.sy, draggingEdge.cx, draggingEdge.cy)}
          className="temp-edge"
        />
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// ConnectMenu — popup flotante "Añadir nodo conectado"
// ---------------------------------------------------------------------------
function ConnectMenu({ menu, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    // pequeño delay para no capturar el mismo mouseup que lo abrió
    const t = setTimeout(() => document.addEventListener("mousedown", onClickOutside), 50);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onClickOutside); };
  }, [menu, onClose]);
  if (!menu) return null;
  const items = [
    { type: "prompt", label: "Prompt",     hint: "brief creativo",        glyph: <Icon.PromptGlyph style={{ width: 18, height: 18 }} />, accent: "#A78BFA" },
    { type: "image",  label: "Imagen",     hint: "generación de imagen",  glyph: <Icon.ImageGlyph  style={{ width: 18, height: 18 }} />, accent: "#C4B5FD" },
    { type: "video",  label: "Video",      hint: "generación de video",   glyph: <Icon.VideoGlyph  style={{ width: 18, height: 18 }} />, accent: "#34D399" },
    { type: "voice",  label: "Voz",        hint: "narración / voz en off", glyph: <Icon.MicGlyph   style={{ width: 18, height: 18 }} />, accent: "#F59E0B" },
    { type: "note",   label: "Nota",       hint: "anotación libre",       glyph: <Icon.NoteGlyph   style={{ width: 18, height: 18 }} />, accent: "#FBBF24" },
    { type: "imageref", label: "Referencia", hint: "fotos de referencia",  glyph: <span style={{ fontSize:17, lineHeight:1 }}>🖼</span>, accent: "#F97316" },
  ];
  return (
    <div
      ref={ref}
      className="connect-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="connect-menu-header">
        <span className="connect-menu-kicker mono">conectar a</span>
        <span className="connect-menu-title">Añadir nodo</span>
      </div>
      <div className="connect-menu-list">
        {items.map((it) => (
          <button
            key={it.type}
            className="connect-menu-item"
            style={{ "--cm-c": it.accent }}
            onClick={() => onPick(it.type)}
          >
            <div className="connect-menu-icon">{it.glyph}</div>
            <div className="connect-menu-meta">
              <div className="connect-menu-label">{it.label}</div>
              <div className="connect-menu-hint mono">{it.hint}</div>
            </div>
            <div className="connect-menu-arrow">↵</div>
          </button>
        ))}
      </div>
      <div className="connect-menu-foot mono">Esc para cancelar</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContextMenu — menú click-derecho (canvas vacío o sobre nodo)
// Reusa estética de connect-menu (clases CSS existentes)
// ---------------------------------------------------------------------------
function ContextMenu({ menu, onPick, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!menu) return;
    const onClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    const t = setTimeout(() => document.addEventListener("mousedown", onClickOutside), 50);
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu, onClose]);
  if (!menu) return null;

  const onNode = !!menu.nodeId;
  const items = onNode ? [
    { action: "duplicate",   label: "Duplicar nodo",      hint: "copia con offset",    accent: "#A78BFA", icon: <Icon.Plus style={{ width: 14, height: 14 }} /> },
    { action: "disconnect",  label: "Desconectar todo",   hint: "quita edges del nodo", accent: "#FBBF24", icon: <span style={{ fontSize: 14, lineHeight: 1 }}>⌀</span> },
    { action: "delete",      label: "Eliminar nodo",      hint: "borrar definitivo",    accent: "#FB7185", icon: <span style={{ fontSize: 16, lineHeight: 1 }}>×</span> },
  ] : [
    { action: "add-prompt",  label: "Crear nodo Prompt",  hint: "brief creativo",         accent: "#A78BFA", icon: <Icon.PromptGlyph style={{ width: 18, height: 18 }} /> },
    { action: "add-image",   label: "Crear nodo Imagen",  hint: "generación de imagen",   accent: "#C4B5FD", icon: <Icon.ImageGlyph  style={{ width: 18, height: 18 }} /> },
    { action: "add-video",   label: "Crear nodo Video",   hint: "generación de video",    accent: "#34D399", icon: <Icon.VideoGlyph  style={{ width: 18, height: 18 }} /> },
    { action: "add-voice",   label: "Crear nodo Voz",     hint: "narración / voz en off", accent: "#F59E0B", icon: <Icon.MicGlyph    style={{ width: 18, height: 18 }} /> },
    { action: "add-note",      label: "Crear nodo Nota",       hint: "anotación libre",           accent: "#FBBF24", icon: <Icon.NoteGlyph   style={{ width: 18, height: 18 }} /> },
    { action: "add-reference",  label: "Crear nodo Referencia",  hint: "personaje · estilo visual",  accent: "#EC4899", icon: <Icon.ImageGlyph  style={{ width: 18, height: 18 }} /> },
  ];

  return (
    <div
      ref={ref}
      className="connect-menu"
      style={{ left: menu.x, top: menu.y }}
    >
      <div className="connect-menu-header">
        <span className="connect-menu-kicker mono">{onNode ? "nodo" : "canvas"}</span>
        <span className="connect-menu-title">{onNode ? "Acciones de nodo" : "Crear nodo aquí"}</span>
      </div>
      <div className="connect-menu-list">
        {items.map((it) => (
          <button
            key={it.action}
            className="connect-menu-item"
            style={{ "--cm-c": it.accent }}
            onClick={() => onPick(it.action, menu)}
          >
            <div className="connect-menu-meta" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 22, height: 22, display: "grid", placeItems: "center", color: "var(--cm-c)", flexShrink: 0 }}>{it.icon}</div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <div className="connect-menu-label">{it.label}</div>
                <div className="connect-menu-hint mono">{it.hint}</div>
              </div>
            </div>
            <div className="connect-menu-arrow">↵</div>
          </button>
        ))}
      </div>
      <div className="connect-menu-foot mono">Esc para cancelar</div>
    </div>
  );
}


// ---------------------------------------------------------------------------
// Minimap — vista en miniatura del canvas + viewport rectangle clickeable
// ---------------------------------------------------------------------------
function Minimap({ nodes, edges, pan, zoom, setPan, viewportRef }) {
  const MM_W = 220, MM_H = 150, MM_PAD = 14;
  // Calcula bounds del mundo
  const bounds = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 1500, maxY: 1000 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    nodes.forEach((n) => {
      const w = (n.type === "video" ? 380 : n.type === "output" ? 420 : n.type === "note" ? 260 : 360);
      const h = (n.type === "video" ? 940 : n.type === "output" ? 380 : n.type === "note" ? 220 : n.type === "image" ? 760 : 280);
      minX = Math.min(minX, n.x);
      minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + w);
      maxY = Math.max(maxY, n.y + h);
    });
    // Margen
    const padW = 200, padH = 200;
    return { minX: minX - padW, minY: minY - padH, maxX: maxX + padW, maxY: maxY + padH };
  }, [nodes]);

  const worldW = bounds.maxX - bounds.minX;
  const worldH = bounds.maxY - bounds.minY;
  const innerW = MM_W - MM_PAD * 2;
  const innerH = MM_H - MM_PAD * 2;
  const scale = Math.min(innerW / worldW, innerH / worldH);
  const offsetX = MM_PAD + (innerW - worldW * scale) / 2;
  const offsetY = MM_PAD + (innerH - worldH * scale) / 2;

  const toMM = (x, y) => ({
    x: offsetX + (x - bounds.minX) * scale,
    y: offsetY + (y - bounds.minY) * scale,
  });

  // Viewport rectangle en el mundo
  const vpW = viewportRef.current?.clientWidth || 1200;
  const vpH = viewportRef.current?.clientHeight || 800;
  const visWorldX = -pan.x / zoom;
  const visWorldY = -pan.y / zoom;
  const visWorldW = vpW / zoom;
  const visWorldH = vpH / zoom;
  const vp1 = toMM(visWorldX, visWorldY);
  const vp2 = toMM(visWorldX + visWorldW, visWorldY + visWorldH);

  const onClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    // Convertir a coords del mundo
    const worldX = bounds.minX + (mx - offsetX) / scale;
    const worldY = bounds.minY + (my - offsetY) / scale;
    // Centrar el viewport en este punto
    setPan({ x: -(worldX * zoom) + vpW / 2, y: -(worldY * zoom) + vpH / 2 });
  };

  const nodeColor = {
    prompt: "#A78BFA", image: "#C4B5FD", video: "#34D399", voice: "#F59E0B", note: "#FBBF24", output: "#7DD3FC",
  };

  return (
    <div className="minimap-wrap">
      <div className="minimap-head mono">canvas</div>
      <svg className="minimap" width={MM_W} height={MM_H} onClick={onClick}>
        <defs>
          <linearGradient id="mm-vp-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="var(--accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={MM_W} height={MM_H} rx="14" fill="rgba(255,255,255,0.025)" stroke="var(--surf-line)" strokeWidth="1" />
        {edges.map((e) => {
          const src = nodes.find((n) => n.id === e.source);
          const tgt = nodes.find((n) => n.id === e.target);
          if (!src || !tgt) return null;
          const w1 = (src.type === "video" ? 380 : src.type === "output" ? 420 : src.type === "note" ? 260 : 360);
          const w2 = (tgt.type === "video" ? 380 : tgt.type === "output" ? 420 : tgt.type === "note" ? 260 : 360);
          const a = toMM(src.x + w1, src.y + 30);
          const b = toMM(tgt.x,      tgt.y + 30);
          return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth="0.8" opacity="0.55" />;
        })}
        {[...nodes].sort((a,b)=> (a.type==="group"?-1:1)).map((n) => {
          const w = (n.type === "video" ? 380 : n.type === "output" ? 420 : n.type === "note" ? 260 : 360);
          const h = (n.type === "video" ? 940 : n.type === "output" ? 380 : n.type === "note" ? 220 : n.type === "image" ? 760 : 280);
          const p = toMM(n.x, n.y);
          const color = nodeColor[n.type] || "#A78BFA";
          return (
            <rect
              key={n.id}
              x={p.x} y={p.y}
              width={Math.max(3, w * scale)}
              height={Math.max(3, h * scale)}
              fill={color}
              opacity={n.data?.status === "running" ? 1 : 0.7}
              rx="2"
            >
              {n.data?.status === "running" && (
                <animate attributeName="opacity" values="0.5;1;0.5" dur="1.4s" repeatCount="indefinite" />
              )}
            </rect>
          );
        })}
        {/* Viewport rect */}
        <rect
          x={Math.max(0, Math.min(MM_W, vp1.x))}
          y={Math.max(0, Math.min(MM_H, vp1.y))}
          width={Math.min(MM_W, vp2.x) - Math.max(0, vp1.x)}
          height={Math.min(MM_H, vp2.y) - Math.max(0, vp1.y)}
          fill="url(#mm-vp-fill)"
          stroke="var(--accent)"
          strokeWidth="1.2"
          rx="3"
          pointerEvents="none"
        />
      </svg>
      <div className="minimap-foot">
        <span className="mono">{Math.round(zoom * 100)}%</span>
        <div className="minimap-zoom">
          <button onClick={() => setPan({ x: -100, y: -100 })}>⊡</button>
        </div>
      </div>
    </div>
  );
}
function HUD({ nodeStatus, zoom, onZoom, onFit }) {
  const items = [
    { k: "master_director", l: "Director" },
    { k: "scriptwriter",    l: "Script"   },
    { k: "cinematographer", l: "Cinema"   },
    { k: "production",      l: "Production"},
    { k: "critic",          l: "Critic"   },
  ];
  return (
    <div className="hud">
      <div className="hud-pill" title="Estado del enjambre">
        <span style={{ color: "var(--text-3)" }}>SWARM</span>
        {items.map((it) => {
          const s = nodeStatus?.[it.k] || "idle";
          const cls = s === "running" ? "is-active" : s === "done" ? "is-done" : "";
          return (
            <span key={it.k} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span className={"swatch " + cls} />
              <span>{it.l}</span>
            </span>
          );
        })}
      </div>
      <div className="hud-zoom">
        <button onClick={() => onZoom(-0.1)}>−</button>
        <div className="zoom-readout mono">{Math.round(zoom * 100)}%</div>
        <button onClick={() => onZoom(0.1)}>+</button>
        <button onClick={onFit} title="Fit view">⊡</button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  const [mode, setMode] = useState("canvas");
  const [panelOpen, setPanelOpen] = useState(false);
  // Single tab state for the left menu — 'nodes' | 'clients' | 'moodboard' | 'gallery' | null
  const [activeTab, setActiveTab] = useState("nodes");

  // Creative agents (persisted in localStorage)
  const [agents, setAgents] = useState(() => {
    try { return JSON.parse(localStorage.getItem('cdp-agents')) || []; }
    catch { return []; }
  });
  useEffect(() => {
    localStorage.setItem('cdp-agents', JSON.stringify(agents));
    window.__creativeAgents = agents;
    window.__store?.put("agents", agents);
  }, [agents]);
  // Expose immediately on mount
  useEffect(() => { window.__creativeAgents = agents; }, []);

  const addAgent    = (a)  => setAgents((s) => [...s, a]);
  const editAgent   = (a)  => setAgents((s) => s.map((x) => x.id === a.id ? a : x));
  const deleteAgent = (id) => setAgents((s) => s.filter((x) => x.id !== id));

  // Theme + Tweaks
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "dark",
    "accent": "violet",
    "motion": "full",
    "density": "comfortable"
  }/*EDITMODE-END*/;
  const [theme, setTheme]     = useState(() => localStorage.getItem("cdpro-theme")   || TWEAK_DEFAULTS.theme);
  const [accent, setAccent]   = useState(() => localStorage.getItem("cdpro-accent")  || TWEAK_DEFAULTS.accent);
  const [motion, setMotion]   = useState(() => localStorage.getItem("cdpro-motion")  || TWEAK_DEFAULTS.motion);
  const [density, setDensity] = useState(() => localStorage.getItem("cdpro-density") || TWEAK_DEFAULTS.density);
  const [tweaksOn, setTweaksOn] = useState(false);
  useEffect(() => {
    const effective = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
      : theme;
    document.documentElement.setAttribute("data-theme", effective);
    document.documentElement.setAttribute("data-accent", accent);
    document.documentElement.setAttribute("data-motion", motion);
    document.documentElement.setAttribute("data-density", density);
    const map  = { violet: "#A78BFA", teal: "#34D399", amber: "#FBBF24", rose: "#FB7185", blue: "#7DD3FC" };
    const map2 = { violet: "#C4B5FD", teal: "#6EE7B7", amber: "#FCD34D", rose: "#FECDD3", blue: "#BAE6FD" };
    document.documentElement.style.setProperty("--accent",   map[accent]  || map.violet);
    document.documentElement.style.setProperty("--accent-2", map2[accent] || map2.violet);
    localStorage.setItem("cdpro-theme",   theme);
    localStorage.setItem("cdpro-accent",  accent);
    localStorage.setItem("cdpro-motion",  motion);
    localStorage.setItem("cdpro-density", density);
  }, [theme, accent, motion, density]);

  // Toggle html data-supermode to hide canvas residuals
  useEffect(() => {
    document.documentElement.setAttribute("data-supermode", mode === "supercomputer" ? "on" : "off");
  }, [mode]);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOn(true);
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOn(false);
    };
    window.addEventListener("message", onMsg);
    window.parent?.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);
  const setTweak = (k, v) => {
    if (k === "theme") setTheme(v);
    if (k === "accent") setAccent(v);
    window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
  };

  // Canvas pan & zoom
  const [pan, setPan] = useState({ x: 100, y: 80 });
  const [zoom, setZoom] = useState(0.85);
  useEffect(() => { window.__zoom = zoom; }, [zoom]);

  // Nodes / edges
  const [nodes, setNodes] = useState([]);
  const nodesRef = useRef([]);
  const _genTapRef = useRef(new Map()); // nodeId → timestamp última generación (anti doble-click)
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { window.__cdpSetNodes = setNodes; window.__cdpSetEdges = setEdges; window.__downloadAsset = downloadAsset; window.__proxied = proxied; }, [setNodes, setEdges]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set()); // multi-select for grouping

  const [rubberBand, setRubberBand] = useState(null); // { x1,y1,x2,y2 } in viewport px
  const toggleSelect = useCallback((id, shift) => {
    if (shift) {
      setSelectedIds((s) => {
        const next = new Set(s);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setSelectedId(null);
    } else {
      setSelectedId(id);
      setSelectedIds(new Set([id]));
    }
  }, []);
  const groupSelected = useCallback(() => {
    // Excluir nodos ya miembros de otro grupo (evita contaminacion cross-grupo)
    const alreadyGrouped = new Set(
      nodes.filter(n => n.type === 'group').flatMap(g => g.data?.members || [])
    );
    const ids = Array.from(selectedIds).filter(id => !alreadyGrouped.has(id));
    if (ids.length < 2) return;
    const members = nodes.filter((n) => ids.includes(n.id));
    if (members.length < 2) return;
    const xs = members.map((n) => n.x);
    const ys = members.map((n) => n.y);
    const ws = members.map((n) => (NODE_SIZE[n.type]?.w || 320));
    const hs = members.map((n) => (NODE_SIZE[n.type]?.h || 280));
    const minX = Math.min(...xs) - 24;
    const minY = Math.min(...ys) - 52;
    const maxX = Math.max(...xs.map((x, i) => x + ws[i])) + 24;
    const maxY = Math.max(...ys.map((y, i) => y + hs[i])) + 24;
    const groupId = "g-" + Math.random().toString(36).slice(2, 7);
    setNodes((ns) => [
      { id: groupId, type: "group", x: minX, y: minY,
        data: { name: "Grupo", w: maxX - minX, h: maxY - minY, members: ids } },
      ...ns,
    ]);
    setSelectedIds(new Set());
    setSelectedId(groupId);
    window.__notify?.({ kind: "success", icon: "▢", title: "Grupo creado",
      body: `${members.length} nodo${members.length !== 1 ? "s" : ""} agrupados — edita el título` });
  }, [selectedIds, nodes]);


  const deleteSelectedMany = useCallback(() => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    setNodes((ns) => ns.filter((n) => !ids.includes(n.id)));
    setEdges((es) => es.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)));
    setSelectedIds(new Set());
    setSelectedId(null);
  }, [selectedIds]);
  const [selectedEdgeId, setSelectedEdgeId] = useState(null);
  const deleteEdge = useCallback((id) => {
    setEdges((es) => es.filter((e) => e.id !== id));
    if (selectedEdgeId === id) setSelectedEdgeId(null);
    window.__notify?.({ kind: "info", icon: "−", title: "Conexión eliminada" });
  }, [selectedEdgeId]);

  // Keyboard: Delete/Backspace removes selected edge or node
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return;
      if (selectedEdgeId) {
        deleteEdge(selectedEdgeId);
        e.preventDefault();
      } else if (selectedId) {
        setNodes((ns) => ns.filter((n) => n.id !== selectedId));
        setEdges((es) => es.filter((ed) => ed.source !== selectedId && ed.target !== selectedId));
        setSelectedId(null);
        e.preventDefault();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedEdgeId, selectedId, deleteEdge]);

  // Running tracking
  const [runningNodes, setRunningNodes] = useState(new Set()); // node ids currently generating
  const [runningEdges, setRunningEdges] = useState(new Set()); // edge ids with animated flow
  const isProcessing = runningNodes.size > 0;

  // Gallery — compartida en Supabase (todos los usuarios ven el mismo contenido)
  const [gallery, setGallery] = useState([]);
  const _galleryApi = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "http://localhost:3003";

  // Cargar galería compartida al arrancar + migrar items antiguos de localStorage
  useEffect(() => {
    const api = _galleryApi;
    fetch(api + "/gallery")
      .then(r => r.json())
      .then(d => {
        const remoteItems = d.items || [];
        // Migrar items de localStorage que no estén ya en Supabase
        let localItems = [];
        try {
          const saved = localStorage.getItem("cliender-gallery");
          if (saved) localItems = JSON.parse(saved).filter(Boolean);
        } catch {}
        const remoteIds = new Set(remoteItems.map(x => x.id));
        const toMigrate = localItems.filter(x => x && x.id && !remoteIds.has(x.id));
        if (toMigrate.length > 0) {
          // Subir items locales a Supabase en background
          const userEmail = localStorage.getItem("cdpro-user-email") || "";
          toMigrate.forEach(item => {
            fetch(api + "/gallery/add", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...item, addedBy: userEmail }),
            }).catch(() => {});
          });
          setGallery([...toMigrate, ...remoteItems]);
          window.__notify?.({ kind: "success", icon: "◈", title: toMigrate.length + " imágenes recuperadas", body: "Tus creaciones anteriores se han sincronizado con el equipo." });
        } else {
          setGallery(remoteItems);
        }
      })
      .catch(() => {
        // Si falla Supabase, cargar desde localStorage como fallback
        try {
          const saved = localStorage.getItem("cliender-gallery");
          if (saved) setGallery(JSON.parse(saved));
        } catch {}
      });
  }, []);

  // Guardar item en Supabase cuando se añade a la galería
  const addToSharedGallery = useCallback((item) => {
    const userEmail = localStorage.getItem("cdpro-user-email") || "";
    const enriched = { ...item, addedBy: userEmail };
    setGallery(g => [enriched, ...g.filter(x => x.id !== enriched.id)]);
    fetch(_galleryApi + "/gallery/add", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(enriched),
    }).catch(() => {});
  }, [_galleryApi]);

  // Eliminar item de la galería compartida
  const removeFromSharedGallery = useCallback((itemId) => {
    setGallery(g => g.filter(x => x.id !== itemId));
    fetch(_galleryApi + "/gallery/item/" + itemId, { method: "DELETE" }).catch(() => {});
  }, [_galleryApi]);

  // Clients
  const [clients, setClients] = useState(() => window.SAMPLE_CLIENTS || []);
  const [activeClientId, setActiveClientId] = useState(() => { try { return localStorage.getItem('cdp-ctx-client') || null; } catch { return null; } });
  const [activeMoodboardId, setActiveMoodboardId] = useState(() => { try { return localStorage.getItem('cdp-ctx-mb') || null; } catch { return null; } });
  // activeClient y activeMoodboard se derivan abajo, después de moodboards (useReducer)
  // (ver líneas tras moodboards)
  const setCtxClient = (id) => { setActiveClientId(id); try { id ? localStorage.setItem('cdp-ctx-client', id) : localStorage.removeItem('cdp-ctx-client'); } catch {} };
  const setCtxMoodboard = (id) => { setActiveMoodboardId(id); try { id ? localStorage.setItem('cdp-ctx-mb', id) : localStorage.removeItem('cdp-ctx-mb'); } catch {} };
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("cliender-profile");
      const parsed = saved ? JSON.parse(saved) : null;
      // Siempre sincronizar email e iniciales desde la sesión Supabase activa
      const sbEmail = localStorage.getItem("cdpro-user-email") || "";
      const sbInitials = sbEmail ? sbEmail.charAt(0).toUpperCase() : "?";
      if (parsed) {
        // Migración: si no tiene avatar, asignar avatar-1 por defecto
        const withAvatar = { ...parsed, email: sbEmail || parsed.email, initials: sbInitials || parsed.initials };
        if (!withAvatar.avatarPhoto) withAvatar.avatarPhoto = "prototype/assets/avatars/avatar-1.png";
        return withAvatar;
      }
      return {
        name: sbEmail ? sbEmail.split("@")[0] : "Usuario",
        email: sbEmail || "",
        role: "Creative Director",
        bio: "Diseñando flujos creativos con ClienderDesign.",
        avatarColor: "violet",
        avatarPhoto: null,
        initials: sbInitials,
      };
    } catch {
      return { name: "Usuario", email: "", role: "Creative Director", bio: "", avatarColor: "violet", avatarPhoto: "prototype/assets/avatars/avatar-1.png", initials: "U" };
    }
  });
  useEffect(() => {
    try { localStorage.setItem("cliender-profile", JSON.stringify(profile)); } catch {}
  }, [profile]);
  const onCreateClient = useCallback((client) => {
    setClients((c) => [client, ...c]);
    setActiveClientId(client.id);
    window.__notify?.({ kind: "success", icon: "+", title: "Cliente conectado", body: `${client.name} · contexto sincronizado con Claude` });
  }, []);

  // Projects
  const [projects, setProjects] = useState(() => {
    try {
      const saved = localStorage.getItem("cliender-projects");
      if (saved) {
        // Eliminar proyectos demo hardcodeados que pudieran haberse guardado antes
        const parsed = JSON.parse(saved).filter(p => p.id !== "p-demo");
        return parsed;
      }
    } catch {}
    return []; // Sin proyectos demo — solo los reales que cree el usuario
  });
  const [activeProjectId, setActiveProjectId] = useState(null);
  useEffect(() => {
    try { localStorage.setItem("cliender-projects", JSON.stringify(projects)); } catch {}
    window.__store?.put("projects", projects);
  }, [projects]);
  const onCreateProject = useCallback(async (nameArg) => {
    const name = nameArg || await window.__askInput("Nombre del proyecto", "", { placeholder: "Mi proyecto", confirmText: "Crear" });
    if (!name?.trim()) return;
    const p = {
      id: "p-" + Math.random().toString(36).slice(2, 8),
      name: name.trim(),
      clientId: activeClientId || clients[0]?.id || null,
      nodes: [], edges: [],
      thumbs: ["#A78BFA","#7DD3FC","#34D399"],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects((ps) => [p, ...ps]);
    setActiveProjectId(p.id);
    setNodes([]);
    setEdges([]);
    setActiveTab(null);
    window.__notify?.({ kind: "success", icon: "🗂", title: "Nuevo proyecto", body: p.name + " · canvas listo" });
  }, [activeClientId, clients]);
  const onDeleteProject = useCallback(async (p) => {
    if (!(await window.__confirm(`¿Eliminar "${p.name}"?`, { danger: true }))) return;
    setProjects((ps) => ps.filter((x) => x.id !== p.id));
    if (activeProjectId === p.id) setActiveProjectId(null);
  }, [activeProjectId]);
  const onOpenProject = useCallback((p) => {
    setActiveProjectId(p.id);
    if (p.nodes?.length) setNodes(p.nodes);
    if (p.edges?.length) setEdges(p.edges);
    setActiveTab(null);
    window.__notify?.({ icon: "📂", title: "Proyecto abierto", body: p.name });
  }, []);

  // Auto-save current canvas to active project
  useEffect(() => {
    if (!activeProjectId) return;
    const t = setTimeout(() => {
      setProjects((ps) => ps.map((p) =>
        p.id === activeProjectId
          ? { ...p, nodes, edges, updatedAt: Date.now() }
          : p
      ));
    }, 800);
    return () => clearTimeout(t);
  }, [nodes, edges, activeProjectId]);

  // Flow Templates — independientes del sistema de proyectos
  const [flowTemplates, setFlowTemplates] = React.useState(() => {
    try { const s = localStorage.getItem("cliender-flow-templates"); if (s) return JSON.parse(s); } catch {}
    return [];
  });
  React.useEffect(() => {
    try { localStorage.setItem("cliender-flow-templates", JSON.stringify(flowTemplates)); } catch {}
    window.__store?.put("flow-templates", flowTemplates);
  }, [flowTemplates]);
  // Cross-user sync de agents/projects/flow-templates/clients:
  // hidrata al montar + polling 30s + merge por id (último updatedAt gana).
  // Esto resuelve "lo que hace un usuario no le sale a otros".
  useEffect(() => {
    if (!window.__store) return;
    const apply = (setter) => (remote) => {
      setter((prev) => {
        const merged = window.__store.mergeById(prev, remote);
        try {
          if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
        } catch (e) { /* ignore */ }
        return merged;
      });
    };
    window.__store.poll("agents", apply(setAgents));
    window.__store.poll("projects", apply(setProjects));
    window.__store.poll("flow-templates", apply(setFlowTemplates));
    window.__store.poll("clients", apply(setClients));
    return () => {
      window.__store.stopPoll("agents");
      window.__store.stopPoll("projects");
      window.__store.stopPoll("flow-templates");
      window.__store.stopPoll("clients");
    };
  }, []);
  const [saveModalOpen, setSaveModalOpen] = React.useState(false);
  const [templatesOpen, setTemplatesOpen] = React.useState(false);

  const saveFlow = React.useCallback((name, desc) => {
    const trimmedName = name.trim() || "Flujo sin nombre";
    const tpl = {
      id: "tpl-" + Math.random().toString(36).slice(2, 9),
      name: trimmedName,
      description: desc?.trim() || "",
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      pan: { ...pan }, zoom,
      nodeCount: nodes.filter(n => n.type !== "group").length,
      edgeCount: edges.length,
      clientId: activeClientId || null,
      moodboardId: activeMoodboardId || null,
      createdAt: Date.now(),
    };
    setFlowTemplates(ts => [tpl, ...ts]);
    // También guardar como Proyecto del cliente activo
    const p = {
      id: "p-" + Math.random().toString(36).slice(2, 8),
      name: trimmedName,
      description: desc?.trim() || "",
      clientId: activeClientId || clients[0]?.id || null,
      moodboardId: activeMoodboardId || null,
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
      thumbs: [
        activeClient?.palette?.[0] || "#A78BFA",
        activeClient?.palette?.[1] || "#7DD3FC",
        activeClient?.palette?.[2] || "#34D399",
      ],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setProjects(ps => [p, ...ps]);
    setActiveProjectId(p.id);
    setSaveModalOpen(false);
    window.__notify?.({ kind: "success", icon: "💾", title: "Plantilla guardada", body: trimmedName + " · proyecto creado" + (activeClient ? " para " + activeClient.name : "") });
  }, [nodes, edges, pan, zoom, activeClientId, activeMoodboardId, activeClient, clients]);

  const loadFlow = React.useCallback((tpl) => {
    setNodes(JSON.parse(JSON.stringify(tpl.nodes)));
    setEdges(JSON.parse(JSON.stringify(tpl.edges)));
    if (tpl.pan) setPan(tpl.pan);
    if (tpl.zoom) setZoom(tpl.zoom);
    setTemplatesOpen(false);
    setSelectedId(null);
    setSelectedIds(new Set());
    window.__notify?.({ kind: "info", icon: "📂", title: "Flujo cargado", body: tpl.name });
  }, []);

  const deleteTemplate = React.useCallback((id) => {
    setFlowTemplates(ts => ts.filter(t => t.id !== id));
    window.__notify?.({ kind: "info", icon: "✕", title: "Plantilla eliminada" });
  }, []);

  // Style Vault
  const _initialMoodboards = (() => {
    try {
      const raw = localStorage.getItem('cdp-moodboards-v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length) return parsed;
      }
    } catch (e) { console.warn('[moodboards] localStorage parse failed', e); }
    return [];
  })();
  const _moodboardReducer = moodboardReducer || window.moodboardReducer || ((s) => s);
  const [moodboards, dispatchMoodboards] = useReducer(_moodboardReducer, _initialMoodboards);
  // Persistencia moodboards: localStorage (cache local) + cross-user vía /moodboards/{id}.
  // El upsert es debounced por id en __moodboards (800ms), y solo se dispara si la
  // firma del mb cambió desde la última vez (no re-envia lo que ya estaba sincronizado).
  const prevMbSigsRef = React.useRef(new Map());
  const _mbSig = (mb) => {
    if (!mb) return '';
    try {
      const clone = Object.assign({}, mb);
      delete clone.updatedAt;
      return JSON.stringify(clone);
    } catch (e) { return ''; }
  };
  React.useEffect(() => {
    try {
      const payload = JSON.stringify(moodboards);
      if (payload.length > 4_500_000) {
        console.warn('[moodboards] localStorage payload ~' + Math.round(payload.length/1024) + 'KB, cerca del límite. Considerar URLs externas.');
      }
      localStorage.setItem('cdp-moodboards-v1', payload);
    } catch (e) { console.warn('[moodboards] localStorage save failed', e); }

    if (!window.__moodboards) return;
    const currentSigs = new Map();
    for (const mb of (moodboards || [])) {
      const s = _mbSig(mb);
      currentSigs.set(mb.id, s);
      if (prevMbSigsRef.current.get(mb.id) !== s) {
        window.__moodboards.upsert(mb);
      }
    }
    for (const id of prevMbSigsRef.current.keys()) {
      if (!currentSigs.has(id)) window.__moodboards.remove(id);
    }
    prevMbSigsRef.current = currentSigs;
  }, [moodboards]);
  const lockedMb = (moodboards || []).find((m) => m.locked);
  // Cross-user moodboards: polling cada 30s. Merge por updatedAt para no pisar
  // ediciones locales recién hechas que aún no se han subido.
  const moodboardsRef = React.useRef(moodboards);
  React.useEffect(() => { moodboardsRef.current = moodboards; }, [moodboards]);
  useEffect(() => {
    if (!window.__moodboards) return;
    window.__moodboards.poll((remote) => {
      if (!Array.isArray(remote)) return;
      const local = moodboardsRef.current || [];
      const localById = new Map(local.map(m => [m.id, m]));
      const merged = [];
      // Estrategia: si el contenido coincide (sig sin updatedAt) → quedarse con local.
      // Si difiere, gana el de updatedAt mayor. Si ninguno tiene timestamp, gana LOCAL
      // (asumimos que es una edición en vuelo que todavía no se ha subido).
      for (const rmt of remote) {
        const loc = localById.get(rmt.id);
        if (!loc) { merged.push(rmt); continue; }
        if (_mbSig(rmt) === _mbSig(loc)) { merged.push(loc); continue; }
        const tr = Number(rmt.updatedAt || 0);
        const tl = Number(loc.updatedAt || 0);
        if (tr === 0 && tl === 0) { merged.push(loc); continue; }
        merged.push(tr >= tl ? rmt : loc);
      }
      // Locales que el server aún no tiene (debounce en vuelo)
      for (const [id, loc] of localById) {
        if (!remote.find(r => r.id === id)) merged.push(loc);
      }
      // Evitar dispatch si nada cambió (evita render-loop con el save effect)
      try {
        if (JSON.stringify(merged) === JSON.stringify(local)) return;
      } catch (e) { /* ignore */ }
      // Actualizar sigs ANTES del dispatch para que el save effect no re-PUTee.
      const sigs = new Map();
      for (const mb of merged) sigs.set(mb.id, _mbSig(mb));
      prevMbSigsRef.current = sigs;
      dispatchMoodboards({ type: "REPLACE", value: merged });
    });
    return () => window.__moodboards.stopPoll();
  }, []);
  // Guardar clients compartidos al cambiar (antes no se persistían ni en localStorage).
  useEffect(() => { window.__store?.put("clients", clients); }, [clients]);
  // Contexto activo — derivado aquí donde ya existen clients y moodboards
  const activeClient = clients.find((c) => c.id === activeClientId) || null;
  const activeMoodboard = (moodboards || []).find((m) => m.id === activeMoodboardId) || null;

  // Supercomputer state
  const [prompt, setPrompt] = useState("");
  const [logs, setLogs] = useState([]);
  const [lastLogAt, setLastLogAt] = useState(0);
  const [nodeStatus, setNodeStatus] = useState({
    master_director: "idle", scriptwriter: "idle", cinematographer: "idle",
    production: "idle", critic: "idle",
  });
  const [swarmArtifact, setSwarmArtifact] = useState(null);

  // --- node ops -----------------------------------------------------------
  const addNode = useCallback((type) => {
    const id = `n-${type}-${Math.random().toString(36).slice(2, 6)}`;
    // posición: centro del viewport actual
    const vx = window.innerWidth / 2;
    const vy = window.innerHeight / 2;
    const worldX = (vx - pan.x) / zoom - (NODE_SIZE[type].w / 2);
    const worldY = (vy - pan.y) / zoom - 60;
    // jitter para que no se apilen
    const jitter = (Math.random() - 0.5) * 60;
    setNodes((ns) => [...ns, {
      id, type,
      x: Math.max(20, worldX + jitter),
      y: Math.max(20, worldY + jitter),
      data: NODE_DEFAULTS[type](),
    }]);
    setSelectedId(id);
    const _typeLabel = { prompt: "Prompt", image: "Imagen", video: "Video", voice: "Voz", note: "Nota", imageref: "Referencia" }[type] || type;
    window.__notify?.({
      kind: "info",
      icon: "+",
      title: `Nodo ${_typeLabel} añadido`,
      body: "Click en el handle para conectarlo.",
    });
  }, [pan, zoom]);

  const removeNode = useCallback((id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  // Captura posiciones iniciales del grupo al empezar drag
  const groupInitRef = useRef({});
  const onGroupDragStart = useCallback((groupId) => {
    // Lee desde ref (síncrono) — evita race con setNodes async
    const ns = nodesRef.current;
    const group = ns.find((n) => n.id === groupId);
    if (!group) return;
    const memberPositions = {};
    (group.data?.members || []).forEach((mid) => {
      const m = ns.find((n) => n.id === mid);
      if (m) memberPositions[mid] = { x: m.x, y: m.y };
    });
    groupInitRef.current[groupId] = { gx: group.x, gy: group.y, members: memberPositions };
  }, []);

  const dragNode = useCallback((id, x, y) => {
    setNodes((ns) => {
      const node = ns.find((n) => n.id === id);
      if (!node) return ns;
      if (node.type !== "group") return ns.map((n) => n.id === id ? { ...n, x, y } : n);
      const init = groupInitRef.current[id];
      if (!init) return ns.map((n) => n.id === id ? { ...n, x, y } : n);
      const dx = x - init.gx;
      const dy = y - init.gy;
      return ns.map((n) => {
        if (n.id === id) return { ...n, x, y };
        const ip = init.members[n.id];
        if (ip) return { ...n, x: ip.x + dx, y: ip.y + dy };
        return n;
      });
    });
  }, []);

  const patchNodeData = useCallback((id, patch) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, []);

  // --- connector drag -----------------------------------------------------
  const [draggingEdge, setDraggingEdge] = useState(null);
  const [connectMenu, setConnectMenu]   = useState(null); // {sourceId, x, y, worldX, worldY}
  const [contextMenu, setContextMenu] = useState(null); // {x, y, worldX, worldY, nodeId|null}
  const [newEdgeIds, setNewEdgeIds]     = useState(new Set()); // pulse on create
  const draggingEdgeRef = useRef(null);
  draggingEdgeRef.current = draggingEdge;
  const viewportRef = useRef(null);

  // helper para registrar un nuevo edge con su pulso de "conexión recién creada"
  const pulseEdge = useCallback((edgeId) => {
    setNewEdgeIds((s) => new Set([...s, edgeId]));
    setTimeout(() => {
      setNewEdgeIds((s) => { const n = new Set(s); n.delete(edgeId); return n; });
    }, 1400);
  }, []);

  // expose to handle children
  useEffect(() => {
    window.__handleMouseDown = (e, nodeId, side) => {
      e.preventDefault();
      e.stopPropagation();
      const sourceNode = nodes.find((n) => n.id === nodeId);
      if (!sourceNode) return;
      // Sólo permitimos arrastrar desde un OUTPUT (right). Si es left, abortamos.
      if (side !== "right") {
        return;
      }
      const port = nodePortPos(sourceNode, "right");
      // world coordinates
      const onMove = (ev) => {
        const rect = viewportRef.current.getBoundingClientRect();
        const wx = (ev.clientX - rect.left - pan.x) / zoom;
        const wy = (ev.clientY - rect.top  - pan.y) / zoom;
        setDraggingEdge({
          sourceId: nodeId,
          sx: port.x, sy: port.y,
          cx: wx, cy: wy,
        });
      };
      const onUp = (ev) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.classList.remove("is-connecting");
        const current = draggingEdgeRef.current;
        setDraggingEdge(null);
        // 1. ¿Cayó sobre un handle de input (left) de otro nodo?
        const tgt = document.elementFromPoint(ev.clientX, ev.clientY);
        if (tgt && tgt.classList.contains("nh") && tgt.dataset.side === "left") {
          const targetId = tgt.dataset.nodeId;
          if (targetId && targetId !== nodeId) {
            setEdges((es) => {
              if (es.find((e) => e.source === nodeId && e.target === targetId)) return es;
              const newId = "e-" + Math.random().toString(36).slice(2, 7);
              pulseEdge(newId);
              window.__notify?.({
                kind: "success",
                icon: "→",
                title: "Conexión creada",
                body: "Flujo activo entre nodos.",
              });
              return [...es, { id: newId, source: nodeId, target: targetId }];
            });
            return;
          }
        }
        // 2. Cayó en vacío → abrimos el menú flotante "Conectar a…"
        //    Sólo si arrastró una distancia mínima para evitar accidentes
        const rect = viewportRef.current.getBoundingClientRect();
        const dragDist = Math.hypot(
          ev.clientX - (rect.left + port.x * zoom + pan.x),
          ev.clientY - (rect.top  + port.y * zoom + pan.y),
        );
        if (dragDist > 30) {
          const wx = (ev.clientX - rect.left - pan.x) / zoom;
          const wy = (ev.clientY - rect.top  - pan.y) / zoom;
          setConnectMenu({
            sourceId: nodeId,
            x: ev.clientX,
            y: ev.clientY,
            worldX: wx,
            worldY: wy,
          });
        }
      };
      document.body.classList.add("is-connecting");
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };
    window.__handleMouseUp = () => {};
    return () => { window.__handleMouseDown = null; };
  }, [nodes, pan, zoom, pulseEdge]);

  // Cierra el menú con Esc / click en backdrop
  useEffect(() => {
    if (!connectMenu) return;
    const onKey = (e) => { if (e.key === "Escape") setConnectMenu(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [connectMenu]);

  // Crear nodo conectado desde el menú flotante
  const addConnectedNode = useCallback((type) => {
    if (!connectMenu) return;
    const id = `n-${type}-${Math.random().toString(36).slice(2, 6)}`;
    const x = Math.max(20, connectMenu.worldX - 10);
    const y = Math.max(20, connectMenu.worldY - 40);
    const newEdgeId = "e-" + Math.random().toString(36).slice(2, 7);
    // Crear nodo + edge en el mismo tick para que ambos aparezcan juntos
    setNodes((ns) => [...ns, { id, type, x, y, data: NODE_DEFAULTS[type]() }]);
    setEdges((es) => [...es, { id: newEdgeId, source: connectMenu.sourceId, target: id }]);
    pulseEdge(newEdgeId);
    setSelectedId(id);
    setConnectMenu(null);
    window.__notify?.({
      kind: "success",
      icon: "+",
      title: "Nodo creado y conectado",
      body: `Output → ${type}`,
    });
  }, [connectMenu, pulseEdge]);

  // --- Context menu handler (click derecho canvas / nodo) -----------------
  const onContextPick = useCallback((action, menu) => {
    if (!menu) { setContextMenu(null); return; }
    const { nodeId, worldX, worldY } = menu;
    if (action.startsWith("add-")) {
      const type = action.slice(4); // 'prompt' | 'image' | 'video' | 'note'
      const id = `n-${type}-${Math.random().toString(36).slice(2, 6)}`;
      const x = Math.max(20, worldX - (NODE_SIZE[type]?.w || 320) / 2);
      const y = Math.max(20, worldY - 40);
      setNodes((ns) => [...ns, { id, type, x, y, data: NODE_DEFAULTS[type]() }]);
      setSelectedId(id);
      window.__notify?.({ kind: "info", icon: "+", title: `Nodo ${type} creado` });
    } else if (action === "duplicate" && nodeId) {
      const src = nodesRef.current.find((n) => n.id === nodeId);
      if (src) {
        const newId = `n-${src.type}-${Math.random().toString(36).slice(2, 6)}`;
        setNodes((ns) => [...ns, { ...src, id: newId, x: src.x + 40, y: src.y + 40, data: JSON.parse(JSON.stringify(src.data)) }]);
        setSelectedId(newId);
        window.__notify?.({ kind: "info", icon: "⧉", title: "Nodo duplicado" });
      }
    } else if (action === "disconnect" && nodeId) {
      setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
      window.__notify?.({ kind: "info", icon: "✂", title: "Conexiones eliminadas" });
    } else if (action === "delete" && nodeId) {
      setNodes((ns) => ns.filter((n) => n.id !== nodeId));
      setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId));
      if (selectedId === nodeId) setSelectedId(null);
      window.__notify?.({ kind: "info", icon: "✕", title: "Nodo eliminado" });
    }
    setContextMenu(null);
  }, [selectedId]);


  // --- pan ---------------------------------------------------------------
  const panRef = useRef(null);
  const onViewportMouseDown = (e) => {
    if (e.target.closest(".node-wrap")) return;
    if (e.target.closest(".nh")) return;
    setSelectedId(null);
    setSelectedEdgeId(null);

    if (e.shiftKey && e.button === 0) {
      // Rubber-band selection: shift + drag izquierdo en canvas vacío
      e.preventDefault();
      const vRect = viewportRef.current.getBoundingClientRect();
      const capPan = { x: pan.x, y: pan.y };
      const capZoom = zoom;
      const x0 = e.clientX - vRect.left;
      const y0 = e.clientY - vRect.top;
      setRubberBand({ x1: x0, y1: y0, x2: x0, y2: y0 });
      const onMove = (ev) => {
        setRubberBand({ x1: x0, y1: y0, x2: ev.clientX - vRect.left, y2: ev.clientY - vRect.top });
      };
      const onUp = (ev) => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        setRubberBand(null);
        const ex = ev.clientX - vRect.left;
        const ey = ev.clientY - vRect.top;
        const wx1 = (Math.min(x0, ex) - capPan.x) / capZoom;
        const wy1 = (Math.min(y0, ey) - capPan.y) / capZoom;
        const wx2 = (Math.max(x0, ex) - capPan.x) / capZoom;
        const wy2 = (Math.max(y0, ey) - capPan.y) / capZoom;
        if (wx2 - wx1 < 30 || wy2 - wy1 < 30) return;
        const _alreadyGrouped = new Set(
          nodes.filter(n => n.type === 'group').flatMap(g => g.data?.members || [])
        );
        const inside = nodes.filter((n) => {
          if (n.type === "group") return false;
          if (_alreadyGrouped.has(n.id)) return false;
          const nw = NODE_SIZE[n.type]?.w || 320;
          const nh = NODE_SIZE[n.type]?.h || 280;
          return n.x < wx2 && n.x + nw > wx1 && n.y < wy2 && n.y + nh > wy1;
        });
        if (inside.length < 2) return;
        const groupId = "g-" + Math.random().toString(36).slice(2, 7);
        setNodes((ns) => [
          { id: groupId, type: "group", x: wx1 - 24, y: wy1 - 52,
            data: { name: "Grupo", w: (wx2 - wx1) + 48, h: (wy2 - wy1) + 76, members: inside.map((n) => n.id) } },
          ...ns,
        ]);
        setSelectedId(groupId);
        window.__notify?.({ kind: "success", icon: "▢", title: "Grupo creado",
          body: `${inside.length} nodo${inside.length !== 1 ? "s" : ""} agrupados — edita el título` });
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      return;
    }

    panRef.current = { sx: e.clientX, sy: e.clientY, origin: { ...pan } };
    viewportRef.current?.classList.add("is-panning");
    const onMove = (ev) => {
      setPan({
        x: panRef.current.origin.x + (ev.clientX - panRef.current.sx),
        y: panRef.current.origin.y + (ev.clientY - panRef.current.sy),
      });
    };
    const onUp = () => {
      viewportRef.current?.classList.remove("is-panning");
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  // Resize del GroupNode desde las esquinas
  const onResizeCorner = useCallback((e, groupId, corner) => {
    e.preventDefault();
    e.stopPropagation();
    const group = nodes.find((n) => n.id === groupId);
    if (!group) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = group.data.w || 600;
    const startH = group.data.h || 400;
    const startNx = group.x;
    const startNy = group.y;
    const onMove = (ev) => {
      const dx = (ev.clientX - startX) / zoom;
      const dy = (ev.clientY - startY) / zoom;
      let newW = startW, newH = startH, newX = startNx, newY = startNy;
      if (corner.includes("e")) newW = Math.max(200, startW + dx);
      if (corner.includes("s")) newH = Math.max(120, startH + dy);
      if (corner.includes("w")) { newW = Math.max(200, startW - dx); newX = startNx + (startW - newW); }
      if (corner.includes("n")) { newH = Math.max(120, startH - dy); newY = startNy + (startH - newH); }
      setNodes((ns) => ns.map((n) => n.id === groupId
        ? { ...n, x: newX, y: newY, data: { ...n.data, w: newW, h: newH } }
        : n
      ));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [nodes, zoom]);

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Zoom hacia el cursor: el punto bajo el cursor permanece fijo
      const vRect = viewportRef.current?.getBoundingClientRect();
      if (vRect) {
        const cursorX = e.clientX - vRect.left;
        const cursorY = e.clientY - vRect.top;
        const delta = e.deltaY < 0 ? 0.06 : -0.06;
        // Calcula nz y el pan DENTRO del updater de setZoom con el z REAL (no el closure
        // stale `zoom`, que provocaba que el viewport saltase al hacer zoom).
        setZoom((z) => {
          const nz = Math.max(0.4, Math.min(1.5, z + delta));
          if (nz !== z) {
            setPan((p) => ({
              x: cursorX - (cursorX - p.x) * (nz / z),
              y: cursorY - (cursorY - p.y) * (nz / z),
            }));
          }
          return nz;
        });
      } else {
        setZoom((z) => Math.max(0.4, Math.min(1.5, z + (e.deltaY < 0 ? 0.06 : -0.06))));
      }
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      setPan((p) => ({ x: p.x - delta, y: p.y }));
      return;
    }
    // Scroll normal (sin modificador) → pan vertical
    e.preventDefault();
    setPan((p) => ({ x: p.x - (e.deltaX || 0), y: p.y - e.deltaY }));
  };
  const onZoomDelta = (d) => setZoom((z) => Math.max(0.4, Math.min(1.5, z + d)));
  const onFitView = () => { setZoom(0.85); setPan({ x: 80, y: 70 }); };

  // Wheel no-pasivo: necesario para que preventDefault() funcione en React 17+
  // Sin esto, scroll vertical no panalea el canvas
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const handler = (e) => onWheel(e);
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [onWheel]);

  // --- generation ---------------------------------------------------------
  const findUpstreamPrompt = useCallback((nodeId) => {
    // Busca un Prompt Node conectado upstream
    const incoming = edges.filter((e) => e.target === nodeId);
    for (const e of incoming) {
      const src = nodes.find((n) => n.id === e.source);
      if (src?.type === "prompt") return { node: src, edgeId: e.id };
    }
    return null;
  }, [edges, nodes]);

  // Helper: extrae URL de imagen de un nodo. image/video → data.lastUrl; output (resultado) → primer item imagen de data.items
  const _imageUrlFromNode = (n) => {
    if (!n) return null;
    if (n.type === "output") {
      const items = n.data?.items || [];
      const img = items.find((it) => it && it.url && (it.kind === "image" || String(it.url).startsWith("data:image") || /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(it.url)));
      return img?.url || null;
    }
    return n.data?.lastUrl || null;
  };

  // Helper: extrae el prompt con que se generó la imagen de un nodo (para detectar storyboards).
  const _promptFromNode = (n) => {
    if (!n) return "";
    if (n.type === "output") {
      const items = n.data?.items || [];
      const img = items.find((it) => it && it.url && (it.kind === "image" || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(it.url)));
      return String(img?.prompt || n.data?.prompt || "");
    }
    return String(n.data?.prompt || n.data?.lastPrompt || "");
  };
  // Un storyboard es una CUADRÍCULA de paneles → para vídeo va como reference_image (guía de
  // escenas), NUNCA como first_frame (Seedance animaría el grid literal). Un único vídeo recorre
  // las escenas guiado por el prompt multi-escena de SHAQ.
  const _isStoryboardImage = (n) => {
    const p = _promptFromNode(n).toLowerCase();
    if (!p) return false;
    return /storyboard|\bpanel(es)?\b|\bgrid of\b|\d+\s*x\s*\d+\s*grid|numbered panels/.test(p);
  };

  // Busca un ImageNode O un OutputNode (resultado) con imagen, conectado upstream → first_frame_url del VideoNode
  const findUpstreamImage = useCallback((nodeId) => {
    const incoming = edges.filter((e) => e.target === nodeId);
    for (const e of incoming) {
      const src = nodes.find((n) => n.id === e.source);
      if (src?.type === "image") return { node: src, edgeId: e.id };
      if (src?.type === "output" && _imageUrlFromNode(src)) return { node: src, edgeId: e.id };
      // Traversa a través de un PromptNode intermedio: Output/Image → Prompt → (este nodo Video)
      if (src?.type === "prompt") {
        const inner = edges.filter((e2) => e2.target === src.id);
        for (const e2 of inner) {
          const src2 = nodes.find((n) => n.id === e2.source);
          if (src2?.type === "image") return { node: src2, edgeId: e2.id };
          if (src2?.type === "output" && _imageUrlFromNode(src2)) return { node: src2, edgeId: e2.id };
        }
      }
    }
    return null;
  }, [edges, nodes]);

  // Busca un ReferenceNode upstream (fotos de personaje → reference_image_urls)
  const findUpstreamReference = useCallback((nodeId) => {
    const _isRef = (n) => n?.type === "reference" || n?.type === "imageref";
    const incoming = edges.filter((e) => e.target === nodeId);
    for (const e of incoming) {
      const src = nodes.find((n) => n.id === e.source);
      if (_isRef(src)) return { node: src, edgeId: e.id };
      // Buscar también a través de PromptNode intermedio
      if (src?.type === "prompt") {
        const inner = edges.filter((e2) => e2.target === src.id);
        for (const e2 of inner) {
          const src2 = nodes.find((n) => n.id === e2.source);
          if (_isRef(src2)) return { node: src2, edgeId: e2.id };
        }
      }
    }
    return null;
  }, [edges, nodes]);

  // Busca un VoiceNode conectado upstream (para pasar voice_prompt al VideoNode)
  const findUpstreamVoice = useCallback((nodeId) => {
    const incoming = edges.filter((e) => e.target === nodeId);
    for (const e of incoming) {
      const src = nodes.find((n) => n.id === e.source);
      if (src?.type === "voice") return { node: src, edgeId: e.id };
    }
    return null;
  }, [edges, nodes]);

  const incomingPromptIds = useMemo(() => {
    const map = {};
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      if (src?.type === "prompt" || src?.type === "voice") map[e.target] = e.id;
    });
    return map;
  }, [edges, nodes]);

  // Mapa nodeId → url upstream (image/video con lastUrl) para mostrar como referencia visual
  const incomingMediaUrls = useMemo(() => {
    const map = {};
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      if (!src) return;
      if ((src.type === "image" || src.type === "video") && src.data?.lastUrl) {
        // Prioriza image sobre video para first_frame: si ya había image guardada, no sobrescribir con video.
        const _existing = map[e.target];
        if (_existing && _existing.kind === "image" && src.type === "video") return;
        map[e.target] = { url: src.data.lastUrl, kind: src.type, sourceId: src.id, isStoryboard: _isStoryboardImage(src) };
      }
      // Nodo de resultado (output) con imagen → referencia visual + first_frame para VideoNode
      else if (src.type === "output") {
        const _u = _imageUrlFromNode(src);
        if (_u) {
          const _existing = map[e.target];
          if (!(_existing && _existing.kind === "image")) map[e.target] = { url: _u, kind: "image", sourceId: src.id, isStoryboard: _isStoryboardImage(src) };
        }
      }
      // Caso adicional: image/video upstream SIN lastUrl (no ejecutado aún) — marca placeholder para UI.
      else if ((src.type === "image" || src.type === "video")) {
        const _existing = map[e.target];
        if (!_existing) {
          map[e.target] = { url: null, kind: src.type, sourceId: src.id, pending: true };
        }
      }
    });
    return map;
  }, [edges, nodes]);

  // Mapa nodeId → fotos http de nodos imageref upstream (para mostrar en ImageNode/VideoNode)
  const incomingRefImages = useMemo(() => {
    const map = {};
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      if (!src) return;
      if (src.type === "imageref" && src.data?.images?.length) {
        const httpImgs = src.data.images.filter((u) => typeof u === "string" && u.startsWith("http"));
        if (httpImgs.length) {
          if (!map[e.target]) map[e.target] = [];
          map[e.target].push(...httpImgs);
        }
      }
    });
    return map;
  }, [edges, nodes]);

  // Mapa nodeId → info del PromptNode o VoiceNode upstream para mostrar en ImageNode/VideoNode
  const incomingPromptInfo = useMemo(() => {
    const map = {};
    const agentList = window.__creativeAgents || [];
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      if (!src) return;
      if (src.type === "prompt") {
        const d = src.data || {};
        const agentObj = agentList.find((a) => a.id === d.agentId);
        map[e.target] = {
          edgeId: e.id,
          sourceId: src.id,
          kind: "prompt",
          agentId: d.agentId || null,
          agentName: agentObj?.name || (d.agentId ? d.agentId : null),
          agentRole: agentObj?.role || null,
          brief: (d.brief || "").trim(),
          refined: (d.agentOutput || d._refinedBrief || "").trim(),
          hasRefined: !!(d.agentOutput || d._refinedBrief),
          status: d.status || "idle",
        };
      } else if (src.type === "voice") {
        const d = src.data || {};
        map[e.target] = {
          edgeId: e.id,
          sourceId: src.id,
          kind: "voice",
          agentId: null,
          agentName: "Voz",
          agentRole: "narración",
          brief: (d.script || "").trim(),
          refined: (d.voicePrompt || "").trim(),
          hasRefined: !!(d.voicePrompt),
          voicePrompt: d.voicePrompt || null,
          tone: d.tone || "neutral",
          language: d.language || "Español",
          status: d.status || "idle",
        };
      }
    });
    return map;
  }, [edges, nodes]);


  const runNode = useCallback(async (nodeId, inheritedBrief = null, inheritedFrameUrl = null) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    // Anti doble-click: SOLO en invocación directa del usuario (sin inheritedBrief).
    // Las llamadas de cascada/batch pasan inheritedBrief → NO se bloquean (deben ejecutarse 1 a 1).
    if (!inheritedBrief) {
      const _lastTap = _genTapRef.current.get(nodeId) || 0;
      if (Date.now() - _lastTap < 1500) {
        window.__notify?.({ kind: "info", icon: "⏳", title: "Generación en curso", body: "Espera a que termine antes de volver a generar este nodo." });
        return;
      }
      _genTapRef.current.set(nodeId, Date.now());
    }
    if (node.type === "prompt") {
      let downstream = edges.filter((e) => e.source === nodeId);
      if (downstream.length === 0) {
        // Auto-crear nodo downstream según TIPO seleccionado en PromptNode
        const autoKind = node.data.kind || "image";
        const autoId = `n-${autoKind}-${Math.random().toString(36).slice(2, 7)}`;
        const srcNode = nodes.find((n) => n.id === nodeId);
        const autoX = (srcNode?.x || 0) + (NODE_SIZE["prompt"]?.w || 320) + 80;
        const autoY = srcNode?.y || 0;
        const autoEdgeId = "e-auto-" + Math.random().toString(36).slice(2, 7);
        const newEdge = { id: autoEdgeId, source: nodeId, target: autoId };
        setNodes((ns) => [...ns, {
          id: autoId, type: autoKind, x: autoX, y: autoY,
          data: { ...NODE_DEFAULTS[autoKind](), cantidad: node.data.cantidad || 1 },
        }]);
        setEdges((es) => [...es, newEdge]);
        pulseEdge(autoEdgeId);
        window.__notify?.({
          kind: "info", icon: "✦",
          title: `Nodo ${autoKind === "video" ? "Vídeo" : "Imagen"} creado`,
          body: "Conectado automáticamente. Ejecutando flujo…",
        });
        await new Promise(r => setTimeout(r, 120));
        downstream = [newEdge];
      }
      const rawBrief = node.data.brief?.trim();
      if (!rawBrief) {
        window.__notify?.({ kind: "error", icon: "!", title: "Falta el brief",
          body: "Escribe un brief en el Prompt Node antes de ejecutar." });
        return;
      }

      // --- Detectar modo batch: "10 imágenes", "dame 5 fotos", "3 variantes", etc. ---
      const _batchRe = /\b(\d+)\s*(?:im[áa]genes?|fotos?|posts?|publicaciones?|piezas?|v[íi]deos?|reels?|prompts?|variantes?|creativos?|opciones?)\b/i;
      const _batchMatch = rawBrief.match(_batchRe);
      const _batchCount = _batchMatch ? Math.min(parseInt(_batchMatch[1], 10), 30) : 0;
      const isBatchMode = _batchCount >= 2;

      // --- Agente creativo: refinar el brief antes de propagar ---
      const agentId = node.data.agentId;
      const agentList = window.__creativeAgents || [];
      // Si agentId es "none" o vacío → modo DIRECTO, brief pasa sin refinamiento.
      // NO hacer fallback al primer agente — respetar la elección del usuario.
      const agentObj = (agentId && agentId !== "none")
        ? (agentList.find((a) => a.id === agentId) || null)
        : null;
      let finalBrief = rawBrief;
      let _agentFailedLocal = false;  // bandera SINCRONA: el estado React es async, no fiable para el guard de abajo

      // Contexto de cliente (se envía siempre al agente)
      const clientCtx = activeClient ? {
        name: activeClient.name,
        // sector: puede venir como 'sector' o 'industry' según el origen del cliente
        sector: activeClient.sector || activeClient.industry || null,
        palette: activeClient.palette || null,
        // fonts puede ser array ["Inter"] o objeto {display:"Inter",text:"Inter"}
        fonts: Array.isArray(activeClient.fonts)
          ? activeClient.fonts
          : activeClient.fonts
            ? [activeClient.fonts.display, activeClient.fonts.text].filter(Boolean)
            : activeClient.typography
              ? [activeClient.typography.display, activeClient.typography.text].filter(Boolean)
              : null,
        colorEmotion: activeClient.colorEmotion || null,
        toneTemperature: activeClient.toneTemperature || null,
        audience: activeClient.audience || null,
        contentPillars: activeClient.contentPillars || null,
        compositionStyle: activeClient.compositionStyle || null,
        // antiPatterns puede venir como 'antiPatterns' o 'dont'
        antiPatterns: activeClient.antiPatterns || activeClient.dont || null,
        moodboardName: activeMoodboard?.name || null,
        logo: activeClient.logo || null,
        // Datos de marca completos — para que el agente entienda al cliente al 100%
        voice: activeClient.voice || null,
        valueProp: activeClient.valueProp || null,
        productList: activeClient.productList || null,
        cta: activeClient.cta || null,
        tagline: activeClient.taglineFull || activeClient.tagline || null,
        instagramHandle: activeClient.instagramHandle || null,
        verticals: activeClient.verticals || null,
        visualReferences: activeClient.visualReferences || null,
        style_manifest: activeMoodboard?.manifest ? {
          moodboard_id: activeMoodboard.manifest.moodboardId || activeMoodboard.id || "",
          color_palette: activeMoodboard.manifest.colorPalette || [],
          color_grading: activeMoodboard.manifest.colorGrading || "",
          lighting_style: activeMoodboard.manifest.lightingStyle || "",
          camera_lens_feel: activeMoodboard.manifest.cameraLensFeel || "",
          character_traits: activeMoodboard.manifest.characterTraits || [],
          composition_rules: activeMoodboard.manifest.compositionRules || [],
          composition_layers: activeMoodboard.manifest.compositionLayers || [],
          typography: activeMoodboard.manifest.typography || [],
          text_content: activeMoodboard.manifest.textContent || [],
          filters_effects: activeMoodboard.manifest.filtersEffects || [],
          mood_keywords: activeMoodboard.manifest.moodKeywords || [],
          master_style_prompt: activeMoodboard.manifest.masterStylePrompt || "",
          negative_prompt: activeMoodboard.manifest.negativePrompt || "",
          characters: activeMoodboard.manifest.characters || [],
          consistency_score: typeof activeMoodboard.manifest.consistencyScore === 'number' ? activeMoodboard.manifest.consistencyScore : 0.7,
        } : null,
      } : null;

      const firstDownstreamNode = nodes.find((n) => downstream.some((e) => e.target === n.id));
      const outputType = firstDownstreamNode?.type === "video" ? "video" : "image";

      if (agentObj) {
        patchNodeData(nodeId, { status: "running", agentOutput: null });
        setRunningNodes((s) => new Set([...s, nodeId]));

        const _agentPayload = {
          id: agentObj.id,
          name: agentObj.name,
          role: agentObj.role,
          specialty: agentObj.specialty,
          description: agentObj.description,
          tono: agentObj.tono,
          objetivo: agentObj.objetivo,
        };

        // Recoge TODAS las URLs upstream (image/video lastUrl + imageref + reference)
        const _directUpstream = nodes.filter((n) => edges.some((e) => e.target === nodeId && e.source === n.id));
        const _refImages = [
          // Nodos generados (imagen/video ya ejecutados)
          ..._directUpstream
            .filter((n) => (n.type === "image" || n.type === "video") && n.data?.lastUrl)
            .map((n) => n.data.lastUrl),
          // OutputNode (RESULTADO) conectado al input → su imagen vive en data.items[].url.
          // CRÍTICO: sin esto, conectar un resultado de storyboard al PromptNode no llegaba a SHAQ.
          ..._directUpstream
            .filter((n) => n.type === "output")
            .map((n) => _imageUrlFromNode(n))
            .filter(Boolean),
          // Nodo imageref conectado directamente
          ..._directUpstream
            .filter((n) => n.type === "imageref" && n.data?.images?.length)
            .flatMap((n) => n.data.images),
          // Nodo reference (personaje) → imágenes del personaje van a SHAQ
          ..._directUpstream
            .filter((n) => n.type === "reference" && n.data?.images?.length)
            .flatMap((n) => n.data.images),
        ].filter((u) => typeof u === "string" && (u.startsWith("http") || u.startsWith("data:")));
        const _referenceImages = _refImages.length ? _refImages : null;

        try {
          if (isBatchMode) {
            // ===== MODO BATCH =====
            patchNodeData(nodeId, { _batchStatus: `Generando ${_batchCount} prompts…` });

            const batchRes = await fetch(`${window.CDPRO_CONFIG.API_BASE}/agent/batch_run`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brief: rawBrief,
                count: _batchCount,
                agent: _agentPayload,
                outputType,
                client: clientCtx,
                reference_images: _referenceImages,
              }),
            });
            const batchJson = await batchRes.json();
            const batchPrompts = batchJson.prompts || [];

            if (batchPrompts.length === 0) {
              finalBrief = rawBrief;
              patchNodeData(nodeId, { status: "done", agentOutput: null });
            } else {
              const allPromptsText = batchPrompts.map((p) => `${p.index}. ${p.prompt}`).join("\n");
              // Lista estructurada para el modal "Ver prompts" con tracking en tiempo real.
              let _promptList = batchPrompts.map((p, i) => ({ index: i + 1, prompt: p.prompt, status: "pending" }));
              patchNodeData(nodeId, { status: "done", agentOutput: allPromptsText, prompts: _promptList });

              window.__notify?.({
                kind: "success", icon: "✦",
                title: `${agentObj.name} • ${batchPrompts.length} prompts`,
                body: `Ejecutando secuencialmente (1 por 1)…`,
              });

              // Ejecutar downstream UNO POR UNO con cada prompt distinto
              for (let bi = 0; bi < batchPrompts.length; bi++) {
                const item = batchPrompts[bi];
                // Marcar este prompt como ejecutándose (en tiempo real en el modal).
                _promptList = _promptList.map((p, i) => i === bi ? { ...p, status: "running" } : p);
                patchNodeData(nodeId, {
                  _refinedBrief: item.prompt,
                  _batchStatus: `${bi + 1}/${batchPrompts.length}`,
                  prompts: _promptList,
                });

                for (const e of downstream) {
                  await runNode(e.target, item.prompt);
                }

                // Marcar como completado.
                _promptList = _promptList.map((p, i) => i === bi ? { ...p, status: "done" } : p);
                patchNodeData(nodeId, { prompts: _promptList });

                if (bi < batchPrompts.length - 1) {
                  await new Promise((r) => setTimeout(r, 300));
                }
              }

              setTimeout(() => patchNodeData(nodeId, { _refinedBrief: undefined, _batchStatus: undefined }), 200);
              setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n; });
              return;
            }

          } else {
            // ===== MODO NORMAL =====
            const res = await fetch(`${window.CDPRO_CONFIG.API_BASE}/agent/run`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                brief: rawBrief,
                agent: _agentPayload,
                outputType,
                client: clientCtx,
                reference_images: _referenceImages,
              }),
            });
            const json = await res.json();
            if (json.refined_prompt && !json.error) {
              finalBrief = json.refined_prompt;
              patchNodeData(nodeId, { status: "done", agentOutput: finalBrief, prompts: [{ index: 1, prompt: finalBrief, status: "pending" }] });
            } else {
              _agentFailedLocal = true;
              patchNodeData(nodeId, { status: "error", agentOutput: null, _agentFailed: true });
              window.__notify?.({
                kind: "error", icon: "✖", title: agentObj.name + " falló — cascada detenida",
                body: (json.error || "Backend no devolvió prompt refinado.") + " Downstream NO ejecutado (evita gasto Kid.ai).",
              });
            }
          }

        } catch (err) {
          _agentFailedLocal = true;
          patchNodeData(nodeId, { status: "error", agentOutput: null, _agentFailed: true });
          window.__notify?.({
            kind: "error", icon: "✖", title: agentObj.name + " offline — cascada detenida",
            body: "Backend no disponible. Downstream NO ejecutado (evita gasto Kid.ai).",
          });
        } finally {
          setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n; });
        }

        if (finalBrief !== rawBrief) {
          window.__notify?.({
            kind: "success", icon: "✦", title: agentObj.name + " refinó el brief",
            body: finalBrief.slice(0, 80) + (finalBrief.length > 80 ? "…" : ""),
          });
        }
      }

      // SAFETY: si el agente fallo, ABORTAR cascada — evita gastar Kid.ai con brief crudo.
      // Usa la bandera local (sincrona); leer node.data._agentFailed seria un closure stale.
      if (_agentFailedLocal) {
        console.warn("[runNode] agent failed — downstream cascade aborted", nodeId);
        return;
      }
      patchNodeData(nodeId, { _refinedBrief: finalBrief });
      // Pasar imagen upstream al downstream (PromptVid→Video necesita la URL del ImageNode upstream)
      const _promptUpstreamImg = findUpstreamImage(nodeId);
      const _frameForDownstream = inheritedFrameUrl || _imageUrlFromNode(_promptUpstreamImg?.node) || null;
      // Marcar el prompt único como ejecutándose (tracking en el modal "Ver prompts").
      const _hasSinglePrompt = (nodes.find((n) => n.id === nodeId)?.data?.prompts || []).length === 1;
      if (_hasSinglePrompt) patchNodeData(nodeId, { prompts: [{ index: 1, prompt: finalBrief, status: "running" }] });
      for (const e of downstream) await runNode(e.target, finalBrief, _frameForDownstream);
      if (_hasSinglePrompt) patchNodeData(nodeId, { prompts: [{ index: 1, prompt: finalBrief, status: "done" }] });
      // NO borramos _refinedBrief — debe persistir como fuente de verdad del PromptNode tras ejecutar agente.
      return;
    }

    if (node.type === "note" || node.type === "output" || node.type === "voice") return;

    // --- Resolver upstream ---
    // Caso A: VideoNode con ImageNode upstream (Imagen → Video)
    // Caso B: ImageNode/VideoNode con PromptNode upstream
    // Caso C: standalone con prompt propio
    // Para video: imagen upstream como first_frame. Para image: imagen upstream como reference_image.
    const upstreamImage = (node.type === "video" || node.type === "image") ? findUpstreamImage(nodeId) : null;
    const upstream = findUpstreamPrompt(nodeId)
      || (upstreamImage ? findUpstreamPrompt(upstreamImage.node.id) : null);

    // Prioridad estricta: inheritedBrief (cascada activa) > agentOutput del PromptNode upstream (SHAQ refinado)
    // > _refinedBrief temporal > NUNCA el brief crudo del usuario > prompt propio del nodo si standalone.
    const upstreamAgentOutput = upstream ? (upstream.node.data.agentOutput || upstream.node.data._refinedBrief) : null;
    // Prioridad: cascada > prompt refinado upstream > prompt PROPIO del nodo (image/video).
    // El prompt propio del Video/Image es deliberado del usuario → válido aunque haya un Prompt node upstream sin ejecutar.
    let brief = inheritedBrief || upstreamAgentOutput || node.data.prompt || null;

    if (!brief?.trim()) {
      window.__notify?.({
        kind: "error", icon: "!", title: "Sin prompt refinado",
        body: upstream && !upstreamAgentOutput
          ? "El agente del Prompt Node upstream no produjo salida. Ejecútalo primero (no se usará el brief crudo del usuario)."
          : (node.type === "video"
              ? "Conecta un Prompt Node con agente ejecutado o un Image Node con imagen generada."
              : "Conecta un Prompt Node con agente ejecutado, o ejecútalo standalone con prompt propio."),
      });
      return;
    }

    // ── Resolución de imagen para VÍDEO (regla robusta) ─────────────────────
    // La imagen upstream (ImageNode/OutputNode generado, ej. un storyboard) va SIEMPRE como
    // REFERENCE visual, NUNCA como first_frame automático. Razones:
    //   1. Para un storyboard, first_frame animaría el grid literal (mal).
    //   2. Seedance prohíbe first_frame + reference juntos → "LOAD FAILED".
    //   3. reference deja a Seedance recrear las escenas guiándose por la imagen + el prompt.
    // El first_frame queda como OPT-IN explícito: solo si el usuario sube una imagen al slot
    // de keyframes del VideoNode (acción deliberada para animar ESE fotograma exacto).
    const _upstreamImgUrl = inheritedFrameUrl || _imageUrlFromNode(upstreamImage?.node) || null;
    const _manualKeyframe = (node.data.keyframes || []).find((u) => typeof u === "string" && u.startsWith("http")) || null;
    const firstFrameUrl = node.type === "video" ? _manualKeyframe : _upstreamImgUrl;
    // Imagen upstream como referencia visual del vídeo (storyboard o guía de escena).
    const videoRefUrl = (node.type === "video" && !firstFrameUrl) ? _upstreamImgUrl : null;
    // Lo que SHAQ debe VER para coherencia (sea reference o first_frame).
    const _candidateFrame = _upstreamImgUrl || _manualKeyframe;
    const _isStoryboardFrame = node.type === "video" && upstreamImage?.node && _isStoryboardImage(upstreamImage.node);

    // ── COHERENCIA TOTAL prompt ↔ imagen ──────────────────────────────────
    // Seedance usará la imagen como ancla visual (first_frame normal, o reference si es
    // storyboard), pero el PROMPT debe describir fielmente lo que hay en ella + el movimiento.
    // Hacemos que SHAQ VEA la imagen y reescriba el prompt coherente. Solo Claude (NO gasta KIE).
    // Para storyboard: el prompt resultante narra las escenas → un único vídeo que las recorre.
    if (node.type === "video" && _candidateFrame && typeof _candidateFrame === "string" && _candidateFrame.startsWith("http")) {
      try {
        const _agentList = window.__creativeAgents || [];
        const _upAgentId = upstream?.node?.data?.agentId;
        const _cohAgent = (_upAgentId && _upAgentId !== "none" ? _agentList.find((a) => a.id === _upAgentId) : null)
          || _agentList.find((a) => /shaq/i.test(a.name || ""))
          || _agentList[0]
          || { id: "shaq", name: "SHAQ", role: "Creative Director" };
        patchNodeData(nodeId, { status: "running" });
        const _cohMsg = _isStoryboardFrame
          ? "SHAQ analiza el storyboard para narrar todas las escenas en un vídeo…"
          : "SHAQ analiza el first_frame para coherencia total…";
        window.__notify?.({ kind: "info", icon: "🎯", title: "Sincronizando prompt con la imagen", body: _cohMsg });
        const _cohRes = await fetch(`${window.CDPRO_CONFIG.API_BASE}/agent/run`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brief,
            agent: {
              id: _cohAgent.id, name: _cohAgent.name, role: _cohAgent.role,
              specialty: _cohAgent.specialty, description: _cohAgent.description,
              tono: _cohAgent.tono, objetivo: _cohAgent.objetivo,
            },
            outputType: "video",
            client: null,
            reference_images: [_candidateFrame],
          }),
        });
        const _cohJson = await _cohRes.json();
        if (_cohJson.refined_prompt && !_cohJson.error && _cohJson.refined_prompt.trim().length > 20) {
          brief = _cohJson.refined_prompt.trim();
          patchNodeData(nodeId, { prompt: brief });
          window.__notify?.({ kind: "success", icon: "✓", title: "Prompt coherente con la imagen", body: brief.slice(0, 90) + (brief.length > 90 ? "…" : "") });
        }
      } catch (_) { /* si falla la sincronización, conservar el brief original */ }
    }


    // Para VideoNode: voice_prompt desde VoiceNode upstream (narración sincronizada)
    const upstreamVoice = node.type === "video" ? findUpstreamVoice(nodeId) : null;
    const voicePromptForVideo = upstreamVoice?.node.data.voicePrompt || null;

    setRunningNodes((s) => new Set([...s, nodeId]));
    if (upstream)    setRunningEdges((s) => new Set([...s, upstream.edgeId]));
    if (upstreamImage) setRunningEdges((s) => new Set([...s, upstreamImage.edgeId]));
    patchNodeData(nodeId, { status: "running", prompt: brief });

    if (firstFrameUrl) {
      window.__notify?.({
        kind: "info", icon: "▦", title: "Animando imagen",
        body: "Usando imagen upstream como primer frame del vídeo.",
      });
    }
    if (voicePromptForVideo) {
      window.__notify?.({
        kind: "info", icon: "🎙", title: "Narración conectada",
        body: "El video incluirá el voice_prompt del nodo de Voz upstream.",
      });
    }

    // Generar N items según `cantidad` — llamada real a Kid.ai via /generate
    const cantidad = Math.max(1, parseInt(node.data.cantidad) || 1);
    const newItems = [];
    if (cantidad > 0) {
      window.__notify?.({
        kind: "info", icon: "⚙", title: "Generando con Kie.ai",
        body: "Puede tardar 30-180s dependiendo del modelo. No cierres ni recargues.",
      });
    }
    // Helper: llama /generate con reintentos automaticos silenciosos sobre task_id si hay timeout
    async function tryGenerate(genBody, retryCount = 0, taskId = null) {
      const API_BASE = window.CDPRO_CONFIG.API_BASE;
      const url = taskId ? `${API_BASE}/generate/retry/${taskId}` : `${API_BASE}/generate`;
      const body = taskId ? JSON.stringify({ media_kind: genBody.media_kind }) : JSON.stringify(genBody);
      const _abort = new AbortController();
      const _abortTimer = setTimeout(() => _abort.abort("client_timeout_380s"), 380000);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          signal: _abort.signal,
        });
        const data = await res.json();
        if (data.url) return data;
        if (data.error && data.error.toLowerCase().includes("timeout") && data.task_id && retryCount < 2) {
          window.__notify?.({
            kind: "info", icon: "⟳", title: "Kie tardando — reintentando",
            body: `task ${data.task_id.slice(0, 8)}… intento ${retryCount + 2}/3`,
          });
          await new Promise(r => setTimeout(r, 20000));
          return tryGenerate(genBody, retryCount + 1, data.task_id);
        }
        return data;
      } finally {
        clearTimeout(_abortTimer);
      }
    }
    // Crear OutputNode placeholder con status=running para que el loader aparezca durante fetch.
    let _outputNodeId = null;
    {
      // SIEMPRE usar nodesRef.current (sync, no stale) para encontrar OutputNode ya creado.
      // Si se usa nodes (closure), una segunda llamada runNode en batch no lo encuentra → duplica.
      const existingOutputNode = nodesRef.current.find((n) =>
        n.type === "output" && edges.some((e) => e.source === nodeId && e.target === n.id)
      );
      if (existingOutputNode) {
        _outputNodeId = existingOutputNode.id;
        setNodes((ns) => ns.map((n) => n.id === _outputNodeId ? { ...n, data: { ...n.data, status: "running", kind: node.type, modelId: node.data.modelId } } : n));
      } else {
        _outputNodeId = `n-output-${Math.random().toString(36).slice(2, 6)}`;
        const sourceNode = nodes.find((n) => n.id === nodeId);
        // Buscar el grupo que contiene el nodo fuente
        const parentGroup = nodes.find((g) => g.type === "group" && (g.data?.members || []).includes(nodeId));
        let newX, newY;
        // OutputNode siempre va justo a la derecha del nodo que genera (el source)
        // No depende del grupo ni del rightmost — se ancla al nodo fuente directamente
        newX = (sourceNode?.x || 0) + (NODE_SIZE[node.type]?.w || 360) + 60;
        newY = sourceNode?.y || 0;
        const outId = _outputNodeId;
        setNodes((ns) => {
          const newNs = [...ns, {
            id: outId, type: "output", x: newX, y: newY,
            data: { ...NODE_DEFAULTS.output(), kind: node.type, modelId: node.data.modelId, items: [], status: "running" },
          }];
          if (!parentGroup) return newNs;
          const updatedMembers = [...(parentGroup.data?.members || []), outId];
          const memberNodes = newNs.filter((n) => updatedMembers.includes(n.id));
          const pad = 28;
          // Nuevo tamaño: mínimo necesario para contener todos los miembros
          // Solo expande hacia derecha/abajo — NUNCA mueve la posición del grupo (x/y fija)
          const newW = Math.max(
            parentGroup.data?.w || 600,
            Math.max(...memberNodes.map((n) => (n.x - parentGroup.x) + (NODE_SIZE[n.type]?.w || 320))) + pad
          );
          const newH = Math.max(
            parentGroup.data?.h || 400,
            Math.max(...memberNodes.map((n) => (n.y - parentGroup.y) + (NODE_SIZE[n.type]?.h || 280))) + pad + 52
          );
          return newNs.map((g) =>
            g.id === parentGroup.id
              ? { ...g, data: { ...g.data, w: newW, h: newH, members: updatedMembers } }
              : g  // NUNCA tocar otros grupos/nodos
          );
        });
        const newEdgeId = "e-" + Math.random().toString(36).slice(2, 7);
        setEdges((es) => [...es, { id: newEdgeId, source: nodeId, target: _outputNodeId }]);
        pulseEdge(newEdgeId);
      }
    }

    for (let i = 0; i < cantidad; i++) {
      let url = "";
      let genError = null;
      let genTaskId = "";
      try {
        const genBody = {
          media_kind: node.type === "video" ? "video" : "image",
          model_id: node.data.modelId,
          prompt: brief,
          aspect: node.data.aspect || null,
          duration: node.type === "video" ? (parseInt(String(node.data.duration || "5").replace(/\D/g,""), 10) || 5) : null,
          first_frame_url: firstFrameUrl || null,
          voice_prompt: voicePromptForVideo || null,
          // reference_images: siempre se pasa cuando hay imagen upstream, sin importar tipo
          // Imagen: max 3 refs. Vídeo: first_frame ya va separado, refs adicionales hasta 2
          reference_images: (() => {
            // SEEDANCE (vídeo): prohíbe first_frame_url + reference_image_urls juntos.
            // KIE rechaza con "LOAD FAILED / SI USAS FIRST-FRAME NO AÑADAS IMÁGENES DE REFERENCIA".
            // Si hay first_frame, ESE manda como ancla visual; la coherencia va por el prompt de texto.
            if (node.type === "video" && firstFrameUrl) return null;
            const refs = [];
            // STORYBOARD / imagen upstream → vídeo: NO se manda a Seedance como reference.
            // Seedance da "LOAD FAILED" al cargar imágenes-grid o con mismatch de formato (.png/JPEG).
            // SHAQ ya VIO la imagen y la describió en el prompt (ultra-detallado de las escenas),
            // así que Seedance la genera desde el TEXTO. Imagen upstream NUNCA va a KIE en vídeo.
            void videoRefUrl; // queda solo informativo para el badge; no se envía a KIE.
            // ReferenceNode upstream (fotos del personaje — máxima prioridad)
            const upstreamRef = findUpstreamReference(nodeId);
            if (upstreamRef?.node?.data?.images?.length) {
              refs.push(...upstreamRef.node.data.images);
            }
            // Imágenes cargadas manualmente en el nodo
            if (node.data.refImages?.length) refs.push(...node.data.refImages);
            // Imagen upstream conectada → SOLO para imagen. En vídeo, el first_frame
            // va aparte y KIE seedance prohíbe first_frame + reference_image_urls juntos.
            if (firstFrameUrl && node.type !== "video") refs.push(firstFrameUrl);
            // KIE solo acepta URLs http(s) — descartar data:base64 (las rechaza) y dedupe.
            const httpRefs = [...new Set(refs.filter(u => typeof u === "string" && u.startsWith("http")))];
            return httpRefs.length ? httpRefs.slice(0, 9) : null;
          })(),
        };
        const genData = await tryGenerate(genBody);
        if (genData.error) { genError = genData.error; genTaskId = genData.task_id || ""; }
        else { url = genData.url; genTaskId = genData.task_id || ""; }

        // REGLA DE ORO — overlay del logo OFICIAL del cliente (píxel-exacto, jamás IA).
        // Solo para imágenes. El logo se compone tras generar para mantener identidad idéntica.
        const _logoUrl = activeClient?.logoUrl || activeClient?.logo?.url;
        if (url && node.type === "image" && _logoUrl) {
          try {
            const API_BASE = window.CDPRO_CONFIG.API_BASE;
            const cr = await fetch(`${API_BASE}/generate/compose-logo`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: url, logo_url: _logoUrl, position: "bottom-right", scale: 0.16 }),
            });
            const cd = await cr.json();
            if (cd.url && cd.logo_applied) {
              url = cd.url;
              window.__notify?.({ kind: "success", icon: "✓", title: "Logo aplicado", body: `Identidad ${activeClient.name} · logo oficial` });
            }
          } catch (_) { /* si falla overlay, conservar imagen original */ }
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          genError = "Kie no respondio en 260s. El task puede estar procesando. Reintenta en 1 min.";
        } else {
          genError = err.message || String(err);
        }
      }
      if (genError) {
        const bodyMsg = genTaskId
          ? `${genError.slice(0, 100)} (task ${genTaskId})`
          : genError.slice(0, 120);
        window.__notify?.({
          kind: "error", icon: "✖", title: "Error generando",
          body: bodyMsg,
        });
        patchNodeData(nodeId, { status: "idle" });
        // CRÍTICO: el OutputNode quedaba en "running" para siempre ("RENDERIZANDO…")
        // si la generación fallaba. Lo marcamos en error para que NO se cuelgue.
        if (_outputNodeId) {
          setNodes((ns) => ns.map((n) => n.id === _outputNodeId
            ? { ...n, data: { ...n.data, status: "error", error: bodyMsg } }
            : n));
        }
        setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n; });
        return;
      }
      // Persistir a Supabase — las URLs de KIE expiran ~24-48h. Tras esto la URL no muere.
      if (url) {
        try {
          const API_BASE = window.CDPRO_CONFIG.API_BASE;
          const pr = await fetch(`${API_BASE}/generate/persist-media`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, kind: node.type === "video" ? "video" : "image" }),
          });
          const pd = await pr.json();
          if (pd.url && pd.persisted) url = pd.url;
        } catch (_) { /* si falla, conservar URL temporal */ }
      }
      newItems.push({
        id: "g-" + Math.random().toString(36).slice(2, 8),
        kind: node.type,
        url,
        prompt: brief,
        model: node.data.modelId,
        duration: node.type === "video" ? node.data.duration : undefined,
        aspect: node.data.aspect,
        styleLocked: !!lockedMb,
        styleSource: lockedMb?.name || null,
        clientId: activeClientId || null,
        moodboardId: activeMoodboardId || null,
        projectId: activeProjectId || null,
        createdAt: Date.now() + i,
        nodeId,
      });
    }

    patchNodeData(nodeId, { status: "done", lastUrl: newItems[0].url });

    // Si hay VideoNodes conectados downstream de esta imagen, ejecutarlos
    // pasando la URL recién generada como first_frame y el brief como inherited
    if (node.type === "image" && newItems[0]?.url) {
      const generatedUrl = newItems[0].url;
      // Cascadar a VideoNodes directos Y PromptNodes downstream (flujo Image→Prompt→Video)
      // En ambos casos pasar generatedUrl como inheritedFrameUrl para que llegue al VideoNode
      const downstream = edges.filter((e) => e.source === nodeId);
      for (const e of downstream) {
        const tgt = nodes.find((n) => n.id === e.target);
        if (!tgt) continue;
        if (tgt.type === "video" || tgt.type === "prompt") {
          await runNode(e.target, brief, generatedUrl);
        }
      }
    }

    // Push a la galería (más nuevos primero)
    newItems.forEach(item => addToSharedGallery(item));

    // Actualizar el OutputNode placeholder creado al inicio (_outputNodeId).
    // No buscamos en edges (closure stale) — usamos el id capturado arriba.
    setNodes((ns) => ns.map((n) =>
      n.id === _outputNodeId
        ? { ...n, data: { ...n.data, status: "done", kind: node.type, modelId: node.data.modelId, items: [...newItems, ...(n.data.items?.filter(i => i.url) || [])] } }
        : n
    ));

    window.__notify?.({
      kind: "success",
      icon: node.type === "video" ? "▶" : "◈",
      title: cantidad === 1
        ? (node.type === "video" ? "Video renderizado" : "Imagen generada")
        : `${cantidad} ${node.type === "video" ? "videos" : "imágenes"} generadas`,
      body: `${node.data.modelId}${lockedMb ? ` · style "${lockedMb.name}"` : ""} · guardado en galería`,
    });

    setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n; });
    setTimeout(() => {
      if (upstream)      setRunningEdges((s) => { const n = new Set(s); n.delete(upstream.edgeId); return n; });
      if (upstreamImage) setRunningEdges((s) => { const n = new Set(s); n.delete(upstreamImage.edgeId); return n; });
    }, 400);
  }, [nodes, edges, findUpstreamPrompt, findUpstreamImage, findUpstreamVoice, patchNodeData, lockedMb, pulseEdge]);

  // --- output node item actions -------------------------------------------
  const [previewItem, setPreviewItem] = useState(null);
  const onOutputAction = useCallback((action, nodeId, item) => {
    if (action === "preview") {
      setPreviewItem(item);
    } else if (action === "download") {
      const isVid = item.kind === "video" || /\.mp4($|\?)/i.test(item.url || "");
      const ext = isVid ? "mp4" : (item.url.startsWith("data:image/svg") ? "svg" : "png");
      downloadAsset(item.url, `cliender-${item.kind || "asset"}-${item.id}.${ext}`);
    } else if (action === "delete") {
      setNodes((ns) => ns.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, items: n.data.items.filter((it) => it.id !== item.id) } }
          : n
      ));
      removeFromSharedGallery(item.id);
    } else if (action === "openGallery") {
      setActiveTab("gallery");
    }
  }, []);

  const runAll = useCallback(async () => {
    // Solo ejecutar PromptNodes "raíz" — los que NO tienen un ImageNode upstream directo.
    // Los PromptNodes con ImageNode upstream (ej: PromptVid) se ejecutan automáticamente
    // por cascade cuando el ImageNode termina, evitando doble gasto de API.
    const promptNodes = nodes.filter((n) => {
      if (n.type !== "prompt") return false;
      const downstream = edges.filter((e) => e.source === n.id);
      if (downstream.length === 0) return false;
      // Excluir si tiene ImageNode upstream directo (se ejecutará por cascade)
      const hasImageUpstream = edges.some((e) =>
        e.target === n.id && nodes.find((s) => s.id === e.source && s.type === "image")
      );
      return !hasImageUpstream;
    });
    for (const p of promptNodes) {
      await runNode(p.id);
    }
  }, [nodes, edges, runNode]);

  // --- Supercomputer simulated run ---------------------------------------
  const pushLog = (frame) => {
    setLogs((ls) => [...ls, { id: Math.random().toString(36).slice(2), ...frame }]);
    setLastLogAt(Date.now());
  };
  const runSwarm = useCallback(async ({ client, refImages, refAnalysis } = {}) => {
    if (!prompt.trim()) return;
    setLogs([]);
    setSwarmArtifact(null);
    const setStatus = (k, s) => setNodeStatus((st) => ({ ...st, [k]: s }));
    setNodeStatus({ master_director:'idle', scriptwriter:'idle', cinematographer:'idle', production:'idle', critic:'idle' });

    const promptNode = nodes.find((n) => n.type === 'prompt');
    const imageNode  = nodes.find((n) => n.type === 'image');
    if (promptNode) patchNodeData(promptNode.id, { brief: prompt, status: 'done' });

    const clientCtx = client ? {
      id: client.id, name: client.name, industry: client.industry,
      tagline: client.tagline, palette: client.palette,
      typography: client.typography, contact: client.contact,
    } : null;

    if (lockedMb?.manifest) {
      pushLog({ agentName: 'VisionAuditor', status: 'done',
        message: `Style Manifest "${lockedMb.name}" · ${lockedMb.images.length} refs activas.` });
    }
    if (client) {
      pushLog({ agentName: 'System', status: 'info',
        message: `Cliente: ${client.name} · ${client.industry}` });
    }
    if (Array.isArray(refImages) && refImages.length > 0) {
      pushLog({ agentName: 'System', status: 'info',
        message: `${refImages.length} imagen${refImages.length > 1 ? 'es' : ''} de referencia adjunta${refImages.length > 1 ? 's' : ''}.` });
    }

    let resp;
    try {
      resp = await fetch(`${window.CDPRO_CONFIG.API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          moodboard_id: lockedMb?.id || null,
          client_context: clientCtx,
          reference_images: Array.isArray(refImages) ? refImages.filter(Boolean).slice(0, 2) : [],
          ref_manifest: refAnalysis || null,
        }),
      });
      if (!resp.ok) throw new Error(`Backend ${resp.status}: ${resp.statusText}`);
    } catch (err) {
      pushLog({ agentName: 'System', status: 'error', message: `Error conectando al backend: ${err.message}` });
      return;
    }

    const reader  = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalArtifact = null;

    const NODE_LABELS = {
      master_director: 'MasterDirector', scriptwriter: 'Scriptwriter',
      cinematographer: 'Cinematographer', production: 'Production', critic: 'Critic',
    };

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          let ev;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }

          if (ev.type === 'node_start') {
            setStatus(ev.node, 'running');
            pushLog({ agentName: NODE_LABELS[ev.node] || ev.node, status: 'running', message: ev.message });

          } else if (ev.type === 'node_done') {
            setStatus(ev.node, ev.status || 'done');
            pushLog({ agentName: ev.label || ev.node, status: ev.status || 'done', message: ev.message });
            if (ev.node === 'cinematographer' && ev.data?.cinematography?.model_id) {
              const mid = ev.data.cinematography.model_id;
              if (imageNode) patchNodeData(imageNode.id, { modelId: mid, status: 'running' });
            }

          } else if (ev.type === 'retry') {
            setStatus('critic', 'rejected');
            pushLog({ agentName: ev.label || 'Critic', status: 'running', message: ev.message });

          } else if (ev.type === 'complete') {
            finalArtifact = ev.artifact;
            setSwarmArtifact(ev.artifact || null);
            const critic   = ev.critic;
            if (finalArtifact?.url) {
              const isVideo = finalArtifact.media_kind === 'video';
              if (imageNode) patchNodeData(imageNode.id, {
                status: 'done', lastUrl: finalArtifact.url,
                modelId: finalArtifact.model_id, prompt,
              });
              addToSharedGallery({
                id: 'g-' + Math.random().toString(36).slice(2, 8),
                kind: isVideo ? 'video' : 'image',
                url: finalArtifact.url, prompt,
                model: finalArtifact.model_id,
                duration: isVideo ? `${finalArtifact.duration_s || 5}s` : null,
                aspect: '16:9',
                styleLocked: !!lockedMb, styleSource: lockedMb?.name || null,
                clientId: client?.id || null, createdAt: Date.now(),
              });
              window.__notify?.({ kind: 'success', icon: '✦',
                title: 'Swarm completó la generación',
                body: `${finalArtifact.model_id}${client ? ` · ${client.name}` : ''}` });
            }
            const scoreStr = critic?.score != null ? ` · Score ${critic.score.toFixed(2)}` : '';
            const stub = finalArtifact?.stub ? ' [KIE.ai pendiente]' : '';
            pushLog({ agentName: 'System', status: 'info',
              message: `✓ Generación completa${scoreStr}${stub}. Asset añadido a Galería.` });

          } else if (ev.type === 'error') {
            pushLog({ agentName: 'System', status: 'error', message: `Error: ${ev.message}` });
          }
        }
      }
    } catch (err) {
      pushLog({ agentName: 'System', status: 'error', message: `Stream interrumpido: ${err.message}` });
    }
  }, [prompt, lockedMb, nodes, patchNodeData]);

  // --- Storyboard → vídeo multi-escena (lee referencia de secuencia) -------
  const runStoryboard = useCallback(async ({ client, refImages, refAnalysis, durationS = 20 } = {}) => {
    if (!prompt.trim()) return;
    if (!Array.isArray(refImages) || refImages.filter(Boolean).length === 0) {
      window.__notify?.({ kind: 'error', icon: '✖', title: 'Falta el storyboard',
        body: 'Sube al menos 1 imagen de referencia que explique la secuencia escena por escena.' });
      return;
    }
    setLogs([]);
    setSwarmArtifact(null);
    // Reutilizamos los LEDs: master=Director, scriptwriter=Escenas, cinematographer=Prompts, production=Generación, critic=Ensamblaje
    setNodeStatus({ master_director:'idle', scriptwriter:'idle', cinematographer:'idle', production:'idle', critic:'idle' });
    const setStatus = (k, s) => setNodeStatus((st) => ({ ...st, [k]: s }));

    const clientCtx = client ? {
      id: client.id, name: client.name, industry: client.industry,
      tagline: client.tagline, palette: client.palette,
      typography: client.typography, contact: client.contact, logo: client.logo,
    } : null;

    pushLog({ agentName: 'System', status: 'info',
      message: `Vídeo storyboard · objetivo ${durationS}s · ${refImages.filter(Boolean).length} referencia(s)` });

    let resp;
    try {
      resp = await fetch(`${window.CDPRO_CONFIG.API_BASE}/chat/storyboard/stream`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          reference_images: refImages.filter(Boolean).slice(0, 4),
          total_duration_s: Math.max(5, Math.min(60, Number(durationS) || 20)),
          client_context: clientCtx,
          ref_manifest: refAnalysis || null,
          fps: 30,
        }),
      });
      if (!resp.ok) throw new Error(`Backend ${resp.status}: ${resp.statusText}`);
    } catch (err) {
      pushLog({ agentName: 'System', status: 'error', message: `Error conectando al backend: ${err.message}` });
      return;
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          let ev; try { ev = JSON.parse(line.slice(6)); } catch { continue; }

          if (ev.type === 'director_start') {
            setStatus('master_director', 'running');
            pushLog({ agentName: 'StoryboardDirector', status: 'running', message: ev.message });

          } else if (ev.type === 'storyboard_ready') {
            setStatus('master_director', 'done'); setStatus('scriptwriter', 'done');
            const p = ev.plan || {};
            pushLog({ agentName: 'StoryboardDirector', status: 'done',
              message: `Historia: ${p.narrative || ''}` });
            pushLog({ agentName: 'System', status: 'info', message: `Hook: “${p.hook || ''}” · ${ev.message}` });
            (p.scenes || []).forEach((s) => pushLog({ agentName: `Escena ${s.index}`, status: 'info',
              message: `[${s.media_kind}] ${s.duration_s}s · ${s.title} — ${(s.caption||'').slice(0,50)}` }));
            setStatus('cinematographer', 'running'); setStatus('production', 'running');

          } else if (ev.type === 'scene_start') {
            pushLog({ agentName: `Escena ${ev.index}`, status: 'running', message: ev.message });

          } else if (ev.type === 'scene_prompt') {
            pushLog({ agentName: `Escena ${ev.index}`, status: 'info',
              message: `${ev.model_id} (${ev.media_kind}) · ${ev.prompt.slice(0, 90)}…` });

          } else if (ev.type === 'scene_done') {
            pushLog({ agentName: `Escena ${ev.index}`, status: 'done',
              message: `✓ ${ev.kind} · ${ev.duration_s}s` });
            // mostrar el keyframe/escena en vivo como preview parcial
            setSwarmArtifact({ url: ev.url, media_kind: ev.kind, model_id: 'storyboard',
              duration_s: ev.duration_s, partial: true });

          } else if (ev.type === 'scene_warn' || ev.type === 'scene_error') {
            pushLog({ agentName: `Escena ${ev.index}`, status: ev.type === 'scene_error' ? 'error' : 'running',
              message: ev.message });

          } else if (ev.type === 'render_start') {
            setStatus('production', 'done'); setStatus('critic', 'running');
            pushLog({ agentName: 'Ensamblaje', status: 'running', message: ev.message });

          } else if (ev.type === 'render_done' || ev.type === 'complete') {
            const finalUrl = ev.url;
            if (finalUrl) {
              setStatus('critic', 'done');
              setSwarmArtifact({ url: finalUrl, media_kind: 'video', model_id: 'storyboard-video',
                duration_s: ev.duration_s || durationS });
              if (ev.type === 'complete') {
                addToSharedGallery({
                  id: 'g-' + Math.random().toString(36).slice(2, 8),
                  kind: 'video', url: finalUrl, prompt,
                  model: 'storyboard-video', duration: `${ev.duration_s || durationS}s`,
                  aspect: '9:16', clientId: client?.id || null, createdAt: Date.now(),
                });
                window.__notify?.({ kind: 'success', icon: '🎬',
                  title: 'Vídeo storyboard ensamblado',
                  body: `${(ev.scenes||[]).length} escenas · ${ev.duration_s || durationS}s` });
                pushLog({ agentName: 'System', status: 'info',
                  message: `✓ Vídeo final listo (${ev.duration_s || durationS}s). Añadido a Galería.` });
              }
            }

          } else if (ev.type === 'render_error') {
            setStatus('critic', 'error');
            pushLog({ agentName: 'Ensamblaje', status: 'error', message: `Remotion: ${ev.message}` });

          } else if (ev.type === 'error') {
            pushLog({ agentName: 'System', status: 'error', message: `Error: ${ev.message}` });
          }
        }
      }
    } catch (err) {
      pushLog({ agentName: 'System', status: 'error', message: `Stream interrumpido: ${err.message}` });
    }
  }, [prompt, lockedMb]);

  // --- moodboard lock notification ---------------------------------------
  const prevLockedRef = useRef(null);
  useEffect(() => {
    if (lockedMb && lockedMb.id !== prevLockedRef.current) {
      window.__notify?.({
        kind: "style",
        icon: "🔒",
        title: `Style locked: ${lockedMb.name}`,
        body: `${lockedMb.images.length} refs · consist ${lockedMb.manifest?.consistencyScore?.toFixed(2) || "—"}`,
      });
    }
    prevLockedRef.current = lockedMb?.id || null;
  }, [lockedMb]);

  // --- supercomputer panel auto-open ------------------------------------
  useEffect(() => {
    // In supercomputer mode, the dedicated stage replaces the side panel
    if (mode === "supercomputer") setPanelOpen(false);
    if (mode === "canvas") setPanelOpen(false);
  }, [mode]);

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

  return (
    <div className="app">
      <TopBar
        mode={mode} onMode={setMode}
        isProcessing={isProcessing}
        onRunAll={runAll}
        theme={theme}
        onThemeToggle={() => setTweak("theme", theme === "dark" ? "light" : "dark")}
        onOpenProfile={() => setProfileOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
        userInitials={profile.initials}
        userEmail={profile.email}
        userPhoto={profile.avatarPhoto}
        clients={clients}
        moodboards={moodboards}
        activeClient={activeClient}
        activeMoodboard={activeMoodboard}
        setCtxClient={setCtxClient}
        setCtxMoodboard={setCtxMoodboard}
      />

      {mode !== "supercomputer" && (
        <LeftRail
          activeTab={activeTab}
          onTab={setActiveTab}
          galleryCount={gallery.length}
          hasLockedMoodboard={!!lockedMb}
          clientsCount={clients.length}
          projectsCount={projects.length}
          agentsCount={agents.length}
        />
      )}

      {mode !== "supercomputer" && (
        <aside className={"left-drawer " + (activeTab === "nodes" ? "is-open" : "")} data-kind="nodes">
          {activeTab === "nodes" && (
            <NodesPanel
              onAdd={addNode}
              onClose={() => setActiveTab(null)}
              onSave={() => setSaveModalOpen(true)}
              onNewCanvas={() => { setNodes([]); setEdges([]); setSelectedId(null); setSelectedIds(new Set()); window.__notify?.({ kind: "info", icon: "✦", title: "Canvas limpio", body: "Listo para un nuevo flujo" }); }}
              flowTemplates={flowTemplates}
              onLoadTemplate={loadFlow}
              onDeleteTemplate={deleteTemplate}
            />
          )}
        </aside>
      )}

      {mode !== "supercomputer" && (
        <aside className={"left-drawer " + (activeTab === "clients" ? "is-open" : "")} data-kind="clients">
          {activeTab === "clients" && (
            <ClientsPanel
              clients={clients}
              activeClientId={activeClientId}
              setActiveClientId={setActiveClientId}
              onClose={() => { setActiveTab(null); setActiveClientId(null); }}
              onOpenCreate={() => setCreateClientOpen(true)}
            />
          )}
        </aside>
      )}


      {mode !== "supercomputer" && (
        <aside className={"left-drawer " + (activeTab === "agents" ? "is-open" : "")} data-kind="agents">
          {activeTab === "agents" && (
            <AgentsPanel
              agents={agents}
              onAdd={addAgent}
              onEdit={editAgent}
              onDelete={deleteAgent}
              onClose={() => setActiveTab(null)}
            />
          )}
        </aside>
      )}

      {mode !== "supercomputer" && (
        <aside className={"left-drawer " + (activeTab === "projects" ? "is-open" : "")} data-kind="projects">
          {activeTab === "projects" && (
            <ProjectsPanel
              projects={projects}
              clients={clients}
              activeProjectId={activeProjectId}
              onOpen={onOpenProject}
              onCreate={onCreateProject}
              onDelete={onDeleteProject}
              onClose={() => setActiveTab(null)}
            />
          )}
        </aside>
      )}

      {mode !== "supercomputer" && activeTab === "settings" && (
        <div className="form-popup-backdrop" onClick={() => setActiveTab(null)}>
          <div className="form-popup form-popup-lg" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel
              theme={theme} setTheme={(v) => { setTheme(v); window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { theme: v } }, "*"); }}
              onClose={() => setActiveTab(null)}
            />
          </div>
        </div>
      )}

      {/* canvas-help removed */}

      {mode !== "supercomputer" && (
        <div
          ref={viewportRef}
          className="canvas-viewport"
          onMouseDown={onViewportMouseDown}
          onContextMenu={(e) => {
            e.preventDefault();
            const nodeWrap = e.target.closest && e.target.closest('.node-wrap');
            const nodeId = nodeWrap?.dataset?.nodeId || null;
            const rect = viewportRef.current.getBoundingClientRect();
            const wx = (e.clientX - rect.left - pan.x) / zoom;
            const wy = (e.clientY - rect.top  - pan.y) / zoom;
            setContextMenu({ x: e.clientX, y: e.clientY, worldX: wx, worldY: wy, nodeId });
          }}
        >
          <div className="canvas-world" style={{ transform }}>
            <EdgesLayer
              nodes={nodes}
              edges={edges}
              draggingEdge={draggingEdge}
              runningEdgeIds={runningEdges}
              newEdgeIds={newEdgeIds}
              selectedEdgeId={selectedEdgeId}
              onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedId(null); }}
              onDeleteEdge={deleteEdge}
            />
            {nodes.map((n) => {
              // Highlight si el nodo está dentro del rubber-band activo
              const inRubberBand = rubberBand ? (() => {
                if (n.type === 'group') return false;
                const groupedIds = new Set(nodes.filter(x => x.type==='group').flatMap(g => g.data?.members||[]));
                if (groupedIds.has(n.id)) return false;
                const rb = rubberBand;
                const rx1 = (Math.min(rb.x1,rb.x2)-pan.x)/zoom, ry1=(Math.min(rb.y1,rb.y2)-pan.y)/zoom;
                const rx2 = (Math.max(rb.x1,rb.x2)-pan.x)/zoom, ry2=(Math.max(rb.y1,rb.y2)-pan.y)/zoom;
                const nw = NODE_SIZE[n.type]?.w||320, nh = NODE_SIZE[n.type]?.h||280;
                return n.x < rx2 && n.x+nw > rx1 && n.y < ry2 && n.y+nh > ry1;
              })() : false;
              return (
              <CanvasNode
                key={n.id}
                node={n}
                selected={selectedId === n.id || selectedIds.has(n.id) || inRubberBand}
                onSelect={(id, e) => toggleSelect(id, e?.shiftKey)}
                onDrag={dragNode}
                onGroupDragStart={onGroupDragStart}
                onDataChange={patchNodeData}
                onClose={removeNode}
                onGenerate={runNode}
                hasIncomingPrompt={!!incomingPromptIds[n.id]}
                incomingPrompt={incomingPromptInfo[n.id] || null}
                incomingMedia={incomingMediaUrls[n.id] || null}
                incomingRefImages={incomingRefImages[n.id] || null}
                onOutputAction={onOutputAction}
                activeClient={activeClient}
                activeMoodboard={activeMoodboard}
                onResizeCorner={onResizeCorner}
              />
              );
            })}
          </div>
          <div className="canvas-vignette" />
          {rubberBand && (
            <div
              className="canvas-rubber-band"
              style={{
                left:   Math.min(rubberBand.x1, rubberBand.x2),
                top:    Math.min(rubberBand.y1, rubberBand.y2),
                width:  Math.abs(rubberBand.x2 - rubberBand.x1),
                height: Math.abs(rubberBand.y2 - rubberBand.y1),
              }}
            />
          )}
        </div>
      )}

      {/* HUD removed — replaced by minimap (only in canvas mode) */}

      <SuperPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        logs={logs}
        isProcessing={isProcessing}
        prompt={prompt}
        setPrompt={setPrompt}
        onSubmit={runSwarm}
        lastLogAt={lastLogAt}
      />

      <MoodboardVault
        open={activeTab === "moodboard"}
        onClose={() => setActiveTab(null)}
        moodboards={moodboards}
        dispatch={dispatchMoodboards}
      />

      <GalleryPanel
        open={activeTab === "gallery"}
        onClose={() => setActiveTab(null)}
        items={gallery}
        onSelect={(it) => setPreviewItem(it)}
        onRemove={(id) => removeFromSharedGallery(id)}
      />

      {mode === "supercomputer" && (
        <SuperStage
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={runSwarm}
          onSubmitVideo={runStoryboard}
          isProcessing={isProcessing}
          logs={logs}
          nodeStatus={nodeStatus}
          lastLogAt={lastLogAt}
          clients={clients}
          moodboards={moodboards}
          lockedMb={lockedMb}
          dispatchMoodboards={dispatchMoodboards}
          activeClient={activeClient}
          activeMoodboard={activeMoodboard}
          setCtxClient={setCtxClient}
          setCtxMoodboard={setCtxMoodboard}
          swarmArtifact={swarmArtifact}
        />
      )}

      {mode !== "supercomputer" && (
        <Minimap nodes={nodes} edges={edges} pan={pan} zoom={zoom} setPan={setPan} viewportRef={viewportRef} />
      )}

      {previewItem && (
        <ImagePreview item={previewItem} onClose={() => setPreviewItem(null)} />
      )}

      {mode !== "supercomputer" && (
        <NewClientPopup
          open={createClientOpen}
          onClose={() => setCreateClientOpen(false)}
          onCreate={onCreateClient}
        />
      )}

      {profileOpen && (
        <ProfilePopup
          profile={profile}
          onSave={(p) => { setProfile(p); setProfileOpen(false); window.__notify?.({ kind: "success", icon: "✓", title: "Perfil actualizado", body: p.name }); }}
          onClose={() => setProfileOpen(false)}
        />
      )}

      {analyticsOpen && window.AnalyticsPanel && (
        <window.AnalyticsPanel onClose={() => setAnalyticsOpen(false)} />
      )}

      {mode !== "supercomputer" && selectedIds.size >= 2 && (
        <div className="multiselect-bar">
          <div className="multiselect-count mono">{selectedIds.size} seleccionados</div>
          <button className="multiselect-btn multiselect-btn-primary" onClick={groupSelected}>
            <span>▢</span> Agrupar
          </button>
          <button className="multiselect-btn multiselect-btn-danger" onClick={deleteSelectedMany}>
            <span>✕</span> Borrar
          </button>
          <button className="multiselect-btn" onClick={() => { setSelectedIds(new Set()); setSelectedId(null); }}>
            Cancelar
          </button>
        </div>
      )}


      {mode !== "supercomputer" && (
        <ConnectMenu
          menu={connectMenu}
          onClose={() => setConnectMenu(null)}
          onPick={addConnectedNode}
        />
      )}

      {mode !== "supercomputer" && (
        <ContextMenu
          menu={contextMenu}
          onClose={() => setContextMenu(null)}
          onPick={onContextPick}
        />
      )}


      {saveModalOpen && (
        <SaveFlowModal
          onSave={saveFlow}
          onClose={() => setSaveModalOpen(false)}
          nodeCount={nodes.filter(n => n.type !== "group").length}
          edgeCount={edges.length}
        />
      )}

      <TweaksPanel
        visible={tweaksOn}
        onClose={() => { setTweaksOn(false); window.parent?.postMessage({ type: "__edit_mode_dismissed" }, "*"); }}
        theme={theme}  setTheme={(v)  => setTweak("theme", v)}
        accent={accent} setAccent={(v) => setTweak("accent", v)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// SaveFlowModal — guardar flujo actual como plantilla independiente
// ---------------------------------------------------------------------------
function SaveFlowModal({ onSave, onClose, nodeCount, edgeCount }) {
  const [name, setName] = React.useState("");
  const [desc, setDesc] = React.useState("");
  const inputRef = React.useRef(null);
  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);
  const confirm = () => { if (name.trim()) onSave(name, desc); };
  return (
    <div className="new-agent-popup-overlay" onClick={onClose}>
      <div className="new-agent-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <p className="new-agent-popup-title">Guardar flujo</p>
        <p className="mono" style={{ fontSize: 11, color: "var(--text-3)", margin: "0 0 16px" }}>
          {nodeCount} nodo{nodeCount !== 1 ? "s" : ""} · {edgeCount} conexi{edgeCount !== 1 ? "ones" : "ón"} · se guarda independiente
        </p>
        <div className="new-agent-field">
          <label>Nombre de la plantilla</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") onClose(); }}
            placeholder="Ej: Hero editorial verano 2026" />
        </div>
        <div className="new-agent-field">
          <label>Descripción (opcional)</label>
          <input value={desc} onChange={e => setDesc(e.target.value)}
            onKeyDown={e => { if (e.key === "Escape") onClose(); }}
            placeholder="Notas sobre este flujo…" />
        </div>
        <div className="new-agent-popup-actions">
          <button className="new-agent-popup-cancel" onClick={onClose}>Cancelar</button>
          <button className="new-agent-popup-submit" onClick={confirm} disabled={!name.trim()}>
            💾 Guardar plantilla
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// FlowTemplatesPanel — panel lateral de plantillas guardadas
// ---------------------------------------------------------------------------
function FlowTemplatesPanel({ templates, onLoad, onDelete, onClose }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const fmt = (ts) => new Date(ts).toLocaleDateString("es-ES", { day:"2-digit", month:"short", year:"numeric" });
  return (
    <div className="flow-templates-panel">
      <div className="flow-templates-head">
        <div>
          <div className="flow-templates-title">Mis plantillas</div>
          <div className="flow-templates-sub mono">{templates.length} flujo{templates.length !== 1 ? "s" : ""} guardado{templates.length !== 1 ? "s" : ""}</div>
        </div>
        <button className="tweaks-close" onClick={onClose}>✕</button>
      </div>
      <div className="flow-templates-body scroll-thin">
        {templates.length === 0 && (
          <div className="flow-templates-empty">
            <div style={{ fontSize: 28, marginBottom: 8 }}>💾</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>Sin plantillas todavía</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5 }}>
              Guarda el flujo actual con el botón "Guardar flujo" del canvas. Cada guardado es independiente.
            </div>
          </div>
        )}
        {templates.map(t => (
          <div key={t.id} className="flow-tpl-card">
            <div className="flow-tpl-info">
              <div className="flow-tpl-name">{t.name}</div>
              {t.description && <div className="flow-tpl-desc">{t.description}</div>}
              <div className="flow-tpl-meta mono">
                {t.nodeCount} nodos · {t.edgeCount} conex. · {fmt(t.createdAt)}
              </div>
            </div>
            <div className="flow-tpl-actions">
              <button className="flow-tpl-btn flow-tpl-btn-load" onClick={() => onLoad(t)}>
                Cargar
              </button>
              {confirmId === t.id ? (
                <button className="flow-tpl-btn flow-tpl-btn-del-confirm" onClick={() => { onDelete(t.id); setConfirmId(null); }}>
                  ¿Borrar?
                </button>
              ) : (
                <button className="flow-tpl-btn flow-tpl-btn-del" onClick={() => setConfirmId(t.id)}>✕</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tweaks Panel — toggle theme + accent
// ---------------------------------------------------------------------------
function TweaksPanel({ visible, onClose, theme, setTheme, accent, setAccent }) {
  if (!visible) return null;
  const accents = [
    { id: "violet", color: "#A78BFA" },
    { id: "teal",   color: "#34D399" },
    { id: "amber",  color: "#FBBF24" },
    { id: "rose",   color: "#FB7185" },
    { id: "blue",   color: "#7DD3FC" },
  ];
  return (
    <aside className="tweaks-panel">
      <div className="tweaks-head">
        <div>
          <div className="tweaks-title">Tweaks</div>
          <div className="tweaks-kicker mono">apariencia</div>
        </div>
        <button className="tweaks-close" onClick={onClose} aria-label="cerrar">✕</button>
      </div>

      <div className="tweak-row">
        <span className="tweak-row-label mono">Tema</span>
        <div className="theme-seg">
          <button
            className={"theme-seg-btn " + (theme === "dark" ? "is-on" : "")}
            onClick={() => setTheme("dark")}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
            Dark
          </button>
          <button
            className={"theme-seg-btn " + (theme === "light" ? "is-on" : "")}
            onClick={() => setTheme("light")}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
            Light
          </button>
        </div>
      </div>

      <div className="tweak-row">
        <span className="tweak-row-label mono">Color de acento</span>
        <div className="theme-swatches">
          {accents.map((a) => (
            <button
              key={a.id}
              className={"theme-swatch " + (accent === a.id ? "is-on" : "")}
              style={{ background: a.color }}
              onClick={() => setAccent(a.id)}
              aria-label={a.id}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}
// proxied — envuelve URLs de CDN externo a través del backend para DISPLAY.
// El navegador puede no alcanzar tempfile/supabase directo; el backend sí.
// NO usar para datos que van al backend (first_frame, reference_images, lastUrl).
function proxied(url) {
  if (!url || typeof url !== "string") return url;
  if (url.startsWith("data:") || url.startsWith("blob:")) return url;
  if (!/^https?:\/\//.test(url)) return url;
  const API = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "";
  return `${API}/generate/media-proxy?url=${encodeURIComponent(url)}`;
}

async function downloadAsset(url, filename) {
  try {
    const res = await fetch(proxied(url), { mode: "cors" });
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 4000);
    window.__notify?.({ kind: "info", icon: "↓", title: "Descargando", body: filename });
  } catch (e) {
    // Fallback: abrir en nueva pestaña si CORS bloquea el fetch
    window.open(url, "_blank");
    window.__notify?.({ kind: "info", icon: "↓", title: "Abriendo en pestaña", body: "Click derecho → Guardar" });
  }
}

function ImagePreview({ item, onClose }) {
  const isVideo = item.kind === "video" || /\.mp4($|\?)/i.test(item.url || "");
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const ext = isVideo ? "mp4" : (item.url?.startsWith("data:image/svg") ? "svg" : "png");
  const fname = `cliender-${item.kind || "asset"}-${item.id}.${ext}`;
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="cerrar">✕</button>
        <div className="lightbox-media">
          {isVideo ? (
            <video src={item.url} controls autoPlay loop playsInline
              style={{ width:'100%', height:'100%', maxHeight:'78vh', objectFit:'contain', display:'block', background:'#000' }}
              onError={(e)=>{ const v=e.currentTarget; if(!v.dataset.proxied){ v.dataset.proxied="1"; v.src=proxied(item.url); } }} />
          ) : (
            <img src={item.url} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }}
              onError={(e)=>{ const i=e.currentTarget; if(!i.dataset.proxied){ i.dataset.proxied="1"; i.src=proxied(item.url); } }} />
          )}
        </div>
        <div className="lightbox-meta">
          <div className="lightbox-tags">
            <span className="mono">{item.model}</span>
            {item.aspect && <span className="mono">· {item.aspect}</span>}
            {item.duration && <span className="mono">· {item.duration}</span>}
            {item.styleSource && <span className="mono">· {item.styleSource}</span>}
            <button className="lightbox-copy-prompt mono" title="Descargar"
              onClick={(e) => { e.stopPropagation(); downloadAsset(item.url, fname); }}>
              ↓ descargar {isVideo ? "vídeo" : "imagen"}
            </button>
            {item.prompt && (
              <button className="lightbox-copy-prompt mono" title="Copiar prompt"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(item.prompt); window.__notify?.({kind:'info',icon:'⎘',title:'Prompt copiado'}); }}>
                ⎘ copiar prompt
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SuperStage — vista dedicada de Supercomputer con orbes animados
// ---------------------------------------------------------------------------
const SWARM_AGENTS = [
  { key: "master_director", letter: "M", label: "MasterDirector", color: "#A78BFA" },
  { key: "scriptwriter",    letter: "S", label: "Scriptwriter",   color: "#7DD3FC" },
  { key: "cinematographer", letter: "C", label: "Cinematographer",color: "#C4B5FD" },
  { key: "production",      letter: "P", label: "Production",     color: "#FBBF24" },
  { key: "critic",          letter: "K", label: "Critic",         color: "#34D399" },
];
const HINTS_BIG = [];

function SuperStage({ prompt, setPrompt, onSubmit, onSubmitVideo, isProcessing, logs, nodeStatus, lastLogAt, clients, moodboards, lockedMb, dispatchMoodboards, activeClient: ctxClient, activeMoodboard: ctxMoodboard, setCtxClient, setCtxMoodboard, swarmArtifact }) {
  // Modo de salida: 'single' (1 imagen/vídeo) | 'video' (vídeo multi-escena desde storyboard)
  const [outputMode, setOutputMode] = useState('single');
  const [videoDuration, setVideoDuration] = useState(20);
  const [pickerOpen, setPickerOpen] = useState(null);
  // Usa el contexto global si viene, si no permite selección local
  const [localClientId, setLocalClientId] = useState(null);
  const activeClientId = ctxClient?.id || localClientId;
  const setActiveClientId = (id) => { setLocalClientId(id); if (setCtxClient) setCtxClient(id); };
  const activeClient = ctxClient || clients?.find((c) => c.id === localClientId);
  const activeMb = ctxMoodboard || moodboards?.find((m) => m.locked);
  const canLaunch = prompt.trim().length > 4;
  const [refImages, setRefImages] = useState([]); // {id, url(data:base64), name}, max 2
  const [refAnalysis, setRefAnalysis] = useState(null); // {status, colorPalette, lightingStyle, masterStylePrompt, moodKeywords, cameraLensFeel, consistencyScore}
  const [swarmModalOpen, setSwarmModalOpen] = useState(true); // permite cerrar el popup central sin abortar el swarm
  // Auto-abrir el modal cuando arranca un nuevo swarm
  useEffect(() => { if (isProcessing) setSwarmModalOpen(true); }, [isProcessing]);

  const handleRefUpload = async (e) => {
    const file = e.target.files?.[0];
    // Reset value first so re-selecting same filename still fires onChange
    if (e.target) e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    const _maxRefs = outputMode === 'video' ? 4 : 2;
    if (refImages.length >= _maxRefs) return;
    try {
      const url = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });
      setRefImages(prev => prev.length >= _maxRefs ? prev : [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, url, name: file.name }].slice(0, _maxRefs));
    } catch (err) {
      console.warn('refUpload error', err);
    }
  };

  // Análisis previo de las refs subidas — llama a /moodboards/audit y guarda el manifest
  useEffect(() => {
    if (refImages.length === 0) { setRefAnalysis(null); return; }
    let cancelled = false;
    setRefAnalysis({ status: 'analyzing' });
    (async () => {
      try {
        const mf = await window.__auditWithPolling({
          moodboard_id: `temp-super-${Date.now()}`,
          name: 'Supercomputer refs',
          images: refImages.map((img, i) => ({ id: `r${i}-${img.id}`, url: img.url })),
        }) || {};
        if (cancelled) return;
        setRefAnalysis({
          status: 'ready',
          colorPalette: mf.color_palette || [],
          colorGrading: mf.color_grading || '',
          lightingStyle: mf.lighting_style || '',
          masterStylePrompt: mf.master_style_prompt || '',
          negativePrompt: mf.negative_prompt || '',
          moodKeywords: mf.mood_keywords || [],
          cameraLensFeel: mf.camera_lens_feel || '',
          typography: mf.typography || [],
          textContent: mf.text_content || [],
          filtersEffects: mf.filters_effects || [],
          compositionLayers: mf.composition_layers || [],
          compositionRules: mf.composition_rules || [],
          characters: mf.characters || [],
          consistencyScore: mf.consistency_score || 0,
        });
      } catch (e) {
        if (cancelled) return;
        setRefAnalysis({ status: 'error', error: e.message });
        window.__notify?.({
          kind: "error", icon: "✖", title: "Error analizando referencias",
          body: e.message?.slice(0, 120) || "No se pudo conectar con el backend.",
        });
      }
    })();
    return () => { cancelled = true; };
  }, [refImages.map(r => r.id).join('|')]);


  // Payload reutilizable para onSubmit / ⌘+Enter — preserva client + refs + ADN
  const buildPayload = () => ({
    client: activeClient,
    refImages: refImages.map(r => r.url),
    durationS: videoDuration,
    refAnalysis: refAnalysis?.status === 'ready' ? {
      color_palette: refAnalysis.colorPalette,
      lighting_style: refAnalysis.lightingStyle,
      master_style_prompt: refAnalysis.masterStylePrompt,
      mood_keywords: refAnalysis.moodKeywords,
      camera_lens_feel: refAnalysis.cameraLensFeel,
      consistency_score: refAnalysis.consistencyScore,
    } : null,
  });

  // Lanza según el modo: single → swarm (1 asset) · video → storyboard multi-escena
  const launch = () => {
    const payload = buildPayload();
    if (outputMode === 'video') { (onSubmitVideo || onSubmit)(payload); }
    else { onSubmit(payload); }
  };

  return (
    <section className="cortex-stage">
      {/* fondo/grano/inner conservados como contenedores; supercomputer.css los neutraliza */}
      <div className="cortex-bg" aria-hidden="true" />
      <div className="cortex-grain" aria-hidden="true" />

      <div className="cortex-inner">
        <div className="sc-shell">
          <div className="sc-column">

            {/* ── Hero editorial serif ── */}
            <header className="sc-hero">
              <span className="sc-kicker">creative supercomputer</span>
              <h1 className="sc-display">
                Un brief.<br /><em>El resto sucede solo.</em>
              </h1>
              <p className="sc-subcopy">
                Describe lo que imaginas. Cinco agentes —dirección, guion, fotografía,
                producción y crítica— lo orquestan en una sola pieza.
              </p>
            </header>

            <hr className="sc-rule" />

            {/* ── Selector de modo de salida ── */}
            <div className="sc-block">
              <div className="sc-mode-toggle">
                <button
                  type="button"
                  className={'sc-mode-btn ' + (outputMode === 'single' ? 'is-active' : '')}
                  onClick={() => setOutputMode('single')}
                  disabled={isProcessing}
                >
                  <span className="sc-mode-title">Pieza única</span>
                  <span className="sc-mode-sub">1 imagen o vídeo</span>
                </button>
                <button
                  type="button"
                  className={'sc-mode-btn ' + (outputMode === 'video' ? 'is-active' : '')}
                  onClick={() => setOutputMode('video')}
                  disabled={isProcessing}
                >
                  <span className="sc-mode-title">Vídeo storyboard</span>
                  <span className="sc-mode-sub">secuencia multi-escena</span>
                </button>
              </div>
              {outputMode === 'video' && (
                <div className="sc-duration">
                  <span className="sc-duration-k">duración</span>
                  <input
                    type="range" min="5" max="40" step="5"
                    value={videoDuration}
                    onChange={(e) => setVideoDuration(Number(e.target.value))}
                    disabled={isProcessing}
                  />
                  <span className="sc-duration-v">{videoDuration}s</span>
                  <span className="sc-duration-hint">· sube una imagen que explique la secuencia escena por escena ↓</span>
                </div>
              )}
            </div>

            {/* ── Contexto heredado del topbar (solo lectura) ── */}
            <div className="sc-block">
              <div className="sc-context">
                <div className="sc-ctx-item">
                  <span className="sc-ctx-dot" style={activeClient?.palette?.[0] ? { background: activeClient.palette[0] } : undefined} />
                  <span className="sc-ctx-k">cliente</span>
                  <span className="sc-ctx-v">{activeClient ? activeClient.name : 'Ninguno'}</span>
                </div>
                <div className="sc-ctx-sep" />
                <div className="sc-ctx-item">
                  <span className="sc-ctx-dot" style={activeMb?.locked ? { background: 'var(--sc-ok)' } : undefined} />
                  <span className="sc-ctx-k">moodboard</span>
                  <span className="sc-ctx-v">{activeMb?.name || 'Ninguno'}{activeMb?.locked ? ' 🔒' : ''}</span>
                </div>
                <span className="sc-ctx-hint">cámbialo en el topbar ↑</span>
              </div>
            </div>

            {/* ── Referencias visuales (máx 2) ── */}
            <div className="sc-block">
              <div className="sc-label">
                {outputMode === 'video' ? 'storyboard + referencias' : 'referencias visuales'}
                <span className="sc-label-aside">
                  {refImages.length}/{outputMode === 'video' ? 4 : 2} {refImages.length > 0
                    ? (outputMode === 'video' ? '· secuencia + personaje' : '· el enjambre las usará')
                    : (outputMode === 'video' ? '· sube la secuencia escena-por-escena' : '· opcional')}
                </span>
              </div>
              <div className="sc-refs">
                {refImages.map((img) => (
                  <div key={img.id} className="sc-ref-thumb">
                    <img src={img.url} alt="referencia visual" />
                    <button
                      type="button"
                      className="sc-ref-remove"
                      onClick={() => setRefImages(r => r.filter(x => x.id !== img.id))}
                      title="Quitar"
                    >×</button>
                  </div>
                ))}
                {refImages.length < (outputMode === 'video' ? 4 : 2) && (
                  <label className="sc-ref-add" title="Añadir imagen de referencia">
                    +
                    <input key={`ref-input-${refImages.length}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefUpload} />
                  </label>
                )}
              </div>

              {refAnalysis && (
                <div className="sc-dna">
                  {refAnalysis.status === 'analyzing' && (
                    <div className="sc-dna-row">
                      <span className="sc-spin" aria-hidden="true" />
                      <span className="sc-dna-k" style={{ minWidth: 'auto' }}>Analizando referencias visuales…</span>
                    </div>
                  )}
                  {refAnalysis.status === 'ready' && (
                    <>
                      <div className="sc-dna-row" style={{ marginBottom: 4 }}>
                        <span className="sc-dna-k sc-dna-ok" style={{ minWidth: 'auto' }}>✓ ADN visual extraído</span>
                        {refAnalysis.consistencyScore > 0 && (
                          <span className="sc-dna-k" style={{ marginLeft: 'auto', minWidth: 'auto' }}>
                            coherencia {Math.round(refAnalysis.consistencyScore * 100)}%
                          </span>
                        )}
                      </div>
                      {refAnalysis.colorPalette.length > 0 && (
                        <div className="sc-dna-row">
                          <span className="sc-dna-k">paleta</span>
                          {refAnalysis.colorPalette.slice(0,6).map((c, i) => (
                            <div key={i} title={c} className="sc-dna-swatch" style={{ background: c }} />
                          ))}
                        </div>
                      )}
                      {refAnalysis.lightingStyle && (
                        <div className="sc-dna-row">
                          <span className="sc-dna-k">luz</span>
                          <span style={{ flex: 1 }}>{refAnalysis.lightingStyle.slice(0, 90)}</span>
                        </div>
                      )}
                      {refAnalysis.moodKeywords.length > 0 && (
                        <div className="sc-dna-row" style={{ flexWrap: 'wrap' }}>
                          <span className="sc-dna-k">mood</span>
                          {refAnalysis.moodKeywords.slice(0,5).map((k, i) => (
                            <span key={i} className="sc-dna-chip">{k}</span>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {refAnalysis.status === 'error' && (
                    <div className="sc-dna-row" style={{ color: 'var(--sc-err)' }}>
                      Error analizando referencias: {(refAnalysis.error || '').slice(0,60)}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── Brief ── */}
            <div className="sc-block">
              <div className="sc-label">tu brief</div>
              <div className="sc-brief">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canLaunch) launch(); }}
                  rows={3}
                  placeholder={outputMode === 'video'
                    ? 'Ej: vídeo de 20s para el Mundial 2026 con Neymar, siguiendo la secuencia de la imagen de referencia. Hook impactante, nostalgia y amor por el fútbol.'
                    : 'Describe lo que quieres crear. El enjambre lo orquesta.'}
                  disabled={isProcessing}
                />
                <div className="sc-brief-foot">
                  <span className="sc-brief-hint">⌘ + ⏎ · lanzar</span>
                  <button
                    type="button"
                    className="sc-launch"
                    onClick={launch}
                    disabled={!canLaunch || isProcessing}
                  >
                    <Icon.Play style={{ width: 13, height: 13 }} />
                    {isProcessing
                      ? 'Orquestando…'
                      : (outputMode === 'video' ? 'Generar vídeo' : 'Lanzar enjambre')}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── Swarm live MODAL POPUP CENTRAL ── */}
      {(logs.length > 0 || isProcessing || swarmArtifact) && swarmModalOpen && (
        <div
          className="swarm-modal-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setSwarmModalOpen(false); }}
        >
          <div className="swarm-modal-card" role="dialog" aria-modal="true" aria-label="Enjambre en vivo">
            {/* Header */}
            <div className="swarm-modal-head">
              <div className="swarm-modal-title-wrap">
                <span className="swarm-modal-pulse" aria-hidden="true" />
                <span className="swarm-modal-title mono">ENJAMBRE EN VIVO</span>
              </div>
              <button
                type="button"
                className="swarm-modal-close"
                onClick={() => setSwarmModalOpen(false)}
                aria-label="Cerrar (el enjambre sigue corriendo en segundo plano)"
                title="Cerrar (sigue en background)"
              >×</button>
            </div>

            {/* Petición original */}
            {prompt && (
              <div className="swarm-modal-section">
                <div className="swarm-modal-label mono">TU PETICIÓN</div>
                <div className="swarm-modal-prompt">“{prompt}”</div>
              </div>
            )}

            {/* Progress + badges */}
            <div className="swarm-modal-section">
              <div className="swarm-modal-label mono">PROGRESS</div>
              <div className="swarm-progress-wrap">
                <div className="swarm-bar-track">
                  <div className="swarm-bar-fill" style={{
                    width: (() => {
                      const done = Object.values(nodeStatus).filter(s => s === 'done').length;
                      return `${Math.round((done / 5) * 100)}%`;
                    })(),
                  }} />
                </div>
                <div className="swarm-agent-badges">
                  {[
                    { key: 'master_director', label: 'Director' },
                    { key: 'scriptwriter',    label: 'Script' },
                    { key: 'cinematographer', label: 'Cine' },
                    { key: 'production',      label: 'Prod' },
                    { key: 'critic',          label: 'Critic' },
                  ].map(({ key, label }) => {
                    const st = nodeStatus[key] || 'idle';
                    return (
                      <div key={key} className={`swarm-badge swarm-badge--${st}`}>
                        {st === 'done' ? <span className="swarm-badge-check">✓</span>
                          : st === 'running' ? <span className="swarm-badge-spin" />
                          : st === 'rejected' || st === 'error' ? <span className="swarm-badge-x">✕</span>
                          : null}
                        <span className="swarm-badge-label">{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Logs */}
            <div className="swarm-modal-section">
              <div className="swarm-modal-label mono">LOG VIVO</div>
              <div className="swarm-logs swarm-modal-logs">
                {logs.map((l) => {
                  const p = ({'MasterDirector':'#A78BFA','Scriptwriter':'#60A5FA','Cinematographer':'#8B5CF6','Production':'#F59E0B','Critic':'#10B981','VisionAuditor':'#22D3EE'})[l.agentName] || '#71717A';
                  return (
                    <div key={l.id} className={`swarm-log-row ${l.status === 'error' ? 'is-error' : ''}`}>
                      <span className="swarm-log-dot" style={{ background: p, boxShadow: `0 0 5px ${p}` }} />
                      <span className="swarm-log-agent" style={{ color: p }}>[{l.agentName}]</span>
                      <span className="swarm-log-msg">{l.message}</span>
                      {l.status === 'running' && <span className="swarm-log-running mono">running…</span>}
                    </div>
                  );
                })}
                {isProcessing && logs.length > 0 && (
                  <div className="swarm-thinking">
                    <span className="led-dot led-breath" style={{ background: '#8B5CF6', boxShadow: '0 0 8px #8B5CF6' }} />
                    <span className="mono" style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>enjambre procesando…</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resultado */}
            <div className="swarm-modal-section">
              <div className="swarm-modal-label mono">RESULTADO</div>
              {swarmArtifact ? (
                <div className="swarm-result">
                  {swarmArtifact.stub ? (
                    <div className="swarm-result-stub">
                      <span className="mono" style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>KIE_API_KEY no configurada · Stub mode</span>
                      <div className="swarm-result-prompt">{swarmArtifact.prompt?.slice(0, 120)}…</div>
                      <div className="swarm-result-model mono">{swarmArtifact.model_id} · {swarmArtifact.media_kind}</div>
                    </div>
                  ) : swarmArtifact.url ? (
                    swarmArtifact.media_kind === 'video' ? (
                      <video className="swarm-result-media" src={swarmArtifact.url} controls autoPlay muted loop playsInline />
                    ) : (
                      <img className="swarm-result-media" src={swarmArtifact.url} alt="Resultado del enjambre" />
                    )
                  ) : null}
                  <div className="swarm-result-meta mono" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>
                      <span>{swarmArtifact.model_id}</span>
                      {swarmArtifact.media_kind === 'video' && <span> · {swarmArtifact.duration_s || 5}s</span>}
                      {swarmArtifact.stub && <span style={{ color: '#F59E0B' }}> · STUB</span>}
                    </span>
                    {swarmArtifact.url && (
                      <a href={swarmArtifact.url} download className="swarm-modal-download" target="_blank" rel="noreferrer">descargar</a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="swarm-tech-loader">
                  <div className="swarm-tech-loader-core">
                    <div className="swarm-tech-loader-orb" />
                    <div className="swarm-tech-loader-label">Sintetizando resultado</div>
                    <div className="swarm-tech-loader-dots">
                      <div className="swarm-tech-loader-dot" />
                      <div className="swarm-tech-loader-dot" />
                      <div className="swarm-tech-loader-dot" />
                      <div className="swarm-tech-loader-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Botón flotante para re-abrir el modal si se cerró mientras corre */}
      {(logs.length > 0 || isProcessing || swarmArtifact) && !swarmModalOpen && (
        <button
          type="button"
          className="swarm-reopen-fab"
          onClick={() => setSwarmModalOpen(true)}
        >
          <span className="swarm-modal-pulse" />
          <span className="mono">ver enjambre</span>
        </button>
      )}


      {pickerOpen && (
        <PickerPopup
          kind={pickerOpen}
          clients={clients}
          moodboards={moodboards}
          activeClientId={activeClientId}
          setActiveClientId={setActiveClientId}
          dispatchMoodboards={dispatchMoodboards}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CortexSwarm — animación cinemática de un enjambre orbital de agentes
// ---------------------------------------------------------------------------
function CortexSwarm({ agents, active }) {
  return (
    <div className={'cortex-swarm-inner ' + (active ? 'is-active' : '')}>
      <svg className="cortex-svg" viewBox="-260 -180 520 360" aria-hidden="true">
        <defs>
          <radialGradient id="cortex-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="20%"  stopColor="var(--accent-2)" stopOpacity="0.85" />
            <stop offset="55%"  stopColor="var(--accent)"   stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--accent)"   stopOpacity="0" />
          </radialGradient>
          <radialGradient id="cortex-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="var(--accent)" stopOpacity="0.30" />
            <stop offset="60%"  stopColor="var(--accent)" stopOpacity="0.05" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </radialGradient>
          <filter id="cortex-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* anillos orbitales */}
        {[60, 100, 140, 180, 220].map((r, i) => (
          <ellipse key={r} cx="0" cy="0" rx={r} ry={r * 0.42}
            fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="1"
            strokeDasharray={i % 2 ? '2 6' : '1 9'}
            style={{ transformOrigin: '0 0', transform: `rotate(${i * 8 - 20}deg)` }}
          />
        ))}

        {/* halo de fondo */}
        <circle cx="0" cy="0" r="180" fill="url(#cortex-halo)" />
        {/* core luminoso */}
        <circle cx="0" cy="0" r="44" fill="url(#cortex-core)" />
        <circle cx="0" cy="0" r="6" fill="#FFFFFF" opacity="0.95">
          <animate attributeName="r" values="5;9;5" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.8;1;0.8" dur="2.4s" repeatCount="indefinite" />
        </circle>

        {/* enjambre orbital */}
        {agents.map((a) => {
          const rx = a.radius;
          const ry = a.radius * 0.42;
          const path = `M ${rx},0 A ${rx},${ry} 0 1,1 ${-rx},0 A ${rx},${ry} 0 1,1 ${rx},0`;
          return (
            <g key={a.id} style={{ transformOrigin: '0 0', transform: `rotate(${a.tilt}deg)` }}>
              <path d={path} fill="none" stroke={a.color} strokeWidth="0.5"
                strokeDasharray="1 220" opacity="0.20" />
              <circle r={a.size} fill={a.color} filter="url(#cortex-glow)">
                <animateMotion dur={a.speed + 's'} repeatCount="indefinite" path={path}
                  rotate="auto" begin={`-${(a.phase / (2*Math.PI)) * a.speed}s`} />
                <animate attributeName="opacity" values="0.4;1;0.4" dur={a.speed * 0.6 + 's'} repeatCount="indefinite" />
              </circle>
              {/* trail dot */}
              <circle r={a.size * 0.55} fill={a.color} opacity="0.5">
                <animateMotion dur={a.speed + 's'} repeatCount="indefinite" path={path}
                  rotate="auto" begin={`-${(a.phase / (2*Math.PI)) * a.speed + 0.18}s`} />
              </circle>
              <circle r={a.size * 0.32} fill={a.color} opacity="0.25">
                <animateMotion dur={a.speed + 's'} repeatCount="indefinite" path={path}
                  rotate="auto" begin={`-${(a.phase / (2*Math.PI)) * a.speed + 0.36}s`} />
              </circle>
            </g>
          );
        })}

        {/* particle bursts saliendo del core */}
        {[0, 0.4, 0.8, 1.2, 1.6, 2.0].map((delay, i) => (
          <circle key={'b'+i} r="1.5" fill="var(--accent-2)" opacity="0">
            <animate attributeName="r" from="1" to="60" dur="2.4s" begin={delay + 's'} repeatCount="indefinite" />
            <animate attributeName="opacity" values="0;0.4;0" dur="2.4s" begin={delay + 's'} repeatCount="indefinite" />
          </circle>
        ))}
      </svg>

      <div className="cortex-orb-label">
        <span className="mono">{agents.length} agents · live</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CortexSlot — selector elegante en el brief
// ---------------------------------------------------------------------------
function CortexSlot({ kind, label, value, hint, avatar, bg, onClick, locked }) {
  return (
    <button className={'cortex-slot ' + (locked ? 'is-locked' : '')} onClick={onClick}>
      <div className="cortex-slot-avatar" style={bg ? { background: bg } : null}>
        {avatar ? <span>{avatar}</span> : <span className="cortex-slot-plus">+</span>}
      </div>
      <div className="cortex-slot-meta">
        <div className="cortex-slot-label mono">{label}</div>
        <div className="cortex-slot-value">{value}</div>
        <div className="cortex-slot-hint mono">{hint}</div>
      </div>
      <div className="cortex-slot-arrow">→</div>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Brief subcomponents
// ---------------------------------------------------------------------------

function PickerPopup({ kind, clients, moodboards, activeClientId, setActiveClientId, dispatchMoodboards, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const title = kind === "client" ? "Elegir cliente" : "Elegir moodboard";
  return (
    <div className="picker-backdrop" onClick={onClose}>
      <div className="picker-popup" onClick={(e) => e.stopPropagation()}>
        <header className="picker-head">
          <div>
            <div className="picker-kicker mono">brief</div>
            <div className="picker-title">{title}</div>
          </div>
          <button className="super-close" onClick={onClose}>✕</button>
        </header>
        <div className="picker-body scroll-thin">
          {kind === "client" && clients.map((c) => (
            <button
              key={c.id}
              className={"picker-row " + (activeClientId === c.id ? "is-on" : "")}
              onClick={() => { setActiveClientId(c.id); onClose(); }}
            >
              <div className="picker-row-avatar" style={{ background: c.bgGradient }}>
                <span>{c.initials}</span>
              </div>
              <div className="picker-row-meta">
                <div className="picker-row-title">{c.name}</div>
                <div className="picker-row-sub mono">{c.industry} · "{c.tagline}"</div>
              </div>
              <div className="picker-row-side">
                <div className="client-palette-mini">
                  {c.palette.slice(0, 4).map((p, i) => <span key={i} style={{ background: p }} />)}
                </div>
              </div>
            </button>
          ))}
          {kind === "client" && (
            <button className="picker-row picker-row-clear" onClick={() => { setActiveClientId(null); onClose(); }}>
              <div className="picker-row-meta" style={{ textAlign: "center" }}>
                <div className="picker-row-title mono" style={{ color: "var(--text-3)" }}>Sin cliente</div>
              </div>
            </button>
          )}
          {kind === "moodboard" && moodboards.map((m) => (
            <button
              key={m.id}
              className={"picker-row " + (m.locked ? "is-locked" : "")}
              onClick={() => {
                if (!m.locked) dispatchMoodboards({ type: "TOGGLE_LOCK", id: m.id });
                onClose();
              }}
            >
              <div className="picker-row-thumbs">
                {m.images.slice(0, 3).map((img, i) => (
                  <div key={i} className="picker-row-thumb" style={{ backgroundImage: `url(${img.url})` }} />
                ))}
              </div>
              <div className="picker-row-meta">
                <div className="picker-row-title">{m.name}</div>
                <div className="picker-row-sub mono">
                  {m.images.length} refs · consist {(m.manifest?.consistencyScore ?? 0).toFixed(2)}
                  {m.locked && " · LOCKED"}
                </div>
              </div>
              <div className="picker-row-side">
                {m.manifest?.colorPalette && (
                  <div className="client-palette-mini">
                    {m.manifest.colorPalette.slice(0, 4).map((p, i) => <span key={i} style={{ background: p }} />)}
                  </div>
                )}
              </div>
            </button>
          ))}
          {kind === "moodboard" && (
            <button className="picker-row picker-row-clear" onClick={() => {
              moodboards.filter((m) => m.locked).forEach((m) => dispatchMoodboards({ type: "TOGGLE_LOCK", id: m.id }));
              onClose();
            }}>
              <div className="picker-row-meta" style={{ textAlign: "center" }}>
                <div className="picker-row-title mono" style={{ color: "var(--text-3)" }}>Sin moodboard</div>
              </div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
const AGENT_PALETTE = {
  MasterDirector:  { dot: "#A78BFA", color: "#C4B5FD" },
  Scriptwriter:    { dot: "#60A5FA", color: "#93C5FD" },
  Cinematographer: { dot: "#8B5CF6", color: "#C4B5FD" },
  Production:      { dot: "#F59E0B", color: "#FCD34D" },
  Critic:          { dot: "#10B981", color: "#6EE7B7" },
  VisionAuditor:   { dot: "#22D3EE", color: "#67E8F9" },
  System:          { dot: "#52525B", color: "#A1A1AA" },
};
function StatusChip({ status }) {
  if (status === "running") return <span className="status-chip" style={{ color: "var(--accent-3)" }}><span className="led-dot led-breath" style={{ background: "#8B5CF6", boxShadow: "0 0 8px #8B5CF6" }} />running</span>;
  if (status === "done")    return <span className="status-chip" style={{ color: "#6EE7B7" }}><span className="led-dot" style={{ background: "#10B981", boxShadow: "0 0 8px #10B981" }} />done</span>;
  if (status === "error")   return <span className="status-chip" style={{ color: "#FCA5A5" }}><span className="led-dot" style={{ background: "#EF4444", boxShadow: "0 0 8px #EF4444" }} />error</span>;
  return null;
}
function LogBubble({ log }) {
  const p = AGENT_PALETTE[log.agentName] || AGENT_PALETTE.System;
  return (
    <div className="log">
      <div className="log-head">
        <span className="log-agent" style={{ color: p.color }}>
          <span className="dot" style={{ background: p.dot, boxShadow: `0 0 6px ${p.dot}` }} />
          [{log.agentName}]
        </span>
        <StatusChip status={log.status} />
      </div>
      <div className="log-msg">{log.message}</div>
      {log.meta?.modelId && (
        <div className="log-meta-chip">
          <span className="dot" style={{ background: "#8B5CF6", boxShadow: "0 0 6px #8B5CF6" }} />
          model: {log.meta.modelId}
        </div>
      )}
    </div>
  );
}
function ThinkingIndicator() {
  return (
    <div className="thinking">
      enjambre pensando
      <span className="thinking-dots"><span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" /></span>
    </div>
  );
}
function SuperPanel({ open, onClose, logs, isProcessing, prompt, setPrompt, onSubmit, lastLogAt }) {
  const scrollRef = useRef(null);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [logs.length]);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isProcessing) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [isProcessing]);
  const showThinking = isProcessing && now - lastLogAt > 600;
  const hints = [];
  return (
    <aside className={"super-panel " + (open ? "is-open" : "")}>
      <div className="super-header">
        <div className="super-header-left">
          <div className="super-header-icon"><span className="pulse-dot" /></div>
          <div>
            <div className="super-title">Supercomputer</div>
            <div className="super-kicker">{isProcessing ? "swarm · active" : "swarm · idle"}</div>
          </div>
        </div>
        <button className="super-close" onClick={onClose}>✕</button>
      </div>
      <div className="super-logs scroll-thin" ref={scrollRef}>
        {logs.length === 0 && !isProcessing ? (
          <div className="super-empty">
            <div>
              <div className="super-empty-kicker">enjambre listo</div>
              <div className="super-empty-title">Describe tu petición creativa.</div>
              <div className="super-empty-body">
                MasterDirector planifica · Cinematographer elige modelo Kid.ai · Production ejecuta · Critic aprueba.
              </div>
              <div className="super-empty-hints">
                {hints.map((h) => (
                  <button key={h} className="super-empty-hint" onClick={() => setPrompt(h)}>{h}</button>
                ))}
              </div>
            </div>
          </div>
        ) : logs.map((l) => <LogBubble key={l.id} log={l} />)}
        {showThinking && <ThinkingIndicator />}
      </div>
      <div className="composer">
        <div className="composer-box">
          <textarea className="composer-textarea" value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") onSubmit(); }}
            rows={3} disabled={isProcessing}
            placeholder="Ej: Spot vertical 9:16 de un perfume con físicas líquidas…" />
          <div className="composer-bar">
            <span className="composer-hint">⌘ + ⏎ · enviar</span>
            <button className="btn-primary" onClick={onSubmit} disabled={!prompt.trim() || isProcessing}>
              <Icon.Play style={{ width: 11, height: 11 }} />
              {isProcessing ? "Generando…" : "Generar"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}

// ---------------------------------------------------------------------------
// ContextBar — selector de contexto activo (cliente + moodboard)
// ---------------------------------------------------------------------------
function ContextBar({ clients, moodboards, activeClient, activeMoodboard, setCtxClient, setCtxMoodboard }) {
  const [clientOpen, setClientOpen] = React.useState(false);
  const [mbOpen, setMbOpen] = React.useState(false);

  const clientMbs = activeMoodboard
    ? [activeMoodboard]
    : moodboards.filter((m) => !activeClient || m.clientId === activeClient.id || !m.clientId);

  return (
    <div className="ctx-bar">
      {/* Separador visual */}
      <div className="ctx-bar-label">Contexto activo</div>

      {/* Selector cliente */}
      <div className="ctx-selector" onClick={() => { setClientOpen((v) => !v); setMbOpen(false); }}>
        {activeClient
          ? <>
              <div className="ctx-avatar" style={{ background: activeClient.bgGradient || 'var(--accent)' }}>
                {activeClient.initials}
              </div>
              <div className="ctx-info">
                <div className="ctx-info-name">{activeClient.name}</div>
                <div className="ctx-info-sub">{activeClient.tagline || 'cliente'}</div>
              </div>
            </>
          : <>
              <div className="ctx-avatar ctx-avatar-empty">✕</div>
              <div className="ctx-info">
                <div className="ctx-info-name">Sin cliente</div>
                <div className="ctx-info-sub">elige para dar contexto</div>
              </div>
            </>}
        <span className="ctx-caret">▾</span>

        {clientOpen && (
          <div className="ctx-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="ctx-dropdown-head">Selecciona cliente</div>
            {activeClient && (
              <button className="ctx-dropdown-row ctx-dropdown-clear"
                onClick={() => { setCtxClient(null); setCtxMoodboard(null); setClientOpen(false); }}>
                ✕ Sin cliente
              </button>
            )}
            {clients.map((c) => (
              <button key={c.id}
                className={'ctx-dropdown-row ' + (activeClient?.id === c.id ? 'is-active' : '')}
                onClick={() => { setCtxClient(c.id); setCtxMoodboard(null); setClientOpen(false); }}>
                <div className="ctx-row-avatar" style={{ background: c.bgGradient || 'var(--accent)' }}>{c.initials}</div>
                <div>
                  <div className="ctx-row-name">{c.name}</div>
                  <div className="ctx-row-sub">{c.tagline || ''}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="ctx-sep">»</div>

      {/* Selector moodboard */}
      <div className="ctx-selector" onClick={() => { setMbOpen((v) => !v); setClientOpen(false); }}>
        {activeMoodboard
          ? <>
              <div className="ctx-mb-dot" style={{ background: activeMoodboard.manifest?.colorPalette?.[0] || 'var(--accent-2)' }} />
              <div className="ctx-info">
                <div className="ctx-info-name">{activeMoodboard.name}</div>
                <div className="ctx-info-sub">{activeMoodboard.images?.length || 0} refs · ADN activo</div>
              </div>
            </>
          : <>
              <div className="ctx-mb-dot ctx-mb-dot-empty" />
              <div className="ctx-info">
                <div className="ctx-info-name">Sin moodboard</div>
                <div className="ctx-info-sub">elige estilo visual</div>
              </div>
            </>}
        <span className="ctx-caret">▾</span>

        {mbOpen && (
          <div className="ctx-dropdown" onClick={(e) => e.stopPropagation()}>
            <div className="ctx-dropdown-head">Selecciona moodboard</div>
            {activeMoodboard && (
              <button className="ctx-dropdown-row ctx-dropdown-clear"
                onClick={() => { setCtxMoodboard(null); setMbOpen(false); }}>
                ✕ Sin moodboard
              </button>
            )}
            {moodboards.length === 0 && (
              <div className="ctx-dropdown-empty">No hay moodboards. Crea uno en el vault.</div>
            )}
            {moodboards.map((m) => (
              <button key={m.id}
                className={'ctx-dropdown-row ' + (activeMoodboard?.id === m.id ? 'is-active' : '')}
                onClick={() => { setCtxMoodboard(m.id); setMbOpen(false); }}>
                <div className="ctx-mb-swatch" style={{ background: m.manifest?.colorPalette?.[0] || '#A78BFA' }} />
                <div>
                  <div className="ctx-row-name">{m.name}</div>
                  <div className="ctx-row-sub">{m.images?.length || 0} refs{m.manifest ? ' · ADN ✓' : ''}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Badge contexto activo */}
      {(activeClient || activeMoodboard) && (
        <div className="ctx-active-badge">
          ✦ Contexto listo
        </div>
      )}
    </div>
  );
}

// ConfirmHost — modal global de confirmacion/input (reemplaza window.confirm/prompt,
// que congelan la pestana y fallan en WebView). Expone window.__confirm y window.__askInput.
// ---------------------------------------------------------------------------
function ConfirmHost() {
  const [state, setState] = React.useState(null);
  const [val, setVal] = React.useState("");
  React.useEffect(() => {
    window.__confirm = (message, opts) => new Promise((resolve) => {
      setState({ mode: "confirm", message, opts: opts || {}, resolve });
    });
    window.__askInput = (message, defaultValue, opts) => new Promise((resolve) => {
      setVal(defaultValue || "");
      setState({ mode: "prompt", message, opts: opts || {}, resolve });
    });
    return () => { delete window.__confirm; delete window.__askInput; };
  }, []);
  if (!state) return null;
  const close = (result) => { const r = state.resolve; setState(null); r && r(result); };
  const isPrompt = state.mode === "prompt";
  const danger = !!(state.opts && state.opts.danger);
  const accent = danger ? "#FB7185" : "#6366F1";
  const modal = (
    <div onClick={() => close(isPrompt ? null : false)}
      style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(8,8,16,0.74)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "grid", placeItems: "center", animation: "cdpModalIn 160ms ease-out" }}>
      <style>{`@keyframes cdpModalIn{from{opacity:0}to{opacity:1}}`}</style>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "min(420px,92vw)", borderRadius: 16, background: "linear-gradient(160deg,#17171f,#0e0e16)", border: "1px solid " + accent + "55", boxShadow: "0 24px 80px rgba(0,0,0,0.6)", padding: 24 }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#EBEAE4", lineHeight: 1.4 }}>{state.message}</div>
        {isPrompt && (
          <input autoFocus value={val} onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") close(val.trim() || null); if (e.key === "Escape") close(null); }}
            placeholder={(state.opts && state.opts.placeholder) || ""}
            style={{ width: "100%", marginTop: 14, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(99,102,241,0.35)", color: "#EBEAE4", fontSize: 14, outline: "none", boxSizing: "border-box" }} />
        )}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={() => close(isPrompt ? null : false)}
            style={{ cursor: "pointer", padding: "8px 16px", borderRadius: 9, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#94a3b8", fontSize: 13, fontWeight: 600 }}>
            {(state.opts && state.opts.cancelText) || "Cancelar"}
          </button>
          <button autoFocus={!isPrompt} onClick={() => close(isPrompt ? (val.trim() || null) : true)}
            style={{ cursor: "pointer", padding: "8px 16px", borderRadius: 9, background: accent, border: "none", color: "#fff", fontSize: 13, fontWeight: 700 }}>
            {(state.opts && state.opts.confirmText) || (danger ? "Eliminar" : "Aceptar")}
          </button>
        </div>
      </div>
    </div>
  );
  return (typeof ReactDOM !== "undefined" && ReactDOM.createPortal) ? ReactDOM.createPortal(modal, document.body) : modal;
}

// ---------------------------------------------------------------------------
// Mount
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <NotificationProvider>
    <App />
    <ConfirmHost />
  </NotificationProvider>
);
