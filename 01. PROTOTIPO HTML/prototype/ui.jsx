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
                ["cinematic", "Cinematic", "Outline grueso · frase natural · sin caja · como la referencia"],
                ["editorial", "Editorial", "Serif itálico dorado + blanco · estilo reel cinematográfico"],
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
            <SubtitlePreview preset={opts.subtitle_preset} position={opts.subtitle_style && opts.subtitle_style.position} color={opts.subtitle_style && opts.subtitle_style.color} outlineColor={opts.subtitle_style && opts.subtitle_style.outline_color} />
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

// ── Transition Preview — inyectar CSS una vez + componente de preview ──
(function() {
  if (document.getElementById("cdpro-trv-kf")) return;
  var s = document.createElement("style");
  s.id = "cdpro-trv-kf";
  s.textContent = [
    ".trv{position:relative;width:100%;height:62px;border-radius:7px;overflow:hidden}",
    ".trv-a{position:absolute;inset:0;background:linear-gradient(135deg,#4C1D95,#7C3AED)}",
    ".trv-b{position:absolute;inset:0;background:linear-gradient(135deg,#065F46,#10B981);animation-duration:2.0s;animation-iteration-count:infinite;animation-timing-function:ease-in-out;animation-fill-mode:both;animation-play-state:paused}",
    ".trv-o{position:absolute;inset:0;animation-duration:2.0s;animation-iteration-count:infinite;animation-timing-function:ease-in-out;animation-play-state:paused}",
    ".trv.trv-playing .trv-b,.trv.trv-playing .trv-o{animation-play-state:running}",
    "@keyframes trv-dissolve{0%,15%{opacity:0}35%,65%{opacity:1}85%,100%{opacity:0}}",
    "@keyframes trv-lumafade{0%,15%{opacity:0}30%{opacity:1;filter:brightness(5)}50%,65%{opacity:1;filter:none}85%,100%{opacity:0}}",
    "@keyframes trv-fb-b{0%,50%{opacity:0}62%,82%{opacity:1}95%,100%{opacity:0}}",
    "@keyframes trv-fb-o{0%,30%{opacity:0}44%,56%{opacity:.92}66%,100%{opacity:0}}",
    "@keyframes trv-fade-b{0%,46%{opacity:0}60%,80%{opacity:1}95%,100%{opacity:0}}",
    "@keyframes trv-fade-o{0%,20%{opacity:0}35%,55%{opacity:1}65%,100%{opacity:0}}",
    "@keyframes trv-dipw-b{0%,46%{opacity:0}60%,80%{opacity:1}95%,100%{opacity:0}}",
    "@keyframes trv-dipw-o{0%,20%{opacity:0}35%,55%{opacity:1}65%,100%{opacity:0}}",
    "@keyframes trv-blurwipe{0%,15%{opacity:0;filter:blur(18px)}45%,68%{opacity:1;filter:blur(0)}83%,100%{opacity:0}}",
    "@keyframes trv-whip{0%,15%{opacity:0;transform:translateX(120%);filter:blur(8px)}40%,65%{opacity:1;transform:translateX(0);filter:none}80%,100%{opacity:0}}",
    "@keyframes trv-wipe{0%,15%{clip-path:inset(0 100% 0 0)}52%,68%{clip-path:inset(0 0% 0 0)}83%,100%{clip-path:inset(0 0% 0 0);opacity:0}}",
    "@keyframes trv-cut{0%,47%{opacity:0}50%,78%{opacity:1}85%,100%{opacity:0}}",
    "@keyframes trv-slide{0%,10%{transform:translateX(110%)}37%,65%{transform:translateX(0)}80%,100%{transform:translateX(0);opacity:0}}",
    "@keyframes trv-slideup{0%,10%{transform:translateY(110%)}37%,65%{transform:translateY(0)}80%,100%{transform:translateY(0);opacity:0}}",
    "@keyframes trv-zoom{0%,10%{transform:scale(.06);opacity:0}37%,65%{transform:scale(1);opacity:1}80%,100%{opacity:0}}",
    "@keyframes trv-glitch{0%,30%{opacity:0}31%{opacity:1;transform:translate(8px,-4px);filter:hue-rotate(120deg) saturate(4)}33%{transform:translate(-6px,4px);filter:hue-rotate(240deg) saturate(4)}36%,65%{opacity:1;transform:none;filter:none}75%,100%{opacity:0}}",
    "@keyframes trv-flipx{0%,44%{transform:scaleX(0)}46%,70%{transform:scaleX(1)}83%,100%{transform:scaleX(1);opacity:0}}",
    "@keyframes trv-clock{0%,15%{clip-path:polygon(50% 50%,50% 0%,50% 0%,50% 0%,50% 0%,50% 0%)}30%{clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 0%,100% 0%,100% 0%)}45%{clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 100%,100% 100%,100% 100%)}60%{clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 100%,0% 100%,0% 100%)}72%{clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 100%,0% 100%,0% 0%)}80%,100%{clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 100%,0% 100%,0% 0%);opacity:0}}",
    "@keyframes subprev-show{0%,100%{opacity:0;transform:translateY(7px)}15%,80%{opacity:1;transform:translateY(0)}}",
    "@keyframes subprev-show2{0%,25%,100%{opacity:0;transform:translateY(7px)}40%,80%{opacity:1;transform:translateY(0)}}",
    ".subprev-word{animation:subprev-show 3.5s ease-in-out infinite}",
    ".subprev-word2{animation:subprev-show2 3.5s ease-in-out infinite}"
  ].join("");
  document.head.appendChild(s);
})();

