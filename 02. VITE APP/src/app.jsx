import React, { useState, useRef, useEffect, useCallback, useMemo, useReducer } from 'react'
import {
  Icon, StatusDot, PromptNode, ImageNode, VideoNode, NoteNode, OutputNode,
  AgentPicker, KID_IMAGE_MODELS, KID_VIDEO_MODELS
} from './nodes.jsx'
import {
  NotificationProvider, useNotifications, NodeDock, GalleryPanel,
  GalleryButton, fakeMediaUrlForGeneration
} from './ui.jsx'
import {
  LeftRail, NodesPanel, ClientsPanel, ProjectsPanel, SettingsPanel,
  NewClientForm, NewClientPopup, NewMoodboardForm, SAMPLE_CLIENTS,
  DrawerHeader, RailIcons, AgentsPanel, NewAgentPopup, SAMPLE_AGENTS,
  AgentFicha, AIAgentPopup, WIZARD_STEPS
} from './leftmenu.jsx'
import {
  MoodboardVault, VaultButton, SAMPLE_MOODBOARDS, moodboardReducer,
  runMockAudit, runRealAudit, useAuditMoodboard
} from './vault.jsx'
import { AnalyticsPanel } from './analytics.jsx'
import { AstronautLoop } from './astronaut.jsx'
import { useSyncedCollection, stamp } from './api/store.js'
import { useSyncedMoodboards } from './api/moodboards.js'

// ---------------------------------------------------------------------------
// Constantes / catálogo
// ---------------------------------------------------------------------------
const ALLOWED_KID_AI_MODELS = ["gpt-imagenes-2", "nano-banana-pro", "nano-banana-2", "veo3", "seedance-2.0"]

const NODE_DEFAULTS = {
  prompt: () => ({ status: "idle", brief: "", tipo: "image", cantidad: 1, agentId: "ag-shaq" }),
  image: () => ({ status: "idle", prompt: "", modelId: "gpt-imagenes-2", aspect: "1:1", crudo: false, seed: null, cantidad: 1, refImages: [], scenarios: ["Editorial cálido", "Cinemático nocturno", "Boceto rápido"], lastUrl: null }),
  video: () => ({ status: "idle", prompt: "", modelId: "seedance-2.0", resolution: "720p", aspect: "16:9", duration: "5s", keyframes: [], refVideos: [], refAudio: [], opts: { syncAudio: false, lastFrame: false, webSearch: false, verifyContent: false }, cantidad: 1, lastUrl: null }),
  note: () => ({ title: "Nota", text: "" }),
  output: () => ({ status: "done", kind: "image", modelId: null, items: [] }),
}

const NODE_SIZE = {
  prompt: { w: 360, h: 280 }, image: { w: 360, h: 760 }, video: { w: 380, h: 940 },
  note: { w: 260, h: 220 }, output: { w: 420, h: 380 }, group: { w: 600, h: 400 },
}

// ---------------------------------------------------------------------------
// Bezier path utility
// ---------------------------------------------------------------------------
function bezierPath(sx, sy, tx, ty) {
  const dx = Math.max(50, Math.abs(tx - sx) * 0.55)
  return `M ${sx},${sy} C ${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`
}

function nodePortPos(node, side) {
  const w = NODE_SIZE[node.type]?.w || 320
  return { x: node.x + (side === "right" ? w + 6 : -6), y: node.y + 30 }
}

// ---------------------------------------------------------------------------
// FormField / FormGrid helpers (inline, no window dependency)
// ---------------------------------------------------------------------------
const FormField = ({ label, hint, children, wide }) => (
  <div className={"form-field " + (wide ? "is-wide" : "")}>
    <div className="form-field-head">
      <span className="form-label mono">{label}</span>
      {hint && <span className="form-hint mono">{hint}</span>}
    </div>
    {children}
  </div>
)
const FormGrid = ({ children }) => <div className="form-grid">{children}</div>

