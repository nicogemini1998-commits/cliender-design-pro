/* prototype/ui.jsx
 * UI infraestructura: NotificationToasts, VideoEditorModal, GalleryPanel, NodeDock.
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
// ProcessingOverlay — contenedor centrado con la misma animación shader de los
// nodos de resultado mientras se procesa; al terminar muestra el vídeo ahí.
// ===========================================================================
function ProcessingOverlay({ open, processing, label, result, error, onClose }) {
  if (!open) return null;
  const SL = window.ShaderLoader;
  return (
    <div className="procov-backdrop" onClick={processing ? undefined : onClose}>
      <div className="procov-card" onClick={(e) => e.stopPropagation()}>
        {processing && (<>
          <div className="procov-shader">
            {SL
              ? <SL style={{ position: "absolute", inset: 0 }} />
              : <div className="shader-loader-fallback" style={{ position: "absolute", inset: 0 }} />}
            <div className="procov-shader-label mono">{label || "Generando…"}</div>
          </div>
          <div className="procov-hint mono">Puede tardar 30–120s según duración del vídeo</div>
        </>)}
        {!processing && error && (<>
          <div className="vedit-error" style={{ margin: 0 }}>⚠ {error}</div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="vedit-btn" onClick={onClose}>Cerrar</button>
          </div>
        </>)}
        {!processing && result && !error && (<>
          {result.url && <video src={result.url} controls autoPlay playsInline className="procov-video" />}
          <div className="procov-meta mono">{result.meta || "✓ Procesado · guardado en galería"}</div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            {result.url && <button className="vedit-btn" onClick={() => window.open(result.url, "_blank")}>Abrir</button>}
            {result.url && (
              <button className="vedit-btn primary" onClick={() =>
                window.__downloadAsset
                  ? window.__downloadAsset(result.url, `cliender-editado-${Date.now()}.mp4`)
                  : window.open(result.url, "_blank")
              }>Descargar</button>
            )}
            <button className="vedit-btn" onClick={onClose}>Cerrar</button>
          </div>
        </>)}
      </div>
    </div>
  );
}

// ===========================================================================
// VideoEditorModal — editor completo: subtítulos opcionales + audio + música
// ===========================================================================
function VideoEditorModal({ item, items, API, onClose, onSaved }) {
  const isMulti = Array.isArray(items) && items.length > 1;
  const effItem = isMulti ? items[0] : item;
  const [opts, setOpts] = React.useState({
    burn_subtitles: true,
    language: "",
    keep_audio: true,
    music_url: "",
    music_volume: 0.18,
    subtitle_style: { color: "#FFFFFF", outline_color: "#000000", font_size: 42, bold: true, position: "bottom" },
    subtitle_preset: "classic",
    transition: "dissolve",
    transition_duration: 0.5,
  });
  const [processing, setProcessing] = React.useState(false);
  const [result, setResult]         = React.useState(null);
  const [error, setError]           = React.useState(null);
  const [overlayClosed, setOverlayClosed] = React.useState(false);

  const setSS = (key, val) => setOpts(o => ({ ...o, subtitle_style: { ...o.subtitle_style, [key]: val } }));

  const process = async () => {
    setProcessing(true); setError(null); setResult(null); setOverlayClosed(false);
    try {
      const body = isMulti
        ? { urls: items.map(i => i.url), transition: opts.transition, transition_duration: opts.transition_duration,
            burn_subtitles: opts.burn_subtitles, language: opts.language || null,
            keep_audio: opts.keep_audio, music_url: opts.music_url || null,
            music_volume: opts.music_volume, subtitle_style: opts.subtitle_style, subtitle_preset: opts.subtitle_preset }
        : { url: item.url, burn_subtitles: opts.burn_subtitles, language: opts.language || null,
            keep_audio: opts.keep_audio, music_url: opts.music_url || null,
            music_volume: opts.music_volume, subtitle_style: opts.subtitle_style, subtitle_preset: opts.subtitle_preset };
      const r = await fetch(`${API}/video/edit`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 429) throw new Error("Límite de velocidad alcanzado — espera 60 segundos e inténtalo de nuevo.");
      const d = await r.json();
      if (!d.url) throw new Error(d.error || "El backend no devolvio URL");
      setResult(d);
      await fetch(`${API}/gallery/add`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: "g-edit-" + Date.now().toString(36),
          kind: "video",
          url: d.url,
          prompt: "Editado: " + (effItem?.prompt || "").slice(0, 60),
          model: "ffmpeg-whisper",
          duration: effItem?.duration,
          createdAt: Date.now(),
          addedBy: localStorage.getItem("cdpro-user-email") || "",
        }),
      });
      window.__notify && window.__notify({
        kind: "success", icon: "✓", title: "Vídeo editado",
        body: d.subtitles_burned
          ? `${(d.segments || []).length} líneas de subtítulos · audio preservado`
          : "Procesado · audio preservado",
      });
    } catch (e) {
      const msg = e && e.message ? e.message : String(e);
      setError(msg);
      window.__notify && window.__notify({ kind: "error", icon: "⚠", title: "Error al editar", body: msg });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="vedit-overlay" onClick={onClose}>
      <div className="vedit-modal" onClick={e => e.stopPropagation()}>
        <div className="vedit-head">
          <span className="vedit-title">✏️ {isMulti ? `Editor multi (${items.length} clips)` : "Editor de vídeo"}</span>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>

        <div className="vedit-body scroll-thin">
          {isMulti ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
              {items.map((it, idx) => (
                <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 8, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.18)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#7C3AED", minWidth: 18 }}>{idx + 1}</span>
                  <video src={it.url} muted playsInline style={{ width: 64, height: 36, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: "#c4b5fd", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{(it.prompt || "clip").slice(0, 55)}</span>
                </div>
              ))}
            </div>
          ) : (
            <video src={item.url} controls playsInline className="vedit-preview" />
          )}
          {isMulti && (
            <>
              <div className="vedit-section-label">Transición entre clips</div>
              <div className="vedit-row">
                <label className="vedit-label">Tipo</label>
                <select className="vedit-select" value={opts.transition}
                  onChange={e => setOpts(o => ({ ...o, transition: e.target.value }))}>
                  <option value="dissolve">Dissolve · fundido cruzado</option>
                  <option value="fade">Fade · a negro</option>
                  <option value="wipeleft">Wipe izquierda</option>
                  <option value="wiperight">Wipe derecha</option>
                  <option value="slideleft">Slide izquierda</option>
                  <option value="slideright">Slide derecha</option>
                  <option value="circlecrop">Círculo</option>
                  <option value="pixelize">Pixelado</option>
                </select>
              </div>
              <div className="vedit-row">
                <label className="vedit-label">Duración: {opts.transition_duration.toFixed(1)}s</label>
                <input type="range" min="0.2" max="1.0" step="0.1" value={opts.transition_duration}
                  onChange={e => setOpts(o => ({ ...o, transition_duration: +e.target.value }))}
                  className="vedit-range" />
              </div>
            </>
          )}

          {/* ── Subtítulos ── */}
          <label className="vedit-toggle-row">
            <span className="vedit-label">Añadir subtítulos</span>
            <span className="vedit-toggle-wrap">
              <input type="checkbox" className="vedit-chk-hidden" checked={opts.burn_subtitles}
                onChange={e => setOpts(o => ({ ...o, burn_subtitles: e.target.checked }))} />
              <span className="vedit-toggle-track" />
            </span>
          </label>

          {opts.burn_subtitles && (<>
            <div className="vedit-preset-grid">
              {[
                ["classic", "Clean",   "Texto blanco · outline suave"],
                ["pop",     "Pop",     "Bold MAYÚSCULAS · reel impact"],
                ["box",     "Caja",    "Fondo semi-transparente"],
                ["karaoke", "Karaoke", "Palabra a palabra · TikTok"],
              ].map(([v, label, desc]) => (
                <button key={v}
                  className={"vedit-preset-card " + (opts.subtitle_preset === v ? "is-active" : "")}
                  onClick={() => setOpts(o => ({ ...o, subtitle_preset: v }))}>
                  <span className="vedit-preset-name">{label}</span>
                  <span className="vedit-preset-desc">{desc}</span>
                </button>
              ))}
            </div>
            <div className="vedit-row">
              <label className="vedit-label">Idioma de la voz</label>
              <select className="vedit-select" value={opts.language}
                onChange={e => setOpts(o => ({ ...o, language: e.target.value }))}>
                <option value="">Auto-detectar</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
              </select>
            </div>
            <div className="vedit-row">
              <label className="vedit-label">Posición</label>
              <div className="vedit-pills">
                {[["bottom", "Abajo"], ["middle", "Centro"], ["top", "Arriba"]].map(([v, l]) => (
                  <button key={v}
                    className={"vedit-pill " + (opts.subtitle_style.position === v ? "is-active" : "")}
                    onClick={() => setSS("position", v)}>{l}</button>
                ))}
              </div>
            </div>
            {opts.subtitle_preset === "classic" && (<>
              <div className="vedit-row">
                <label className="vedit-label">Tamaño: {opts.subtitle_style.font_size}px</label>
                <input type="range" min="24" max="56" step="2" value={opts.subtitle_style.font_size}
                  onChange={e => setSS("font_size", +e.target.value)} className="vedit-range" />
              </div>
              <div className="vedit-color-row">
                <div className="vedit-color-field">
                  <label className="vedit-label">Color texto</label>
                  <input type="color" value={opts.subtitle_style.color}
                    onChange={e => setSS("color", e.target.value)} className="vedit-colorpick" />
                </div>
                <div className="vedit-color-field">
                  <label className="vedit-label">Borde / sombra</label>
                  <input type="color" value={opts.subtitle_style.outline_color}
                    onChange={e => setSS("outline_color", e.target.value)} className="vedit-colorpick" />
                </div>
                <label className="vedit-toggle-row" style={{ marginLeft: "auto" }}>
                  <span className="vedit-label">Negrita</span>
                  <span className="vedit-toggle-wrap">
                    <input type="checkbox" className="vedit-chk-hidden" checked={opts.subtitle_style.bold}
                      onChange={e => setSS("bold", e.target.checked)} />
                    <span className="vedit-toggle-track" />
                  </span>
                </label>
              </div>
            </>)}
          </>)}


          {/* ── Audio ── */}
          <div className="vedit-section-label">Audio</div>
          <label className="vedit-toggle-row">
            <span className="vedit-label">Conservar audio original</span>
            <span className="vedit-toggle-wrap">
              <input type="checkbox" className="vedit-chk-hidden" checked={opts.keep_audio}
                onChange={e => setOpts(o => ({ ...o, keep_audio: e.target.checked }))} />
              <span className="vedit-toggle-track" />
            </span>
          </label>
          <div className="vedit-row">
            <label className="vedit-label">Música de fondo (URL mp3/wav — opcional)</label>
            <input type="text" className="vedit-input" placeholder="https://…"
              value={opts.music_url}
              onChange={e => setOpts(o => ({ ...o, music_url: e.target.value }))} />
          </div>
          {opts.music_url && (
            <div className="vedit-row">
              <label className="vedit-label">Volumen música: {Math.round(opts.music_volume * 100)}%</label>
              <input type="range" min="0" max="1" step="0.05" value={opts.music_volume}
                onChange={e => setOpts(o => ({ ...o, music_volume: +e.target.value }))} className="vedit-range" />
            </div>
          )}

          {/* ── Estado ── */}
          {error && <div className="vedit-error">⚠ {error}</div>}
        </div>

        <div className="vedit-footer">
          <button className="vedit-btn" onClick={onClose}>Cerrar</button>
          <button className="vedit-btn primary" disabled={processing || !!result} onClick={process}>
            {processing ? "⏳ Procesando…" : result ? "✓ Hecho" : "✨ Aplicar"}
          </button>
        </div>
        <ProcessingOverlay
          open={processing || (!overlayClosed && (!!result || !!error))}
          processing={processing}
          label="Generando vídeo…"
          error={error}
          result={result ? {
            url: result.url,
            meta: "✓ " + (result.subtitles_burned
              ? `${(result.segments || []).length} líneas de subtítulos quemadas`
              : "Sin subtítulos") + (result.music_mixed ? " · música mezclada" : "") + " · guardado en galería",
          } : null}
          onClose={() => setOverlayClosed(true)}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// Gallery Panel — slide-over con grid de assets generados
