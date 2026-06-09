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
  const [selecting, setSelecting] = React.useState(false);
  const [selected, setSelected] = React.useState([]); // ids ordenados
  const [rendering, setRendering] = React.useState(false);
  const [result, setResult] = React.useState(null);     // {url,...} | {error}
  const filtered = items.filter((it) => filter === "all" ? true : it.kind === filter);

  const counts = {
    all: items.length,
    image: items.filter((i) => i.kind === "image").length,
    video: items.filter((i) => i.kind === "video").length,
  };

  const toggleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const orderOf = (id) => selected.indexOf(id);

  const exitSelecting = () => { setSelecting(false); setSelected([]); };

  const assemble = async () => {
    const scenes = selected
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean)
      .map((it) => ({
        url: it.url,
        kind: it.kind === "video" ? "video" : "image",
        duration_s: parseFloat(String(it.duration || "")) || 5,
        caption: (it.prompt || "").slice(0, 90),
      }));
    if (scenes.length === 0) return;
    const API = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "";
    setRendering(true); setResult(null);
    try {
      const r = await fetch(`${API}/chat/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes,
          brand: { name: "Cliender", accent: "#7C3AED" },
          fps: 24, width: 1080, height: 1920,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      setResult(data);
      window.__notify && window.__notify({ kind: "success", icon: "✨", title: "Vídeo ensamblado", body: `${scenes.length} escenas · ${data.duration_s}s` });
    } catch (e) {
      setResult({ error: String(e && e.message ? e.message : e) });
      window.__notify && window.__notify({ kind: "error", icon: "⚠", title: "Error al ensamblar", body: String(e && e.message ? e.message : e) });
    } finally {
      setRendering(false);
    }
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
          <button
            className={"gallery-assemble-btn " + (selecting ? "is-on" : "")}
            onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
            title="Ensamblar vídeo a partir de varias escenas"
          >
            {selecting ? "Cancelar" : "✨ Edit video"}
          </button>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>

        {selecting && (
          <div className="gallery-assemble-bar">
            <span className="mono">{selected.length} escena{selected.length === 1 ? "" : "s"} seleccionada{selected.length === 1 ? "" : "s"} · toca para ordenar</span>
            <button
              className="gallery-assemble-go"
              disabled={selected.length === 0 || rendering}
              onClick={assemble}
            >
              {rendering ? "Ensamblando…" : `Generar vídeo (${selected.length})`}
            </button>
          </div>
        )}

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
              {filtered.map((it) => {
                const isSel = selecting && selected.includes(it.id);
                return (
                <div
                  key={it.id}
                  className={"gallery-card " + (isSel ? "is-selected" : "")}
                  role="button"
                  tabIndex={0}
                  style={{ cursor: "pointer" }}
                  onClick={() => (selecting ? toggleSelect(it.id) : (onSelect && onSelect(it)))}
                  onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ")) { e.preventDefault(); selecting ? toggleSelect(it.id) : (onSelect && onSelect(it)); } }}
                >
                  <div className="gallery-thumb" style={{ position:"relative" }}>
                    {isSel && <div className="gallery-sel-badge mono">{orderOf(it.id) + 1}</div>}
                    {it.kind === "video" ? (
                      <video src={it.url} muted playsInline preload="metadata"
                        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", borderRadius:"inherit" }}
                        onMouseEnter={(e) => { e.currentTarget.play && e.currentTarget.play().catch(()=>{}); }}
                        onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                        onError={(e)=>{ const v=e.currentTarget; if(!v.dataset.proxied && window.__proxied){ v.dataset.proxied="1"; v.src=window.__proxied(it.url); } }} />
                    ) : (
                      <img src={it.url} alt="" loading="lazy"
                        style={{ position:"absolute", inset:0, width:"100%", height:"100%", objectFit:"cover", borderRadius:"inherit" }}
                        onError={(e)=>{ const i=e.currentTarget; if(!i.dataset.proxied && window.__proxied){ i.dataset.proxied="1"; i.src=window.__proxied(it.url); } }} />
                    )}
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
                  {!selecting && (
                  <button
                    className="gallery-download"
                    title="Descargar"
                    onClick={(e) => {
                      e.stopPropagation();
                      const isVid = it.kind === "video" || /\.mp4($|\?)/i.test(it.url || "");
                      const ext = isVid ? "mp4" : (it.url?.startsWith("data:image/svg") ? "svg" : "png");
                      window.__downloadAsset
                        ? window.__downloadAsset(it.url, `cliender-${it.kind||"asset"}-${it.id}.${ext}`)
                        : window.open(it.url, "_blank");
                    }}
                  >↓</button>
                  )}
                  {!selecting && (
                  <button
                    className="gallery-remove"
                    onClick={(e) => { e.stopPropagation(); onRemove(it.id); }}
                  >✕</button>
                  )}
                </div>
              );})}
            </div>
          )}
        </div>
      </aside>

      {result && (
        <div className="gallery-result-overlay" onClick={() => setResult(null)}>
          <div className="gallery-result-card" onClick={(e) => e.stopPropagation()}>
            <div className="gallery-result-head">
              <div className="gallery-result-title">{result.error ? "Error al ensamblar" : "Vídeo final"}</div>
              <button className="super-close" onClick={() => setResult(null)}>✕</button>
            </div>
            {result.error ? (
              <div className="gallery-result-error mono">{result.error}</div>
            ) : (
              <>
                <video src={result.url} controls autoPlay loop playsInline
                  className="gallery-result-video"
                  onError={(e)=>{ const v=e.currentTarget; if(!v.dataset.proxied && window.__proxied){ v.dataset.proxied="1"; v.src=window.__proxied(result.url); } }} />
                <div className="gallery-result-actions">
                  <span className="mono gallery-result-meta">{result.duration_s}s · {result.width}×{result.height} · {result.fps}fps</span>
                  <div style={{ display:"flex", gap:8 }}>
                    <button className="gallery-result-btn" onClick={() => window.open(result.url, "_blank")}>Abrir</button>
                    <button className="gallery-result-btn primary" onClick={() => (window.__downloadAsset ? window.__downloadAsset(result.url, `cliender-video-${Date.now()}.mp4`) : window.open(result.url, "_blank"))}>Descargar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
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