// ---------------------------------------------------------------------------
// ProfilePopup
// ---------------------------------------------------------------------------
function ProfilePopup({ profile, onSave, onClose }) {
  const [draft, setDraft] = useState(profile)
  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  useEffect(() => {
    if (draft.name && draft.name !== profile.name) {
      const init = draft.name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("")
      if (init) setDraft((d) => ({ ...d, initials: init }))
    }
  }, [draft.name])
  const avatarColors = [
    { id: "violet", color: "linear-gradient(135deg, #A78BFA, #818CF8)" },
    { id: "teal",   color: "linear-gradient(135deg, #34D399, #06B6D4)" },
    { id: "amber",  color: "linear-gradient(135deg, #FBBF24, #FB7185)" },
    { id: "rose",   color: "linear-gradient(135deg, #FB7185, #C084FC)" },
    { id: "blue",   color: "linear-gradient(135deg, #7DD3FC, #818CF8)" },
    { id: "sand",   color: "linear-gradient(135deg, #D9B58C, #A47551)" },
  ]
  const selectedAvatar = avatarColors.find((a) => a.id === draft.avatarColor) || avatarColors[0]
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
          <div className="form-hero" style={draft.avatarPhoto ? { background: `url(${draft.avatarPhoto}) center/cover` } : { background: selectedAvatar.color }}>
            <div className="form-hero-fade" />
            <div className="form-hero-content">
              <label className="form-hero-avatar profile-photo-slot" style={draft.avatarPhoto ? { backgroundImage: `url(${draft.avatarPhoto})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => {
                  const file = e.target.files?.[0]; if (!file) return
                  const reader = new FileReader()
                  reader.onload = () => set({ avatarPhoto: reader.result })
                  reader.readAsDataURL(file)
                }} />
                {!draft.avatarPhoto && <span>{(draft.initials || "··").slice(0, 2)}</span>}
                <span className="profile-photo-edit">cambiar foto</span>
              </label>
              <div>
                <div className="form-hero-name">{draft.name || "Sin nombre"}</div>
                <div className="form-hero-tag">{draft.role || "Rol del usuario"}</div>
                <div className="form-hero-meta mono">{draft.email}</div>
                {draft.avatarPhoto && (
                  <button type="button" onClick={() => set({ avatarPhoto: null })}
                    style={{ marginTop: 6, padding: "4px 9px", border: 0, background: "rgba(0,0,0,0.40)", color: "#fff", borderRadius: 6, fontFamily: "JetBrains Mono", fontSize: 9.5, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}>
                    quitar foto
                  </button>
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
                  <button key={a.id} type="button" className={"accent-card " + (draft.avatarColor === a.id ? "is-on" : "")} onClick={() => set({ avatarColor: a.id })}>
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
  )
}

// ---------------------------------------------------------------------------
// TopBar
// ---------------------------------------------------------------------------
function TopBar({ mode, onMode, isProcessing, onRunAll, theme, onThemeToggle, onOpenProfile, onOpenAnalytics, userInitials, userEmail, userPhoto,
  clients, moodboards, activeClient, activeMoodboard, setCtxClient, setCtxMoodboard }) {
  const [clientOpen, setClientOpen] = React.useState(false)
  const [mbOpen, setMbOpen] = React.useState(false)
  const closeAll = () => { setClientOpen(false); setMbOpen(false) }
  React.useEffect(() => {
    if (!clientOpen && !mbOpen) return
    const handler = (e) => { if (!e.target.closest('.ctx-pill')) closeAll() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [clientOpen, mbOpen])
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark" />
        <div>
          <div className="brand-name">Cliender<sup>design</sup></div>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: '0.18em', color: 'var(--text-3)', textTransform: 'uppercase', marginTop: 2 }}>creative supercomputer</div>
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
      <div className="ctx-center">
        <span className="ctx-center-label">trabajando en</span>
        <div className={'ctx-pill' + (clientOpen ? ' is-open' : '')}>
          <button className={'ctx-pill-btn' + (activeClient ? ' has-value' : '')} onClick={() => { setClientOpen((v) => !v); setMbOpen(false) }}>
            {activeClient ? (
              <><div className="ctx-pill-dot" style={{ background: activeClient.bgGradient || 'var(--accent)' }} /><span>{activeClient.name}</span><svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></>
            ) : (
              <><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="6" r="3"/><path d="M2 14c0-3.3 2.7-6 6-6s6 2.7 6 6"/></svg><span>Cliente</span><svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></>
            )}
          </button>
          {clientOpen && (
            <div className="ctx-drop">
              <div className="ctx-drop-header">
                <span className="ctx-drop-title">Selecciona cliente</span>
                {activeClient && <button className="ctx-drop-clear" onClick={() => { setCtxClient(null); setCtxMoodboard(null); closeAll() }}>× Limpiar</button>}
              </div>
              <div className="ctx-drop-list">
                {(clients || []).map((c) => (
                  <button key={c.id} className={'ctx-drop-row' + (activeClient?.id === c.id ? ' is-active' : '') + (c._pinned ? ' ctx-drop-row--pinned' : '')}
                    style={c._pinned ? { borderLeft: '2px solid #A78BFA', paddingLeft: 10, marginBottom: 2 } : {}}
                    onClick={() => { setCtxClient(c.id); setCtxMoodboard(null); closeAll() }}>
                    <div className="ctx-drop-avatar" style={{ background: c.bgGradient || 'var(--accent)' }}>{c.initials}</div>
                    <div className="ctx-drop-info">
                      <div className="ctx-drop-name">{c.name}</div>
                      <div className="ctx-drop-sub">{c.tagline || ''}</div>
                    </div>
                    {activeClient?.id === c.id && <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5"/></svg>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <svg viewBox="0 0 6 10" width="5" height="9" fill="none" style={{ opacity: .2, flexShrink: 0 }}><path d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <div className={'ctx-pill' + (mbOpen ? ' is-open' : '')}>
          <button className={'ctx-pill-btn' + (activeMoodboard ? ' has-value' : '')} onClick={() => { setMbOpen((v) => !v); setClientOpen(false) }}>
            {activeMoodboard ? (
              <><div className="ctx-pill-dot ctx-pill-dot-sq" style={{ background: activeMoodboard.manifest?.colorPalette?.[0] || 'var(--accent-2)' }} /><span>{activeMoodboard.name}</span><svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></>
            ) : (
              <><svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg><span>Moodboard</span><svg className="ctx-pill-caret" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg></>
            )}
          </button>
          {mbOpen && (
            <div className="ctx-drop ctx-drop-mb">
              <div className="ctx-drop-header">
                <span className="ctx-drop-title">Estilo visual</span>
                {activeMoodboard && <button className="ctx-drop-clear" onClick={() => { setCtxMoodboard(null); closeAll() }}>× Limpiar</button>}
              </div>
              {(moodboards || []).length === 0 ? (
                <div className="ctx-drop-empty">Sin moodboards. Crea uno en el Vault.</div>
              ) : (
                <div className="ctx-drop-list">
                  {(moodboards || []).map((m) => (
                    <button key={m.id} className={'ctx-drop-row' + (activeMoodboard?.id === m.id ? ' is-active' : '')} onClick={() => { setCtxMoodboard(m.id); closeAll() }}>
                      <div className="ctx-drop-mb-pal">
                        {(m.manifest?.colorPalette || ['#A78BFA', '#7DD3FC']).slice(0, 4).map((c, i, a) => (
                          <div key={i} style={{ background: c, flex: 1, borderRadius: i === 0 ? '4px 0 0 4px' : i === a.length - 1 ? '0 4px 4px 0' : 0 }} />
                        ))}
                      </div>
                      <div className="ctx-drop-info">
                        <div className="ctx-drop-name">{m.name}</div>
                        <div className="ctx-drop-sub">{m.images?.length || 0} refs{m.manifest ? ' · ADN ✓' : ' · sin ADN'}</div>
                      </div>
                      {activeMoodboard?.id === m.id && <svg viewBox="0 0 12 12" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 6l3 3 5-5"/></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {(activeClient || activeMoodboard) && <div className="ctx-status-badge" title="Contexto activo"><div className="ctx-status-dot" /></div>}
      </div>
      <div className="topbar-right">
        <button className="theme-toggle-btn" onClick={onThemeToggle} title={theme === 'dark' ? 'Cambiar a Light' : 'Cambiar a Dark'} aria-label="theme toggle">
          {theme === 'dark'
            ? <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>
            : <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
        </button>
        <button className="theme-toggle-btn" onClick={onOpenAnalytics} title="Analytics de costes API" style={{ fontSize: 14 }}>📊</button>
        {mode !== 'supercomputer' && (
          <button className="btn-primary" onClick={onRunAll}>
            <Icon.Play style={{ width: 11, height: 11 }} /> Run All
          </button>
        )}
        <button className="user-avatar-btn" onClick={onOpenProfile} title={`Mi perfil · ${userEmail}`}
          style={userPhoto ? { backgroundImage: `url(${userPhoto})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
          {!userPhoto && <span>{userInitials}</span>}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DraggableWrap
// ---------------------------------------------------------------------------
function DraggableWrap({ node, selected, onSelect, onDrag, onDragStart, children }) {
  const wrapRef = useRef(null)
  const dragRef = useRef(null)
  const onMouseDownHeader = (e) => {
    if (e.button !== 0) return
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return
    e.preventDefault(); e.stopPropagation()
    onSelect(node.id, e)
    onDragStart?.(node.id)
    const origin = { x: node.x, y: node.y }
    dragRef.current = { sx: e.clientX, sy: e.clientY, origin }
    function onMove(ev) {
      const zoom = window.__zoom || 1
      const dx = (ev.clientX - dragRef.current.sx) / zoom
      const dy = (ev.clientY - dragRef.current.sy) / zoom
      onDrag(node.id, dragRef.current.origin.x + dx, dragRef.current.origin.y + dy)
    }
    function onUp() {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      if (wrapRef.current) wrapRef.current.classList.remove("is-dragging")
      dragRef.current = null
    }
    if (wrapRef.current) wrapRef.current.classList.add("is-dragging")
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }
  return (
    <div ref={wrapRef} className={"node-wrap" + (node.type === "group" ? " group-wrap" : "")}
      data-node-id={node.id} style={{ left: node.x, top: node.y }}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(node.id, e) }}>
      {children({ onMouseDownHeader })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GroupNode
// ---------------------------------------------------------------------------
function GroupNode({ node, onChange, onMouseDownHeader, onClose, selected }) {
  return (
    <div className={"node-v2 group-node " + (selected ? "is-selected" : "")}
      style={{ width: node.data.w, height: node.data.h, position: "absolute", left: 0, top: 0 }}>
      <div className="group-node-header" onMouseDown={onMouseDownHeader}>
        <span className="group-node-icon">▢</span>
        <input className="group-node-name" value={node.data.name} onChange={(e) => onChange({ name: e.target.value })} />
        <button className="node-v2-close" onClick={onClose}>✕</button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// GroupNameModal
// ---------------------------------------------------------------------------
function GroupNameModal({ defaultName, count, onConfirm, onCancel }) {
  const [name, setName] = React.useState(defaultName || "Subproyecto")
  const inputRef = React.useRef(null)
  React.useEffect(() => { setTimeout(() => inputRef.current?.select(), 60) }, [])
  const confirm = () => onConfirm(name.trim() || "Subproyecto")
  return (
    <div className="new-agent-popup-overlay" onClick={onCancel}>
      <div className="new-agent-popup" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 360 }}>
        <p className="new-agent-popup-title">Nombrar grupo</p>
        <p className="mono" style={{ fontSize: 11, color: "var(--text-3)", margin: 0 }}>{count} nodo{count !== 1 ? "s" : ""} seleccionado{count !== 1 ? "s" : ""}</p>
        <div className="new-agent-field">
          <label>Nombre del subproyecto</label>
          <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirm() } if (e.key === "Escape") onCancel() }}
            placeholder="Subproyecto" />
        </div>
        <div className="new-agent-popup-actions">
          <button className="new-agent-popup-cancel" type="button" onClick={onCancel}>Cancelar</button>
          <button className="new-agent-popup-submit" type="button" onClick={confirm}>▢ Agrupar</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CanvasNode dispatcher — passes onHandleMouseDown/Up as props
// ---------------------------------------------------------------------------
function CanvasNode({ node, selected, onSelect, onDrag, onGroupDragStart, onDataChange, onClose, onGenerate, hasIncomingPrompt, incomingPrompt, incomingMedia, onOutputAction, activeClient, activeMoodboard, notify, creativeAgents, onHandleMouseDown, onHandleMouseUp }) {
  return (
    <DraggableWrap node={node} selected={selected} onSelect={onSelect} onDrag={onDrag} onDragStart={node.type === 'group' ? onGroupDragStart : undefined}>
      {({ onMouseDownHeader }) => {
        const common = { node, onChange: (p) => onDataChange(node.id, p), onMouseDownHeader, onClose: () => onClose(node.id), selected }
        const handleProps = { onHandleMouseDown, onHandleMouseUp }
        if (node.type === "prompt") return <PromptNode {...common} {...handleProps} onGenerate={() => onGenerate(node.id)} incomingMedia={incomingMedia} activeClient={activeClient} activeMoodboard={activeMoodboard} notify={notify} creativeAgents={creativeAgents} />
        if (node.type === "image")  return <ImageNode  {...common} {...handleProps} onGenerate={() => onGenerate(node.id)} hasIncomingPrompt={hasIncomingPrompt} incomingPrompt={incomingPrompt} incomingMedia={incomingMedia} notify={notify} />
        if (node.type === "video")  return <VideoNode  {...common} {...handleProps} onGenerate={() => onGenerate(node.id)} hasIncomingPrompt={hasIncomingPrompt} incomingPrompt={incomingPrompt} incomingMedia={incomingMedia} notify={notify} />
        if (node.type === "note")   return <NoteNode   {...common} {...handleProps} notify={notify} />
        if (node.type === "output") return <OutputNode {...common} {...handleProps} onItemAction={onOutputAction} notify={notify} />
        if (node.type === "group")  return <GroupNode  {...common} />
        return null
      }}
    </DraggableWrap>
  )
}

// ---------------------------------------------------------------------------
// EdgesLayer
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
        const src = nodes.find((n) => n.id === e.source)
        const tgt = nodes.find((n) => n.id === e.target)
        if (!src || !tgt) return null
        const s = nodePortPos(src, "right"), t = nodePortPos(tgt, "left")
        const d = bezierPath(s.x, s.y, t.x, t.y)
        const mx = (s.x + t.x) / 2, my = (s.y + t.y) / 2
        const isRunning = runningEdgeIds.has(e.id)
        const isJustCreated = newEdgeIds.has(e.id)
        const isSelected = selectedEdgeId === e.id
        const sourceHasData = !!(src?.data?.lastUrl || (src?.type === "prompt" && src?.data?.agentOutput))
        return (
          <g key={e.id} className={(isJustCreated ? "edge-just-created" : "") + (isSelected ? " edge-selected" : "") + (sourceHasData ? " edge-has-data" : "")}>
            <path d={d} stroke="transparent" strokeWidth="14" fill="none" style={{ cursor: "pointer", pointerEvents: "stroke" }} onClick={(ev) => { ev.stopPropagation(); onSelectEdge?.(e.id) }} />
            <path d={d} className={"edge-base " + (isRunning || isJustCreated || isSelected ? "is-active" : "")} />
            {!isJustCreated && <path d={d} className="edge-stream" />}
            {!isRunning && !isJustCreated && (
              <circle r="2.4" className="edge-stream-pixel">
                <animateMotion dur="3.2s" repeatCount="indefinite" path={d} />
                <animate attributeName="opacity" values="0.2;1;0.2" dur="3.2s" repeatCount="indefinite" />
              </circle>
            )}
            {(isRunning || isJustCreated) && (
              <>
                <path d={d} className="edge-dash" filter={isJustCreated ? "url(#edgeGlowStrong)" : "url(#edgeGlow)"} />
                {[0, 0.55, 1.05].map((begin, i) => (
                  <circle key={i} r={isJustCreated ? "3.6" : "2.8"} className="edge-particle">
                    <animateMotion dur={isJustCreated ? "0.9s" : "1.9s"} repeatCount="indefinite" begin={`${begin}s`} path={d} />
                  </circle>
                ))}
              </>
            )}
            {isSelected && (
              <g className="edge-delete-btn" transform={`translate(${mx},${my})`} style={{ cursor: "pointer", pointerEvents: "all" }} onClick={(ev) => { ev.stopPropagation(); onDeleteEdge?.(e.id) }}>
                <circle r="12" fill="#FB7185" filter="url(#edgeGlowStrong)" />
                <circle r="11" fill="#0F1018" />
                <circle r="11" fill="none" stroke="#FB7185" strokeWidth="1.5" />
                <line x1="-4" y1="-4" x2="4" y2="4" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
                <line x1="-4" y1="4"  x2="4" y2="-4" stroke="#FB7185" strokeWidth="2" strokeLinecap="round" />
              </g>
            )}
          </g>
        )
      })}
      {draggingEdge && (
        <path d={bezierPath(draggingEdge.sx, draggingEdge.sy, draggingEdge.cx, draggingEdge.cy)} className="temp-edge" />
      )}
    </svg>
  )
}

