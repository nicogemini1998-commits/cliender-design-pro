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
const NoteNode = window.NoteNode;
const OutputNode = window.OutputNode;
const Icon = window.Icon;
const StatusDot = window.StatusDot;


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
    modelId: "veo3",
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
  }),
  output: () => ({
    status: "done",
    kind: "image",     // 'image' | 'video'
    modelId: null,
    items: [],         // [{id, url, prompt, duration?}]
  }),
};

const NODE_SIZE = {
  prompt: { w: 360, h: 280 },
  image:  { w: 360, h: 760 },
  video:  { w: 380, h: 940 },
  note:   { w: 260, h: 220 },
  output: { w: 420, h: 380 },
  group:  { w: 600, h: 400 },
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
          {/* Hero preview */}
          <div className="form-hero" style={draft.avatarPhoto ? { background: `url(${draft.avatarPhoto}) center/cover` } : { background: selectedAvatar.color }}>
            <div className="form-hero-fade" />
            <div className="form-hero-content">
              <label className="form-hero-avatar profile-photo-slot" style={draft.avatarPhoto ? { backgroundImage: `url(${draft.avatarPhoto})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <input
                  type="file" accept="image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => set({ avatarPhoto: reader.result });
                    reader.readAsDataURL(file);
                  }}
                />
                {!draft.avatarPhoto && <span>{(draft.initials || "··").slice(0, 2)}</span>}
                <span className="profile-photo-edit">cambiar foto</span>
              </label>
              <div>
                <div className="form-hero-name">{draft.name || "Sin nombre"}</div>
                <div className="form-hero-tag">{draft.role || "Rol del usuario"}</div>
                <div className="form-hero-meta mono">{draft.email}</div>
                {draft.avatarPhoto && (
                  <button
                    type="button"
                    onClick={() => set({ avatarPhoto: null })}
                    style={{ marginTop: 6, padding: "4px 9px", border: 0, background: "rgba(0,0,0,0.40)", color: "#fff", borderRadius: 6, fontFamily: "JetBrains Mono", fontSize: 9.5, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}
                  >quitar foto</button>
                )}
              </div>
            </div>
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
            <FormField label="Email">
              <input className="form-input" type="email" value={draft.email} onChange={(e) => set({ email: e.target.value })} placeholder="tu@correo.com" />
            </FormField>
            <FormField label="Bio" hint="breve descripción">
              <textarea className="form-input" rows={3} value={draft.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="¿Qué haces en ClienderDesign?" />
            </FormField>
            <FormField label="Color de avatar">
              <div className="accent-grid">
                {avatarColors.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className={"accent-card " + (draft.avatarColor === a.id ? "is-on" : "")}
                    onClick={() => set({ avatarColor: a.id })}
                  >
                    <div className="accent-card-bg" style={{ background: a.color }} />
                    <span className="accent-card-name mono">{a.id}</span>
                  </button>
                ))}
              </div>
            </FormField>
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

function TopBar({ mode, onMode, isProcessing, onRunAll, theme, onThemeToggle, onOpenProfile, userInitials, userEmail, userPhoto }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Cliender<sup>design</sup></div>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase", marginTop: 2 }}>
            creative supercomputer
          </div>
        </div>
      </div>

      <div className="mode-tabs">
        <button className={"mode-tab " + (mode === "canvas" ? "is-active" : "")} onClick={() => onMode("canvas")}>
          <span className="mode-tab-dot" /> Canvas
        </button>
        <button className={"mode-tab " + (mode === "supercomputer" ? "is-active" : "")} onClick={() => onMode("supercomputer")}>
          <span className="mode-tab-dot" /> Supercomputer
        </button>
      </div>

      <div className="topbar-right">
        <button
          className="theme-toggle-btn"
          onClick={onThemeToggle}
          title={theme === "dark" ? "Cambiar a Light" : "Cambiar a Dark"}
          aria-label="theme toggle"
        >
          {theme === "dark" ? (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4"/>
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          )}
        </button>
        {mode !== "supercomputer" && (
          <button className="btn-primary" onClick={onRunAll}>
            <Icon.Play style={{ width: 11, height: 11 }} />
            Run All
          </button>
        )}
        <button
          className="user-avatar-btn"
          onClick={onOpenProfile}
          title={`Mi perfil · ${userEmail}`}
          style={userPhoto ? { backgroundImage: `url(${userPhoto})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        >
          {!userPhoto && <span>{userInitials}</span>}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Draggable wrapper (re-used across node types)
// ---------------------------------------------------------------------------
function DraggableWrap({ node, selected, onSelect, onDrag, children }) {
  const wrapRef = useRef(null);
  const dragRef = useRef(null);
  const onMouseDownHeader = (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect(node.id, e);
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
      className="node-wrap"
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
function GroupNode({ node, onChange, onMouseDownHeader, onClose, selected }) {
  return (
    <div
      className={"node-v2 group-node " + (selected ? "is-selected" : "")}
      style={{
        width: node.data.w,
        height: node.data.h,
        position: "absolute",
        left: 0, top: 0,
        zIndex: -1,
      }}
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// CanvasNode dispatcher
// ---------------------------------------------------------------------------
function CanvasNode({ node, selected, onSelect, onDrag, onDataChange, onClose, onGenerate, hasIncomingPrompt, onOutputAction }) {
  return (
    <DraggableWrap node={node} selected={selected} onSelect={onSelect} onDrag={onDrag}>
      {({ onMouseDownHeader }) => {
        const common = {
          node,
          onChange: (p) => onDataChange(node.id, p),
          onMouseDownHeader,
          onClose: () => onClose(node.id),
          selected,
        };
        if (node.type === "prompt") return <PromptNode {...common} onGenerate={() => onGenerate(node.id)} />;
        if (node.type === "image")  return <ImageNode  {...common} onGenerate={() => onGenerate(node.id)} hasIncomingPrompt={hasIncomingPrompt} />;
        if (node.type === "video")  return <VideoNode  {...common} onGenerate={() => onGenerate(node.id)} hasIncomingPrompt={hasIncomingPrompt} />;
        if (node.type === "note")   return <NoteNode   {...common} />;
        if (node.type === "output") return <OutputNode {...common} onItemAction={onOutputAction} />;
        if (node.type === "group")  return <GroupNode {...common} />;
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
        return (
          <g key={e.id} className={(isJustCreated ? "edge-just-created" : "") + (isSelected ? " edge-selected" : "")}>
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
    { type: "prompt", label: "Prompt",  hint: "brief creativo",        glyph: <Icon.PromptGlyph style={{ width: 18, height: 18 }} />, accent: "#A78BFA" },
    { type: "image",  label: "Imagen",  hint: "generación de imagen",  glyph: <Icon.ImageGlyph  style={{ width: 18, height: 18 }} />, accent: "#C4B5FD" },
    { type: "video",  label: "Video",   hint: "generación de video",   glyph: <Icon.VideoGlyph  style={{ width: 18, height: 18 }} />, accent: "#34D399" },
    { type: "note",   label: "Nota",    hint: "anotación libre",       glyph: <Icon.NoteGlyph   style={{ width: 18, height: 18 }} />, accent: "#FBBF24" },
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
    prompt: "#A78BFA", image: "#C4B5FD", video: "#34D399", note: "#FBBF24", output: "#7DD3FC",
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
        {nodes.map((n) => {
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

  // Theme + Tweaks
  const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
    "theme": "dark",
    "accent": "violet",
    "motion": "full",
    "density": "comfortable"
  }/*EDITMODE-END*/;
  const [theme, setTheme]     = useState(TWEAK_DEFAULTS.theme);
  const [accent, setAccent]   = useState(TWEAK_DEFAULTS.accent);
  const [motion, setMotion]   = useState(TWEAK_DEFAULTS.motion);
  const [density, setDensity] = useState(TWEAK_DEFAULTS.density);
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
  const [nodes, setNodes] = useState(() => {
    const demoPrompt = "Botella de perfume premium sobre mármol travertino, luz cálida de tarde, sombra suave a 30°";
    const mk = (seed) => ({
      id: "g-" + seed,
      kind: "image",
      url: window.fakeMediaUrlForGeneration ? window.fakeMediaUrlForGeneration("demo-" + seed, "image") : "",
      prompt: demoPrompt,
      model: "gpt-imagenes-2",
      aspect: "1:1",
      styleLocked: false,
      createdAt: Date.now() - parseInt(seed) * 1000,
    });
    return [
      {
        id: "n-prompt-1", type: "prompt", x: 60, y: 80,
        data: { ...NODE_DEFAULTS.prompt(), brief: demoPrompt, tipo: "image", status: "done", cantidad: 4 },
      },
      {
        id: "n-image-1", type: "image", x: 500, y: 60,
        data: { ...NODE_DEFAULTS.image(), prompt: demoPrompt, status: "done", cantidad: 4 },
      },
      {
        id: "n-output-1", type: "output", x: 940, y: 60,
        data: {
          ...NODE_DEFAULTS.output(),
          status: "done",
          kind: "image",
          modelId: "gpt-imagenes-2",
          items: ["1","2","3","4"].map(mk),
        },
      },
    ];
  });
  const [edges, setEdges] = useState([
    { id: "e-1", source: "n-prompt-1", target: "n-image-1" },
    { id: "e-2", source: "n-image-1",  target: "n-output-1" },
  ]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set()); // multi-select for grouping
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
    const ids = Array.from(selectedIds);
    if (ids.length < 2) return;
    const members = nodes.filter((n) => ids.includes(n.id));
    if (members.length < 2) return;
    const xs = members.map((n) => n.x);
    const ys = members.map((n) => n.y);
    const ws = members.map((n) => (NODE_SIZE[n.type]?.w || 320));
    const hs = members.map((n) => (NODE_SIZE[n.type]?.h || 280));
    const minX = Math.min(...xs) - 30;
    const minY = Math.min(...ys) - 60;
    const maxX = Math.max(...xs.map((x, i) => x + ws[i])) + 30;
    const maxY = Math.max(...ys.map((y, i) => y + hs[i])) + 30;
    const groupId = "g-" + Math.random().toString(36).slice(2, 7);
    const name = prompt("Nombre del subproyecto:", "Subproyecto");
    if (name === null) return;
    setNodes((ns) => [
      { id: groupId, type: "group", x: minX, y: minY,
        data: { name: name || "Subproyecto", w: maxX - minX, h: maxY - minY, members: ids } },
      ...ns,
    ]);
    setSelectedIds(new Set());
    setSelectedId(groupId);
    window.__notify?.({ kind: "success", icon: "▢", title: "Agrupados",
      body: `${members.length} nodos en "${name || "Subproyecto"}"` });
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

  // Gallery
  const [gallery, setGallery] = useState([]);

  // Clients
  const [clients, setClients] = useState(() => window.SAMPLE_CLIENTS || []);
  const [activeClientId, setActiveClientId] = useState(null);
  const [createClientOpen, setCreateClientOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profile, setProfile] = useState(() => {
    try {
      const saved = localStorage.getItem("cliender-profile");
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      name: "Nicolas",
      email: "nicolas@cliender.com",
      role: "Creative Director",
      bio: "Diseñando flujos creativos con ClienderDesign.",
      avatarColor: "violet",
      avatarPhoto: null,
      initials: "N",
    };
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
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: "p-demo", name: "Otoño Editorial — Hero", clientId: clients[0]?.id || null,
        nodes: [], edges: [], thumbs: ["#A78BFA","#7DD3FC","#34D399"],
        createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 3600000,
      },
    ];
  });
  const [activeProjectId, setActiveProjectId] = useState(null);
  useEffect(() => {
    try { localStorage.setItem("cliender-projects", JSON.stringify(projects)); } catch {}
  }, [projects]);
  const onCreateProject = useCallback(() => {
    const name = prompt("Nombre del proyecto:");
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
    window.__notify?.({ kind: "success", icon: "🗂", title: "Nuevo canvas", body: p.name + " · canvas vacío listo" });
  }, [activeClientId, clients]);
  const onDeleteProject = useCallback((p) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return;
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

  // Style Vault
  const _initialMoodboards = SAMPLE_MOODBOARDS || window.SAMPLE_MOODBOARDS || [];
  const _moodboardReducer = moodboardReducer || window.moodboardReducer || ((s) => s);
  const [moodboards, dispatchMoodboards] = useReducer(_moodboardReducer, _initialMoodboards);
  const lockedMb = (moodboards || []).find((m) => m.locked);

  // Supercomputer state
  const [prompt, setPrompt] = useState("Reel vertical 9:16 dinámico para Instagram de una zapatilla");
  const [logs, setLogs] = useState([]);
  const [lastLogAt, setLastLogAt] = useState(0);
  const [nodeStatus, setNodeStatus] = useState({
    master_director: "idle", scriptwriter: "idle", cinematographer: "idle",
    production: "idle", critic: "idle",
  });

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
    window.__notify?.({
      kind: "info",
      icon: "+",
      title: `Nodo ${type === "prompt" ? "Prompt" : type === "image" ? "Imagen" : type === "video" ? "Video" : "Nota"} añadido`,
      body: "Click en el handle morado para conectarlo.",
    });
  }, [pan, zoom]);

  const removeNode = useCallback((id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id));
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id));
    if (selectedId === id) setSelectedId(null);
  }, [selectedId]);

  const dragNode = useCallback((id, x, y) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, x, y } : n));
  }, []);

  const patchNodeData = useCallback((id, patch) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n));
  }, []);

  // --- connector drag -----------------------------------------------------
  const [draggingEdge, setDraggingEdge] = useState(null);
  const [connectMenu, setConnectMenu]   = useState(null); // {sourceId, x, y, worldX, worldY}
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

  // --- pan ---------------------------------------------------------------
  const panRef = useRef(null);
  const onViewportMouseDown = (e) => {
    if (e.target.closest(".node-wrap")) return;
    if (e.target.closest(".nh")) return;
    setSelectedId(null);
    setSelectedEdgeId(null);
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
  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      setZoom((z) => Math.max(0.4, Math.min(1.5, z + (e.deltaY < 0 ? 0.06 : -0.06))));
      return;
    }
    if (e.shiftKey) {
      e.preventDefault();
      // Shift+wheel: most browsers already redirect deltaY → deltaX,
      // but we accept whichever is non-zero
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      setPan((p) => ({ x: p.x - delta, y: p.y }));
      return;
    }
  };
  const onZoomDelta = (d) => setZoom((z) => Math.max(0.4, Math.min(1.5, z + d)));
  const onFitView = () => { setZoom(0.85); setPan({ x: 80, y: 70 }); };

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

  const incomingPromptIds = useMemo(() => {
    const map = {};
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source);
      if (src?.type === "prompt") map[e.target] = e.id;
    });
    return map;
  }, [edges, nodes]);

  const runNode = useCallback(async (nodeId) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    if (node.type === "prompt") {
      const downstream = edges.filter((e) => e.source === nodeId);
      if (downstream.length === 0) {
        window.__notify?.({
          kind: "info", icon: "ⓘ", title: "Nada que correr",
          body: "Conecta este Prompt a un nodo Imagen o Video para ejecutar el flujo.",
        });
        return;
      }
      for (const e of downstream) await runNode(e.target);
      return;
    }
    if (node.type === "note" || node.type === "output") return;

    const upstream = findUpstreamPrompt(nodeId);
    const brief = upstream ? upstream.node.data.brief : node.data.prompt;
    if (!brief?.trim()) {
      window.__notify?.({ kind: "error", icon: "!", title: "Falta el prompt",
        body: "Escribe un brief o conecta un Prompt Node." });
      return;
    }

    setRunningNodes((s) => new Set([...s, nodeId]));
    if (upstream) setRunningEdges((s) => new Set([...s, upstream.edgeId]));
    patchNodeData(nodeId, { status: "running", prompt: brief });

    const baseMs = node.type === "video" ? 2400 : 1500;
    await new Promise((r) => setTimeout(r, baseMs + Math.random() * 800));

    // Generar N items según `cantidad`
    const cantidad = Math.max(1, parseInt(node.data.cantidad) || 1);
    const newItems = [];
    for (let i = 0; i < cantidad; i++) {
      const seed = `${node.id}-${Date.now()}-${i}`;
      const url = fakeMediaUrlForGeneration(seed, node.type);
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
        createdAt: Date.now() + i,
        nodeId,
      });
    }

    patchNodeData(nodeId, { status: "done", lastUrl: newItems[0].url });

    // Push a la galería (más nuevos primero)
    setGallery((g) => [...newItems.slice().reverse(), ...g]);

    // Crear o actualizar el OutputNode downstream
    const existingOutputEdge = edges.find(
      (e) => e.source === nodeId && nodes.find((n) => n.id === e.target && n.type === "output")
    );
    if (existingOutputEdge) {
      // append a los items existentes
      const outId = existingOutputEdge.target;
      setNodes((ns) => ns.map((n) =>
        n.id === outId
          ? { ...n, data: { ...n.data, status: "done", kind: node.type, modelId: node.data.modelId, items: [...newItems, ...(n.data.items || [])] } }
          : n
      ));
    } else {
      // crear nuevo OutputNode a la derecha
      const outId = `n-output-${Math.random().toString(36).slice(2, 6)}`;
      const sourceNode = nodes.find((n) => n.id === nodeId);
      const newX = (sourceNode?.x || 0) + (NODE_SIZE[node.type]?.w || 360) + 80;
      const newY = sourceNode?.y || 0;
      setNodes((ns) => [...ns, {
        id: outId, type: "output",
        x: newX, y: newY,
        data: {
          ...NODE_DEFAULTS.output(),
          kind: node.type,
          modelId: node.data.modelId,
          items: newItems,
        },
      }]);
      const newEdgeId = "e-" + Math.random().toString(36).slice(2, 7);
      setEdges((es) => [...es, { id: newEdgeId, source: nodeId, target: outId }]);
      pulseEdge(newEdgeId);
    }

    window.__notify?.({
      kind: "success",
      icon: node.type === "video" ? "▶" : "◈",
      title: cantidad === 1
        ? (node.type === "video" ? "Video renderizado" : "Imagen generada")
        : `${cantidad} ${node.type === "video" ? "videos" : "imágenes"} generadas`,
      body: `${node.data.modelId}${lockedMb ? ` · style "${lockedMb.name}"` : ""} · guardado en galería`,
    });

    setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n; });
    if (upstream) {
      setTimeout(() => {
        setRunningEdges((s) => { const n = new Set(s); n.delete(upstream.edgeId); return n; });
      }, 400);
    }
  }, [nodes, edges, findUpstreamPrompt, patchNodeData, lockedMb, pulseEdge]);

  // --- output node item actions -------------------------------------------
  const [previewItem, setPreviewItem] = useState(null);
  const onOutputAction = useCallback((action, nodeId, item) => {
    if (action === "preview") {
      setPreviewItem(item);
    } else if (action === "download") {
      const a = document.createElement("a");
      a.href = item.url;
      a.download = `${item.kind || "asset"}-${item.id}.${(item.url.startsWith("data:image/svg") ? "svg" : "png")}`;
      a.click();
      window.__notify?.({ kind: "info", icon: "↓", title: "Descarga iniciada", body: a.download });
    } else if (action === "delete") {
      setNodes((ns) => ns.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, items: n.data.items.filter((it) => it.id !== item.id) } }
          : n
      ));
      setGallery((g) => g.filter((x) => x.id !== item.id));
    } else if (action === "openGallery") {
      setActiveTab("gallery");
    }
  }, []);

  const runAll = useCallback(async () => {
    // Corre todos los Prompt nodes que tengan downstream
    const promptNodes = nodes.filter((n) => n.type === "prompt");
    for (const p of promptNodes) {
      const downstream = edges.filter((e) => e.source === p.id);
      if (downstream.length === 0) continue;
      // Ejecuta downstream en paralelo
      await Promise.all(downstream.map((e) => runNode(e.target)));
    }
  }, [nodes, edges, runNode]);

  // --- Supercomputer simulated run ---------------------------------------
  const pushLog = (frame) => {
    setLogs((ls) => [...ls, { id: Math.random().toString(36).slice(2), ...frame }]);
    setLastLogAt(Date.now());
  };
  const runSwarm = useCallback(async () => {
    if (!prompt.trim()) return;
    setLogs([]);
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const setStatus = (k, s) => setNodeStatus((st) => ({ ...st, [k]: s }));
    const styleLocked = !!lockedMb && !!lockedMb.manifest;

    // crear/encontrar Prompt+Image en el canvas para reflejar
    let promptNode = nodes.find((n) => n.type === "prompt");
    let imageNode = nodes.find((n) => n.type === "image");
    if (promptNode) patchNodeData(promptNode.id, { brief: prompt, status: "done" });

    const chosenModel = (() => {
      const p = prompt.toLowerCase();
      const isVideo = ["video","reel","clip","spot","tiktok","shorts"].some((h) => p.includes(h));
      if (isVideo) return ["tiktok","reel","instagram","shorts","vertical","9:16"].some((h) => p.includes(h)) ? "seedance-2.0" : "veo3";
      if (["fotorrealista","realista","retrato","cinematic"].some((h) => p.includes(h))) return "nano-banana-pro";
      if (["boceto","sketch","anime","ilustración"].some((h) => p.includes(h))) return "nano-banana-2";
      return "gpt-imagenes-2";
    })();

    if (styleLocked) {
      pushLog({ agentName: "VisionAuditor", status: "done",
        message: `Style Manifest "${lockedMb.name}" · ${lockedMb.images.length} refs · consist ${lockedMb.manifest.consistencyScore.toFixed(2)}` });
      await sleep(400);
    }
    setStatus("master_director","running");
    pushLog({ agentName: "MasterDirector", status: "running", message: "Analizando petición…" });
    await sleep(800);
    pushLog({ agentName: "MasterDirector", status: "done", message: `Plan: Script → Cinematographer → Production → Critic.${styleLocked ? ` Style "${lockedMb.name}" activo.` : ""}` });
    setStatus("master_director","done");

    setStatus("scriptwriter","running");
    pushLog({ agentName: "Scriptwriter", status: "running", message: "Estrategia creativa…" });
    await sleep(900);
    pushLog({ agentName: "Scriptwriter", status: "done", message: "Tono editorial, foco en materialidad." });
    setStatus("scriptwriter","done");

    setStatus("cinematographer","running");
    pushLog({ agentName: "Cinematographer", status: "running", message: `Modelo: ${chosenModel}. Construyendo prompt técnico…`, meta: { modelId: chosenModel } });
    await sleep(900);
    if (styleLocked) {
      pushLog({ agentName: "Cinematographer", status: "running", message: `Fusionando StyleManifest "${lockedMb.name}".`, meta: { modelId: chosenModel } });
      await sleep(500);
    }
    pushLog({ agentName: "Cinematographer", status: "done", message: "Prompt técnico listo." });
    setStatus("cinematographer","done");

    setStatus("production","running");
    pushLog({ agentName: "Production", status: "running",
      message: `call_kid_ai_api(model="${chosenModel}"${styleLocked ? `, reference_images=[${lockedMb.images.length}])` : ")"}`,
      meta: { modelId: chosenModel } });
    await sleep(1600);
    pushLog({ agentName: "Production", status: "done", message: "Artefacto recibido." });
    setStatus("production","done");

    setStatus("critic","running");
    pushLog({ agentName: "Critic", status: "running", message: "Evaluando…" });
    await sleep(800);
    pushLog({ agentName: "Critic", status: "done", message: `Aprobado. Score ${(styleLocked ? 0.94 : 0.91).toFixed(2)}.` });
    setStatus("critic","done");

    const url = fakeMediaUrlForGeneration(`swarm-${Date.now()}`, chosenModel === "veo3" || chosenModel === "seedance-2.0" ? "video" : "image");
    if (imageNode) patchNodeData(imageNode.id, { status: "done", lastUrl: url, modelId: chosenModel, prompt });
    setGallery((g) => [{
      id: "g-" + Math.random().toString(36).slice(2, 8),
      kind: (chosenModel === "veo3" || chosenModel === "seedance-2.0") ? "video" : "image",
      url, prompt, model: chosenModel,
      duration: "5s", aspect: "16:9",
      styleLocked, styleSource: lockedMb?.name || null,
      createdAt: Date.now(),
    }, ...g]);
    window.__notify?.({ kind: "success", icon: "✦", title: "Swarm completó la generación",
      body: `Modelo: ${chosenModel}${styleLocked ? ` · style "${lockedMb.name}"` : ""}` });

    pushLog({ agentName: "System", status: "info", message: "✓ Generación completa. Asset añadido a Galería." });
  }, [prompt, lockedMb, nodes, patchNodeData]);

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
        userInitials={profile.initials}
        userEmail={profile.email}
        userPhoto={profile.avatarPhoto}
      />

      {mode !== "supercomputer" && (
        <LeftRail
          activeTab={activeTab}
          onTab={setActiveTab}
          galleryCount={gallery.length}
          hasLockedMoodboard={!!lockedMb}
          clientsCount={clients.length}
        />
      )}

      {mode !== "supercomputer" && (
        <aside className={"left-drawer " + (activeTab === "nodes" ? "is-open" : "")} data-kind="nodes">
          {activeTab === "nodes" && (
            <NodesPanel onAdd={addNode} onClose={() => setActiveTab(null)} />
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
              theme={theme}     setTheme={(v) => { setTheme(v); window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { theme: v } }, "*"); }}
              accent={accent}   setAccent={(v) => { setAccent(v); window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { accent: v } }, "*"); }}
              motion={motion}   setMotion={(v) => { setMotion(v); window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { motion: v } }, "*"); }}
              density={density} setDensity={(v) => { setDensity(v); window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { density: v } }, "*"); }}
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
          onWheel={onWheel}
        >
          <div className="canvas-world" style={{ transform }}>
            <EdgesLayer
              nodes={nodes}
              edges={edges}
              draggingEdge={draggingEdge}
              runningEdgeIds={runningEdges}
              newEdgeIds={newEdgeIds}
            />
            {nodes.map((n) => (
              <CanvasNode
                key={n.id}
                node={n}
                selected={selectedId === n.id || selectedIds.has(n.id)}
                onSelect={(id, e) => toggleSelect(id, e?.shiftKey)}
                onDrag={dragNode}
                onDataChange={patchNodeData}
                onClose={removeNode}
                onGenerate={runNode}
                hasIncomingPrompt={!!incomingPromptIds[n.id]}
                onOutputAction={onOutputAction}
              />
            ))}
          </div>
          <div className="canvas-vignette" />
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
        onRemove={(id) => setGallery((g) => g.filter((x) => x.id !== id))}
      />

      {mode === "supercomputer" && (
        <SuperStage
          prompt={prompt}
          setPrompt={setPrompt}
          onSubmit={runSwarm}
          isProcessing={isProcessing}
          logs={logs}
          nodeStatus={nodeStatus}
          lastLogAt={lastLogAt}
          clients={clients}
          moodboards={moodboards}
          lockedMb={lockedMb}
          dispatchMoodboards={dispatchMoodboards}
        />
      )}

      {mode !== "supercomputer" && (
        <Minimap nodes={nodes} edges={edges} pan={pan} zoom={zoom} setPan={setPan} viewportRef={viewportRef} />
      )}

      {previewItem && mode !== "supercomputer" && (
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
function ImagePreview({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="cerrar">✕</button>
        <div className="lightbox-media">
          <img src={item.url} alt="" />
        </div>
        <div className="lightbox-meta">
          <div className="lightbox-prompt">{item.prompt}</div>
          <div className="lightbox-tags">
            <span className="mono">{item.model}</span>
            {item.aspect && <span className="mono">· {item.aspect}</span>}
            {item.duration && <span className="mono">· {item.duration}</span>}
            {item.styleSource && <span className="mono">· style: {item.styleSource}</span>}
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
const HINTS_BIG = [
  "Retrato fotorrealista campaña otoño",
  "Reel 9:16 para Instagram, dinámico",
  "Boceto rápido estilo anime",
  "Spot cinematográfico de perfume",
  "Producto de lujo, fondo neutro",
];

function SuperStage({ prompt, setPrompt, onSubmit, isProcessing, logs, nodeStatus, lastLogAt, clients, moodboards, lockedMb, dispatchMoodboards }) {
  const [pickerOpen, setPickerOpen] = useState(null);
  const [activeClientId, setActiveClientId] = useState(null);
  const activeClient = clients?.find((c) => c.id === activeClientId);
  const activeMb = moodboards?.find((m) => m.locked);
  const canLaunch = prompt.trim().length > 4;

  // 18 agentes en órbita estilo enjambre cinematográfico
  const AGENTS = React.useMemo(() => {
    const colors = ['#A78BFA','#7DD3FC','#FBBF24','#FB7185','#34D399','#C4B5FD','#F0ABFC','#67E8F9'];
    return new Array(18).fill(0).map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      radius: 80 + Math.random() * 130,
      speed: 12 + Math.random() * 18,
      phase: Math.random() * 2 * Math.PI,
      size: 1.6 + Math.random() * 2.2,
      tilt: -8 + Math.random() * 16,
    }));
  }, []);

  return (
    <section className="cortex-stage">
      <div className="cortex-bg" />
      <div className="cortex-grain" />

      <div className="cortex-inner">
        <header className="cortex-head">
          <div className="cortex-kicker mono">creative supercomputer · agent swarm</div>
          <h1 className="cortex-title">
            <span className="cortex-title-soft">Mega</span><span className="cortex-title-em">Cliender</span>
          </h1>
          <p className="cortex-tagline">
            Un brief. Un enjambre. <i>El resto sucede solo.</i>
          </p>
        </header>

        <div className="cortex-swarm" aria-hidden="true"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const ripple = document.createElement("div");
              ripple.className = "cortex-ripple";
              ripple.style.left = (e.clientX - r.left) + "px";
              ripple.style.top  = (e.clientY - r.top)  + "px";
              e.currentTarget.appendChild(ripple);
              setTimeout(() => ripple.remove(), 1200);
              // Spawn 2 more for layered effect
              [200, 400].forEach((delay) => {
                setTimeout(() => {
                  const r2 = document.createElement("div");
                  r2.className = "cortex-ripple";
                  r2.style.left = (e.clientX - r.left) + "px";
                  r2.style.top  = (e.clientY - r.top)  + "px";
                  r2.style.borderColor = "color-mix(in srgb, var(--accent-2) 60%, transparent)";
                  e.currentTarget.appendChild(r2);
                  setTimeout(() => r2.remove(), 1200);
                }, delay);
              });
            }}
            onMouseMove={(e) => {
              const svg = e.currentTarget.querySelector("svg.cortex-svg");
              if (!svg) return;
              const r = svg.getBoundingClientRect();
              // Translate viewport coords to svg coords (-260 to 260, -180 to 180)
              const mx = ((e.clientX - r.left) / r.width)  * 520 - 260;
              const my = ((e.clientY - r.top)  / r.height) * 360 - 180;
              // Attract agents toward cursor with falloff
              svg.querySelectorAll("circle[r]").forEach((c) => {
                if (c.getAttribute("fill") === "#FFFFFF") return;
                const motion = c.querySelector("animateMotion");
                if (!motion) return;
                const ctm = c.getCTM(); if (!ctm) return;
                const cx = ctm.e, cy = ctm.f;
                const dx = mx - cx, dy = my - cy;
                const d = Math.hypot(dx, dy);
                const pull = Math.max(0, 60 - d / 2.5) / 4;
                const tx = (dx / (d || 1)) * pull;
                const ty = (dy / (d || 1)) * pull;
                c.style.transform = `translate(${tx}px, ${ty}px)`;
              });
            }}
            onMouseLeave={(e) => {
              const svg = e.currentTarget.querySelector("svg.cortex-svg");
              if (!svg) return;
              svg.querySelectorAll("circle[r]").forEach((c) => { c.style.transform = ""; });
            }}>
          <CortexSwarm agents={AGENTS} active={isProcessing} />
        </div>

        <div className="cortex-form">
          <div className="cortex-slots">
            <CortexSlot
              kind="client"
              label="Cliente"
              value={activeClient ? activeClient.name : 'Sin asignar'}
              hint={activeClient ? activeClient.tagline : 'opcional'}
              avatar={activeClient?.initials}
              bg={activeClient?.bgGradient}
              onClick={() => setPickerOpen('client')}
            />
            <CortexSlot
              kind="moodboard"
              label="Moodboard"
              value={activeMb?.name || 'Sin estilo'}
              hint={activeMb?.locked ? 'style locked' : (activeMb ? 'no locked' : 'opcional')}
              avatar={activeMb ? '◇' : null}
              onClick={() => setPickerOpen('moodboard')}
              locked={activeMb?.locked}
            />
          </div>

          <div className="cortex-prompt">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canLaunch) onSubmit(); }}
              rows={3}
              placeholder="Describe lo que quieres crear. El enjambre lo orquesta."
              disabled={isProcessing}
            />
            <div className="cortex-prompt-foot">
              <span className="cortex-prompt-hint mono">⌘ + ⏎ &middot; lanzar</span>
              <button
                className="cortex-launch"
                onClick={onSubmit}
                disabled={!canLaunch || isProcessing}
              >
                <span className="cortex-launch-bg" />
                <span className="cortex-launch-label">
                  <Icon.Play style={{ width: 13, height: 13 }} />
                  {isProcessing ? 'Orquestando…' : 'Lanzar enjambre'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

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
  const hints = [
    "Retrato fotorrealista para campaña otoño",
    "Reel vertical 9:16 dinámico para Instagram",
    "Boceto rápido estilo anime de un dragón",
    "Spot cinematográfico de perfume",
  ];
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
// Mount
// ---------------------------------------------------------------------------
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <NotificationProvider>
    <App />
  </NotificationProvider>
);
