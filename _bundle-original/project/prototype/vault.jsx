/* prototype/vault.jsx
 * Style Vault — bottom sheet con drag&drop, lista de carpetas, masonry grid,
 * inspector con el StyleManifest y el escáner "auditando ADN visual".
 *
 * Expone al window:
 *   - MoodboardVault (componente principal del sheet)
 *   - VaultButton (botón del topbar con estado locked)
 *   - SAMPLE_MOODBOARDS (carpetas pre-cargadas para que el demo arranque vistoso)
 *   - runMockAudit(images, themeHint) → StyleManifest (mock realista)
 */

// ---------------------------------------------------------------------------
// Mocks de StyleManifest — el backend usa Claude Vision; aquí simulamos.
// ---------------------------------------------------------------------------
const VAULT_THEMES = {
  "warm-editorial": {
    name: "Warm Editorial",
    seeds: ["wmEd1", "wmEd2", "wmEd3", "wmEd4", "wmEd5", "wmEd6"],
    manifest: {
      colorPalette: ["#2A1F18", "#5C3D2E", "#A47551", "#D9B58C", "#F2E3CB"],
      lightingStyle: "golden-hour rim light at 45°, soft falloff, gentle ambient bounce, no harsh shadows",
      cameraLensFeel: "85mm f/1.4 anamorphic, shallow DOF, mild chromatic aberration on edges",
      characterTraits: ["natural skin texture", "minimal makeup", "linen and wool fabrics", "soft tousled hair"],
      compositionRules: ["subject off-center to the right", "negative space top third", "horizon low"],
      moodKeywords: ["editorial", "contemplative", "refined", "autumnal"],
      masterStylePrompt: "Editorial fashion photography, golden hour warm autumn palette, 85mm shallow DOF with anamorphic flare, linen and wool textures, contemplative subject framed off-center with negative space above, soft natural light with gentle rim at 45°, neutral warm grading, subtle 35mm film grain.",
      negativePrompt: "plastic skin, oversaturated, low-fi, watermark, text, hdr",
      consistencyScore: 0.92
    }
  },
  "neon-tokyo": {
    name: "Neon Tokyo Night",
    seeds: ["nTk1", "nTk2", "nTk3", "nTk4", "nTk5"],
    manifest: {
      colorPalette: ["#0A0419", "#3D1466", "#8B5CF6", "#F9A8D4", "#06B6D4"],
      lightingStyle: "neon practicals, mixed magenta + cyan, hard speculars on wet asphalt",
      cameraLensFeel: "35mm f/1.8, mild barrel distortion, halated highlights, anamorphic streaks",
      characterTraits: ["wet hair", "translucent rain ponchos", "reflective fabrics"],
      compositionRules: ["dutch angle 5–10°", "deep one-point perspective"],
      moodKeywords: ["cyberpunk", "rain-soaked", "kinetic", "lonely"],
      masterStylePrompt: "Cyberpunk Tokyo night street photography, neon magenta and cyan practicals reflecting on wet asphalt, 35mm anamorphic with halation, slight dutch angle and deep one-point perspective, translucent ponchos and reflective textures, moody high-contrast, photographic grain.",
      negativePrompt: "daylight, pastel sky, cartoon, low contrast, blurry",
      consistencyScore: 0.87
    }
  },
  "brutalist-monochrome": {
    name: "Brutalist Monochrome",
    seeds: ["brM1", "brM2", "brM3", "brM4", "brM5", "brM6", "brM7"],
    manifest: {
      colorPalette: ["#0A0A0A", "#1F1F1F", "#3F3F3F", "#9CA3AF", "#F4F4F5"],
      lightingStyle: "north-window daylight, single source, deep shadow side, no fill",
      cameraLensFeel: "50mm f/2 medium-format, edge-to-edge sharpness, mild micro-contrast",
      characterTraits: ["concrete textures", "geometric grids", "minimal subjects"],
      compositionRules: ["centered subject", "symmetry", "frame-within-frame"],
      moodKeywords: ["austere", "monumental", "silent", "minimalist"],
      masterStylePrompt: "Brutalist architectural photography, pure monochrome with restrained mid-tones, single north-window source casting deep unfilled shadows, 50mm medium-format sharpness, perfectly symmetrical centered composition with frame-within-frame, monumental and silent.",
      negativePrompt: "warm tones, color cast, hdr, busy composition",
      consistencyScore: 0.94
    }
  }
};