// ---------------------------------------------------------------------------
// ConnectMenu
// ---------------------------------------------------------------------------
function ConnectMenu({ menu, onPick, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!menu) return
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const t = setTimeout(() => document.addEventListener("mousedown", onClickOutside), 50)
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onClickOutside) }
  }, [menu, onClose])
  if (!menu) return null
  const items = [
    { type: "prompt", label: "Prompt",  hint: "brief creativo",        glyph: <Icon.PromptGlyph style={{ width: 18, height: 18 }} />, accent: "#A78BFA" },
    { type: "image",  label: "Imagen",  hint: "generación de imagen",  glyph: <Icon.ImageGlyph  style={{ width: 18, height: 18 }} />, accent: "#C4B5FD" },
    { type: "video",  label: "Video",   hint: "generación de video",   glyph: <Icon.VideoGlyph  style={{ width: 18, height: 18 }} />, accent: "#34D399" },
    { type: "note",   label: "Nota",    hint: "anotación libre",       glyph: <Icon.NoteGlyph   style={{ width: 18, height: 18 }} />, accent: "#FBBF24" },
  ]
  return (
    <div ref={ref} className="connect-menu" style={{ left: menu.x, top: menu.y }}>
      <div className="connect-menu-header">
        <span className="connect-menu-kicker mono">conectar a</span>
        <span className="connect-menu-title">Añadir nodo</span>
      </div>
      <div className="connect-menu-list">
        {items.map((it) => (
          <button key={it.type} className="connect-menu-item" style={{ "--cm-c": it.accent }} onClick={() => onPick(it.type)}>
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
  )
}

// ---------------------------------------------------------------------------
// ContextMenu
// ---------------------------------------------------------------------------
function ContextMenu({ menu, onPick, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!menu) return
    const onClickOutside = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose() }
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    const t = setTimeout(() => document.addEventListener("mousedown", onClickOutside), 50)
    document.addEventListener("keydown", onKey)
    return () => { clearTimeout(t); document.removeEventListener("mousedown", onClickOutside); document.removeEventListener("keydown", onKey) }
  }, [menu, onClose])
  if (!menu) return null
  const onNode = !!menu.nodeId
  const items = onNode ? [
    { action: "duplicate",   label: "Duplicar nodo",      hint: "copia con offset",    accent: "#A78BFA", icon: <Icon.Plus style={{ width: 14, height: 14 }} /> },
    { action: "disconnect",  label: "Desconectar todo",   hint: "quita edges del nodo", accent: "#FBBF24", icon: <span style={{ fontSize: 14, lineHeight: 1 }}>⌀</span> },
    { action: "delete",      label: "Eliminar nodo",      hint: "borrar definitivo",    accent: "#FB7185", icon: <span style={{ fontSize: 16, lineHeight: 1 }}>×</span> },
  ] : [
    { action: "add-prompt",  label: "Crear nodo Prompt",  hint: "brief creativo",        accent: "#A78BFA", icon: <Icon.PromptGlyph style={{ width: 18, height: 18 }} /> },
    { action: "add-image",   label: "Crear nodo Imagen",  hint: "generación de imagen",  accent: "#C4B5FD", icon: <Icon.ImageGlyph  style={{ width: 18, height: 18 }} /> },
    { action: "add-video",   label: "Crear nodo Video",   hint: "generación de video",   accent: "#34D399", icon: <Icon.VideoGlyph  style={{ width: 18, height: 18 }} /> },
    { action: "add-note",    label: "Crear nodo Nota",    hint: "anotación libre",       accent: "#FBBF24", icon: <Icon.NoteGlyph   style={{ width: 18, height: 18 }} /> },
  ]
  return (
    <div ref={ref} className="connect-menu" style={{ left: menu.x, top: menu.y }}>
      <div className="connect-menu-header">
        <span className="connect-menu-kicker mono">{onNode ? "nodo" : "canvas"}</span>
        <span className="connect-menu-title">{onNode ? "Acciones de nodo" : "Crear nodo aquí"}</span>
      </div>
      <div className="connect-menu-list">
        {items.map((it) => (
          <button key={it.action} className="connect-menu-item" style={{ "--cm-c": it.accent }} onClick={() => onPick(it.action, menu)}>
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
  )
}

// ---------------------------------------------------------------------------
// Minimap
// ---------------------------------------------------------------------------
function Minimap({ nodes, edges, pan, zoom, setPan, viewportRef }) {
  const MM_W = 220, MM_H = 150, MM_PAD = 14
  const bounds = useMemo(() => {
    if (!nodes.length) return { minX: 0, minY: 0, maxX: 1500, maxY: 1000 }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    nodes.forEach((n) => {
      const w = (n.type === "video" ? 380 : n.type === "output" ? 420 : n.type === "note" ? 260 : 360)
      const h = (n.type === "video" ? 940 : n.type === "output" ? 380 : n.type === "note" ? 220 : n.type === "image" ? 760 : 280)
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y)
      maxX = Math.max(maxX, n.x + w); maxY = Math.max(maxY, n.y + h)
    })
    return { minX: minX - 200, minY: minY - 200, maxX: maxX + 200, maxY: maxY + 200 }
  }, [nodes])
  const worldW = bounds.maxX - bounds.minX, worldH = bounds.maxY - bounds.minY
  const innerW = MM_W - MM_PAD * 2, innerH = MM_H - MM_PAD * 2
  const scale = Math.min(innerW / worldW, innerH / worldH)
  const offsetX = MM_PAD + (innerW - worldW * scale) / 2
  const offsetY = MM_PAD + (innerH - worldH * scale) / 2
  const toMM = (x, y) => ({ x: offsetX + (x - bounds.minX) * scale, y: offsetY + (y - bounds.minY) * scale })
  const vpW = viewportRef.current?.clientWidth || 1200, vpH = viewportRef.current?.clientHeight || 800
  const visWorldX = -pan.x / zoom, visWorldY = -pan.y / zoom
  const vp1 = toMM(visWorldX, visWorldY), vp2 = toMM(visWorldX + vpW / zoom, visWorldY + vpH / zoom)
  const onClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const worldX = bounds.minX + (e.clientX - rect.left - offsetX) / scale
    const worldY = bounds.minY + (e.clientY - rect.top  - offsetY) / scale
    setPan({ x: -(worldX * zoom) + vpW / 2, y: -(worldY * zoom) + vpH / 2 })
  }
  const nodeColor = { prompt: "#A78BFA", image: "#C4B5FD", video: "#34D399", note: "#FBBF24", output: "#7DD3FC" }
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
          const src = nodes.find((n) => n.id === e.source), tgt = nodes.find((n) => n.id === e.target)
          if (!src || !tgt) return null
          const a = toMM(src.x + (src.type === "video" ? 380 : 360), src.y + 30)
          const b = toMM(tgt.x, tgt.y + 30)
          return <line key={e.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="var(--accent)" strokeWidth="0.8" opacity="0.55" />
        })}
        {[...nodes].sort((a,b)=> (a.type==="group"?-1:1)).map((n) => {
          const w = (n.type === "video" ? 380 : n.type === "output" ? 420 : n.type === "note" ? 260 : 360)
          const h = (n.type === "video" ? 940 : n.type === "output" ? 380 : n.type === "note" ? 220 : n.type === "image" ? 760 : 280)
          const p = toMM(n.x, n.y)
          return (
            <rect key={n.id} x={p.x} y={p.y} width={Math.max(3, w * scale)} height={Math.max(3, h * scale)}
              fill={nodeColor[n.type] || "#A78BFA"} opacity={n.data?.status === "running" ? 1 : 0.7} rx="2">
              {n.data?.status === "running" && <animate attributeName="opacity" values="0.5;1;0.5" dur="1.4s" repeatCount="indefinite" />}
            </rect>
          )
        })}
        <rect x={Math.max(0, Math.min(MM_W, vp1.x))} y={Math.max(0, Math.min(MM_H, vp1.y))}
          width={Math.min(MM_W, vp2.x) - Math.max(0, vp1.x)} height={Math.min(MM_H, vp2.y) - Math.max(0, vp1.y)}
          fill="url(#mm-vp-fill)" stroke="var(--accent)" strokeWidth="1.2" rx="3" pointerEvents="none" />
      </svg>
      <div className="minimap-foot">
        <span className="mono">{Math.round(zoom * 100)}%</span>
        <div className="minimap-zoom"><button onClick={() => setPan({ x: -100, y: -100 })}>⊡</button></div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SaveFlowModal
// ---------------------------------------------------------------------------
function SaveFlowModal({ onSave, onClose, nodeCount, edgeCount }) {
  const [name, setName] = React.useState("")
  const [desc, setDesc] = React.useState("")
  const inputRef = React.useRef(null)
  React.useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60) }, [])
  const confirm = () => { if (name.trim()) onSave(name, desc) }
  return (
    <div className="new-agent-popup-overlay" onClick={onClose}>
      <div className="new-agent-popup" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
        <p className="new-agent-popup-title">Guardar flujo</p>
        <div className="new-agent-field">
          <label>Nombre de la plantilla</label>
          <input ref={inputRef} value={name} onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") confirm(); if (e.key === "Escape") onClose() }}
            placeholder="Ej: Hero editorial verano 2026" />
        </div>
        <div className="new-agent-field">
          <label>Descripcion opcional</label>
          <input value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => { if (e.key === "Escape") onClose() }} placeholder="Notas sobre este flujo" />
        </div>
        <div className="new-agent-popup-actions">
          <button className="new-agent-popup-cancel" onClick={onClose}>Cancelar</button>
          <button className="new-agent-popup-submit" onClick={confirm} disabled={!name.trim()}>Guardar plantilla</button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TweaksPanel
// ---------------------------------------------------------------------------
function TweaksPanel({ visible, onClose, theme, setTheme, accent, setAccent }) {
  if (!visible) return null
  const accents = [
    { id: "violet", color: "#A78BFA" }, { id: "teal", color: "#34D399" },
    { id: "amber", color: "#FBBF24" }, { id: "rose", color: "#FB7185" }, { id: "blue", color: "#7DD3FC" },
  ]
  return (
    <aside className="tweaks-panel">
      <div className="tweaks-head">
        <div><div className="tweaks-title">Tweaks</div><div className="tweaks-kicker mono">apariencia</div></div>
        <button className="tweaks-close" onClick={onClose} aria-label="cerrar">cerrar</button>
      </div>
      <div className="tweak-row">
        <span className="tweak-row-label mono">Tema</span>
        <div className="theme-seg">
          <button className={"theme-seg-btn " + (theme === "dark" ? "is-on" : "")} onClick={() => setTheme("dark")}>Dark</button>
          <button className={"theme-seg-btn " + (theme === "light" ? "is-on" : "")} onClick={() => setTheme("light")}>Light</button>
        </div>
      </div>
      <div className="tweak-row">
        <span className="tweak-row-label mono">Color de acento</span>
        <div className="theme-swatches">
          {accents.map((a) => (
            <button key={a.id} className={"theme-swatch " + (accent === a.id ? "is-on" : "")}
              style={{ background: a.color }} onClick={() => setAccent(a.id)} aria-label={a.id} />
          ))}
        </div>
      </div>
    </aside>
  )
}

