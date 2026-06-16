/* prototype/ui.jsx
 * UI infraestructura: NotificationToasts, GalleryPanel, NodeDock.
 * Cada una se exporta a window para que app.jsx la consuma.
 */

// ===========================================================================
// Notification system
// ===========================================================================
const NotificationCtx = React.createContext({ push: () => {} });
const useNotifications = () => React.useContext(NotificationCtx);

function NotificationProvider({ children }) {
  const [toasts, setToasts] = React.useState([]);
  const push = React.useCallback((n) => {
    const id = "n-" + Math.random().toString(36).slice(2, 8);
    const toast = { id, kind: "info", duration: 3800, ...n };
    setToasts((ts) => [...ts, toast]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), toast.duration);
  }, []);
  // Expose globally for non-React code (mock generation timers, etc.)
  React.useEffect(() => { window.__notify = push; }, [push]);
  return (
    <NotificationCtx.Provider value={{ push }}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => <Toast key={t.id} {...t} onDismiss={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))} />)}
      </div>
    </NotificationCtx.Provider>
  );
}

function Toast({ kind, title, body, onDismiss, icon }) {
  const palette = {
    info:    { c: "#8B5CF6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.35)" },
    success: { c: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.35)" },
    error:   { c: "#EF4444", bg: "rgba(239,68,68,0.10)", border: "rgba(239,68,68,0.35)" },
    style:   { c: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.35)" },
  }[kind] || { c: "#8B5CF6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.35)" };
  return (
    <div className="toast" style={{ "--toast-c": palette.c, background: palette.bg, borderColor: palette.border }}>
      <span className="toast-bar" />
      <div className="toast-icon">{icon || "✦"}</div>
      <div className="toast-body">
        <div className="toast-title">{title}</div>
        {body && <div className="toast-text">{body}</div>}
      </div>
      <button className="toast-close" onClick={onDismiss} aria-label="cerrar">✕</button>
    </div>
  );
}