function buildSampleMoodboard(themeKey) {
  const t = VAULT_THEMES[themeKey];
  // Genera 5-7 placeholder SVG sintetizados seedeados — offline-friendly
  const images = t.seeds.map((seed, i) => {
    const palette = t.manifest.colorPalette;
    const c1 = palette[i % palette.length];
    const c2 = palette[(i + 1) % palette.length];
    const c3 = palette[(i + 2) % palette.length];
    const w = 600;
    const h = 600 + seed.charCodeAt(2) % 4 * 80;
    const noiseSeed = (seed.charCodeAt(0) * 31 + seed.charCodeAt(2)) % 99;
    const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${w} ${h}' preserveAspectRatio='xMidYMid slice'>` +
    `<defs>` +
    `<radialGradient id='a' cx='${20 + i * 12}%' cy='${30 + i * 8}%' r='75%'>` +
    `<stop offset='0%' stop-color='${c1}'/>` +
    `<stop offset='55%' stop-color='${c2}'/>` +
    `<stop offset='100%' stop-color='${c3}'/>` +
    `</radialGradient>` +
    `<filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.4' numOctaves='1' seed='${noiseSeed}'/>` +
    `<feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.10 0'/></filter>` +
    `</defs>` +
    `<rect width='${w}' height='${h}' fill='url(#a)'/>` +
    `<rect width='${w}' height='${h}' filter='url(#n)'/>` +
    `</svg>`;
    return {
      id: `img-${seed}`,
      url: "data:image/svg+xml;utf8," + encodeURIComponent(svg)
    };
  });
  return {
    id: `mb-${themeKey}`,
    name: t.name,
    images,
    manifest: { moodboardId: `mb-${themeKey}`, ...t.manifest },
    auditStatus: "ready",
    locked: false
  };
}

const SAMPLE_MOODBOARDS = [
buildSampleMoodboard("warm-editorial"),
buildSampleMoodboard("neon-tokyo"),
buildSampleMoodboard("brutalist-monochrome")];