function TransitionPreviewAnim({ id, selected }) {
  var bRef = React.useRef(null);
  var oRef = React.useRef(null);
  React.useEffect(function() {
    if (!selected) return;
    [bRef.current, oRef.current].forEach(function(el) {
      if (!el) return;
      el.style.animationName = "none";
      void el.offsetWidth;
      el.style.animationName = "";
    });
  }, [selected]);
  var cfg = {
    dissolve:  { b: "trv-dissolve" },
    lumafade:  { b: "trv-lumafade" },
    filmburn:  { b: "trv-fb-b",    o: "trv-fb-o",   ob: "linear-gradient(180deg,rgba(255,120,20,.95),rgba(255,50,0,.8))" },
    blurwipe:  { b: "trv-blurwipe" },
    fade:      { b: "trv-fade-b",  o: "trv-fade-o",  ob: "#000" },
    dipwhite:  { b: "trv-dipw-b",  o: "trv-dipw-o",  ob: "#fff" },
    whip:      { b: "trv-whip" },
    wipe:      { b: "trv-wipe" },
    cut:       { b: "trv-cut" },
    slide:     { b: "trv-slide" },
    slideup:   { b: "trv-slideup" },
    zoom:      { b: "trv-zoom" },
    glitch:    { b: "trv-glitch" },
    flipx:     { b: "trv-flipx" },
    clockwipe: { b: "trv-clock" },
  };
  var c = cfg[id] || cfg.dissolve;
  return (
    <div className={"trv" + (selected ? " trv-playing" : "")}>
      <div className="trv-a" />
      <div className="trv-b" ref={bRef} style={{ animationName: c.b }} />
      {c.o && <div className="trv-o" ref={oRef} style={{ background: c.ob, animationName: c.o }} />}
    </div>
  );
}