// ---------------------------------------------------------------------------
// ImagePreview lightbox
// ---------------------------------------------------------------------------
function ImagePreview({ item, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])
  return (
    <div className="lightbox" onClick={onClose}>
      <div className="lightbox-inner" onClick={(e) => e.stopPropagation()}>
        <button className="lightbox-close" onClick={onClose} aria-label="cerrar">cerrar</button>
        <div className="lightbox-media"><img src={item.url} alt="" /></div>
        <div className="lightbox-meta">
          <div className="lightbox-prompt">{item.prompt}</div>
          <div className="lightbox-tags">
            <span className="mono">{item.model}</span>
            {item.aspect && <span className="mono">item.aspect</span>}
            {item.duration && <span className="mono">item.duration</span>}
            {item.styleSource && <span className="mono">style: {item.styleSource}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// App — main component
// ---------------------------------------------------------------------------
function App() {
  // ── notifications via context ──
  const notify = useNotifications ? useNotifications() : null

  // Helper: notifies if provider available, otherwise falls back
  const doNotify = useCallback((opts) => {
    if (notify) notify(opts)
  }, [notify])

  const [mode, setMode] = useState("canvas")
  const [panelOpen, setPanelOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("nodes")

  // Blendy panel animation ref
  const panelContainerRef = useRef(null)
  const prevTabRef = useRef(null)

  // blendy transition when active panel changes
  useEffect(() => {
    if (!panelContainerRef.current) return
    if (prevTabRef.current === activeTab) return
    // Only animate if panel is actually open (has a real panel mounted)
    if (activeTab && prevTabRef.current) {
      import('blendy').then(({ animate }) => {
        const el = panelContainerRef.current
        if (el) {
          // Fade+slide the container as a simple blendy swap
          animate(el, el, {
            duration: 320,
            easing: 'ease-out',
          }).catch(() => {}) // silently ignore if blendy can't find targets
        }
      }).catch(() => {})
    }
    prevTabRef.current = activeTab
  }, [activeTab])

  // Creative agents — cross-user via /store/agents
  const [agents, setAgents] = useSyncedCollection('agents', SAMPLE_AGENTS || [])

  const addAgent    = (a)  => setAgents((s) => [...s, stamp(a)])
  const editAgent   = (a)  => setAgents((s) => s.map((x) => x.id === a.id ? stamp(a) : x))
  const deleteAgent = (id) => setAgents((s) => s.filter((x) => x.id !== id))

  // Theme / Tweaks
  const TWEAK_DEFAULTS = { theme: "dark", accent: "violet", motion: "full", density: "comfortable" }
  const [theme, setTheme]     = useState(TWEAK_DEFAULTS.theme)
  const [accent, setAccent]   = useState(TWEAK_DEFAULTS.accent)
  const [motion, setMotion]   = useState(TWEAK_DEFAULTS.motion)
  const [density, setDensity] = useState(TWEAK_DEFAULTS.density)
  const [tweaksOn, setTweaksOn] = useState(false)

  useEffect(() => {
    const effective = theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : theme
    document.documentElement.setAttribute("data-theme", effective)
    document.documentElement.setAttribute("data-accent", accent)
    document.documentElement.setAttribute("data-motion", motion)
    document.documentElement.setAttribute("data-density", density)
    const map  = { violet: "#A78BFA", teal: "#34D399", amber: "#FBBF24", rose: "#FB7185", blue: "#7DD3FC" }
    const map2 = { violet: "#C4B5FD", teal: "#6EE7B7", amber: "#FCD34D", rose: "#FECDD3", blue: "#BAE6FD" }
    document.documentElement.style.setProperty("--accent",   map[accent]  || map.violet)
    document.documentElement.style.setProperty("--accent-2", map2[accent] || map2.violet)
  }, [theme, accent, motion, density])

  useEffect(() => {
    document.documentElement.setAttribute("data-supermode", mode === "supercomputer" ? "on" : "off")
  }, [mode])

  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type === "__activate_edit_mode") setTweaksOn(true)
      if (e.data?.type === "__deactivate_edit_mode") setTweaksOn(false)
    }
    window.addEventListener("message", onMsg)
    window.parent?.postMessage({ type: "__edit_mode_available" }, "*")
    return () => window.removeEventListener("message", onMsg)
  }, [])

  const setTweak = (k, v) => {
    if (k === "theme") setTheme(v)
    if (k === "accent") setAccent(v)
    window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*")
  }

  // Canvas pan & zoom
  const [pan, setPan] = useState({ x: 100, y: 80 })
  const [zoom, setZoom] = useState(0.85)
  useEffect(() => { window.__zoom = zoom }, [zoom])

  // Nodes / edges
  const [nodes, setNodes] = useState([])
  const nodesRef = useRef([])
  useEffect(() => { nodesRef.current = nodes }, [nodes])
  const [edges, setEdges] = useState([
    { id: "e-1", source: "n-prompt-1", target: "n-image-1" },
    { id: "e-2", source: "n-image-1",  target: "n-output-1" },
  ])
  const [selectedId, setSelectedId] = useState(null)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [rubberBand, setRubberBand] = useState(null)

  const toggleSelect = useCallback((id, shift) => {
    if (shift) {
      setSelectedIds((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next })
      setSelectedId(null)
    } else {
      setSelectedId(id); setSelectedIds(new Set([id]))
    }
  }, [])

  const groupSelected = useCallback(() => {
    const alreadyGrouped = new Set(nodes.filter(n => n.type === 'group').flatMap(g => g.data?.members || []))
    const ids = Array.from(selectedIds).filter(id => !alreadyGrouped.has(id))
    if (ids.length < 2) return
    const members = nodes.filter((n) => ids.includes(n.id))
    if (members.length < 2) return
    const xs = members.map((n) => n.x), ys = members.map((n) => n.y)
    const ws = members.map((n) => (NODE_SIZE[n.type]?.w || 320)), hs = members.map((n) => (NODE_SIZE[n.type]?.h || 280))
    const minX = Math.min(...xs) - 24, minY = Math.min(...ys) - 52
    const maxX = Math.max(...xs.map((x, i) => x + ws[i])) + 24
    const maxY = Math.max(...ys.map((y, i) => y + hs[i])) + 24
    const groupId = "g-" + Math.random().toString(36).slice(2, 7)
    setNodes((ns) => [{ id: groupId, type: "group", x: minX, y: minY, data: { name: "Grupo", w: maxX - minX, h: maxY - minY, members: ids } }, ...ns])
    setSelectedIds(new Set()); setSelectedId(groupId)
    doNotify({ kind: "success", icon: "▢", title: "Grupo creado", body: `${members.length} nodos agrupados` })
  }, [selectedIds, nodes, doNotify])

  const deleteSelectedMany = useCallback(() => {
    const ids = Array.from(selectedIds); if (!ids.length) return
    setNodes((ns) => ns.filter((n) => !ids.includes(n.id)))
    setEdges((es) => es.filter((e) => !ids.includes(e.source) && !ids.includes(e.target)))
    setSelectedIds(new Set()); setSelectedId(null)
  }, [selectedIds])

  const [selectedEdgeId, setSelectedEdgeId] = useState(null)
  const deleteEdge = useCallback((id) => {
    setEdges((es) => es.filter((e) => e.id !== id))
    if (selectedEdgeId === id) setSelectedEdgeId(null)
    doNotify({ kind: "info", icon: "−", title: "Conexión eliminada" })
  }, [selectedEdgeId, doNotify])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Delete" && e.key !== "Backspace") return
      const tag = document.activeElement?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || document.activeElement?.isContentEditable) return
      if (selectedEdgeId) { deleteEdge(selectedEdgeId); e.preventDefault() }
      else if (selectedId) {
        setNodes((ns) => ns.filter((n) => n.id !== selectedId))
        setEdges((es) => es.filter((ed) => ed.source !== selectedId && ed.target !== selectedId))
        setSelectedId(null); e.preventDefault()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [selectedEdgeId, selectedId, deleteEdge])

  const [runningNodes, setRunningNodes] = useState(new Set())
  const [runningEdges, setRunningEdges] = useState(new Set())
  const isProcessing = runningNodes.size > 0

  const [gallery, setGallery] = useState(() => {
    try { const s = localStorage.getItem("cliender-gallery"); if (s) return JSON.parse(s) } catch {}
    return []
  })
  useEffect(() => { try { localStorage.setItem("cliender-gallery", JSON.stringify(gallery)) } catch {} }, [gallery])

  // Clients — cross-user via /store/clients
  const [clients, setClients] = useSyncedCollection('clients', SAMPLE_CLIENTS || [])
  const [activeClientId, setActiveClientId] = useState(() => { try { return localStorage.getItem('cdp-ctx-client') || null } catch { return null } })
  const [activeMoodboardId, setActiveMoodboardId] = useState(() => { try { return localStorage.getItem('cdp-ctx-mb') || null } catch { return null } })
  const setCtxClient = (id) => { setActiveClientId(id); try { id ? localStorage.setItem('cdp-ctx-client', id) : localStorage.removeItem('cdp-ctx-client') } catch {} }
  const setCtxMoodboard = (id) => { setActiveMoodboardId(id); try { id ? localStorage.setItem('cdp-ctx-mb', id) : localStorage.removeItem('cdp-ctx-mb') } catch {} }

  const [createClientOpen, setCreateClientOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [profile, setProfile] = useState(() => {
    try { const saved = localStorage.getItem("cliender-profile"); if (saved) return JSON.parse(saved) } catch {}
    return { name: "Nicolas", email: "nicolas@cliender.com", role: "Creative Director", bio: "Diseñando flujos creativos.", avatarColor: "violet", avatarPhoto: null, initials: "N" }
  })
  useEffect(() => { try { localStorage.setItem("cliender-profile", JSON.stringify(profile)) } catch {} }, [profile])

  const onCreateClient = useCallback((client) => {
    const stamped = stamp({ ...client, createdAt: client.createdAt || Date.now() })
    setClients((c) => [stamped, ...c]); setActiveClientId(stamped.id)
    doNotify({ kind: "success", icon: "+", title: "Cliente conectado", body: stamped.name })
  }, [doNotify, setClients])

  // Projects — cross-user via /store/projects
  const [projects, setProjects] = useSyncedCollection('projects', [
    { id: "p-demo", name: "Otoño Editorial — Hero", clientId: null, nodes: [], edges: [], thumbs: ["#A78BFA","#7DD3FC","#34D399"], createdAt: Date.now() - 86400000 * 3, updatedAt: Date.now() - 3600000 }
  ])
  const [activeProjectId, setActiveProjectId] = useState(null)

  const onCreateProject = useCallback((nameArg) => {
    const name = nameArg || prompt("Nombre del proyecto:"); if (!name?.trim()) return
    const p = stamp({ id: "p-" + Math.random().toString(36).slice(2, 8), name: name.trim(), clientId: activeClientId || null, nodes: [], edges: [], thumbs: ["#A78BFA","#7DD3FC","#34D399"], createdAt: Date.now() })
    setProjects((ps) => [p, ...ps]); setActiveProjectId(p.id); setNodes([]); setEdges([]); setActiveTab(null)
    doNotify({ kind: "success", icon: "🗂", title: "Nuevo proyecto", body: p.name })
  }, [activeClientId, doNotify, setProjects])

  const onDeleteProject = useCallback((p) => {
    if (!confirm(`¿Eliminar "${p.name}"?`)) return
    setProjects((ps) => ps.filter((x) => x.id !== p.id))
    if (activeProjectId === p.id) setActiveProjectId(null)
  }, [activeProjectId, setProjects])

  const onOpenProject = useCallback((p) => {
    setActiveProjectId(p.id)
    if (p.nodes?.length) setNodes(p.nodes)
    if (p.edges?.length) setEdges(p.edges)
    setActiveTab(null)
    doNotify({ icon: "📂", title: "Proyecto abierto", body: p.name })
  }, [doNotify])

  useEffect(() => {
    if (!activeProjectId) return
    const t = setTimeout(() => {
      setProjects((ps) => ps.map((p) => p.id === activeProjectId ? { ...p, nodes, edges, updatedAt: Date.now() } : p))
    }, 800)
    return () => clearTimeout(t)
  }, [nodes, edges, activeProjectId, setProjects])

  // Flow templates — cross-user via /store/flow-templates
  const [flowTemplates, setFlowTemplates] = useSyncedCollection('flow-templates', [])
  const [saveModalOpen, setSaveModalOpen] = React.useState(false)

  const saveFlow = React.useCallback((name, desc) => {
    const trimmedName = name.trim() || "Flujo sin nombre"
    const now = Date.now()
    const tpl = { id: "tpl-" + Math.random().toString(36).slice(2, 9), name: trimmedName, description: desc?.trim() || "", nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), pan: { ...pan }, zoom, nodeCount: nodes.filter(n => n.type !== "group").length, edgeCount: edges.length, clientId: activeClientId || null, moodboardId: activeMoodboardId || null, createdAt: now, updatedAt: now }
    setFlowTemplates(ts => [tpl, ...ts])
    const p = { id: "p-" + Math.random().toString(36).slice(2, 8), name: trimmedName, clientId: activeClientId || clients[0]?.id || null, moodboardId: activeMoodboardId || null, nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)), thumbs: [activeClient?.palette?.[0] || "#A78BFA", activeClient?.palette?.[1] || "#7DD3FC", activeClient?.palette?.[2] || "#34D399"], createdAt: now, updatedAt: now }
    setProjects(ps => [p, ...ps]); setActiveProjectId(p.id); setSaveModalOpen(false)
    doNotify({ kind: "success", icon: "💾", title: "Plantilla guardada", body: trimmedName })
  }, [nodes, edges, pan, zoom, activeClientId, activeMoodboardId, clients, doNotify, setFlowTemplates, setProjects])

  const loadFlow = React.useCallback((tpl) => {
    setNodes(JSON.parse(JSON.stringify(tpl.nodes))); setEdges(JSON.parse(JSON.stringify(tpl.edges)))
    if (tpl.pan) setPan(tpl.pan); if (tpl.zoom) setZoom(tpl.zoom)
    setSelectedId(null); setSelectedIds(new Set())
    doNotify({ kind: "info", icon: "📂", title: "Flujo cargado", body: tpl.name })
  }, [doNotify])

  const deleteTemplate = React.useCallback((id) => {
    setFlowTemplates(ts => ts.filter(t => t.id !== id))
    doNotify({ kind: "info", icon: "✕", title: "Plantilla eliminada" })
  }, [doNotify, setFlowTemplates])

  // Style Vault — cross-user via /moodboards (tabla Supabase con imágenes en Storage)
  const _moodboardReducer = moodboardReducer || ((s) => s)
  const [moodboards, dispatchMoodboards] = useSyncedMoodboards(_moodboardReducer, SAMPLE_MOODBOARDS || [])

  const lockedMb = (moodboards || []).find((m) => m.locked)
  const activeClient = clients.find((c) => c.id === activeClientId) || null
  const activeMoodboard = (moodboards || []).find((m) => m.id === activeMoodboardId) || null

  // Supercomputer state
  const [prompt, setPrompt] = useState("Reel vertical 9:16 dinámico para Instagram de una zapatilla")
  const [logs, setLogs] = useState([])
  const [lastLogAt, setLastLogAt] = useState(0)
  const [nodeStatus, setNodeStatus] = useState({ master_director: "idle", scriptwriter: "idle", cinematographer: "idle", production: "idle", critic: "idle" })
  const [swarmArtifact, setSwarmArtifact] = useState(null)

  // --- node ops ---
  const addNode = useCallback((type) => {
    const id = `n-${type}-${Math.random().toString(36).slice(2, 6)}`
    const vx = window.innerWidth / 2, vy = window.innerHeight / 2
    const worldX = (vx - pan.x) / zoom - (NODE_SIZE[type].w / 2)
    const worldY = (vy - pan.y) / zoom - 60
    const jitter = (Math.random() - 0.5) * 60
    setNodes((ns) => [...ns, { id, type, x: Math.max(20, worldX + jitter), y: Math.max(20, worldY + jitter), data: NODE_DEFAULTS[type]() }])
    setSelectedId(id)
    doNotify({ kind: "info", icon: "+", title: `Nodo ${type} añadido`, body: "Click en el handle morado para conectarlo." })
  }, [pan, zoom, doNotify])

  const removeNode = useCallback((id) => {
    setNodes((ns) => ns.filter((n) => n.id !== id))
    setEdges((es) => es.filter((e) => e.source !== id && e.target !== id))
    if (selectedId === id) setSelectedId(null)
  }, [selectedId])

  const groupInitRef = useRef({})
  const onGroupDragStart = useCallback((groupId) => {
    const ns = nodesRef.current, group = ns.find((n) => n.id === groupId); if (!group) return
    const memberPositions = {}
    ;(group.data?.members || []).forEach((mid) => { const m = ns.find((n) => n.id === mid); if (m) memberPositions[mid] = { x: m.x, y: m.y } })
    groupInitRef.current[groupId] = { gx: group.x, gy: group.y, members: memberPositions }
  }, [])

  const dragNode = useCallback((id, x, y) => {
    setNodes((ns) => {
      const node = ns.find((n) => n.id === id); if (!node) return ns
      if (node.type !== "group") return ns.map((n) => n.id === id ? { ...n, x, y } : n)
      const init = groupInitRef.current[id]
      if (!init) return ns.map((n) => n.id === id ? { ...n, x, y } : n)
      const dx = x - init.gx, dy = y - init.gy
      return ns.map((n) => {
        if (n.id === id) return { ...n, x, y }
        const ip = init.members[n.id]; if (ip) return { ...n, x: ip.x + dx, y: ip.y + dy }
        return n
      })
    })
  }, [])

  const patchNodeData = useCallback((id, patch) => {
    setNodes((ns) => ns.map((n) => n.id === id ? { ...n, data: { ...n.data, ...patch } } : n))
  }, [])

  // --- connector drag ---
  const [draggingEdge, setDraggingEdge] = useState(null)
  const [connectMenu, setConnectMenu]   = useState(null)
  const [contextMenu, setContextMenu]   = useState(null)
  const [newEdgeIds, setNewEdgeIds]     = useState(new Set())
  const draggingEdgeRef = useRef(null)
  draggingEdgeRef.current = draggingEdge
  const viewportRef = useRef(null)

  const pulseEdge = useCallback((edgeId) => {
    setNewEdgeIds((s) => new Set([...s, edgeId]))
    setTimeout(() => { setNewEdgeIds((s) => { const n = new Set(s); n.delete(edgeId); return n }) }, 1400)
  }, [])

  // handleMouseDown passed as prop (replaces window.__handleMouseDown)
  const onHandleMouseDown = useCallback((e, nodeId, side) => {
    e.preventDefault(); e.stopPropagation()
    const sourceNode = nodes.find((n) => n.id === nodeId); if (!sourceNode) return
    if (side !== "right") return
    const port = nodePortPos(sourceNode, "right")
    const onMove = (ev) => {
      const rect = viewportRef.current.getBoundingClientRect()
      const wx = (ev.clientX - rect.left - pan.x) / zoom
      const wy = (ev.clientY - rect.top  - pan.y) / zoom
      setDraggingEdge({ sourceId: nodeId, sx: port.x, sy: port.y, cx: wx, cy: wy })
    }
    const onUp = (ev) => {
      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.classList.remove("is-connecting")
      const current = draggingEdgeRef.current
      setDraggingEdge(null)
      const tgt = document.elementFromPoint(ev.clientX, ev.clientY)
      if (tgt && tgt.classList.contains("nh") && tgt.dataset.side === "left") {
        const targetId = tgt.dataset.nodeId
        if (targetId && targetId !== nodeId) {
          setEdges((es) => {
            if (es.find((e) => e.source === nodeId && e.target === targetId)) return es
            const newId = "e-" + Math.random().toString(36).slice(2, 7)
            pulseEdge(newId)
            doNotify({ kind: "success", icon: "→", title: "Conexión creada", body: "Flujo activo entre nodos." })
            return [...es, { id: newId, source: nodeId, target: targetId }]
          })
          return
        }
      }
      const rect = viewportRef.current.getBoundingClientRect()
      const dragDist = Math.hypot(ev.clientX - (rect.left + port.x * zoom + pan.x), ev.clientY - (rect.top  + port.y * zoom + pan.y))
      if (dragDist > 30) {
        const wx = (ev.clientX - rect.left - pan.x) / zoom
        const wy = (ev.clientY - rect.top  - pan.y) / zoom
        setConnectMenu({ sourceId: nodeId, x: ev.clientX, y: ev.clientY, worldX: wx, worldY: wy })
      }
    }
    document.body.classList.add("is-connecting")
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
  }, [nodes, pan, zoom, pulseEdge, doNotify])

  const onHandleMouseUp = useCallback(() => {}, [])

  useEffect(() => {
    if (!connectMenu) return
    const onKey = (e) => { if (e.key === "Escape") setConnectMenu(null) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [connectMenu])

  const addConnectedNode = useCallback((type) => {
    if (!connectMenu) return
    const id = `n-${type}-${Math.random().toString(36).slice(2, 6)}`
    const x = Math.max(20, connectMenu.worldX - 10), y = Math.max(20, connectMenu.worldY - 40)
    const newEdgeId = "e-" + Math.random().toString(36).slice(2, 7)
    setNodes((ns) => [...ns, { id, type, x, y, data: NODE_DEFAULTS[type]() }])
    setEdges((es) => [...es, { id: newEdgeId, source: connectMenu.sourceId, target: id }])
    pulseEdge(newEdgeId); setSelectedId(id); setConnectMenu(null)
    doNotify({ kind: "success", icon: "+", title: "Nodo creado y conectado" })
  }, [connectMenu, pulseEdge, doNotify])

  const onContextPick = useCallback((action, menu) => {
    if (!menu) { setContextMenu(null); return }
    const { nodeId, worldX, worldY } = menu
    if (action.startsWith("add-")) {
      const type = action.slice(4)
      const id = `n-${type}-${Math.random().toString(36).slice(2, 6)}`
      const x = Math.max(20, worldX - (NODE_SIZE[type]?.w || 320) / 2), y = Math.max(20, worldY - 40)
      setNodes((ns) => [...ns, { id, type, x, y, data: NODE_DEFAULTS[type]() }]); setSelectedId(id)
      doNotify({ kind: "info", icon: "+", title: `Nodo ${type} creado` })
    } else if (action === "duplicate" && nodeId) {
      const src = nodesRef.current.find((n) => n.id === nodeId)
      if (src) {
        const newId = `n-${src.type}-${Math.random().toString(36).slice(2, 6)}`
        setNodes((ns) => [...ns, { ...src, id: newId, x: src.x + 40, y: src.y + 40, data: JSON.parse(JSON.stringify(src.data)) }])
        setSelectedId(newId); doNotify({ kind: "info", icon: "⧉", title: "Nodo duplicado" })
      }
    } else if (action === "disconnect" && nodeId) {
      setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId))
      doNotify({ kind: "info", icon: "✂", title: "Conexiones eliminadas" })
    } else if (action === "delete" && nodeId) {
      setNodes((ns) => ns.filter((n) => n.id !== nodeId))
      setEdges((es) => es.filter((e) => e.source !== nodeId && e.target !== nodeId))
      if (selectedId === nodeId) setSelectedId(null)
      doNotify({ kind: "info", icon: "✕", title: "Nodo eliminado" })
    }
    setContextMenu(null)
  }, [selectedId, doNotify])

  // --- pan ---
  const panRef = useRef(null)
  const onViewportMouseDown = (e) => {
    if (e.target.closest(".node-wrap")) return
    if (e.target.closest(".nh")) return
    setSelectedId(null); setSelectedEdgeId(null)
    if (e.shiftKey && e.button === 0) {
      e.preventDefault()
      const vRect = viewportRef.current.getBoundingClientRect()
      const capPan = { x: pan.x, y: pan.y }, capZoom = zoom
      const x0 = e.clientX - vRect.left, y0 = e.clientY - vRect.top
      setRubberBand({ x1: x0, y1: y0, x2: x0, y2: y0 })
      const onMove = (ev) => setRubberBand({ x1: x0, y1: y0, x2: ev.clientX - vRect.left, y2: ev.clientY - vRect.top })
      const onUp = (ev) => {
        document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp)
        setRubberBand(null)
        const ex = ev.clientX - vRect.left, ey = ev.clientY - vRect.top
        const wx1 = (Math.min(x0, ex) - capPan.x) / capZoom, wy1 = (Math.min(y0, ey) - capPan.y) / capZoom
        const wx2 = (Math.max(x0, ex) - capPan.x) / capZoom, wy2 = (Math.max(y0, ey) - capPan.y) / capZoom
        if (wx2 - wx1 < 30 || wy2 - wy1 < 30) return
        const _alreadyGrouped = new Set(nodes.filter(n => n.type === 'group').flatMap(g => g.data?.members || []))
        const inside = nodes.filter((n) => {
          if (n.type === "group" || _alreadyGrouped.has(n.id)) return false
          const nw = NODE_SIZE[n.type]?.w || 320, nh2 = NODE_SIZE[n.type]?.h || 280
          return n.x < wx2 && n.x + nw > wx1 && n.y < wy2 && n.y + nh2 > wy1
        })
        if (inside.length < 2) return
        const groupId = "g-" + Math.random().toString(36).slice(2, 7)
        setNodes((ns) => [{ id: groupId, type: "group", x: wx1 - 24, y: wy1 - 52, data: { name: "Grupo", w: (wx2 - wx1) + 48, h: (wy2 - wy1) + 76, members: inside.map((n) => n.id) } }, ...ns])
        setSelectedId(groupId)
        doNotify({ kind: "success", icon: "▢", title: "Grupo creado", body: `${inside.length} nodos agrupados` })
      }
      document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp)
      return
    }
    panRef.current = { sx: e.clientX, sy: e.clientY, origin: { ...pan } }
    viewportRef.current?.classList.add("is-panning")
    const onMove = (ev) => setPan({ x: panRef.current.origin.x + (ev.clientX - panRef.current.sx), y: panRef.current.origin.y + (ev.clientY - panRef.current.sy) })
    const onUp = () => { viewportRef.current?.classList.remove("is-panning"); document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp) }
    document.addEventListener("mousemove", onMove); document.addEventListener("mouseup", onUp)
  }

  const onWheel = (e) => {
    if (e.ctrlKey || e.metaKey) { e.preventDefault(); setZoom((z) => Math.max(0.4, Math.min(1.5, z + (e.deltaY < 0 ? 0.06 : -0.06)))); return }
    if (e.shiftKey) { e.preventDefault(); const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY; setPan((p) => ({ x: p.x - delta, y: p.y })); return }
  }
  const onZoomDelta = (d) => setZoom((z) => Math.max(0.4, Math.min(1.5, z + d)))
  const onFitView = () => { setZoom(0.85); setPan({ x: 80, y: 70 }) }

  // --- generation ---
  const findUpstreamPrompt = useCallback((nodeId) => {
    const incoming = edges.filter((e) => e.target === nodeId)
    for (const e of incoming) { const src = nodes.find((n) => n.id === e.source); if (src?.type === "prompt") return { node: src, edgeId: e.id } }
    return null
  }, [edges, nodes])

  const findUpstreamImage = useCallback((nodeId) => {
    const incoming = edges.filter((e) => e.target === nodeId)
    for (const e of incoming) { const src = nodes.find((n) => n.id === e.source); if (src?.type === "image") return { node: src, edgeId: e.id } }
    return null
  }, [edges, nodes])

  const incomingPromptIds = useMemo(() => {
    const map = {}
    edges.forEach((e) => { const src = nodes.find((n) => n.id === e.source); if (src?.type === "prompt") map[e.target] = e.id })
    return map
  }, [edges, nodes])

  const incomingMediaUrls = useMemo(() => {
    const map = {}
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source); if (!src) return
      if ((src.type === "image" || src.type === "video") && src.data?.lastUrl) {
        const existing = map[e.target]
        if (existing && existing.kind === "image" && src.type === "video") return
        map[e.target] = { url: src.data.lastUrl, kind: src.type, sourceId: src.id }
      } else if ((src.type === "image" || src.type === "video")) {
        if (!map[e.target]) map[e.target] = { url: null, kind: src.type, sourceId: src.id, pending: true }
      }
    })
    return map
  }, [edges, nodes])

  const incomingPromptInfo = useMemo(() => {
    const map = {}, agentList = agents
    edges.forEach((e) => {
      const src = nodes.find((n) => n.id === e.source); if (src?.type !== "prompt") return
      const d = src.data || {}, agentObj = agentList.find((a) => a.id === d.agentId)
      map[e.target] = { edgeId: e.id, sourceId: src.id, agentId: d.agentId || null, agentName: agentObj?.name || (d.agentId ? d.agentId : null), agentRole: agentObj?.role || null, brief: (d.brief || "").trim(), refined: (d.agentOutput || d._refinedBrief || "").trim(), hasRefined: !!(d.agentOutput || d._refinedBrief), status: d.status || "idle" }
    })
    return map
  }, [edges, nodes, agents])

  const runNode = useCallback(async (nodeId, inheritedBrief = null, inheritedFrameUrl = null) => {
    const node = nodes.find((n) => n.id === nodeId); if (!node) return
    if (node.type === "prompt") {
      const downstream = edges.filter((e) => e.source === nodeId)
      if (downstream.length === 0) { doNotify({ kind: "info", icon: "ⓘ", title: "Nada que correr", body: "Conecta este Prompt a un nodo Imagen o Video." }); return }
      const rawBrief = node.data.brief?.trim()
      if (!rawBrief) { doNotify({ kind: "error", icon: "!", title: "Falta el brief" }); return }
      const agentId = node.data.agentId, agentObj = agents.find((a) => a.id === agentId) || agents[0]
      let finalBrief = rawBrief
      const clientCtx = activeClient ? { name: activeClient.name, sector: activeClient.sector || activeClient.industry || null, palette: activeClient.palette || null, moodboardName: activeMoodboard?.name || null } : null
      const firstDownstreamNode = nodes.find((n) => downstream.some((e) => e.target === n.id))
      const outputType = firstDownstreamNode?.type === "video" ? "video" : "image"
      if (agentObj) {
        patchNodeData(nodeId, { status: "running", agentOutput: null })
        setRunningNodes((s) => new Set([...s, nodeId]))
        const _agentPayload = { id: agentObj.id, name: agentObj.name, role: agentObj.role, specialty: agentObj.specialty, description: agentObj.description, tono: agentObj.tono, objetivo: agentObj.objetivo }
        try {
          const res = await fetch(`${window.CDPRO_CONFIG?.API_BASE || ''}/agent/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ brief: rawBrief, agent: _agentPayload, outputType, client: clientCtx }) })
          const json = await res.json()
          if (json.refined_prompt && !json.error) { finalBrief = json.refined_prompt; patchNodeData(nodeId, { status: "done", agentOutput: finalBrief }) }
          else { patchNodeData(nodeId, { status: "error", agentOutput: null, _agentFailed: true }); doNotify({ kind: "error", icon: "✖", title: agentObj.name + " falló", body: json.error || "Backend error" }) }
        } catch (err) {
          patchNodeData(nodeId, { status: "error", agentOutput: null, _agentFailed: true })
          doNotify({ kind: "error", icon: "✖", title: agentObj.name + " offline" })
        } finally { setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n }) }
        if (finalBrief !== rawBrief) doNotify({ kind: "success", icon: "✦", title: agentObj.name + " refinó el brief", body: finalBrief.slice(0, 80) })
      }
      const _curNode = nodes.find(n => n.id === nodeId)
      if (_curNode?.data?._agentFailed) return
      patchNodeData(nodeId, { _refinedBrief: finalBrief })
      for (const e of downstream) await runNode(e.target, finalBrief)
      return
    }
    if (node.type === "note" || node.type === "output") return
    const upstreamImage = (node.type === "video" || node.type === "image") ? findUpstreamImage(nodeId) : null
    const upstream = findUpstreamPrompt(nodeId) || (upstreamImage ? findUpstreamPrompt(upstreamImage.node.id) : null)
    const upstreamAgentOutput = upstream ? (upstream.node.data.agentOutput || upstream.node.data._refinedBrief) : null
    const brief = inheritedBrief || upstreamAgentOutput || (upstream ? null : node.data.prompt)
    if (!brief?.trim()) { doNotify({ kind: "error", icon: "!", title: "Sin prompt refinado" }); return }
    const firstFrameUrl = inheritedFrameUrl || upstreamImage?.node.data.lastUrl || null
    setRunningNodes((s) => new Set([...s, nodeId]))
    if (upstream)      setRunningEdges((s) => new Set([...s, upstream.edgeId]))
    if (upstreamImage) setRunningEdges((s) => new Set([...s, upstreamImage.edgeId]))
    patchNodeData(nodeId, { status: "running", prompt: brief })
    const cantidad = Math.max(1, parseInt(node.data.cantidad) || 1)
    const newItems = []
    doNotify({ kind: "info", icon: "⚙", title: "Generando con Kie.ai", body: "Puede tardar 30-180s." })
    async function tryGenerate(genBody, retryCount = 0, taskId = null) {
      const API_BASE = window.CDPRO_CONFIG?.API_BASE || ''
      const url = taskId ? `${API_BASE}/generate/retry/${taskId}` : `${API_BASE}/generate`
      const body = taskId ? JSON.stringify({ media_kind: genBody.media_kind }) : JSON.stringify(genBody)
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body })
      const data = await res.json()
      if (data.url) return data
      if (data.error && data.error.toLowerCase().includes("timeout") && data.task_id && retryCount < 2) {
        doNotify({ kind: "info", icon: "⟳", title: "Kie tardando — reintentando" })
        await new Promise(r => setTimeout(r, 20000))
        return tryGenerate(genBody, retryCount + 1, data.task_id)
      }
      return data
    }
    let _outputNodeId = null
    {
      const existing = edges.find((e) => e.source === nodeId && nodes.find((n) => n.id === e.target && n.type === "output"))
      if (existing) {
        _outputNodeId = existing.target
        setNodes((ns) => ns.map((n) => n.id === _outputNodeId ? { ...n, data: { ...n.data, status: "running", kind: node.type, modelId: node.data.modelId } } : n))
      } else {
        _outputNodeId = `n-output-${Math.random().toString(36).slice(2, 6)}`
        const sourceNode = nodes.find((n) => n.id === nodeId)
        const newX = (sourceNode?.x || 0) + (NODE_SIZE[node.type]?.w || 360) + 80, newY = sourceNode?.y || 0
        setNodes((ns) => [...ns, { id: _outputNodeId, type: "output", x: newX, y: newY, data: { ...NODE_DEFAULTS.output(), kind: node.type, modelId: node.data.modelId, items: [], status: "running" } }])
        const newEdgeId = "e-" + Math.random().toString(36).slice(2, 7)
        setEdges((es) => [...es, { id: newEdgeId, source: nodeId, target: _outputNodeId }]); pulseEdge(newEdgeId)
      }
    }
    for (let i = 0; i < cantidad; i++) {
      let url = "", genError = null
      try {
        const genBody = { media_kind: node.type === "video" ? "video" : "image", model_id: node.data.modelId, prompt: brief, aspect: node.data.aspect || null, duration: node.type === "video" ? (parseInt(String(node.data.duration || "5").replace(/\D/g,""), 10) || 5) : null, first_frame_url: firstFrameUrl || null, reference_images: (() => { const refs = []; if (node.data.refImages?.length) refs.push(...node.data.refImages.slice(0, 2)); if (firstFrameUrl && !refs.includes(firstFrameUrl)) refs.push(firstFrameUrl); return refs.length ? refs.slice(0, 3) : null })() }
        const genData = await tryGenerate(genBody)
        if (genData.error) genError = genData.error; else url = genData.url
      } catch (err) { genError = err.message || String(err) }
      if (genError) { doNotify({ kind: "error", icon: "✖", title: "Error generando", body: genError.slice(0, 120) }); patchNodeData(nodeId, { status: "idle" }); setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n }); return }
      newItems.push({ id: "g-" + Math.random().toString(36).slice(2, 8), kind: node.type, url, prompt: brief, model: node.data.modelId, duration: node.type === "video" ? node.data.duration : undefined, aspect: node.data.aspect, styleLocked: !!lockedMb, styleSource: lockedMb?.name || null, clientId: activeClientId || null, moodboardId: activeMoodboardId || null, projectId: activeProjectId || null, createdAt: Date.now() + i, nodeId })
    }
    patchNodeData(nodeId, { status: "done", lastUrl: newItems[0].url })
    if (node.type === "image" && newItems[0]?.url) {
      const generatedUrl = newItems[0].url
      const videoDownstream = edges.filter((e) => { if (e.source !== nodeId) return false; const tgt = nodes.find((n) => n.id === e.target); return tgt?.type === "video" })
      for (const e of videoDownstream) await runNode(e.target, brief, generatedUrl)
    }
    setGallery((g) => [...newItems.slice().reverse(), ...g])
    const existingOutputEdge = edges.find((e) => e.source === nodeId && nodes.find((n) => n.id === e.target && n.type === "output"))
    if (existingOutputEdge) {
      const outId = existingOutputEdge.target
      setNodes((ns) => ns.map((n) => n.id === outId ? { ...n, data: { ...n.data, status: "done", kind: node.type, modelId: node.data.modelId, items: [...newItems, ...(n.data.items || [])] } } : n))
    } else {
      const outId = `n-output-${Math.random().toString(36).slice(2, 6)}`
      const sourceNode = nodes.find((n) => n.id === nodeId)
      const newX = (sourceNode?.x || 0) + (NODE_SIZE[node.type]?.w || 360) + 80, newY = sourceNode?.y || 0
      setNodes((ns) => [...ns, { id: outId, type: "output", x: newX, y: newY, data: { ...NODE_DEFAULTS.output(), kind: node.type, modelId: node.data.modelId, items: newItems } }])
      const newEdgeId = "e-" + Math.random().toString(36).slice(2, 7)
      setEdges((es) => [...es, { id: newEdgeId, source: nodeId, target: outId }]); pulseEdge(newEdgeId)
    }
    doNotify({ kind: "success", icon: node.type === "video" ? "▶" : "◈", title: cantidad === 1 ? (node.type === "video" ? "Video renderizado" : "Imagen generada") : `${cantidad} generadas`, body: node.data.modelId + (lockedMb ? ` · style "${lockedMb.name}"` : "") })
    setRunningNodes((s) => { const n = new Set(s); n.delete(nodeId); return n })
    setTimeout(() => {
      if (upstream)      setRunningEdges((s) => { const n = new Set(s); n.delete(upstream.edgeId); return n })
      if (upstreamImage) setRunningEdges((s) => { const n = new Set(s); n.delete(upstreamImage.edgeId); return n })
    }, 400)
  }, [nodes, edges, findUpstreamPrompt, findUpstreamImage, patchNodeData, lockedMb, pulseEdge, agents, activeClient, activeMoodboard, activeClientId, activeMoodboardId, activeProjectId, doNotify])

  const [previewItem, setPreviewItem] = useState(null)
  const onOutputAction = useCallback((action, nodeId, item) => {
    if (action === "preview") { setPreviewItem(item) }
    else if (action === "download") {
      const a = document.createElement("a"); a.href = item.url; a.download = `${item.kind || "asset"}-${item.id}.png`; a.click()
      doNotify({ kind: "info", icon: "↓", title: "Descarga iniciada" })
    } else if (action === "delete") {
      setNodes((ns) => ns.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, items: n.data.items.filter((it) => it.id !== item.id) } } : n))
      setGallery((g) => g.filter((x) => x.id !== item.id))
    } else if (action === "openGallery") { setActiveTab("gallery") }
  }, [doNotify])

  const runAll = useCallback(async () => {
    const promptNodes = nodes.filter((n) => n.type === "prompt")
    for (const p of promptNodes) { if (edges.filter((e) => e.source === p.id).length === 0) continue; await runNode(p.id) }
  }, [nodes, edges, runNode])

  // --- Supercomputer swarm ---
  const pushLog = (frame) => { setLogs((ls) => [...ls, { id: Math.random().toString(36).slice(2), ...frame }]); setLastLogAt(Date.now()) }
  const runSwarm = useCallback(async ({ client, refImages, refAnalysis } = {}) => {
    if (!prompt.trim()) return
    setLogs([]); setSwarmArtifact(null)
    const setStatus = (k, s) => setNodeStatus((st) => ({ ...st, [k]: s }))
    setNodeStatus({ master_director:'idle', scriptwriter:'idle', cinematographer:'idle', production:'idle', critic:'idle' })
    const promptNode = nodes.find((n) => n.type === 'prompt'), imageNode = nodes.find((n) => n.type === 'image')
    if (promptNode) patchNodeData(promptNode.id, { brief: prompt, status: 'done' })
    const clientCtx = client ? { id: client.id, name: client.name, industry: client.industry, tagline: client.tagline, palette: client.palette } : null
    if (lockedMb?.manifest) pushLog({ agentName: 'VisionAuditor', status: 'done', message: `Style Manifest "${lockedMb.name}"` })
    let resp
    try {
      resp = await fetch(`${window.CDPRO_CONFIG?.API_BASE || ''}/chat/stream`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: prompt, moodboard_id: lockedMb?.id || null, client_context: clientCtx, reference_images: Array.isArray(refImages) ? refImages.filter(Boolean).slice(0, 2) : [] }) })
      if (!resp.ok) throw new Error(`Backend ${resp.status}`)
    } catch (err) { pushLog({ agentName: 'System', status: 'error', message: `Error: ${err.message}` }); return }
    const reader = resp.body.getReader(), decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n'); buffer = parts.pop() || ''
        for (const part of parts) {
          const line = part.trim(); if (!line.startsWith('data: ')) continue
          let ev; try { ev = JSON.parse(line.slice(6)) } catch { continue }
          if (ev.type === 'node_start') { setStatus(ev.node, 'running'); pushLog({ agentName: ev.node, status: 'running', message: ev.message }) }
          else if (ev.type === 'node_done') { setStatus(ev.node, ev.status || 'done'); pushLog({ agentName: ev.label || ev.node, status: ev.status || 'done', message: ev.message }) }
          else if (ev.type === 'complete') {
            const finalArtifact = ev.artifact; setSwarmArtifact(ev.artifact || null)
            if (finalArtifact?.url) {
              const isVideo = finalArtifact.media_kind === 'video'
              if (imageNode) patchNodeData(imageNode.id, { status: 'done', lastUrl: finalArtifact.url, modelId: finalArtifact.model_id, prompt })
              setGallery((g) => [{ id: 'g-' + Math.random().toString(36).slice(2, 8), kind: isVideo ? 'video' : 'image', url: finalArtifact.url, prompt, model: finalArtifact.model_id, duration: isVideo ? `${finalArtifact.duration_s || 5}s` : null, aspect: '16:9', styleLocked: !!lockedMb, styleSource: lockedMb?.name || null, clientName: client?.name || null, createdAt: Date.now() }, ...g])
              doNotify({ kind: 'success', icon: '✦', title: 'Swarm completado', body: finalArtifact.model_id })
            }
            pushLog({ agentName: 'System', status: 'info', message: 'Generacion completa' })
          }
          else if (ev.type === 'error') { pushLog({ agentName: 'System', status: 'error', message: `Error: ${ev.message}` }) }
        }
      }
    } catch (err) { pushLog({ agentName: 'System', status: 'error', message: `Stream: ${err.message}` }) }
  }, [prompt, lockedMb, nodes, patchNodeData, doNotify])

  const prevLockedRef = useRef(null)
  useEffect(() => {
    if (lockedMb && lockedMb.id !== prevLockedRef.current) doNotify({ kind: "style", icon: "🔒", title: `Style locked: ${lockedMb.name}` })
    prevLockedRef.current = lockedMb?.id || null
  }, [lockedMb, doNotify])

  useEffect(() => {
    if (mode === "supercomputer") setPanelOpen(false)
    if (mode === "canvas") setPanelOpen(false)
  }, [mode])

  const transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`

  return (
    <div className="app">
      <TopBar mode={mode} onMode={setMode} isProcessing={isProcessing} onRunAll={runAll} theme={theme}
        onThemeToggle={() => setTweak("theme", theme === "dark" ? "light" : "dark")}
        onOpenProfile={() => setProfileOpen(true)} onOpenAnalytics={() => setAnalyticsOpen(true)}
        userInitials={profile.initials} userEmail={profile.email} userPhoto={profile.avatarPhoto}
        clients={clients} moodboards={moodboards} activeClient={activeClient} activeMoodboard={activeMoodboard}
        setCtxClient={setCtxClient} setCtxMoodboard={setCtxMoodboard} />

      {mode !== "supercomputer" && (
        <LeftRail activeTab={activeTab} onTab={setActiveTab} galleryCount={gallery.length}
          hasLockedMoodboard={!!lockedMb} clientsCount={clients.length} projectsCount={projects.length} agentsCount={agents.length} />
      )}

      {/* Panel container with blendy ref for animated transitions */}
      <div ref={panelContainerRef} style={{ display: 'contents' }}>
        {mode !== "supercomputer" && (
          <aside className={"left-drawer " + (activeTab === "nodes" ? "is-open" : "")} data-kind="nodes">
            {activeTab === "nodes" && (
              <NodesPanel onAdd={addNode} onClose={() => setActiveTab(null)} onSave={() => setSaveModalOpen(true)}
                onNewCanvas={() => { setNodes([]); setEdges([]); setSelectedId(null); setSelectedIds(new Set()); doNotify({ kind: "info", icon: "✦", title: "Canvas limpio" }) }}
                flowTemplates={flowTemplates} onLoadTemplate={loadFlow} onDeleteTemplate={deleteTemplate} />
            )}
          </aside>
        )}

        {mode !== "supercomputer" && (
          <aside className={"left-drawer " + (activeTab === "clients" ? "is-open" : "")} data-kind="clients">
            {activeTab === "clients" && (
              <ClientsPanel clients={clients} activeClientId={activeClientId} setActiveClientId={setActiveClientId}
                onClose={() => { setActiveTab(null); setActiveClientId(null) }} onOpenCreate={() => setCreateClientOpen(true)} />
            )}
          </aside>
        )}

        {mode !== "supercomputer" && (
          <aside className={"left-drawer " + (activeTab === "agents" ? "is-open" : "")} data-kind="agents">
            {activeTab === "agents" && (
              <AgentsPanel agents={agents} onAdd={addAgent} onEdit={editAgent} onDelete={deleteAgent} onClose={() => setActiveTab(null)} />
            )}
          </aside>
        )}

        {mode !== "supercomputer" && (
          <aside className={"left-drawer " + (activeTab === "projects" ? "is-open" : "")} data-kind="projects">
            {activeTab === "projects" && (
              <ProjectsPanel projects={projects} clients={clients} activeProjectId={activeProjectId}
                onOpen={onOpenProject} onCreate={onCreateProject} onDelete={onDeleteProject} onClose={() => setActiveTab(null)} />
            )}
          </aside>
        )}
      </div>

      {mode !== "supercomputer" && activeTab === "settings" && (
        <div className="form-popup-backdrop" onClick={() => setActiveTab(null)}>
          <div className="form-popup form-popup-lg" onClick={(e) => e.stopPropagation()}>
            <SettingsPanel theme={theme} setTheme={(v) => { setTheme(v); window.parent?.postMessage({ type: "__edit_mode_set_keys", edits: { theme: v } }, "*") }} onClose={() => setActiveTab(null)} />
          </div>
        </div>
      )}

      {mode !== "supercomputer" && (
        <div ref={viewportRef} className="canvas-viewport" onMouseDown={onViewportMouseDown} onWheel={onWheel}
          onContextMenu={(e) => {
            e.preventDefault()
            const nodeWrap = e.target.closest && e.target.closest('.node-wrap')
            const nodeId = nodeWrap?.dataset?.nodeId || null
            const rect = viewportRef.current.getBoundingClientRect()
            const wx = (e.clientX - rect.left - pan.x) / zoom, wy = (e.clientY - rect.top - pan.y) / zoom
            setContextMenu({ x: e.clientX, y: e.clientY, worldX: wx, worldY: wy, nodeId })
          }}>
          <div className="canvas-world" style={{ transform }}>
            <EdgesLayer nodes={nodes} edges={edges} draggingEdge={draggingEdge} runningEdgeIds={runningEdges}
              newEdgeIds={newEdgeIds} selectedEdgeId={selectedEdgeId}
              onSelectEdge={(id) => { setSelectedEdgeId(id); setSelectedId(null) }} onDeleteEdge={deleteEdge} />
            {nodes.map((n) => {
              const inRubberBand = rubberBand ? (() => {
                if (n.type === 'group') return false
                const groupedIds = new Set(nodes.filter(x => x.type==='group').flatMap(g => g.data?.members||[]))
                if (groupedIds.has(n.id)) return false
                const rb = rubberBand
                const rx1 = (Math.min(rb.x1,rb.x2)-pan.x)/zoom, ry1=(Math.min(rb.y1,rb.y2)-pan.y)/zoom
                const rx2 = (Math.max(rb.x1,rb.x2)-pan.x)/zoom, ry2=(Math.max(rb.y1,rb.y2)-pan.y)/zoom
                const nw = NODE_SIZE[n.type]?.w||320, nh = NODE_SIZE[n.type]?.h||280
                return n.x < rx2 && n.x+nw > rx1 && n.y < ry2 && n.y+nh > ry1
              })() : false
              return (
                <CanvasNode key={n.id} node={n}
                  selected={selectedId === n.id || selectedIds.has(n.id) || inRubberBand}
                  onSelect={(id, e) => toggleSelect(id, e?.shiftKey)} onDrag={dragNode}
                  onGroupDragStart={onGroupDragStart} onDataChange={patchNodeData} onClose={removeNode}
                  onGenerate={runNode} hasIncomingPrompt={!!incomingPromptIds[n.id]}
                  incomingPrompt={incomingPromptInfo[n.id] || null} incomingMedia={incomingMediaUrls[n.id] || null}
                  onOutputAction={onOutputAction} activeClient={activeClient} activeMoodboard={activeMoodboard}
                  notify={doNotify} creativeAgents={agents}
                  onHandleMouseDown={onHandleMouseDown} onHandleMouseUp={onHandleMouseUp} />
              )
            })}
          </div>
          <div className="canvas-vignette" />
          {rubberBand && (
            <div className="canvas-rubber-band" style={{ left: Math.min(rubberBand.x1, rubberBand.x2), top: Math.min(rubberBand.y1, rubberBand.y2), width: Math.abs(rubberBand.x2 - rubberBand.x1), height: Math.abs(rubberBand.y2 - rubberBand.y1) }} />
          )}
        </div>
      )}

      <SuperPanel open={panelOpen} onClose={() => setPanelOpen(false)} logs={logs} isProcessing={isProcessing}
        prompt={prompt} setPrompt={setPrompt} onSubmit={runSwarm} lastLogAt={lastLogAt} />

      <MoodboardVault open={activeTab === "moodboard"} onClose={() => setActiveTab(null)}
        moodboards={moodboards} dispatch={dispatchMoodboards} />

      <GalleryPanel open={activeTab === "gallery"} onClose={() => setActiveTab(null)}
        items={gallery} onRemove={(id) => setGallery((g) => g.filter((x) => x.id !== id))} />

      {mode === "supercomputer" && (
        <SuperStage prompt={prompt} setPrompt={setPrompt} onSubmit={runSwarm} isProcessing={isProcessing}
          logs={logs} nodeStatus={nodeStatus} lastLogAt={lastLogAt} clients={clients} moodboards={moodboards}
          lockedMb={lockedMb} dispatchMoodboards={dispatchMoodboards} activeClient={activeClient}
          activeMoodboard={activeMoodboard} setCtxClient={setCtxClient} setCtxMoodboard={setCtxMoodboard}
          swarmArtifact={swarmArtifact} />
      )}

      {mode !== "supercomputer" && (
        <Minimap nodes={nodes} edges={edges} pan={pan} zoom={zoom} setPan={setPan} viewportRef={viewportRef} />
      )}

      {previewItem && mode !== "supercomputer" && <ImagePreview item={previewItem} onClose={() => setPreviewItem(null)} />}

      {mode !== "supercomputer" && (
        <NewClientPopup open={createClientOpen} onClose={() => setCreateClientOpen(false)} onCreate={onCreateClient} />
      )}

      {profileOpen && (
        <ProfilePopup profile={profile}
          onSave={(p) => { setProfile(p); setProfileOpen(false); doNotify({ kind: "success", icon: "✓", title: "Perfil actualizado", body: p.name }) }}
          onClose={() => setProfileOpen(false)} />
      )}

      {analyticsOpen && <AnalyticsPanel onClose={() => setAnalyticsOpen(false)} />}

      {mode !== "supercomputer" && selectedIds.size >= 2 && (
        <div className="multiselect-bar">
          <div className="multiselect-count mono">{selectedIds.size} seleccionados</div>
          <button className="multiselect-btn multiselect-btn-primary" onClick={groupSelected}><span>▢</span> Agrupar</button>
          <button className="multiselect-btn multiselect-btn-danger" onClick={deleteSelectedMany}><span>✕</span> Borrar</button>
          <button className="multiselect-btn" onClick={() => { setSelectedIds(new Set()); setSelectedId(null) }}>Cancelar</button>
        </div>
      )}

      {mode !== "supercomputer" && <ConnectMenu menu={connectMenu} onClose={() => setConnectMenu(null)} onPick={addConnectedNode} />}
      {mode !== "supercomputer" && <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} onPick={onContextPick} />}

      {saveModalOpen && (
        <SaveFlowModal onSave={saveFlow} onClose={() => setSaveModalOpen(false)}
          nodeCount={nodes.filter(n => n.type !== "group").length} edgeCount={edges.length} />
      )}

      <TweaksPanel visible={tweaksOn}
        onClose={() => { setTweaksOn(false); window.parent?.postMessage({ type: "__edit_mode_dismissed" }, "*") }}
        theme={theme} setTheme={(v) => setTweak("theme", v)} accent={accent} setAccent={(v) => setTweak("accent", v)} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// SuperStage — Supercomputer cinematic page
// ---------------------------------------------------------------------------
const SWARM_AGENTS = [
  { key: "master_director", letter: "M", label: "MasterDirector", color: "#A78BFA" },
  { key: "scriptwriter",    letter: "S", label: "Scriptwriter",   color: "#7DD3FC" },
  { key: "cinematographer", letter: "C", label: "Cinematographer",color: "#C4B5FD" },
  { key: "production",      letter: "P", label: "Production",     color: "#FBBF24" },
  { key: "critic",          letter: "K", label: "Critic",         color: "#34D399" },
]

function SuperStage({ prompt, setPrompt, onSubmit, isProcessing, logs, nodeStatus, lastLogAt, clients, moodboards, lockedMb, dispatchMoodboards, activeClient: ctxClient, activeMoodboard: ctxMoodboard, setCtxClient, setCtxMoodboard, swarmArtifact }) {
  const [pickerOpen, setPickerOpen] = useState(null)
  const [localClientId, setLocalClientId] = useState(null)
  const activeClientId = ctxClient?.id || localClientId
  const setActiveClientId = (id) => { setLocalClientId(id); if (setCtxClient) setCtxClient(id) }
  const activeClient = ctxClient || clients?.find((c) => c.id === localClientId)
  const activeMb = ctxMoodboard || moodboards?.find((m) => m.locked)
  const canLaunch = prompt.trim().length > 4
  const [refImages, setRefImages] = useState([])
  const [refAnalysis, setRefAnalysis] = useState(null)
  const [swarmModalOpen, setSwarmModalOpen] = useState(true)
  useEffect(() => { if (isProcessing) setSwarmModalOpen(true) }, [isProcessing])

  const handleRefUpload = async (e) => {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file || !file.type.startsWith('image/') || refImages.length >= 2) return
    try {
      const url = await new Promise((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = () => rej(fr.error); fr.readAsDataURL(file)
      })
      setRefImages(prev => prev.length >= 2 ? prev : [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2,7)}`, url, name: file.name }].slice(0, 2))
    } catch {}
  }

  useEffect(() => {
    if (refImages.length === 0) { setRefAnalysis(null); return }
    let cancelled = false; setRefAnalysis({ status: 'analyzing' })
    ;(async () => {
      try {
        const res = await fetch(`${window.CDPRO_CONFIG?.API_BASE || ''}/moodboards/audit`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ moodboard_id: `temp-super-${Date.now()}`, name: 'Supercomputer refs', images: refImages.map((img, i) => ({ id: `r${i}-${img.id}`, url: img.url })) }) })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json(), mf = data?.moodboard?.manifest || {}
        if (cancelled) return
        setRefAnalysis({ status: 'ready', colorPalette: mf.color_palette || [], lightingStyle: mf.lighting_style || '', masterStylePrompt: mf.master_style_prompt || '', moodKeywords: mf.mood_keywords || [], cameraLensFeel: mf.camera_lens_feel || '', consistencyScore: mf.consistency_score || 0 })
      } catch (e) { if (cancelled) return; setRefAnalysis({ status: 'error', error: e.message }) }
    })()
    return () => { cancelled = true }
  }, [refImages.map(r => r.id).join('|')])

  const AGENTS_ORBIT = React.useMemo(() => {
    const colors = ['#A78BFA','#7DD3FC','#FBBF24','#FB7185','#34D399','#C4B5FD','#F0ABFC','#67E8F9']
    return new Array(18).fill(0).map((_, i) => ({ id: i, color: colors[i % colors.length], radius: 80 + Math.random() * 130, speed: 12 + Math.random() * 18, phase: Math.random() * 2 * Math.PI, size: 1.6 + Math.random() * 2.2, tilt: -8 + Math.random() * 16 }))
  }, [])

  const launchSwarm = () => onSubmit({ client: activeClient, refImages: refImages.map(r => r.url), refAnalysis: refAnalysis?.status === 'ready' ? { color_palette: refAnalysis.colorPalette, lighting_style: refAnalysis.lightingStyle, master_style_prompt: refAnalysis.masterStylePrompt, mood_keywords: refAnalysis.moodKeywords, camera_lens_feel: refAnalysis.cameraLensFeel, consistency_score: refAnalysis.consistencyScore } : null })

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
          <p className="cortex-tagline">Un brief. Un enjambre. <i>El resto sucede solo.</i></p>
        </header>

        <div className="cortex-swarm" aria-hidden="true">
          <AstronautLoop active={isProcessing} nodeStatus={nodeStatus} briefLength={(prompt || "").length} />
        </div>

        <div className="cortex-form">
          <div className="cortex-slots">
            <CortexSlot kind="client" label="Cliente" value={activeClient ? activeClient.name : 'Sin asignar'} hint={activeClient ? activeClient.tagline : 'opcional'} avatar={activeClient?.initials} bg={activeClient?.bgGradient} onClick={() => setPickerOpen('client')} />
            <CortexSlot kind="moodboard" label="Moodboard" value={activeMb?.name || 'Sin estilo'} hint={activeMb?.locked ? 'style locked' : (activeMb ? 'no locked' : 'opcional')} avatar={activeMb ? '◇' : null} onClick={() => setPickerOpen('moodboard')} locked={activeMb?.locked} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.18em', opacity: 0.65 }}>Referencias visuales</span>
            {refImages.map((img) => (
              <div key={img.id} style={{ position: 'relative', width: 56, height: 56, borderRadius: 12, overflow: 'hidden', border: '1.5px solid rgba(167,139,250,0.55)' }}>
                <img src={img.url} alt="ref" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button type="button" onClick={() => setRefImages(r => r.filter(x => x.id !== img.id))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#FB7185', border: '1.5px solid #0a0a14', color: '#fff', fontSize: 11, cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0 }}>×</button>
              </div>
            ))}
            {refImages.length < 2 && (
              <label style={{ width: 56, height: 56, borderRadius: 12, border: '1.5px dashed rgba(167,139,250,0.45)', display: 'grid', placeItems: 'center', cursor: 'pointer', color: 'rgba(167,139,250,0.85)', fontSize: 22, background: 'rgba(167,139,250,0.05)' }} title="Añadir imagen de referencia">
                +<input key={`ref-input-${refImages.length}`} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleRefUpload} />
              </label>
            )}
          </div>

          <div className="cortex-prompt">
            <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canLaunch) launchSwarm() }}
              rows={3} placeholder="Describe lo que quieres crear. El enjambre lo orquesta." disabled={isProcessing} />
            <div className="cortex-prompt-foot">
              <span className="cortex-prompt-hint mono">⌘ + ⏎ · lanzar</span>
              <button className="cortex-launch" onClick={launchSwarm} disabled={!canLaunch || isProcessing}>
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

      {(logs.length > 0 || isProcessing || swarmArtifact) && swarmModalOpen && (
        <div className="swarm-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setSwarmModalOpen(false) }}>
          <div className="swarm-modal-card" role="dialog" aria-modal="true" aria-label="Enjambre en vivo">
            <div className="swarm-modal-head">
              <div className="swarm-modal-title-wrap">
                <span className="swarm-modal-pulse" aria-hidden="true" />
                <span className="swarm-modal-title mono">ENJAMBRE EN VIVO</span>
              </div>
              <button type="button" className="swarm-modal-close" onClick={() => setSwarmModalOpen(false)} title="Cerrar (sigue en background)">×</button>
            </div>
            {prompt && <div className="swarm-modal-section"><div className="swarm-modal-label mono">TU PETICION</div><div className="swarm-modal-prompt">"{prompt}"</div></div>}
            <div className="swarm-modal-section">
              <div className="swarm-modal-label mono">PROGRESS</div>
              <div className="swarm-progress-wrap">
                <div className="swarm-bar-track">
                  <div className="swarm-bar-fill" style={{ width: `${Math.round((Object.values(nodeStatus).filter(s => s === 'done').length / 5) * 100)}%` }} />
                </div>
                <div className="swarm-agent-badges">
                  {[{ key: 'master_director', label: 'Director' },{ key: 'scriptwriter', label: 'Script' },{ key: 'cinematographer', label: 'Cine' },{ key: 'production', label: 'Prod' },{ key: 'critic', label: 'Critic' }].map(({ key, label }) => {
                    const st = nodeStatus[key] || 'idle'
                    return (
                      <div key={key} className={`swarm-badge swarm-badge--${st}`}>
                        {st === 'done' ? <span className="swarm-badge-check">✓</span> : st === 'running' ? <span className="swarm-badge-spin" /> : null}
                        <span className="swarm-badge-label">{label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <div className="swarm-modal-section">
              <div className="swarm-modal-label mono">LOG VIVO</div>
              <div className="swarm-logs swarm-modal-logs">
                {logs.map((l) => {
                  const p = ({'MasterDirector':'#A78BFA','Scriptwriter':'#60A5FA','Cinematographer':'#8B5CF6','Production':'#F59E0B','Critic':'#10B981','VisionAuditor':'#22D3EE'})[l.agentName] || '#71717A'
                  return (
                    <div key={l.id} className={`swarm-log-row ${l.status === 'error' ? 'is-error' : ''}`}>
                      <span className="swarm-log-dot" style={{ background: p, boxShadow: `0 0 5px ${p}` }} />
                      <span className="swarm-log-agent" style={{ color: p }}>[{l.agentName}]</span>
                      <span className="swarm-log-msg">{l.message}</span>
                      {l.status === 'running' && <span className="swarm-log-running mono">running</span>}
                    </div>
                  )
                })}
                {isProcessing && logs.length > 0 && (
                  <div className="swarm-thinking">
                    <span className="led-dot led-breath" style={{ background: '#8B5CF6', boxShadow: '0 0 8px #8B5CF6' }} />
                    <span className="mono" style={{ color: 'var(--text-3)', fontSize: '0.72rem' }}>enjambre procesando</span>
                  </div>
                )}
              </div>
            </div>
            <div className="swarm-modal-section">
              <div className="swarm-modal-label mono">RESULTADO</div>
              {swarmArtifact ? (
                <div className="swarm-result">
                  {swarmArtifact.url ? (
                    swarmArtifact.media_kind === 'video'
                      ? <video className="swarm-result-media" src={swarmArtifact.url} controls autoPlay muted loop playsInline />
                      : <img className="swarm-result-media" src={swarmArtifact.url} alt="Resultado del enjambre" />
                  ) : <div className="swarm-result-stub"><span className="mono" style={{ color: 'var(--text-3)', fontSize: '0.75rem' }}>Stub mode</span></div>}
                  <div className="swarm-result-meta mono" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span>{swarmArtifact.model_id}{swarmArtifact.media_kind === 'video' && ` · ${swarmArtifact.duration_s || 5}s`}</span>
                    {swarmArtifact.url && <a href={swarmArtifact.url} download className="swarm-modal-download" target="_blank" rel="noreferrer">descargar</a>}
                  </div>
                </div>
              ) : (
                <div className="swarm-tech-loader">
                  <div className="swarm-tech-loader-core">
                    <div className="swarm-tech-loader-orb" />
                    <div className="swarm-tech-loader-label">Sintetizando resultado</div>
                    <div className="swarm-tech-loader-dots">
                      <div className="swarm-tech-loader-dot" /><div className="swarm-tech-loader-dot" />
                      <div className="swarm-tech-loader-dot" /><div className="swarm-tech-loader-dot" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(logs.length > 0 || isProcessing || swarmArtifact) && !swarmModalOpen && (
        <button type="button" className="swarm-reopen-fab" onClick={() => setSwarmModalOpen(true)}>
          <span className="swarm-modal-pulse" /><span className="mono">ver enjambre</span>
        </button>
      )}

      {pickerOpen && (
        <PickerPopup kind={pickerOpen} clients={clients} moodboards={moodboards} activeClientId={activeClientId}
          setActiveClientId={setActiveClientId} dispatchMoodboards={dispatchMoodboards} onClose={() => setPickerOpen(null)} />
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Root export — wrapped in NotificationProvider
// ---------------------------------------------------------------------------
function AppWithNotifications() {
  return (
    <NotificationProvider>
      <AppInner />
    </NotificationProvider>
  )
}

// AppInner consumes the notification context
function AppInner() {
  return <App />
}

export default AppWithNotifications