// Mock auditor para drops del usuario (cuando no hay backend)
async function runMockAudit(images) {
  // Simulamos el tiempo de Claude
  await new Promise((r) => setTimeout(r, 1800));
  // Mezclamos un manifest base aleatorio
  const themes = Object.values(VAULT_THEMES);
  const base = themes[Math.floor(Math.random() * themes.length)].manifest;
  return {
    moodboardId: "mock",
    ...base,
    consistencyScore: Math.max(0.6, Math.min(0.95, 0.7 + images.length % 6 * 0.04))
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}
async function imagesFromFiles(fileList) {
  const arr = Array.from(fileList).filter((f) => f.type && f.type.startsWith("image/"));
  const out = [];
  for (const f of arr) {
    const url = await fileToDataURL(f);
    out.push({ id: "img-" + Math.random().toString(36).slice(2, 9), url });
  }
  return out;
}

// ---------------------------------------------------------------------------
// LockSwitch
// ---------------------------------------------------------------------------
function LockSwitch({ locked, onToggle, compact }) {
  return (
    <button
      type="button"
      className={"lock-switch " + (locked ? "is-locked" : "")}
      onClick={(e) => {e.stopPropagation();onToggle();}}>
      
      <span className="lock-track"><span className="lock-knob" /></span>
      {compact ? locked ? "locked" : "lock" : locked ? "style locked" : "lock style"}
    </button>);

}

// ---------------------------------------------------------------------------
// Moodboard Card (sidebar)
// ---------------------------------------------------------------------------
function MoodboardCard({ mb, active, onSelect, onToggleLock, onOpenGallery }) {
  const thumbs = mb.images.slice(0, 4);
  return (
    <div
      role="button"
      tabIndex={0}
      className={"moodboard-card " + (active ? "is-active " : "") + (mb.locked ? "is-locked" : "")}
      onClick={onSelect}
      onKeyDown={(e) => {if (e.key === "Enter" || e.key === " ") onSelect();}}>
      
      <button
        className="mb-card-open"
        onClick={(e) => {e.stopPropagation();onOpenGallery?.();}}
        title="Ver todas las imágenes">
        
        Ver {mb.images.length} fotos →
      </button>
      <div className="mb-thumbs">
        {thumbs.length === 0 && <div className="mb-thumbs-empty">empty</div>}
        {thumbs.map((img, i) =>
        <div
          key={img.id}
          className={"mb-thumb " + (thumbs.length === 1 ? "single" : "")}
          style={{ backgroundImage: `url(${img.url})` }} />

        )}
        {mb.auditStatus === "auditing" &&
        <div className="scanner-overlay">
            <div className="scanner-line" />
            <div className="scanner-label">
              <span className="led-dot led-breath" style={{ background: "#8B5CF6", boxShadow: "0 0 8px #8B5CF6" }} />
              auditando ADN
            </div>
          </div>
        }
      </div>
      <div className="mb-meta">
        <div style={{ minWidth: 0 }}>
          <div className="mb-name">{mb.name}</div>
          <div className="mb-stat">
            {mb.images.length} ref ·{" "}
            {mb.auditStatus === "ready" && mb.manifest ?
            `consist ${mb.manifest.consistencyScore.toFixed(2)}` :
            mb.auditStatus}
          </div>
        </div>
        <LockSwitch locked={mb.locked} onToggle={onToggleLock} compact />
      </div>
    </div>);

}

// ---------------------------------------------------------------------------
// Palette Strip
// ---------------------------------------------------------------------------
function PaletteStrip({ colors }) {
  if (!colors?.length) return null;
  return (
    <div className="vi-palette">
      {colors.slice(0, 6).map((c, i) =>
      <div key={i} className="vi-swatch">
          <div className="vi-swatch-color" style={{ background: c, boxShadow: `inset 0 0 0 1px var(--line), 0 0 10px ${c}66` }} />
          <span className="vi-swatch-hex">{c}</span>
        </div>
      )}
    </div>);

}

// ---------------------------------------------------------------------------
// Inspector (Style Manifest) — Dashboard mejorado
// ---------------------------------------------------------------------------
function ManifestInspector({ mb }) {
  const [popupOpen, setPopupOpen] = React.useState(false);
  if (!mb) return null;
  if (!mb.manifest) {
    return (
      <aside className="vault-inspector">
        <div className="dash-hero dash-hero-empty">
          <div className="dash-hero-orb dash-orb-empty">
            <div className="dash-orb-core" />
          </div>
          <div className="dash-hero-title">Sin auditoría</div>
          <div className="dash-hero-sub">
            Sube referencias y el <span style={{ color: "var(--accent-3)" }}>Vision Auditor</span> generará el ADN visual.
          </div>
        </div>
      </aside>);

  }
  const m = mb.manifest;
  const consistency = Math.round(m.consistencyScore * 100);
  const consistencyLabel = consistency >= 85 ? "excelente" : consistency >= 70 ? "alta" : consistency >= 50 ? "media" : "baja";
  const circumference = 2 * Math.PI * 60;
  const dashOffset = circumference - consistency / 100 * circumference;

  return (
    <>
    <aside className="vault-inspector vault-inspector-dash scroll-thin">
      <button className="mfp-open-btn" onClick={() => setPopupOpen(true)}>
        Ver manifest completo <span style={{ marginLeft: 6 }}>→</span>
      </button>

      <div className="dash-score-card">
        <div className="dash-score-ring">
          <svg viewBox="0 0 140 140">
            <defs>
              <linearGradient id="dash-score-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent)" />
                <stop offset="100%" stopColor="var(--accent-2)" />
              </linearGradient>
            </defs>
            <circle cx="70" cy="70" r="60" className="dash-score-ring-bg" />
            <circle cx="70" cy="70" r="60" className="dash-score-ring-fill"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.32, 0.72, 0, 1)" }} />
              
          </svg>
          <div className="dash-score-text">
            <div className="dash-score-num">{consistency}</div>
            <div className="dash-score-label">match score</div>
          </div>
        </div>
        <div className="dash-score-tag">precisión {consistencyLabel}</div>
        <div className="dash-score-explain">
          Tan exacto será el prompt generado al replicar las {mb.images.length} imágenes de referencia.
        </div>
      </div>
    </aside>
    {popupOpen &&
      <div className="form-popup-backdrop" onClick={() => setPopupOpen(false)}>
        <div className="form-popup mfp-popup" onClick={(e) => e.stopPropagation()}>
          <div className="mfp-head">
            <div className="mfp-head-left">
              <div className="mfp-head-orb" style={{
                background: `conic-gradient(${(m.colorPalette || []).map((c, i, a) => `${c} ${i / a.length * 100}% ${(i + 1) / a.length * 100}%`).join(", ")})`
              }}>
                <div className="mfp-head-orb-inner" style={{ background: m.colorPalette?.[0] || "#A78BFA" }}>
                  <div className="mfp-head-score">{Math.round(m.consistencyScore * 100)}</div>
                </div>
              </div>
              <div>
                <div className="form-popup-kicker mono">style manifest · ADN visual</div>
                <div className="form-popup-title">{mb.name}</div>
                <div className="mfp-head-stats mono">{mb.images.length} refs · {m.colorPalette?.length || 0} colors</div>
              </div>
            </div>
            <button className="super-close" onClick={() => setPopupOpen(false)}>✕</button>
          </div>
          <div className="mfp-body scroll-thin">
            <div className="mfp-block">
              <div className="mfp-label mono">paleta dominante</div>
              <div className="mfp-palette">
                {(m.colorPalette || []).map((c, i) =>
                <div key={c + i} className="mfp-swatch" style={{ background: c }}>
                    <div className="mfp-swatch-info">
                      <div className="mfp-swatch-role mono">{i === 0 ? "dominante" : "acento"}</div>
                      <div className="mfp-swatch-hex mono">{c.toUpperCase()}</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {m.lightingStyle &&
            <div className="mfp-block">
                <div className="mfp-attr-head">
                  <div className="mfp-attr-icon" style={{ background: "rgba(251,191,36,0.14)", color: "#FBBF24" }}>☀</div>
                  <div className="mfp-label mono">iluminación</div>
                </div>
                <div className="mfp-attr-text">{m.lightingStyle}</div>
              </div>
            }
            {m.cameraLensFeel &&
            <div className="mfp-block">
                <div className="mfp-attr-head">
                  <div className="mfp-attr-icon" style={{ background: "rgba(125,211,252,0.14)", color: "#7DD3FC" }}>◎</div>
                  <div className="mfp-label mono">lente y cámara</div>
                </div>
                <div className="mfp-attr-text">{m.cameraLensFeel}</div>
              </div>
            }
            {(m.moodKeywords || []).length > 0 &&
            <div className="mfp-block">
                <div className="mfp-label mono">mood</div>
                <div className="mfp-mood-grid">
                  {m.moodKeywords.map((k) => <span key={k} className="dash-mood-chip">{k}</span>)}
                </div>
              </div>
            }
            {(m.compositionRules || []).length > 0 &&
            <div className="mfp-block">
                <div className="mfp-label mono">reglas de composición</div>
                <div className="dash-chips">{m.compositionRules.map((r) => <span key={r} className="dash-chip">{r}</span>)}</div>
              </div>
            }
            {(m.characterTraits || []).length > 0 &&
            <div className="mfp-block">
                <div className="mfp-label mono">character traits</div>
                <div className="dash-chips">{m.characterTraits.map((r) => <span key={r} className="dash-chip dash-chip-soft">{r}</span>)}</div>
              </div>
            }
            <div className="mfp-block">
              <div className="mfp-label-row">
                <div className="mfp-label mono">master style prompt</div>
                <button className="dash-copy" onClick={() => {navigator.clipboard?.writeText(m.masterStylePrompt);window.__notify?.({ icon: "⧉", title: "Prompt copiado" });}}>copiar</button>
              </div>
              <div className="mfp-prompt mono">{m.masterStylePrompt}</div>
            </div>
            {m.negativePrompt &&
            <div className="mfp-block">
                <div className="mfp-label mono mfp-label-neg">negative · qué evitar</div>
                <div className="mfp-prompt mono mfp-prompt-neg">{m.negativePrompt}</div>
              </div>
            }
          </div>
        </div>
      </div>
      }
    </>);

}
// ---------------------------------------------------------------------------
// MoodboardVault — sheet completo
// ---------------------------------------------------------------------------
function MoodboardVault({ open, onClose, moodboards, dispatch }) {
  const [activeId, setActiveId] = React.useState(moodboards[0]?.id || null);
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [galleryId, setGalleryId] = React.useState(null);
  const [previewImg, setPreviewImg] = React.useState(null);
  const fileInputRef = React.useRef(null);
  const dragCounter = React.useRef(0);

  // Recalcula active si la lista cambia
  React.useEffect(() => {
    if (!activeId && moodboards.length) setActiveId(moodboards[0].id);
    if (activeId && !moodboards.find((m) => m.id === activeId) && moodboards.length) {
      setActiveId(moodboards[0].id);
    }
  }, [moodboards, activeId]);

  const activeMb = moodboards.find((m) => m.id === activeId);

  const onSelectFiles = async (filesLike) => {
    if (!activeMb) return;
    const imgs = await imagesFromFiles(filesLike);
    if (!imgs.length) return;
    dispatch({ type: "ADD_IMAGES", id: activeMb.id, images: imgs });
    // Trigger audit
    dispatch({ type: "BEGIN_AUDIT", id: activeMb.id });
    const manifest = await runMockAudit([...activeMb.images, ...imgs]);
    dispatch({ type: "SET_MANIFEST", id: activeMb.id, manifest });
  };

  const onDragEnter = (e) => {
    e.preventDefault();
    dragCounter.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length) setIsDragOver(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {setIsDragOver(false);dragCounter.current = 0;}
  };
  const onDragOver = (e) => {e.preventDefault();};
  const onDrop = (e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    if (e.dataTransfer.files?.length) onSelectFiles(e.dataTransfer.files);
  };

  return (
    <>
      {open && <div className="vault-backdrop" onClick={onClose} />}
      <section className={"vault-sheet " + (open ? "is-open" : "")}>
        <div className="vault-handle" />

        {/* Sidebar */}
        <aside className="vault-side">
          <div className="vault-side-head">
            <div>
              <div className="vault-side-title">Moodboard</div>
              <div className="vault-side-kicker">style engine · consistencia</div>
            </div>
            <button
              className="btn-ghost"
              onClick={() => setCreateOpen(true)}>
              + new</button>
          </div>
          <div className="vault-side-list scroll-thin">
            {moodboards.map((mb) =>
            <MoodboardCard
              key={mb.id}
              mb={mb}
              active={activeMb?.id === mb.id}
              onSelect={() => setActiveId(mb.id)}
              onToggleLock={() => dispatch({ type: "TOGGLE_LOCK", id: mb.id })}
              onOpenGallery={() => setGalleryId(mb.id)} />

            )}
          </div>
        </aside>

        {/* Main */}
        <section className="vault-main">
          <div className="vault-main-head" data-comment-anchor="61b4f7b6fb-div-470-11">
            <div style={{ minWidth: 0, flex: 1 }}>
              {activeMb ?
              <>
                  <input
                  className="vault-name-input"
                  value={activeMb.name}
                  onChange={(e) => dispatch({ type: "RENAME", id: activeMb.id, name: e.target.value })}
                  placeholder="Nombre del moodboard" />
                
                  <div className="vault-main-stat">
                    {activeMb.images.length} refs
                    {activeMb.manifest && ` · consist ${activeMb.manifest.consistencyScore.toFixed(2)}`}
                  </div>
                </> :

              <div style={{ color: "var(--text-3)", fontSize: 14 }}>Selecciona un moodboard</div>
              }
            </div>
            <div className="vault-actions">
              {activeMb &&
              <>
                  <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>
                    + subir imágenes
                  </button>
                  <button
                  className="btn-ghost"
                  style={{
                    borderColor: "rgba(139,92,246,0.4)",
                    background: "rgba(139,92,246,0.10)",
                    color: "var(--accent-3)"
                  }}
                  disabled={!activeMb.images.length}
                  onClick={async () => {
                    dispatch({ type: "BEGIN_AUDIT", id: activeMb.id });
                    const manifest = await runMockAudit(activeMb.images);
                    dispatch({ type: "SET_MANIFEST", id: activeMb.id, manifest });
                  }}>
                  re-auditar</button>
                  <LockSwitch
                  locked={activeMb.locked}
                  onToggle={() => dispatch({ type: "TOGGLE_LOCK", id: activeMb.id })} />
                
                </>
              }
              <button
                onClick={onClose}
                className="super-close"
                style={{ marginLeft: 6 }}>
                ✕</button>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => e.target.files && onSelectFiles(e.target.files)} />
          

          <div className="vault-body">
            {/* Grid */}
            <div
              className={"vault-grid-wrap scroll-thin " + (isDragOver ? "is-drag-over" : "")}
              onDragEnter={onDragEnter}
              onDragLeave={onDragLeave}
              onDragOver={onDragOver}
              onDrop={onDrop}>
              
              {!activeMb || activeMb.images.length === 0 ?
              <div className="vault-empty">
                  <div>
                    <div className="vault-empty-icon">⇪</div>
                    <div className="vault-empty-kicker">arrastra para subir</div>
                    <div className="vault-empty-title">Suelta imágenes aquí.</div>
                    <div className="vault-empty-body">
                      El <em>Vision Auditor</em> analiza el set y produce un{" "}
                      <em>master style prompt</em> + paleta + lente + luz para forzar consistencia.
                    </div>
                    <div className="vault-empty-cta">
                      <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>
                        seleccionar archivos
                      </button>
                    </div>
                  </div>
                </div> :

              <div className="masonry" data-comment-anchor="85c14e0339-div-560-17">
                  {activeMb.images.map((img) =>
                <div key={img.id} className="masonry-item">
                      <img src={img.url} alt="" loading="lazy" />
                      <button
                    className="remove-btn"
                    onClick={() => dispatch({ type: "REMOVE_IMAGE", id: activeMb.id, imageId: img.id })}>
                    ✕</button>
                    </div>
                )}
                </div>
              }

              {/* Drop overlay */}
              {isDragOver &&
              <div className="drop-overlay">
                  <div style={{ textAlign: "center" }}>
                    <div className="drop-overlay-title">soltar para auditar</div>
                    <div className="drop-overlay-sub">El Vision Auditor analizará el ADN visual</div>
                  </div>
                </div>
              }

              {/* Big scanner */}
              {activeMb?.auditStatus === "auditing" && <div className="scanner-big" />}
            </div>

            {/* Inspector */}
            <ManifestInspector mb={activeMb} />
          </div>
        </section>
      </section>

      {createOpen &&
      <div className="form-popup-backdrop" onClick={() => setCreateOpen(false)}>
          <div className="form-popup" onClick={(e) => e.stopPropagation()}>
            <div className="form-popup-head">
              <div>
                <div className="form-popup-kicker mono">style vault</div>
                <div className="form-popup-title">Nuevo moodboard</div>
              </div>
              <button className="super-close" onClick={() => setCreateOpen(false)}>✕</button>
            </div>
            {window.NewMoodboardForm &&
          <window.NewMoodboardForm
            onCancel={() => setCreateOpen(false)}
            onCreate={(data) => {
              const id = "mb-" + Math.random().toString(36).slice(2, 7);
              dispatch({ type: "CREATE", id, name: data.name });
              setActiveId(id);
              setCreateOpen(false);
              window.__notify?.({ kind: "success", icon: "+", title: "Moodboard creado", body: `${data.name} · intent ${data.intent}` });
            }} />

          }
          </div>
        </div>
      }

      {/* Gallery popup */}
      {galleryId && (() => {
        const mb = moodboards.find((m) => m.id === galleryId);
        if (!mb) return null;
        return (
          <div className="form-popup-backdrop" onClick={() => setGalleryId(null)}>
            <div className="form-popup mb-gallery-popup" onClick={(e) => e.stopPropagation()}>
              <div className="form-popup-head">
                <div>
                  <div className="form-popup-kicker mono">moodboard · referencias</div>
                  <div className="form-popup-title">{mb.name} <span style={{ color: "var(--text-3)", fontWeight: 400, fontSize: 14 }}>· {mb.images.length} imágenes</span></div>
                </div>
                <button className="super-close" onClick={() => setGalleryId(null)}>✕</button>
              </div>
              <div className="mb-gallery-grid scroll-thin">
                {mb.images.length === 0 ?
                <div className="mb-gallery-empty">
                    <div style={{ fontSize: 32, opacity: .4 }}>◇</div>
                    <div style={{ marginTop: 12, color: "var(--text-3)", fontSize: 13 }}>
                      No hay imágenes en este moodboard
                    </div>
                  </div> :

                mb.images.map((img) =>
                <button key={img.id} className="mb-gallery-thumb" onClick={() => setPreviewImg(img)}>
                      <img src={img.url} alt="" />
                    </button>
                )
                }
              </div>
            </div>
          </div>);

      })()}

      {previewImg &&
      <div className="form-popup-backdrop" style={{ zIndex: 300 }} onClick={() => setPreviewImg(null)}>
          <div className="mb-preview" onClick={(e) => e.stopPropagation()}>
            <button className="super-close mb-preview-close" onClick={() => setPreviewImg(null)}>✕</button>
            <img src={previewImg.url} alt="" />
          </div>
        </div>
      }
    </>);

}

// ---------------------------------------------------------------------------
// Botón del topbar
// ---------------------------------------------------------------------------
function VaultButton({ lockedName, onClick }) {
  return (
    <button className={"vault-btn " + (lockedName ? "has-locked" : "")} onClick={onClick}>
      {lockedName ? <span className="lock-pulse" /> : <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--text-4)" }} />}
      <span>Style Vault</span>
      {lockedName &&
      <span className="mono" style={{ fontSize: 10, letterSpacing: "0.12em", color: "var(--success-2)", textTransform: "uppercase" }}>
          · {lockedName.slice(0, 14)}
        </span>
      }
    </button>);

}

// ---------------------------------------------------------------------------
// Reducer del Vault — consumido por App
// ---------------------------------------------------------------------------
function moodboardReducer(state, action) {
  switch (action.type) {
    case "CREATE":
      return [...state, {
        id: action.id, name: action.name, images: [], manifest: null,
        auditStatus: "idle", locked: false
      }];
    case "RENAME":
      return state.map((m) => m.id === action.id ? { ...m, name: action.name } : m);
    case "ADD_IMAGES":
      return state.map((m) => {
        if (m.id !== action.id) return m;
        const ids = new Set(m.images.map((i) => i.id));
        return { ...m, images: [...m.images, ...action.images.filter((i) => !ids.has(i.id))] };
      });
    case "REMOVE_IMAGE":
      return state.map((m) => m.id === action.id ?
      { ...m, images: m.images.filter((i) => i.id !== action.imageId) } :
      m);
    case "BEGIN_AUDIT":
      return state.map((m) => m.id === action.id ? { ...m, auditStatus: "auditing" } : m);
    case "SET_MANIFEST":
      return state.map((m) => m.id === action.id ?
      { ...m, auditStatus: "ready", manifest: { ...action.manifest, moodboardId: m.id } } :
      m);
    case "TOGGLE_LOCK":{
        const target = state.find((m) => m.id === action.id);
        if (!target) return state;
        const willLock = !target.locked;
        return state.map((m) => ({
          ...m,
          locked: m.id === action.id ? willLock : willLock ? false : m.locked
        }));
      }
    case "REPLACE":
      return action.value;
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
Object.assign(window, {
  MoodboardVault,
  VaultButton,
  SAMPLE_MOODBOARDS,
  moodboardReducer,
  runMockAudit
});