function SubtitlePreview({ preset, position, color, outlineColor }) {
  var posAlign = { bottom: "flex-end", middle: "center", top: "flex-start" }[position] || "flex-end";
  var padSide = position === "top" ? { paddingTop: 8 } : position === "middle" ? {} : { paddingBottom: 8 };
  var textEl;
  if (preset === "editorial") {
    textEl = (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 3, paddingLeft: 10 }}>
        <span className="subprev-word" style={{ fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 17, fontWeight: 300, color: "#C9A42A", letterSpacing: "0.04em", lineHeight: 1 }}>La mejor idea</span>
        <span className="subprev-word2" style={{ fontFamily: "Georgia,serif", fontStyle: "italic", fontSize: 11, fontWeight: 300, color: "#fff", marginLeft: 14, lineHeight: 1 }}>que has tenido hoy</span>
      </div>
    );
  } else if (preset === "pop") {
    textEl = <span className="subprev-word" style={{ fontFamily: "system-ui,sans-serif", fontSize: 19, fontWeight: 900, color: "#fff", WebkitTextStroke: "2px #000", textTransform: "uppercase", letterSpacing: "0.03em" }}>LA MEJOR IDEA</span>;
  } else if (preset === "karaoke") {
    textEl = <span className="subprev-word" style={{ fontFamily: "system-ui,sans-serif", fontSize: 22, fontWeight: 900, color: "#fff", WebkitTextStroke: "2.5px #000", textTransform: "uppercase" }}>QUE</span>;
  } else if (preset === "box") {
    textEl = <span className="subprev-word" style={{ fontFamily: "system-ui,sans-serif", fontSize: 14, color: "#fff", background: "rgba(0,0,0,0.6)", padding: "3px 11px", borderRadius: 5, display: "inline-block" }}>La mejor idea que has tenido</span>;
  } else if (preset === "cinematic") {
    textEl = <span className="subprev-word" style={{ fontFamily: "system-ui,sans-serif", fontSize: 15, fontWeight: 600, color: "#fff", WebkitTextStroke: "2px #000" }}>La mejor idea que has tenido</span>;
  } else {
    textEl = <span className="subprev-word" style={{ fontFamily: "system-ui,sans-serif", fontSize: 15, fontWeight: 700, color: color || "#fff", WebkitTextStroke: "1.5px " + (outlineColor || "#000") }}>La mejor idea que has tenido</span>;
  }
  return (
    <div style={{ position: "relative", width: "100%", height: 76, background: "linear-gradient(160deg,#0d0d1a 0%,#1a0a2e 55%,#0a1520 100%)", borderRadius: 8, overflow: "hidden", display: "flex", alignItems: posAlign, justifyContent: "center", border: "1px solid rgba(255,255,255,0.06)", ...padSide }}>
      <div style={{ textAlign: "center", lineHeight: 1.2 }}>
        {textEl}
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
    dissolve:  { label: "Disolvencia",        description: "Crossfade suave: el clip nuevo se funde sobre el anterior. Elegante y fluido — el estándar profesional." },
    lumafade:  { label: "Luma fade",           description: "Fundido por luminancia: las luces aparecen primero, después las sombras. El crossfade del cine documental." },
    filmburn:  { label: "Film burn",           description: "Flash cálido de película quemada con bloom naranja. Transición orgánica de cine analógico." },
    blurwipe:  { label: "Blur wipe",           description: "El clip emerge desde el desenfoque hasta quedar nítido. Suave y premium, usado en moda y belleza." },
    fade:      { label: "Fundido a negro",     description: "El clip se oscurece a negro y el siguiente emerge desde negro. Marca un cambio de bloque o de tiempo." },
    dipwhite:  { label: "Flash a blanco",      description: "Flash cegador a blanco y emerge el nuevo clip. Impacto máximo: revelación, recuerdo, clímax." },
    whip:      { label: "Whip pan",            description: "Barrido rápido con desenfoque de movimiento, como un latigazo de cámara. Estilo vlog/reel." },
    wipe:      { label: "Barrido (wipe)",      description: "Una cortina revela el clip nuevo de izquierda a derecha. Editorial y limpio." },
    cut:       { label: "Corte seco",          description: "Cambio instantáneo sin transición. Directo y rítmico, como el montaje clásico." },
    slide:     { label: "Deslizamiento",       description: "El clip nuevo entra empujando desde la derecha. Dinámico y direccional." },
    slideup:   { label: "Deslizamiento ↑",     description: "El clip nuevo sube desde abajo cubriendo al anterior. Moderno, tipo feed/stories." },
    zoom:      { label: "Zoom punch",          description: "El clip entra con un golpe de zoom y desenfoque que se resuelve. Energético y viral." },
    glitch:    { label: "Glitch digital",      description: "Corte con distorsión RGB y parpadeo breve. Tech, urbano y moderno." },
    flipx:     { label: "Flip horizontal",     description: "El plano gira 180° sobre el eje — volteo radical de perspectiva." },
    clockwipe: { label: "Reloj",               description: "Una manecilla revela el nuevo clip girando. Clásico cinematográfico, pausa de tiempo." },
  };
  const [transition, setTransition] = React.useState("dissolve");
  // Looks cinematográficos — espejo de LOOKS en Remotion Stitch.jsx (Cinematic Engine v2)
  // Looks cinematográficos — espejo de LOOKS en Remotion Stitch.jsx (Cinematic Engine v2)
  const VIDEO_LOOKS = {
    cine:        { label: "Cine — Blockbuster",  description: "Sombras teal, luces ámbar, negros levantados estilo película 16mm. El look Hollywood." },
    kodak:       { label: "Kodak Vision3",       description: "Indie fílmico: tonos cálidos de 35mm, skin tones dorados, grano suave y nostálgico." },
    teal_orange: { label: "Teal & Orange",       description: "El look más viral de acción y publicidad: piel naranja contra fondos fríos teal." },
    golden:      { label: "Golden Hour",         description: "Luz dorada de atardecer, cálido y nostálgico. Lifestyle, amor, momentos humanos." },
    muted:       { label: "Muted / Fade",        description: "Desaturado suave, contraste bajo, como foto overexposed. Moda editorial y lookbooks." },
    velvia:      { label: "Velvia",              description: "Saturación extrema estilo Fujifilm: naturaleza, paisajes y colores imposibles." },
    noir:        { label: "Film Noir",           description: "Blanco y negro de alto contraste con grano marcado. Dramático y editorial." },
    bleach:      { label: "Bleach Bypass",       description: "Alto contraste gritty, desaturación fotoquímica. Thriller y drama tenso." },
    analog:      { label: "Analog 90s",          description: "VHS cálido con dominante sepia suave, alma de cassette. Nostalgia de los 90s." },
    dusk:        { label: "Dusk / Dreamy",       description: "Sombras violeta-azul, luces doradas: el look onírico de la hora mágica." },
    instagram:   { label: "Instagram Warm",      description: "Calidez brillante estilo RRSS: tonos dorados, piel luminosa, contenido viral." },
    vintage:     { label: "Vintage Film",        description: "Película analógica: colores lavados, dominante cálida. Nostalgia auténtica." },
    clean:       { label: "Clean Commercial",    description: "Pulido premium: contraste sutil, color fiel, mínimo grano. Producto y marca." },
    none:        { label: "Sin grade",           description: "Color original de los clips, sin tratamiento. Solo montaje y transiciones." },
  };
  const [look, setLook] = React.useState("cine");
  const [letterbox, setLetterbox] = React.useState(true);
  const [grain, setGrain] = React.useState(true);
  // ── Editor de película (modal) ──
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [subs, setSubs] = React.useState(false);          // subtítulos SOLO si el usuario los pide
  const [sfx, setSfx] = React.useState(true);             // diseño de sonido cinematográfico
  const [origAudio, setOrigAudio] = React.useState(true); // audio original de los vídeos (voz incluida)
  const [branding, setBranding] = React.useState(false);  // intro/outro de marca (off = solo tu contenido)
  const [capStyle, setCapStyle] = React.useState("boxed");   // estilo de subtítulos TikTok: boxed|bubble|neon|clean
  const [captionStyle, setCaptionStyle] = React.useState("pill");   // pill|outline|stamp|gradient|minimal|bold|kinetic
  const [captionPos, setCaptionPos]     = React.useState("bottom"); // bottom|top|center|left|right
  const [autopunch, setAutopunch] = React.useState(true);    // punch-ins + SFX automáticos en los beats del habla
  // Texto de subtítulo POR ESCENA (editable en el editor) — keyed por id de asset.
  // Se prefillea con el prompt del asset al abrir el editor; el usuario lo edita.
  const [sceneTexts, setSceneTexts] = React.useState({});
  // ── Director de Edición IA — el usuario describe el montaje y Claude lo configura ──
  const [editPrompt, setEditPrompt] = React.useState("");
  const [aiPlanning, setAiPlanning] = React.useState(false);
  const [planNotes, setPlanNotes] = React.useState("");
  const [scenePlan, setScenePlan] = React.useState({}); // id -> {transition,kenburns,duration_s} del plan IA
  const [directorId, setDirectorId] = React.useState(null);  // agente-director elegido para el montaje
  // ── Duración REAL de los vídeos (metadata del navegador, sin descargar el archivo) ──
  // FIX crítico: la galería no guarda la duración real → los vídeos caían al default
  // de 5s y la película salía mucho más corta de lo esperado.
  const [mediaDur, setMediaDur] = React.useState({}); // id -> segundos reales
  React.useEffect(() => {
    selected.forEach((id) => {
      const it = items.find((i) => i.id === id);
      if (!it || it.kind !== "video" || mediaDur[id] != null) return;
      try {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.muted = true;
        v.onloadedmetadata = () => {
          const d = Number(v.duration);
          if (isFinite(d) && d > 0) setMediaDur((p) => (p[id] != null ? p : { ...p, [id]: Math.round(d * 10) / 10 }));
          v.removeAttribute("src");
        };
        v.onerror = () => {};
        v.src = it.url;
      } catch (e) { /* metadata no disponible — cae al fallback */ }
    });
  }, [selected, items, mediaDur]);
  // Duración efectiva de una escena: plan IA > duración REAL del vídeo > campo guardado > default
  const durOfItem = (it) => (scenePlan[it.id] && scenePlan[it.id].duration_s) || mediaDur[it.id] || parseFloat(String(it.duration || "")) || (it.kind === "video" ? 5 : 2.5);
  // Swatches por look para las tarjetas del editor
  // Swatches por look para las tarjetas del editor
  const LOOK_SWATCH = {
    cine:        ["#0b4a5c", "#ffc7a0", "#1a1a22"],
    kodak:       ["#2B1505", "#FFF8E8", "#8a6030"],
    teal_orange: ["#003344", "#FF7A22", "#1a2530"],
    golden:      ["#8a5a20", "#ffd9a0", "#2a2014"],
    muted:       ["#888888", "#e0d8d0", "#555555"],
    velvia:      ["#0a4a0a", "#ff5500", "#004488"],
    noir:        ["#0a0a0a", "#e8e8e8", "#555555"],
    bleach:      ["#2a2a2a", "#d0c8c0", "#555545"],
    analog:      ["#2a2018", "#f0e0c8", "#9a8060"],
    dusk:        ["#2A0A3A", "#FFD080", "#1a1535"],
    instagram:   ["#3a2010", "#ffeedd", "#aa7040"],
    vintage:     ["#2a2620", "#f7ead2", "#9a8468"],
    clean:       ["#e8e8f0", "#7C3AED", "#1f1f28"],
    none:        ["#333333", "#666666", "#999999"],
  };
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
        muted: it.kind === "video" ? !origAudio : true,
        duration_s: durOfItem(it),
        caption: subs ? String(sceneTexts[it.id] != null ? sceneTexts[it.id] : (it.prompt || "")).trim().slice(0, 120) : "",
        caption_position: (scenePlan[it.id] && scenePlan[it.id].caption_position) || captionPos,
        caption_style: (scenePlan[it.id] && scenePlan[it.id].caption_style) || captionStyle,
        transition: (scenePlan[it.id] && scenePlan[it.id].transition) || transition,
        kenburns: (scenePlan[it.id] && scenePlan[it.id].kenburns) || undefined,
      }));
    if (scenes.length === 0) return;
    setRendering(true); setResult(null);
    try {
      const r = await fetch(`${API}/chat/render`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes, brand: { name: "Cliender", accent: "#7C3AED" }, style: { look, letterbox, grain: grain ? 0.18 : 0, sfx, branding, autosubs: subs, captions: capStyle, autopunch }, fps: 24, width: 1080, height: 1920 }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || data.error || `HTTP ${r.status}`);
      setResult(data);
      setEditorOpen(false);
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

        {/* ── Dock flotante de Edit video — toda la navegación del modo selección ── */}
        {selecting && !batchMode && (() => {
          const selItemsDock = selected.map((id) => items.find((i) => i.id === id)).filter(Boolean);
          const totalSel = selItemsDock.reduce((a, it) => a + durOfItem(it), 0);
          const DOCKBTN = { display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 12, fontSize: 12.5, fontWeight: 600, cursor: "pointer", border: "1px solid var(--line)", background: "var(--surface-2)", color: "var(--text-1)", transition: "background .15s, border .15s, transform .1s" };
          const hover = (e, on) => { e.currentTarget.style.background = on ? "rgba(139,92,246,0.14)" : "var(--surface-2)"; e.currentTarget.style.transform = on ? "translateY(-1px)" : "none"; };
          return (
            <div style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 350,
              display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 18, maxWidth: "94vw", flexWrap: "wrap", justifyContent: "center",
              background: "color-mix(in srgb, var(--surface) 88%, transparent)", color: "var(--text-1)", backdropFilter: "blur(20px) saturate(1.3)", WebkitBackdropFilter: "blur(20px) saturate(1.3)",
              border: "1px solid rgba(167,139,250,0.3)", boxShadow: "0 18px 50px -12px rgba(0,0,0,0.75), inset 0 0 0 1px rgba(255,255,255,0.04)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingRight: 12, borderRight: "1px solid var(--line)" }}>
                <span style={{ fontSize: 13, fontWeight: 700, whiteSpace: "nowrap" }}>{selected.length} escena{selected.length === 1 ? "" : "s"} · ~{Math.round(totalSel)}s</span>
                <span className="mono" style={{ fontSize: 9.5, opacity: 0.55, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>toca los assets en orden de aparición</span>
              </div>
              {selectedVideos.length > 0 && (
                <button style={DOCKBTN} onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}
                  onClick={() => setBatchMode("config")} title="Quemar subtítulos Whisper en los vídeos seleccionados">
                  💬 <span>Subtítulos</span>
                </button>
              )}
              {selectedVideoItems.length >= 2 && (
                <button style={{ ...DOCKBTN, borderColor: "rgba(124,58,237,0.4)", color: "#C4B5FD" }}
                  onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)}
                  onClick={() => { setEditingItems(selectedVideoItems); exitSelecting(); }} title="Editor de vídeo (recortes, música)">
                  ✏️ <span>Editar</span>
                </button>
              )}
              <button disabled={selected.length === 0 || rendering}
                style={{ ...DOCKBTN, background: "rgba(124,58,237,0.32)", borderColor: "rgba(167,139,250,0.65)", opacity: selected.length === 0 ? 0.45 : 1, boxShadow: "0 4px 18px -4px rgba(124,58,237,0.5)" }}
                onMouseEnter={(e) => { if (selected.length) { e.currentTarget.style.background = "rgba(124,58,237,0.45)"; e.currentTarget.style.transform = "translateY(-1px)"; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.32)"; e.currentTarget.style.transform = "none"; }}
                onClick={() => {
                  setSceneTexts((prev) => {
                    const next = { ...prev };
                    selected.forEach((id) => {
                      if (next[id] == null) {
                        const it = items.find((i) => i.id === id);
                        next[id] = ((it && it.prompt) || "").slice(0, 90);
                      }
                    });
                    return next;
                  });
                  setEditorOpen(true);
                }}>
                {rendering ? "⏳ Renderizando…" : "🎬 Montar película"}
              </button>
              <button title="Salir del modo selección" style={{ ...DOCKBTN, padding: "9px 12px" }}
                onMouseEnter={(e) => hover(e, true)} onMouseLeave={(e) => hover(e, false)} onClick={exitSelecting}>✕</button>
            </div>
          );
        })()}

        {/* ── Editor de película — modal cinematográfico ── */}
        {editorOpen && (() => {
          const selItems = selected.map((id) => items.find((i) => i.id === id)).filter(Boolean);
          const durOf = durOfItem; // duración real de vídeos vía metadata
          const totalS = selItems.reduce((a, it) => a + durOf(it), 0);
          const move = (idx, dir) => {
            setSelected((prev) => {
              const next = [...prev];
              const j = idx + dir;
              if (j < 0 || j >= next.length) return prev;
              [next[idx], next[j]] = [next[j], next[idx]];
              return next;
            });
          };
          const LBL = { fontSize: 10, opacity: 0.65, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 };
          const DSC = { fontSize: 11, opacity: 0.6, lineHeight: 1.4, marginTop: 7 };
          const SBTN = { flex: 1, background: "none", border: "none", color: "#E4E4EC", fontSize: 10, padding: "4px 0", cursor: "pointer" };
          // Directores disponibles para el montaje: Shaq (default) + agentes creados por el usuario.
          const _allDirectors = [...(window.SAMPLE_AGENTS || []), ...(window.__creativeAgents || [])]
            .filter((a, i, arr) => a && a.id && arr.findIndex((b) => b.id === a.id) === i);
          const activeDirector = _allDirectors.find((d) => d.id === directorId) || _allDirectors[0] || null;
          // Dirección IA: prompt del usuario → /chat/edit (render:false) → EDL → aplica al editor
          const applyAIPlan = async () => {
            const p = editPrompt.trim();
            if (!p || aiPlanning || selItems.length === 0) return;
            setAiPlanning(true); setPlanNotes("");
            try {
              const r = await fetch(`${API}/chat/edit`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  instruction: p,
                  render: false,
                  brand: { name: "Cliender", accent: "#7C3AED" },
                  scenes: selItems.map((it) => ({
                    url: it.url,
                    kind: it.kind === "video" ? "video" : "image",
                    duration_s: durOf(it),
                    caption: String(sceneTexts[it.id] != null ? sceneTexts[it.id] : (it.prompt || "")).slice(0, 100),
                    description: (it.prompt || "").slice(0, 100),
                  })),
                }),
              });
              const d = await r.json();
              if (!r.ok || !d.edl) throw new Error(d.detail || d.error || `HTTP ${r.status}`);
              const edl = d.edl;
              const edlScenes = Array.isArray(edl.scenes) ? edl.scenes : [];
              const byIdx = {};
              edlScenes.forEach((s) => { if (s && s.index != null) byIdx[s.index] = s; });
              const byId = {};
              selItems.forEach((it, idx) => {
                const s = byIdx[idx + 1];
                if (s) byId[it.id] = {
                  transition: s.transition || null,
                  kenburns: s.kenburns || null,
                  duration_s: it.kind === "video" ? null : (s.duration_s || null),
                  caption_style: s.caption_style || null,
                  caption_position: s.caption_position || null,
                };
              });
              setScenePlan(byId);
              const caps = {};
              selItems.forEach((it, idx) => {
                const s = byIdx[idx + 1];
                if (s && s.caption) caps[it.id] = s.caption;
              });
              if (Object.keys(caps).length) { setSceneTexts((prev) => ({ ...prev, ...caps })); setSubs(true); }
              const st = edl.style || {};
              if (st.look) setLook(st.look);
              if (st.letterbox != null) setLetterbox(!!st.letterbox);
              if (st.grain != null) setGrain(st.grain > 0);
              if (st.sfx != null) setSfx(!!st.sfx);
              if (st.branding != null) setBranding(!!st.branding);
              setPlanNotes(edl.rationale || "Plan de montaje aplicado — revisa la secuencia y renderiza.");
              window.__notify && window.__notify({ kind: "success", icon: "🎬", title: "Dirección aplicada", body: "El plan de montaje está listo — revisa y renderiza" });
            } catch (e) {
              setPlanNotes("");
              window.__notify && window.__notify({ kind: "error", icon: "⚠", title: "Dirección IA falló", body: String(e && e.message ? e.message : e) });
            } finally { setAiPlanning(false); }
          };
          return (
            <div onClick={() => !rendering && setEditorOpen(false)}
              style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
                background: "rgba(8,8,14,0.5)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }}>
              <div className="scroll-thin" onClick={(e) => e.stopPropagation()}
                style={{ width: "min(760px, 100%)", maxHeight: "min(88vh, 1000px)", overflowY: "auto", borderRadius: 22,
                  background: "var(--surface)", color: "var(--text-1)", border: "1px solid var(--line)",
                  boxShadow: "0 32px 90px -18px rgba(0,0,0,0.55), 0 0 0 1px rgba(139,92,246,0.10)" }}>

                <div style={{ padding: "20px 24px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "var(--surface)", zIndex: 5, borderTopLeftRadius: 22, borderTopRightRadius: 22 }}>
                  <div>
                    <div style={{ fontSize: 17, fontWeight: 600 }}>🎬 Editor de película</div>
                    <div className="mono" style={{ fontSize: 10.5, opacity: 0.6, marginTop: 3, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                      {selItems.length} escena{selItems.length === 1 ? "" : "s"} · ~{Math.round(totalS)}s · 1080×1920 · solo tu contenido
                    </div>
                  </div>
                  <button className="super-close" onClick={() => !rendering && setEditorOpen(false)}>✕</button>
                </div>

                <div style={{ padding: "16px 24px 22px", display: "flex", flexDirection: "column", gap: 18 }}>

                  {/* ── Dirección de edición IA ── */}
                  <div>
                    <div className="mono" style={LBL}>🎬 Dirección de edición — describe el montaje y la IA configura todo</div>
                    {_allDirectors.length > 0 && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "2px 0 10px" }}>
                        {_allDirectors.map((d) => {
                          const on = activeDirector && d.id === activeDirector.id;
                          return (
                            <button key={d.id} onClick={() => setDirectorId(d.id)} title={d.role || ""}
                              style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 12px 4px 5px", borderRadius: 999, cursor: "pointer", fontSize: 12, fontWeight: 600, background: on ? "rgba(124,58,237,0.16)" : "var(--surface-2)", border: "1px solid " + (on ? (d.accent || "#A78BFA") : "var(--line)"), color: "var(--text-1)", transition: "all 120ms" }}>
                              <span style={{ width: 22, height: 22, borderRadius: "50%", background: d.accent || "#6366F1", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9.5, fontWeight: 700, overflow: "hidden" }}>
                                {d.agentPhoto ? <img src={d.agentPhoto} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (d.initials || String(d.name || "?").slice(0, 2).toUpperCase())}
                              </span>
                              <span>/{String(d.name || "").toLowerCase()}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {activeDirector && (
                      <div className="mono" style={{ fontSize: 10, opacity: 0.5, marginBottom: 8, letterSpacing: "0.08em" }}>
                        Dirige /{String(activeDirector.name || "").toLowerCase()} · {activeDirector.role || "director"}
                      </div>
                    )}
                    <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)} rows={3}
                      placeholder={"Ej: estilo tráiler: abre con el plano más potente, ritmo rápido (1.5s por plano) con cortes secos, un film burn al cambiar de bloque, look noir, y el plano final lento con zoom out…"}
                      style={{ width: "100%", padding: "10px 12px", fontSize: 12.5, lineHeight: 1.5, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-1)", outline: "none", resize: "vertical", boxSizing: "border-box" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
                      <button className="gallery-assemble-go" disabled={!editPrompt.trim() || aiPlanning} onClick={applyAIPlan}
                        style={{ background: "rgba(124,58,237,0.2)", borderColor: "rgba(167,139,250,0.5)", fontWeight: 600 }}>
                        {aiPlanning ? "✦ Dirigiendo…" : "✦ Aplicar dirección IA"}
                      </button>
                      <span style={{ fontSize: 10.5, opacity: 0.55, lineHeight: 1.35 }}>Decide orden, transición y cámara por escena, look y ritmo — todo editable después.</span>
                    </div>
                    {planNotes && (
                      <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 10, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(167,139,250,0.25)", fontSize: 11.5, lineHeight: 1.45 }}>
                        🎬 {planNotes}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mono" style={LBL}>Secuencia — orden de aparición</div>
                    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6 }}>
                      {selItems.map((it, idx) => (
                        <div key={it.id} style={{ position: "relative", flex: "0 0 auto", width: 96, borderRadius: 10, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", background: "#000" }}>
                          {it.kind === "video"
                            ? <video src={it.url} muted style={{ width: 96, height: 128, objectFit: "cover", display: "block" }} />
                            : <img src={it.url} alt="" style={{ width: 96, height: 128, objectFit: "cover", display: "block" }} />}
                          <div style={{ position: "absolute", top: 5, left: 5, width: 18, height: 18, borderRadius: 6, background: "rgba(124,58,237,0.92)", color: "#fff", fontSize: 10.5, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>{idx + 1}</div>
                          {scenePlan[it.id] && scenePlan[it.id].transition && (
                            <div className="mono" style={{ position: "absolute", top: 5, right: 5, fontSize: 8, background: "rgba(124,58,237,0.85)", color: "#fff", padding: "1px 5px", borderRadius: 4 }} title={`Transición del plan IA: ${scenePlan[it.id].transition}`}>{scenePlan[it.id].transition}</div>
                          )}
                          <div className="mono" style={{ position: "absolute", bottom: 26, right: 5, fontSize: 9, background: "rgba(0,0,0,0.6)", padding: "1px 5px", borderRadius: 4, color: "#fff" }}>{durOf(it)}s</div>
                          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", background: "rgba(8,8,13,0.85)" }}>
                            <button onClick={() => move(idx, -1)} disabled={idx === 0} style={{ ...SBTN, opacity: idx === 0 ? 0.3 : 1 }} title="Mover antes">◀</button>
                            <button onClick={() => toggleSelect(it.id)} style={{ ...SBTN, color: "#f87171" }} title="Quitar de la película">✕</button>
                            <button onClick={() => move(idx, 1)} disabled={idx === selItems.length - 1} style={{ ...SBTN, opacity: idx === selItems.length - 1 ? 0.3 : 1 }} title="Mover después">▶</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mono" style={LBL}>Look cinematográfico</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                      {Object.entries(VIDEO_LOOKS).map(([id, l]) => (
                        <button key={id} onClick={() => setLook(id)}
                          style={{
                            textAlign: "left", padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                            background: look === id ? "rgba(124,58,237,0.16)" : "var(--surface-2)",
                            border: look === id ? "1.5px solid var(--accent-2)" : "1px solid var(--line)",
                            color: "inherit",
                          }}>
                          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                            {(LOOK_SWATCH[id] || []).map((c) => <span key={c} style={{ width: 13, height: 13, borderRadius: "50%", background: c, border: "1px solid rgba(255,255,255,0.18)" }} />)}
                          </div>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{l.label}</div>
                        </button>
                      ))}
                    </div>
                    <div style={DSC}>{VIDEO_LOOKS[look] && VIDEO_LOOKS[look].description}</div>
                  </div>

                  <div>
                    <div className="mono" style={LBL}>Transición entre escenas</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, maxHeight: 360, overflowY: "auto", paddingRight: 2 }}>
                      {Object.entries(VIDEO_TRANSITIONS).map(([id, t]) => (
                        <button key={id} onClick={() => setTransition(id)}
                          style={{ padding: "7px 5px 7px", borderRadius: 10, border: transition === id ? "2px solid var(--accent)" : "1.5px solid var(--line)", background: transition === id ? "rgba(124,58,237,0.12)" : "var(--surface-2)", cursor: "pointer", display: "flex", flexDirection: "column", gap: 5, transition: "border-color 130ms, background 130ms", outline: "none" }}>
                          <TransitionPreviewAnim id={id} selected={transition === id} />
                          <div style={{ fontSize: 11, fontWeight: transition === id ? 700 : 500, color: transition === id ? "#A78BFA" : "var(--text-2)", textAlign: "center", lineHeight: 1.15 }}>{t.label}</div>
                        </button>
                      ))}
                    </div>
                    <div style={DSC}>{VIDEO_TRANSITIONS[transition] && VIDEO_TRANSITIONS[transition].description}</div>
                  </div>

                  <div>
                    <div className="mono" style={LBL}>Acabado de película</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
                      {[
                        { k: "sfx", v: sfx, set: setSfx, t: "Sonido cinematográfico", d: "Whooshes e impactos sincronizados con cada transición (J-cut)" },
                        { k: "letterbox", v: letterbox, set: setLetterbox, t: "Letterbox cine", d: "Barras panorámicas estilo película" },
                        { k: "grain", v: grain, set: setGrain, t: "Grano 16mm", d: "Textura de película analógica" },
                        { k: "subs", v: subs, set: setSubs, t: "Subtítulos automáticos", d: "La voz de tus vídeos se transcribe sola (Whisper) y aparece sincronizada estilo cine" },
                        { k: "origAudio", v: origAudio, set: setOrigAudio, t: "Audio original", d: "Mantener la voz y el sonido de tus vídeos en la película" },
                        { k: "branding", v: branding, set: setBranding, t: "Intro/Outro de marca", d: "Cabecera y cierre Cliender. Apagado = SOLO tu contenido" },
                      ].map((o) => (
                        <label key={o.k} style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: o.v ? "rgba(124,58,237,0.10)" : "var(--surface-2)", border: o.v ? "1px solid var(--accent-2)" : "1px solid var(--line)" }}>
                          <input type="checkbox" checked={o.v} onChange={(e) => o.set(e.target.checked)} style={{ marginTop: 2 }} />
                          <span>
                            <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>{o.t}</span>
                            <span style={{ display: "block", fontSize: 10.5, opacity: 0.6, lineHeight: 1.35, marginTop: 2 }}>{o.d}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {subs && (
                    <div>
                      <div className="mono" style={LBL}>Estilo de subtítulos</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {[
                          { id: "boxed", t: "TikTok", d: "Palabra a palabra, MAYÚSCULAS, la activa se ilumina en violeta. El estilo viral." },
                          { id: "bubble", t: "Globo cómic", d: "Burbuja blanca con borde negro y sombra dura, estilo cartoon." },
                          { id: "neon", t: "Neón", d: "Texto con glow violeta brillante, la palabra activa se enciende." },
                          { id: "clean", t: "Cine", d: "Frase completa en píldora elegante, sin karaoke. El clásico." },
                        ].map((s) => (
                          <button key={s.id} onClick={() => setCapStyle(s.id)} title={s.d} style={{
                            padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                            background: capStyle === s.id ? "rgba(124,58,237,0.16)" : "var(--surface-2)",
                            border: capStyle === s.id ? "1.5px solid var(--accent-2)" : "1px solid var(--line)",
                            color: "var(--text-1)", fontSize: 12, fontWeight: 600,
                          }}>
                            {s.t}
                            <span style={{ display: "block", fontSize: 9.5, opacity: 0.6, marginTop: 3, lineHeight: 1.3, fontWeight: 400 }}>{s.d}</span>
                          </button>
                        ))}
                      </div>
                      <label style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", marginTop: 8, borderRadius: 10, cursor: "pointer", background: autopunch ? "rgba(124,58,237,0.10)" : "var(--surface-2)", border: autopunch ? "1px solid var(--accent-2)" : "1px solid var(--line)" }}>
                        <input type="checkbox" checked={autopunch} onChange={(e) => setAutopunch(e.target.checked)} style={{ marginTop: 2 }} />
                        <span>
                          <span style={{ display: "block", fontSize: 12.5, fontWeight: 600 }}>Dinamismo automático</span>
                          <span style={{ display: "block", fontSize: 10.5, opacity: 0.6, lineHeight: 1.35, marginTop: 2 }}>La IA detecta los silencios y golpes del habla y coloca micro-zooms + efectos de sonido justo ahí — el vídeo respira solo</span>
                        </span>
                      </label>
                    </div>
                  )}

                  {subs && (
                    <div>
                      <div className="mono" style={LBL}>Estilo visual del subtítulo</div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                        {[
                          { id: "pill",     t: "Píldora",   d: "Fondo semi-transparente con acento." },
                          { id: "outline",  t: "Contorno",  d: "Sin fondo, trazo fino. Elegancia tipográfica." },
                          { id: "stamp",    t: "Stamp",     d: "Bold all-caps angular. Impacto editorial." },
                          { id: "gradient", t: "Gradiente", d: "Texto degradado blanco→accent. Moderno." },
                          { id: "minimal",  t: "Minimal",   d: "Thin tracking amplio, uppercase. Ultra editorial." },
                          { id: "bold",     t: "Bold",      d: "Tamaño máximo. Para frases de una palabra." },
                          { id: "kinetic",  t: "Kinético",  d: "Cada letra entra staggered. Para títulos cortos." },
                        ].map((s) => (
                          <button key={s.id} onClick={() => setCaptionStyle(s.id)} title={s.d} style={{
                            padding: "10px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                            background: captionStyle === s.id ? "rgba(124,58,237,0.16)" : "var(--surface-2)",
                            border: captionStyle === s.id ? "1.5px solid var(--accent-2)" : "1px solid var(--line)",
                            color: "var(--text-1)", fontSize: 12, fontWeight: 600,
                          }}>
                            {s.t}
                            <span style={{ display: "block", fontSize: 9.5, opacity: 0.6, marginTop: 3, lineHeight: 1.3, fontWeight: 400 }}>{s.d}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {subs && (
                    <div>
                      <div className="mono" style={LBL}>Posición del subtítulo en pantalla</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {[
                          { id: "bottom", t: "↓ Abajo",  d: "Posición estándar. Debajo de la acción." },
                          { id: "top",    t: "↑ Arriba", d: "Cuando la acción ocupa la zona baja." },
                          { id: "center", t: "✛ Centro", d: "Impacto dramático máximo." },
                          { id: "left",   t: "← Izqda", d: "Composición asimétrica a la izquierda." },
                          { id: "right",  t: "Dcha →",  d: "Composición asimétrica a la derecha." },
                        ].map((s) => (
                          <button key={s.id} onClick={() => setCaptionPos(s.id)} title={s.d} style={{
                            flex: 1, minWidth: 70, padding: "9px 8px", borderRadius: 10, cursor: "pointer", textAlign: "center",
                            background: captionPos === s.id ? "rgba(124,58,237,0.16)" : "var(--surface-2)",
                            border: captionPos === s.id ? "1.5px solid var(--accent-2)" : "1px solid var(--line)",
                            color: "var(--text-1)", fontSize: 12, fontWeight: 600,
                          }}>
                            {s.t}
                            <span style={{ display: "block", fontSize: 9, opacity: 0.55, marginTop: 2, lineHeight: 1.2, fontWeight: 400 }}>{s.d}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {subs && (
                    <div>
                      <div className="mono" style={LBL}>Subtítulos por escena — vídeos: automáticos por voz · este texto es el respaldo</div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {selItems.map((it, idx) => (
                          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span className="mono" style={{ width: 18, fontSize: 10.5, opacity: 0.6, textAlign: "right" }}>{idx + 1}</span>
                            <input
                              type="text"
                              value={sceneTexts[it.id] != null ? sceneTexts[it.id] : ""}
                              maxLength={120}
                              placeholder="Escribe el subtítulo de esta escena… (vacío = sin subtítulo)"
                              onChange={(e) => setSceneTexts((p) => ({ ...p, [it.id]: e.target.value }))}
                              style={{ flex: 1, height: 32, padding: "4px 12px", fontSize: 12.5, borderRadius: 8, background: "var(--surface-2)", border: "1px solid var(--line)", color: "var(--text-1)", outline: "none" }}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={DSC}>En vídeos la voz se transcribe sola; este texto solo se usa si la escena no tiene voz (o es imagen). Campo vacío = sin subtítulo.</div>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", alignItems: "center", borderTop: "1px solid var(--line)", paddingTop: 16 }}>
                    {rendering && <span className="mono" style={{ fontSize: 11, opacity: 0.7, marginRight: "auto" }}>⏳ Renderizando película… 1-2 min</span>}
                    <button className="btn-soft" disabled={rendering} onClick={() => setEditorOpen(false)}>Cancelar</button>
                    <button className="gallery-assemble-go" disabled={selItems.length === 0 || rendering} onClick={assemble}
                      style={{ background: "rgba(124,58,237,0.25)", borderColor: "rgba(167,139,250,0.55)", fontWeight: 600, padding: "8px 18px" }}>
                      {rendering ? "Renderizando…" : "🎬 Renderizar película"}
                    </button>
                  </div>

                </div>
              </div>
            </div>
          );
        })()}

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
// (Eliminado fakeMediaUrlForGeneration: la herramienta solo muestra media REAL
//  generada por el backend; si una generación falla, falla visiblemente.)

// ===========================================================================
// Export
// ===========================================================================
Object.assign(window, {
  NotificationProvider,
  useNotifications,
  NodeDock,
  GalleryPanel,
  GalleryButton,
});
