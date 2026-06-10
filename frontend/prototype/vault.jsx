/* prototype/vault.jsx — v3
 * Layout: sidebar (220px) + galería (flex 1)
 * ADN Visual → popup central sobre fondo blur
 * Expone: MoodboardVault, VaultButton, moodboardReducer, runRealAudit, _mapManifest
 */

// Sin datos de muestra: los moodboards reales viven en Supabase (/moodboards)
// y se sincronizan vía window.__moodboards. El análisis es SIEMPRE el real
// (Vision Auditor backend) — runRealAudit más abajo.

// ─────────────────────────────────────────────────────────────────
// REAL AUDIT — POST /moodboards/audit (Vision Auditor backend)
// Maps snake_case backend manifest → camelCase frontend manifest.
// ─────────────────────────────────────────────────────────────────
function _mapManifest(m) {
  if (!m || typeof m !== "object") return null;
  const cs = typeof m.consistency_score === "number" ? m.consistency_score
           : typeof m.consistencyScore === "number" ? m.consistencyScore : 0.7;
  return {
    moodboardId: m.moodboard_id || m.moodboardId || "",
    colorPalette: m.color_palette || m.colorPalette || [],
    colorGrading: m.color_grading || m.colorGrading || "",
    lightingStyle: m.lighting_style || m.lightingStyle || "",
    cameraLensFeel: m.camera_lens_feel || m.cameraLensFeel || "",
    characterTraits: m.character_traits || m.characterTraits || [],
    compositionRules: m.composition_rules || m.compositionRules || [],
    compositionLayers: m.composition_layers || m.compositionLayers || [],
    typography: m.typography || [],
    textContent: m.text_content || m.textContent || [],
    filtersEffects: m.filters_effects || m.filtersEffects || [],
    moodKeywords: m.mood_keywords || m.moodKeywords || [],
    masterStylePrompt: m.master_style_prompt || m.masterStylePrompt || "",
    negativePrompt: m.negative_prompt || m.negativePrompt || "",
    characters: m.characters || [],
    consistencyScore: cs,
  };
}
async function runRealAudit(mb) {
  const body = {
    moodboard_id: mb.id,
    name: mb.name,
    images: (mb.images || []).map(i => ({ id: i.id, url: i.url })),
  };
  console.log("[vault] audit start →", body.images.length, "imgs · mb:", mb.id);
  // El backend procesa en background; este helper hace POST + polling hasta ready|error.
  const rawManifest = await window.__auditWithPolling(body, { maxMs: 360000 });
  let manifest = null;
  try {
    manifest = _mapManifest(rawManifest);
  } catch (mapErr) {
    console.error("[vault] _mapManifest threw", mapErr, rawManifest);
    throw new Error("audit manifest mapping failed: " + (mapErr?.message || mapErr));
  }
  if (!manifest) throw new Error("audit response missing manifest");
  return manifest;
}

// runAudit — función imperativa, NO hook.
// Se llama SOLO en dos casos:
//   1. El usuario sube imágenes nuevas (auto, solo las nuevas)
//   2. El usuario pulsa "analizar" manualmente (fuerza re-audit de todas)
// setScanningId(imageId|null) → actualiza qué foto está siendo analizada en tiempo real.
async function runAudit({ mb, dispatch, imagesToSend, setScanningId, auditedIdsRef }) {
  if (!mb?.id || !imagesToSend?.length) return;
  if (auditedIdsRef._running) return;
  auditedIdsRef._running = true;

  dispatch({ type: "BEGIN_AUDIT", id: mb.id });

  // Simular progreso por imagen: mostrar cada id mientras el fetch corre
  let cancelled = false;
  let imgIdx = 0;
  // Cicla en bucle mientras dura el análisis (puede tardar 75-180s en background),
  // así la UI no se queda congelada en la última foto.
  const stepInterval = setInterval(() => {
    if (cancelled) { clearInterval(stepInterval); return; }
    setScanningId(imagesToSend[imgIdx % imagesToSend.length].id);
    imgIdx++;
  }, Math.max(700, Math.floor(8000 / imagesToSend.length)));

  // Failsafe alineado con el cap de polling (6min). El análisis forense de sets
  // grandes corre en background en el backend; el frontend espera vía polling.
  const failsafe = setTimeout(() => {
    if (!auditedIdsRef._running) return;
    cancelled = true;
    clearInterval(stepInterval);
    setScanningId(null);
    auditedIdsRef._running = false;
    dispatch({ type: "SET_AUDIT_STATUS", id: mb.id, status: "error" });
  }, 380000);

  try {
    const manifest = await runRealAudit({ id: mb.id, name: mb.name, images: imagesToSend });
    clearTimeout(failsafe);
    cancelled = true;
    clearInterval(stepInterval);
    setScanningId(null);
    // Marcar todos los ids enviados como ya auditados
    imagesToSend.forEach(i => auditedIdsRef.ids.add(i.id));
    auditedIdsRef._running = false;
    dispatch({ type: "SET_MANIFEST", id: mb.id, manifest });
  } catch (err) {
    clearTimeout(failsafe);
    cancelled = true;
    clearInterval(stepInterval);
    setScanningId(null);
    auditedIdsRef._running = false;
    dispatch({ type: "SET_AUDIT_STATUS", id: mb.id, status: "error" });
  }
}


// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}
async function imagesFromFiles(fileList) {
  const arr = Array.from(fileList).filter(f => f.type && f.type.startsWith("image/"));
  const out = [];
  for (const f of arr) out.push({ id:"img-"+Math.random().toString(36).slice(2,9), url: await fileToDataURL(f) });
  return out;
}
function splitComma(s) { return (s||"").split(",").map(x=>x.trim()).filter(Boolean); }

// ─────────────────────────────────────────────────────────────────
// LOCK SWITCH
// ─────────────────────────────────────────────────────────────────
function LockSwitch({ locked, onToggle }) {
  return (
    <button type="button" className={"lock-switch " + (locked ? "is-locked" : "")}
      onClick={e => { e.stopPropagation(); onToggle(); }}>
      <span className="lock-track"><span className="lock-knob"/></span>
      {locked ? "locked" : "lock"}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// SIDEBAR — lista de moodboards
// ─────────────────────────────────────────────────────────────────
function MbListItem({ mb, active, onSelect, onToggleLock, onDelete }) {
  const palette = mb.manifest?.colorPalette || [];
  const score = mb.manifest ? Math.round(mb.manifest.consistencyScore * 100) : null;
  return (
    <div role="button" tabIndex={0}
      className={"vlt-mb-item " + (active ? "is-active " : "") + (mb.locked ? "is-locked" : "")}
      onClick={onSelect}
      onKeyDown={e => { if (e.key==="Enter"||e.key===" ") onSelect(); }}>

      <div className="vlt-mb-strip">
        {palette.length > 0
          ? palette.map((c,i) => <div key={i} className="vlt-mb-strip-seg" style={{background:c}}/>)
          : [0,1,2,3,4].map(i => <div key={i} className="vlt-mb-strip-seg" style={{background:"var(--surface-2)"}}/>)
        }
      </div>

      <div className="vlt-mb-info">
        <div className="vlt-mb-name">{mb.name}</div>
        <div className="vlt-mb-meta mono">
          {mb.images.length} refs
          {score !== null && <span className="vlt-mb-score">{score}%</span>}
          {mb.locked && <span className="vlt-mb-locked-badge">LOCKED</span>}
        </div>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:4,marginLeft:"auto"}}>
        <div className={"vlt-mb-dot " + (mb.auditStatus==="auditing" ? "is-auditing" : mb.manifest ? "is-ready" : "is-idle")}/>
        <button
          className="vlt-mb-delete-btn"
          title="Borrar moodboard"
          onClick={e => { e.stopPropagation(); if (window.__confirm) { window.__confirm(`¿Borrar "${mb.name}"?`, { danger: true, confirmText: "Borrar" }).then((ok) => { if (ok) onDelete(); }); } else if (window.confirm(`¿Borrar "${mb.name}"?`)) onDelete(); }}>
          ✕
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ADN POPUP — aparece centrado, ocupa ~80% de pantalla
// ─────────────────────────────────────────────────────────────────
function AdnPopup({ mb, dispatch, onClose }) {
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(null);

  React.useEffect(() => {
    if (!mb?.manifest) return;
    const m = mb.manifest;
    setDraft({
      lightingStyle: m.lightingStyle || "",
      cameraLensFeel: m.cameraLensFeel || "",
      masterStylePrompt: m.masterStylePrompt || "",
      negativePrompt: m.negativePrompt || "",
      moodKeywords: (m.moodKeywords||[]).join(", "),
      compositionRules: (m.compositionRules||[]).join(", "),
      characterTraits: (m.characterTraits||[]).join(", "),
    });
  }, [mb?.id]);

  React.useEffect(() => {
    const esc = e => { if (e.key==="Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  if (!mb?.manifest) return null;

  const m = mb.manifest;
  const score = Math.round(m.consistencyScore * 100);
  const scoreLabel = score>=85?"excelente":score>=70?"alta":score>=50?"media":"baja";
  const circumference = 2 * Math.PI * 24;
  const dashOffset = circumference - (score/100)*circumference;
  const set = k => e => setDraft(d => ({...d, [k]: e.target.value}));

  const save = () => {
    if (!draft) return;
    dispatch({ type:"SET_MANIFEST", id:mb.id, manifest:{
      ...m,
      lightingStyle: draft.lightingStyle,
      cameraLensFeel: draft.cameraLensFeel,
      masterStylePrompt: draft.masterStylePrompt,
      negativePrompt: draft.negativePrompt,
      moodKeywords: splitComma(draft.moodKeywords),
      compositionRules: splitComma(draft.compositionRules),
      characterTraits: splitComma(draft.characterTraits),
    }});
    window.__notify?.({ kind:"success", icon:"✦", title:"ADN actualizado", body:mb.name });
    setEditing(false);
  };

  const cancel = () => {
    setDraft({
      lightingStyle: m.lightingStyle||"",
      cameraLensFeel: m.cameraLensFeel||"",
      masterStylePrompt: m.masterStylePrompt||"",
      negativePrompt: m.negativePrompt||"",
      moodKeywords: (m.moodKeywords||[]).join(", "),
      compositionRules: (m.compositionRules||[]).join(", "),
      characterTraits: (m.characterTraits||[]).join(", "),
    });
    setEditing(false);
  };

  return ReactDOM.createPortal(
    <div className="adn-backdrop" onClick={onClose}>
      <div className="adn-popup" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="adn-head">
          <div className="adn-head-left">
            {/* Score mini ring */}
            <div className="adn-score-wrap">
              <svg viewBox="0 0 56 56" width="56" height="56">
                <defs>
                  <linearGradient id="adn-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--accent)"/>
                    <stop offset="100%" stopColor="var(--accent-2)"/>
                  </linearGradient>
                </defs>
                <circle cx="28" cy="28" r="24" className="adn-ring-bg"/>
                <circle cx="28" cy="28" r="24" className="adn-ring-fill"
                  strokeDasharray={circumference} strokeDashoffset={dashOffset}
                  style={{transition:"stroke-dashoffset 1.1s cubic-bezier(0.32,0.72,0,1)"}}/>
                <text x="28" y="33" textAnchor="middle" className="adn-score-num">{score}</text>
              </svg>
            </div>
            <div>
              <div className="adn-kicker mono">ficha de estilo · ADN visual</div>
              <div className="adn-title">{mb.name}</div>
              <div className="adn-sub mono">
                {mb.images.length} refs · consistencia <strong>{scoreLabel}</strong>
              </div>
            </div>
          </div>
          <div className="adn-head-right">
            {!editing
              ? <button className="cdp-btn cdp-btn-ghost adn-edit-btn" onClick={() => setEditing(true)}>✎ Editar ADN</button>
              : <>
                  <button className="cdp-btn cdp-btn-ghost" onClick={cancel}>Cancelar</button>
                  <button className="cdp-btn cdp-btn-primary" onClick={save}>Guardar</button>
                </>
            }
            <button className="super-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body — dos columnas */}
        <div className="adn-body scroll-thin">

          {/* Col izq */}
          <div className="adn-col">
            {/* Paleta */}
            <div className="adn-section">
              <div className="adn-label mono">paleta dominante</div>
              <div className="adn-palette">
                {(m.colorPalette||[]).map((c,i) => (
                  <div key={c+i} className="adn-swatch" style={{background:c}} title={c}>
                    <span className="adn-swatch-hex mono">{c.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Mood keywords */}
            <div className="adn-section">
              <div className="adn-label mono">mood keywords</div>
              {editing
                ? <input className="adn-input" value={draft.moodKeywords} onChange={set("moodKeywords")} placeholder="editorial, contemplative..."/>
                : <div className="adn-tags">{(m.moodKeywords||[]).map(k=><span key={k} className="adn-tag">{k}</span>)}</div>
              }
            </div>

            {/* Iluminación */}
            <div className="adn-section">
              <div className="adn-label mono">iluminación</div>
              {editing
                ? <textarea className="adn-textarea" rows={3} value={draft.lightingStyle} onChange={set("lightingStyle")}/>
                : <div className="adn-text">{m.lightingStyle}</div>
              }
            </div>

            {/* Cámara */}
            <div className="adn-section">
              <div className="adn-label mono">lente y cámara</div>
              {editing
                ? <textarea className="adn-textarea" rows={2} value={draft.cameraLensFeel} onChange={set("cameraLensFeel")}/>
                : <div className="adn-text">{m.cameraLensFeel}</div>
              }
            </div>

            {/* Composición */}
            <div className="adn-section">
              <div className="adn-label mono">composición</div>
              {editing
                ? <input className="adn-input" value={draft.compositionRules} onChange={set("compositionRules")} placeholder="off-center, negative space..."/>
                : <div className="adn-tags">{(m.compositionRules||[]).map(r=><span key={r} className="adn-tag adn-tag-dim">{r}</span>)}</div>
              }
            </div>

            {/* Character traits */}
            <div className="adn-section">
              <div className="adn-label mono">character traits</div>
              {editing
                ? <input className="adn-input" value={draft.characterTraits} onChange={set("characterTraits")} placeholder="linen fabrics, tousled hair..."/>
                : <div className="adn-tags">{(m.characterTraits||[]).map(t=><span key={t} className="adn-tag adn-tag-dim">{t}</span>)}</div>
              }
            </div>
          </div>

          {/* Col der — prompts */}
          <div className="adn-col">
            <div className="adn-section adn-section-grow">
              <div className="adn-label mono">master style prompt</div>
              {editing
                ? <textarea className="adn-textarea adn-textarea-lg" rows={8} value={draft.masterStylePrompt} onChange={set("masterStylePrompt")}/>
                : <>
                    <div className="adn-prompt">{m.masterStylePrompt}</div>
                    <button className="adn-copy-btn mono" onClick={() => {
                      navigator.clipboard?.writeText(m.masterStylePrompt);
                      window.__notify?.({ kind:"info", icon:"⎘", title:"Prompt copiado" });
                    }}>⎘ copiar prompt</button>
                  </>
              }
            </div>

            <div className="adn-section">
              <div className="adn-label mono">negative · qué evitar</div>
              {editing
                ? <textarea className="adn-textarea" rows={3} value={draft.negativePrompt} onChange={set("negativePrompt")}/>
                : <>
                    <div className="adn-text adn-text-neg">{m.negativePrompt}</div>
                    <button className="adn-copy-btn mono" style={{marginTop:6}} onClick={() => {
                      navigator.clipboard?.writeText(m.negativePrompt);
                      window.__notify?.({ kind:"info", icon:"⎘", title:"Negative copiado" });
                    }}>⎘ copiar negative</button>
                  </>
              }
            </div>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────
// GALERÍA — masonry + drag&drop
// ─────────────────────────────────────────────────────────────────
function Gallery({ mb, dispatch, scanningId, onRequestUpload }) {
  const [isDragOver, setIsDragOver] = React.useState(false);
  const [previewImg, setPreviewImg] = React.useState(null);
  const dragCounter = React.useRef(0);

  // Drag handlers delegados — las imágenes nuevas las sube MoodboardVault via handleFiles
  const onDragEnter = e => { e.preventDefault(); dragCounter.current+=1; if(e.dataTransfer.items?.length) setIsDragOver(true); };
  const onDragLeave = e => { e.preventDefault(); dragCounter.current-=1; if(dragCounter.current<=0){setIsDragOver(false);dragCounter.current=0;} };
  const onDrop = e => {
    e.preventDefault(); dragCounter.current=0; setIsDragOver(false);
    if(e.dataTransfer.files?.length) onRequestUpload(e.dataTransfer.files);
  };

  if (!mb) return (
    <div className="vlt-gallery-empty">
      <div className="vlt-empty-icon">◈</div>
      <div className="vlt-empty-title">Selecciona un moodboard</div>
    </div>
  );

  return (
    <>
      <div className={"vlt-gallery scroll-thin "+(isDragOver?"is-drag-over":"")}
        onDragEnter={onDragEnter} onDragLeave={onDragLeave}
        onDragOver={e=>e.preventDefault()} onDrop={onDrop}>

        {mb.images.length === 0 ? (
          <div className="vlt-gallery-empty">
            <div className="vlt-empty-icon">⇪</div>
            <div className="vlt-empty-title">Sin referencias</div>
            <div className="vlt-empty-sub">Arrastra imágenes o sube archivos</div>
            <button className="cdp-btn cdp-btn-ghost" style={{marginTop:16}} onClick={()=>onRequestUpload()}>seleccionar archivos</button>
          </div>
        ) : (
          <div className="vlt-masonry">
            {mb.images.map((img, idx) => {
              const isActive = scanningId === img.id;
              return (
                <div key={img.id} className={"vlt-masonry-item" + (isActive ? " is-scanning" : "")}>
                  <img src={img.url} alt="" loading="lazy" onClick={()=>setPreviewImg(img)}/>
                  {isActive && (
                    <div className="vlt-scan-overlay vlt-siri" aria-hidden="true">
                      {/* Campo fluido de color morphing — estilo Siri */}
                      <div className="vlt-siri-fluid"/>
                      {/* Anillo de borde conic que fluye */}
                      <div className="vlt-siri-glow"/>
                      {/* Label con orbe Siri */}
                      <div className="vlt-scan-label">
                        <span className="vlt-siri-orb"/>
                        analizando {String(idx+1).padStart(2,"0")}/{String(mb.images.length).padStart(2,"0")}
                      </div>
                    </div>
                  )}
                  {/* Tick verde si ya fue auditada */}
                  {!isActive && mb.auditStatus === "ready" && (
                    <div className="vlt-audited-tick" title="Analizada">✓</div>
                  )}
                  <button className="vlt-remove-btn" onClick={()=>dispatch({type:"REMOVE_IMAGE",id:mb.id,imageId:img.id})}>✕</button>
                </div>
              );
            })}
          </div>
        )}

        {isDragOver && (
          <div className="vlt-drop-overlay">
            <div className="vlt-drop-icon">⇪</div>
            <div className="vlt-drop-title">Soltar para analizar</div>
            <div className="vlt-drop-sub">Vision Auditor leerá el ADN visual</div>
          </div>
        )}

        {scanningId && <div className="vlt-scanner-bar"/>}
      </div>

      {previewImg && ReactDOM.createPortal(
        <div className="form-popup-backdrop" style={{zIndex:350}} onClick={()=>setPreviewImg(null)}>
          <div className="vlt-lightbox" onClick={e=>e.stopPropagation()}>
            <button className="super-close vlt-lightbox-close" onClick={()=>setPreviewImg(null)}>✕</button>
            <img src={previewImg.url} alt=""/>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// MOODBOARD VAULT — shell principal
// ─────────────────────────────────────────────────────────────────
function MoodboardVault({ open, onClose, moodboards, dispatch }) {
  const [activeId, setActiveId] = React.useState(moodboards[0]?.id || null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [adnOpen, setAdnOpen] = React.useState(false);
  const [scanningId, setScanningId] = React.useState(null); // imageId siendo analizada ahora
  const fileInputRef = React.useRef(null);
  // Ref por moodboard: ids ya auditados + flag de running
  const auditedRefs = React.useRef({});
  const getAuditedRef = (mbId) => {
    if (!auditedRefs.current[mbId]) auditedRefs.current[mbId] = { ids: new Set(), _running: false };
    return auditedRefs.current[mbId];
  };

  React.useEffect(() => {
    if (!activeId && moodboards.length) setActiveId(moodboards[0].id);
    if (activeId && !moodboards.find(m=>m.id===activeId) && moodboards.length) setActiveId(moodboards[0].id);
  }, [moodboards, activeId]);

  const activeMb = moodboards.find(m=>m.id===activeId) || null;

  // Botón manual "analizar" — re-audita TODO el moodboard aunque ya se haya auditado antes
  const handleReaudit = () => {
    if (!activeMb?.images.length) return;
    const ref = getAuditedRef(activeMb.id);
    if (ref._running) return;
    // Forzar: limpiar ids auditados para que envíe todas
    ref.ids.clear();
    runAudit({ mb: activeMb, dispatch, imagesToSend: activeMb.images, setScanningId, auditedIdsRef: ref });
  };

  const handleFiles = async filesLike => {
    if (!activeMb) return;
    const imgs = await imagesFromFiles(filesLike);
    if (!imgs.length) return;
    dispatch({ type:"ADD_IMAGES", id:activeMb.id, images:imgs });
    // Auto-audit solo las nuevas — nunca re-lee las ya auditadas
    const ref = getAuditedRef(activeMb.id);
    const newImgs = imgs.filter(i => !ref.ids.has(i.id));
    if (newImgs.length) {
      runAudit({ mb: activeMb, dispatch, imagesToSend: newImgs, setScanningId, auditedIdsRef: ref });
    }
  };

  return (
    <>
      {open && <div className="vault-backdrop" onClick={onClose}/>}

      <section className={"vault-sheet vault-sheet-v3 "+(open?"is-open":"")}>
        <div className="vault-handle"/>

        <div className="vlt3-layout">

          {/* ── SIDEBAR ── */}
          <aside className="vlt3-sidebar">
            <div className="vlt3-sidebar-head">
              <div>
                <div className="vlt3-sidebar-title">Moodboards</div>
                <div className="vlt3-sidebar-sub mono">style engine · {moodboards.length} sets</div>
              </div>
              <button className="cdp-btn cdp-btn-ghost cdp-btn-sm" onClick={()=>setCreateOpen(true)}>+ nuevo</button>
            </div>
            <div className="vlt3-sidebar-list scroll-thin">
              {moodboards.map(mb => (
                <MbListItem key={mb.id} mb={mb} active={activeMb?.id===mb.id}
                  onSelect={()=>setActiveId(mb.id)}
                  onToggleLock={()=>dispatch({type:"TOGGLE_LOCK",id:mb.id})}
                  onDelete={()=>{
                    dispatch({type:"DELETE",id:mb.id});
                    if (activeId===mb.id) setActiveId(moodboards.find(m=>m.id!==mb.id)?.id||null);
                  }}
                />
              ))}
            </div>
          </aside>

          {/* ── ÁREA PRINCIPAL ── */}
          <section className="vlt3-main">

            {/* Toolbar del moodboard activo */}
            <div className="vlt3-toolbar">
              <div className="vlt3-toolbar-left">
                {activeMb ? (
                  <input
                    className="vault-name-input"
                    value={activeMb.name}
                    onChange={e=>dispatch({type:"RENAME",id:activeMb.id,name:e.target.value})}
                    placeholder="Nombre del moodboard"
                  />
                ) : (
                  <div style={{color:"var(--text-3)",fontSize:13}}>Selecciona un moodboard</div>
                )}

                {/* Estado de audit — compacto, sin ruido */}
                {activeMb && activeMb.auditStatus==="auditing" && (
                  <span className="vlt3-status-pill vlt3-status-auditing">
                    <span className="led-dot led-breath"/>analizando
                  </span>
                )}
                {activeMb && activeMb.auditStatus==="error" && (
                  <span className="vlt3-status-pill vlt3-status-error" style={{cursor:"pointer"}} onClick={handleReaudit} title="Reintentar">
                    <span className="led-dot" style={{background:"#ef4444"}}/>error · reintentar
                  </span>
                )}
                {activeMb && activeMb.auditStatus==="ready" && activeMb.manifest && (
                  <span className="vlt3-status-pill vlt3-status-ready" title={activeMb.manifest.masterStylePrompt}>
                    <span className="led-dot" style={{background:"#10b981"}}/>
                    {Math.round(activeMb.manifest.consistencyScore*100)}% consist.
                  </span>
                )}
              </div>

              <div className="vlt3-toolbar-actions">
                {activeMb && (
                  <>
                    {activeMb.manifest && (
                      <button className="vlt3-adn-btn" onClick={()=>setAdnOpen(true)} title="Ver ADN Visual">
                        <span className="vlt3-adn-btn-dot"/>
                        ADN Visual
                      </button>
                    )}
                    <button className="cdp-btn cdp-btn-ghost cdp-btn-sm" onClick={()=>fileInputRef.current?.click()}>
                      + imagen
                    </button>
                    <button
                      className="cdp-btn cdp-btn-ghost cdp-btn-sm"
                      disabled={!activeMb.images.length || !!scanningId}
                      onClick={handleReaudit}
                      title="Analizar moodboard">
                      {scanningId ? "analizando…" : "⟳ analizar"}
                    </button>
                    <LockSwitch locked={activeMb.locked} onToggle={()=>dispatch({type:"TOGGLE_LOCK",id:activeMb.id})}/>
                  </>
                )}
                <button className="super-close" onClick={onClose}>✕</button>
              </div>
            </div>

            {/* Galería */}
            <Gallery mb={activeMb} dispatch={dispatch} scanningId={scanningId}
              onRequestUpload={(filesOrUndef) => {
                if (filesOrUndef instanceof FileList || Array.isArray(filesOrUndef)) {
                  handleFiles(filesOrUndef);
                } else {
                  fileInputRef.current?.click();
                }
              }}/>

            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{display:"none"}}
              onChange={e=>{ if(e.target.files) handleFiles(e.target.files); e.target.value=''; }}/>
          </section>
        </div>
      </section>

      {/* ADN Popup */}
      {adnOpen && activeMb?.manifest && (
        <AdnPopup mb={activeMb} dispatch={dispatch} onClose={()=>setAdnOpen(false)}/>
      )}

      {/* Nuevo moodboard popup */}
      {createOpen && (
        <div className="form-popup-backdrop" onClick={()=>setCreateOpen(false)}>
          <div className="form-popup" onClick={e=>e.stopPropagation()}>
            <div className="form-popup-head">
              <div>
                <div className="form-popup-kicker mono">style vault</div>
                <div className="form-popup-title">Nuevo moodboard</div>
              </div>
              <button className="super-close" onClick={()=>setCreateOpen(false)}>✕</button>
            </div>
            {window.NewMoodboardForm && (
              <window.NewMoodboardForm
                onCancel={()=>setCreateOpen(false)}
                onCreate={data=>{
                  const id = "mb-"+Math.random().toString(36).slice(2,7);
                  dispatch({type:"CREATE",id,name:data.name});
                  setActiveId(id);
                  setCreateOpen(false);
                  window.__notify?.({kind:"success",icon:"+",title:"Moodboard creado",body:data.name});
                }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// VAULT BUTTON (topbar)
// ─────────────────────────────────────────────────────────────────
function VaultButton({ lockedName, onClick }) {
  return (
    <button className={"vault-btn "+(lockedName?"has-locked":"")} onClick={onClick}>
      {lockedName
        ? <span className="lock-pulse"/>
        : <span style={{width:6,height:6,borderRadius:"50%",background:"var(--text-4)"}}/>}
      <span>Style Vault</span>
      {lockedName && <span className="mono" style={{fontSize:10,letterSpacing:"0.12em",color:"var(--success-2)",textTransform:"uppercase"}}>· {lockedName.slice(0,14)}</span>}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// REDUCER
// ─────────────────────────────────────────────────────────────────
function moodboardReducer(state, action) {
  switch (action.type) {
    case "CREATE":
      return [...state, {id:action.id,name:action.name,images:[],manifest:null,auditStatus:"idle",locked:false}];
    case "RENAME":
      return state.map(m=>m.id===action.id?{...m,name:action.name}:m);
    case "ADD_IMAGES":
      return state.map(m=>{ if(m.id!==action.id)return m; const ids=new Set(m.images.map(i=>i.id)); return{...m,images:[...m.images,...action.images.filter(i=>!ids.has(i.id))]}; });
    case "REMOVE_IMAGE":
      return state.map(m=>m.id===action.id?{...m,images:m.images.filter(i=>i.id!==action.imageId)}:m);
    case "BEGIN_AUDIT":
      return state.map(m=>m.id===action.id?{...m,auditStatus:"auditing"}:m);
    case "SET_MANIFEST": {
      const found = state.some(m => m.id === action.id);
      if (!found) console.warn("[vault reducer] SET_MANIFEST id not found:", action.id, "available:", state.map(m=>m.id));
      return state.map(m=>m.id===action.id?{...m,auditStatus:"ready",manifest:{...action.manifest,moodboardId:m.id}}:m);
    }
    case "SET_AUDIT_STATUS":
      return state.map(m=>m.id===action.id?{...m,auditStatus:action.status}:m);
    case "TOGGLE_LOCK": {
      const target = state.find(m=>m.id===action.id);
      if(!target) return state;
      const willLock = !target.locked;
      return state.map(m=>({...m,locked:m.id===action.id?willLock:willLock?false:m.locked}));
    }
    case "DELETE":
      return state.filter(m => m.id !== action.id);
    case "REPLACE": return action.value;
    default: return state;
  }
}

Object.assign(window, { MoodboardVault, VaultButton, moodboardReducer, runRealAudit, _mapManifest });