// ===========================================================================
function GalleryPanel({ open, onClose, items, onRemove, onSelect }) {
  const API = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "";
  const [filter, setFilter]           = React.useState("all");
  const [selecting, setSelecting]     = React.useState(false);
  const [selected, setSelected]       = React.useState([]);
  const [rendering, setRendering]     = React.useState(false);
  const [result, setResult]           = React.useState(null);
  const [editingItem, setEditingItem] = React.useState(null);
  // Batch subtitle states: null | 'config' | 'running'
  const [batchMode, setBatchMode]     = React.useState(null);
  const [batchOpts, setBatchOpts]     = React.useState({ language: "", position: "bottom", preset: "classic" });
  const [batchProgress, setBatchProgress] = React.useState({ done: 0, total: 0, errors: [] });
  const [batchResult, setBatchResult] = React.useState(null);
  // Doble confirmación de borrado
  const [confirmDelId, setConfirmDelId] = React.useState(null);

  const [editingItems, setEditingItems] = React.useState([]);
  // Transición entre escenas para el ensamblaje de vídeo (Remotion Stitch).
  // Catálogo espejo de 06. REMOTION RENDER/src/Stitch.jsx — label + descripción
  // para que el usuario sepa exactamente qué hace cada transición.
  const VIDEO_TRANSITIONS = {
    dissolve: { label: "Disolvencia", description: "Crossfade suave: el clip nuevo se funde sobre el anterior. Elegante y fluido — el estándar profesional." },
    fade:     { label: "Fundido a negro", description: "El clip se oscurece a negro y el siguiente emerge desde negro. Marca un cambio de bloque o de tiempo." },
    slide:    { label: "Deslizamiento", description: "El clip nuevo entra empujando desde la derecha. Dinámico y direccional, ideal para ritmo ágil." },
    slideup:  { label: "Deslizamiento vertical", description: "El clip nuevo sube desde abajo cubriendo al anterior. Moderno, tipo feed/stories." },
    zoom:     { label: "Zoom punch", description: "El clip entra con un golpe de zoom y desenfoque que se resuelve. Energético y viral." },
    whip:     { label: "Whip pan", description: "Barrido rápido con desenfoque de movimiento, como un latigazo de cámara. Estilo vlog/reel." },
    wipe:     { label: "Barrido (wipe)", description: "Una cortina revela el clip nuevo de izquierda a derecha. Editorial y limpio." },
    glitch:   { label: "Glitch digital", description: "Corte con distorsión RGB y parpadeo breve. Tech, urbano y moderno." },
    cut:      { label: "Corte seco", description: "Cambio instantáneo sin transición. Directo y rítmico, como el montaje clásico." },
  };
  const [transition, setTransition] = React.useState("dissolve");
  const _delTimer = React.useRef(null);

  const askDelete = (e, id) => {
    e.stopPropagation();
    if (confirmDelId === id) {
      clearTimeout(_delTimer.current);
      setConfirmDelId(null);
      onRemove(id);
      window.__notify && window.__notify({ kind: "info", icon: "🗑", title: "Eliminado", body: "Borrado definitivo de la galería compartida." });
    } else {
      setConfirmDelId(id);
      clearTimeout(_delTimer.current);
      _delTimer.current = setTimeout(() => setConfirmDelId(null), 3000);
    }
  };

  const filtered = items.filter((it) => filter === "all" ? true : it.kind === filter);
  const counts = {
    all:   items.length,
    image: items.filter((i) => i.kind === "image").length,
    video: items.filter((i) => i.kind === "video").length,
  };

  const toggleSelect = (id) => {
    setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };
  const orderOf = (id) => selected.indexOf(id);
  const exitSelecting = () => { setSelecting(false); setSelected([]); setBatchMode(null); };

  // Items de vídeo seleccionados (para subtítulos en lote)
  const selectedVideos = selected.filter(id => {
    const it = items.find(i => i.id === id);
    return it && it.kind === "video";
  });

  const selectedVideoItems = selected
    .map(id => items.find(i => i.id === id))
    .filter(it => it && it.kind === "video");

  // ── Ensamblar vídeo (Remotion pipeline) ──
  const assemble = async () => {
    const scenes = selected
      .map((id) => items.find((i) => i.id === id))
      .filter(Boolean)
      .map((it) => ({
        url: it.url,
        kind: it.kind === "video" ? "video" : "image",
        duration_s: parseFloat(String(it.duration || "")) || 5,
        caption: (it.prompt || "").slice(0, 90),
        transition,
      }));
    if (scenes.length === 0) return;
    setRendering(true); setResult(null);
    try {
      const r = await fetch(`${API}/chat/render`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes, brand: { name: "Cliender", accent: "#7C3AED" }, fps: 24, width: 1080, height: 1920 }),
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

  // ── Subtítulos en lote para la selección ──
  const runBatchSubtitles = async () => {
    const videoItems = selected
      .map(id => items.find(i => i.id === id))
      .filter(it => it && it.kind === "video");
    if (videoItems.length === 0) return;
    setBatchMode("running");
    setBatchProgress({ done: 0, total: videoItems.length, errors: [] });
    const errors = [];
    let lastUrl = "";
    for (let i = 0; i < videoItems.length; i++) {
      const it = videoItems[i];
      try {
        const r = await fetch(`${API}/video/edit`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: it.url, burn_subtitles: true,
            language: batchOpts.language || null, keep_audio: true,
            subtitle_style: { color: "#FFFFFF", outline_color: "#000000", font_size: 42, bold: true, position: batchOpts.position },
            subtitle_preset: batchOpts.preset,
          }),
        });
        if (r.status === 429) {
          setBatchResult({ url: lastUrl, meta: `⚠ Límite de velocidad alcanzado — espera 60s e inténtalo de nuevo. Procesados: ${videoItems.length - errors.length - (videoItems.length - i)}/${videoItems.length}` });
          setBatchMode(null);
          return;
        }
        const d = await r.json();
        if (!d.url) throw new Error(d.error || "Sin URL");
        lastUrl = d.url;
        // body PLANO — bug fix
        await fetch(`${API}/gallery/add`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: "g-batch-" + Date.now().toString(36) + i,
            kind: "video", url: d.url,
            prompt: "Sub: " + (it.prompt || "").slice(0, 60),
            model: "ffmpeg-whisper", duration: it.duration,
            createdAt: Date.now(),
            addedBy: localStorage.getItem("cdpro-user-email") || "",
          }),
        });
      } catch (_) {
        errors.push(it.id);
      }
      setBatchProgress(p => ({ ...p, done: i + 1, errors: [...errors] }));
    }
    setBatchResult({
      url: lastUrl,
      meta: `✓ ${videoItems.length - errors.length}/${videoItems.length} vídeos procesados${errors.length ? ` · ${errors.length} errores` : ""} · añadidos a la galería`,
    });
    window.__notify && window.__notify({
      kind: errors.length ? "error" : "success", icon: errors.length ? "⚠" : "✓",
      title: "Lote completado",
      body: `${videoItems.length - errors.length}/${videoItems.length} procesados${errors.length ? ` · ${errors.length} errores` : ""}`,
    });
    setBatchMode(null);
    exitSelecting();
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
            {[{ k: "all", label: "Todo" }, { k: "image", label: "Imagen" }, { k: "video", label: "Video" }].map((f) => (
              <button key={f.k}
                className={"gallery-filter " + (filter === f.k ? "is-active" : "")}
                onClick={() => setFilter(f.k)}>
                {f.label} <span className="mono filter-count">{counts[f.k]}</span>
              </button>
            ))}
          </div>
          <button
            className={"gallery-assemble-btn " + (selecting ? "is-on" : "")}
            onClick={() => (selecting ? exitSelecting() : setSelecting(true))}
            title="Seleccionar vídeos/imágenes para ensamblar o subtitular"
          >
            {selecting ? "Cancelar" : "✨ Edit video"}
          </button>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>

        {/* ── Barra de selección — modo normal ── */}
        {selecting && !batchMode && (
          <div className="gallery-assemble-bar">
            <span className="mono">
              {selected.length} escena{selected.length === 1 ? "" : "s"} · toca para ordenar
            </span>
            {selected.length >= 2 && (
              <div className="vedit-transition-picker" style={{ display: "flex", flexDirection: "column", gap: 4, marginRight: "auto", maxWidth: 380 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span className="mono" style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase", letterSpacing: "0.1em" }}>Transición</span>
                  <select className="vedit-select" style={{ height: 28, fontSize: 12, padding: "2px 8px" }}
                    value={transition} onChange={(e) => setTransition(e.target.value)}>
                    {Object.entries(VIDEO_TRANSITIONS).map(([id, t]) => (
                      <option key={id} value={id}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <span style={{ fontSize: 11, opacity: 0.65, lineHeight: 1.35 }}>{VIDEO_TRANSITIONS[transition] && VIDEO_TRANSITIONS[transition].description}</span>
              </div>
            )}
            <div style={{ display: "flex", gap: 6 }}>
              {selectedVideos.length > 0 && (
                <button className="gallery-assemble-go vedit-batch-trigger"
                  onClick={() => setBatchMode("config")}>
                  💬 Subtítulos ({selectedVideos.length})
                </button>
              )}
              {selectedVideoItems.length >= 2 && (
                <button className="gallery-assemble-go"
                  style={{ background: "rgba(124,58,237,0.15)", borderColor: "rgba(124,58,237,0.4)", color: "#C4B5FD" }}
                  onClick={() => { setEditingItems(selectedVideoItems); exitSelecting(); }}>
                  ✏️ Editar ({selectedVideoItems.length})
                </button>
              )}
              <button className="gallery-assemble-go"
                disabled={selected.length === 0 || rendering}
                onClick={assemble}>
                {rendering ? "Ensamblando…" : `Ensamblar (${selected.length})`}
              </button>
            </div>
          </div>
        )}

        {/* ── Barra de selección — configurar subtítulos en lote ── */}
        {selecting && batchMode === "config" && (
          <div className="gallery-assemble-bar vedit-batch-config">
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", flex: 1 }}>
              <span className="mono" style={{ fontSize: 11 }}>
                Subtítulos para {selectedVideos.length} vídeo{selectedVideos.length === 1 ? "" : "s"}
              </span>
              <select className="vedit-select" style={{ height: 30, fontSize: 12, padding: "3px 8px" }}
                value={batchOpts.language}
                onChange={e => setBatchOpts(o => ({ ...o, language: e.target.value }))}>
                <option value="">Auto-detectar</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
                <option value="pt">Português</option>
              </select>
              <div className="vedit-pills" style={{ gap: 4 }}>
                {[["bottom", "↓ Abajo"], ["middle", "— Centro"], ["top", "↑ Arriba"]].map(([v, l]) => (
                  <button key={v}
                    className={"vedit-pill " + (batchOpts.position === v ? "is-active" : "")}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                    onClick={() => setBatchOpts(o => ({ ...o, position: v }))}>{l}</button>
                ))}
              </div>
              <div className="vedit-pills" style={{ gap: 4 }}>
                {[["classic", "Clean"], ["pop", "Pop"], ["box", "Caja"], ["karaoke", "Karaoke"]].map(([v, l]) => (
                  <button key={v}
                    className={"vedit-pill " + (batchOpts.preset === v ? "is-active" : "")}
                    style={{ padding: "4px 10px", fontSize: 11 }}
                    onClick={() => setBatchOpts(o => ({ ...o, preset: v }))}>{l}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              <button className="gallery-assemble-go"
                style={{ background: "var(--surface-2)", color: "var(--text-2)", borderColor: "var(--line)" }}
                onClick={() => setBatchMode(null)}>← Volver</button>
              <button className="gallery-assemble-go" onClick={runBatchSubtitles}>
                ✨ Procesar {selectedVideos.length} vídeo{selectedVideos.length === 1 ? "" : "s"}
              </button>
            </div>
          </div>
        )}

        {/* ── Barra de selección — progreso de lote ── */}
        {selecting && batchMode === "running" && (
          <div className="gallery-assemble-bar vedit-batch-config">
            <div style={{ flex: 1 }}>
              <div className="mono" style={{ fontSize: 11, marginBottom: 6 }}>
                ⏳ Procesando {batchProgress.done}/{batchProgress.total}…
                {batchProgress.errors.length > 0 && ` · ${batchProgress.errors.length} errores`}
              </div>
              <div className="vedit-batch-progress-track">
                <div className="vedit-batch-progress-fill"
                  style={{ width: `${batchProgress.total > 0 ? (batchProgress.done / batchProgress.total) * 100 : 0}%` }} />
              </div>
            </div>
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
                    <div className="gallery-thumb" style={{ position: "relative" }}>
                      {isSel && <div className="gallery-sel-badge mono">{orderOf(it.id) + 1}</div>}
                      {it.kind === "video" ? (
                        <video src={it.url} muted playsInline
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#0a0a0a", borderRadius: "inherit" }}
                          onMouseEnter={(e) => { e.currentTarget.play(); }}

                          onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
                          onError={(e) => { const v = e.currentTarget; if (!v.dataset.proxied && window.__proxied) { v.dataset.proxied = "1"; v.src = window.__proxied(it.url); } }} />
                      ) : (
                        <img src={it.url} alt="" loading="lazy"
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }}
                          onError={(e) => { const i = e.currentTarget; if (!i.dataset.proxied && window.__proxied) { i.dataset.proxied = "1"; i.src = window.__proxied(it.url); } }} />
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
                      {it.kind === "video" && !selecting && (
                        <button
                          className="gallery-cc-btn mono"
                          title="Editar vídeo: subtítulos, audio, música"
                          onClick={(e) => { e.stopPropagation(); setEditingItem(it); }}
                          style={{ marginTop: 6, width: "100%", padding: "5px 8px", borderRadius: 7, border: "1px solid rgba(124,58,237,0.4)", background: "rgba(124,58,237,0.12)", color: "#C4B5FD", fontSize: 11, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                          ✏️ Editar vídeo
                        </button>
                      )}
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
                            ? window.__downloadAsset(it.url, `cliender-${it.kind || "asset"}-${it.id}.${ext}`)
                            : window.open(it.url, "_blank");
                        }}
                      >↓</button>
                    )}
                    {!selecting && (
                      <button
                        className="gallery-remove"
                        title={confirmDelId === it.id ? "Confirmar borrado definitivo" : "Eliminar (pide confirmación)"}
                        onClick={(e) => askDelete(e, it.id)}
                        style={confirmDelId === it.id ? { width: "auto", padding: "0 8px", background: "#EF4444", color: "#fff", fontWeight: 700, boxShadow: "0 0 10px rgba(239,68,68,0.6)" } : undefined}
                      >{confirmDelId === it.id ? "¿Borrar?" : "✕"}</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>

      {/* ── Resultado Ensamblar ── */}
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
                  onError={(e) => { const v = e.currentTarget; if (!v.dataset.proxied && window.__proxied) { v.dataset.proxied = "1"; v.src = window.__proxied(result.url); } }} />
                <div className="gallery-result-actions">
                  <span className="mono gallery-result-meta">{result.meta || (result.duration_s + "s · " + result.width + "×" + result.height + " · " + result.fps + "fps")}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button className="gallery-result-btn" onClick={() => window.open(result.url, "_blank")}>Abrir</button>
                    <button className="gallery-result-btn primary" onClick={() => (window.__downloadAsset ? window.__downloadAsset(result.url, `cliender-video-${Date.now()}.mp4`) : window.open(result.url, "_blank"))}>Descargar</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Video Editor Modal ── */}
      {editingItem && (
        <VideoEditorModal
          item={editingItem}
          API={API}
          onClose={() => setEditingItem(null)}
        />
      )}
      {editingItems.length > 0 && (
        <VideoEditorModal
          items={editingItems}
          API={API}
          onClose={() => setEditingItems([])}
        />
      )}

      {/* ── Overlay de proceso del lote (misma animación que nodos resultado) ── */}
      <ProcessingOverlay
        open={rendering || batchMode === "running" || !!batchResult}
        processing={rendering || batchMode === "running"}
        label={rendering ? "Ensamblando vídeo…" : `Procesando ${Math.min(batchProgress.done + 1, batchProgress.total)}/${batchProgress.total}…`}
        result={batchResult}
        onClose={() => setBatchResult(null)}
      />
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