// ===========================================================================
// Node Dock — floating bar with 4 add-node buttons
// ===========================================================================
function NodeDock({ onAdd }) {
  const items = [
    { type: "prompt", label: "Prompt",  icon: <Icon.PromptGlyph style={{ width: 22, height: 22 }} />, hint: "Brief creativo" },
    { type: "image",  label: "Imagen",  icon: <Icon.ImageGlyph  style={{ width: 22, height: 22 }} />, hint: "Generación de imagen" },
    { type: "video",  label: "Video",   icon: <Icon.VideoGlyph  style={{ width: 22, height: 22 }} />, hint: "Generación de video" },
    { type: "note",   label: "Nota",    icon: <Icon.NoteGlyph   style={{ width: 22, height: 22 }} />, hint: "Anotación libre" },
  ];
  return (
    <div className="dock">
      <div className="dock-kicker mono">añadir nodo</div>
      <div className="dock-items">
        {items.map((it) => (
          <button
            key={it.type}
            className={"dock-item is-" + it.type}
            onClick={() => onAdd(it.type)}
            title={it.hint}
          >
            <div className="dock-item-icon">{it.icon}</div>
            <div className="dock-item-meta">
              <div className="dock-item-label">{it.label}</div>
              <div className="dock-item-hint mono">{it.hint}</div>
            </div>
            <div className="dock-item-plus">+</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ===========================================================================
// Gallery Panel — slide-over con grid de assets generados
// ===========================================================================
function GalleryPanel({ open, onClose, items, onRemove, onSelect }) {
  const [filter, setFilter] = React.useState("all");
  const filtered = items.filter((it) => filter === "all" ? true : it.kind === filter);

  const counts = {
    all: items.length,
    image: items.filter((i) => i.kind === "image").length,
    video: items.filter((i) => i.kind === "video").length,
  };

  return (
    <>
      {open && <div className="gallery-backdrop" onClick={onClose} />}
      <aside className={"gallery-panel " + (open ? "is-open" : "")}>
        <div className="gallery-head">
          <div>
            <div className="gallery-title">Galería</div>
            <div className="gallery-kicker mono">{items.length} assets · creative supercomputer</div>
          </div>
          <div className="gallery-filters">
            {[
              { k: "all",   label: "Todo" },
              { k: "image", label: "Imagen" },
              { k: "video", label: "Video" },
            ].map((f) => (
              <button
                key={f.k}
                className={"gallery-filter " + (filter === f.k ? "is-active" : "")}
                onClick={() => setFilter(f.k)}
              >
                {f.label} <span className="mono filter-count">{counts[f.k]}</span>
              </button>
            ))}
          </div>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>

        <div className="gallery-body scroll-thin">
          {filtered.length === 0 ? (
            <div className="gallery-empty">
              <div className="vault-empty-icon" style={{ fontSize: 18 }}>◇</div>
              <div className="vault-empty-kicker">galería vacía</div>
              <div className="vault-empty-body">
                Genera tu primera creación desde un nodo Imagen o Video y aparecerá aquí.
              </div>
            </div>
          ) : (
            <div className="gallery-grid">
              {filtered.map((it) => (
                <button
                  key={it.id}
                  className="gallery-card"
                  onClick={() => onSelect && onSelect(it)}
                >
                  <div className="gallery-thumb" style={{ backgroundImage: `url(${it.url})` }}>
                    {it.kind === "video" && (
                      <div className="gallery-video-tag mono">
                        <Icon.Play style={{ width: 9, height: 9 }} /> {it.duration || "5s"}
                      </div>
                    )}
                    {it.styleLocked && (
                      <div className="gallery-style-tag mono">
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", display: "inline-block" }} />
                        {it.styleSource}
                      </div>
                    )}
                  </div>
                  <div className="gallery-meta">
                    <div className="gallery-meta-prompt">{it.prompt?.slice(0, 80) || ""}</div>
                    <div className="gallery-meta-row">
                      <span className="mono gallery-model">{it.model}</span>
                      <span className="mono gallery-time">{new Date(it.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                  <button
                    className="gallery-remove"
                    onClick={(e) => { e.stopPropagation(); onRemove(it.id); }}
                  >✕</button>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

// ===========================================================================
// Gallery Topbar Button
// ===========================================================================
function GalleryButton({ count, onClick }) {
  return (
    <button className="gallery-btn" onClick={onClick}>
      <Icon.Photo style={{ width: 13, height: 13 }} />
      <span>Galería</span>
      {count > 0 && <span className="gallery-btn-count mono">{count}</span>}
    </button>
  );
}

// ===========================================================================
// Helpers — placeholder content for generation results
// ===========================================================================
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function hueFromSeed(seed, offset = 0) {
  return (hashStr(seed) + offset * 137) % 360;
}
function fakeMediaUrlForGeneration(seed, kind) {
  const w = kind === "video" ? 720 : 600;
  const h = kind === "video" ? 405 : 600;
  const h1 = hueFromSeed(seed, 0);
  const h2 = hueFromSeed(seed, 3);
  const h3 = hueFromSeed(seed, 7);
  // Synth gradient SVG con grano sutil — sin red dependency
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>
    <defs>
      <radialGradient id='g1' cx='25%' cy='30%' r='80%'>
        <stop offset='0%' stop-color='hsl(${h1},65%,55%)'/>
        <stop offset='60%' stop-color='hsl(${h2},45%,18%)'/>
        <stop offset='100%' stop-color='hsl(${h3},35%,6%)'/>
      </radialGradient>
      <radialGradient id='g2' cx='75%' cy='75%' r='60%'>
        <stop offset='0%' stop-color='hsl(${h3},60%,42%)' stop-opacity='0.55'/>
        <stop offset='100%' stop-color='hsl(${h3},60%,42%)' stop-opacity='0'/>
      </radialGradient>
      <filter id='noise'>
        <feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='1' seed='${hashStr(seed) % 100}'/>
        <feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.07 0'/>
      </filter>
    </defs>
    <rect width='${w}' height='${h}' fill='url(#g1)'/>
    <rect width='${w}' height='${h}' fill='url(#g2)'/>
    <rect width='${w}' height='${h}' filter='url(#noise)'/>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

// ===========================================================================
// Export
// ===========================================================================
Object.assign(window, {
  NotificationProvider,
  useNotifications,
  NodeDock,
  GalleryPanel,
  GalleryButton,
  fakeMediaUrlForGeneration,
});
