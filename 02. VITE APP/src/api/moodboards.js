/**
 * Cross-user moodboard sync — habla con `/moodboards/*` del backend.
 *
 * El backend persiste cada moodboard en una tabla Supabase dedicada
 * (incluye images, manifest, audit_status, locked). El endpoint /audit
 * existente ya guarda al disparar Vision_Auditor, pero el usuario puede
 * crear/renombrar/lockear sin auditar y eso ANTES se perdía.
 *
 * Estrategia:
 *   - Hidratar al montar: GET /moodboards
 *   - Cada vez que muta el estado local, hacer PUT debounced por moodboard
 *     cambiado (one shot por mb modificado, no full collection)
 *   - Polling cada 30s → mergear por id
 *
 * NOTA sobre nombres de campo: el backend usa snake_case
 * (audit_status, master_style_prompt, color_palette, etc.).
 * El frontend usa camelCase (auditStatus, masterStylePrompt, colorPalette).
 * Mapeamos en `toClient`/`toServer`.
 */
import React from 'react'
import { CDPRO_CONFIG } from '../config'

const POLL_MS = 30_000
const DEBOUNCE_MS = 700

const base = () => CDPRO_CONFIG.API_BASE || ''

// ─── Mapping helpers ───────────────────────────────────────────────

const CAMEL_TO_SNAKE = {
  moodboardId: 'moodboard_id',
  colorPalette: 'color_palette',
  lightingStyle: 'lighting_style',
  cameraLensFeel: 'camera_lens_feel',
  characterTraits: 'character_traits',
  compositionRules: 'composition_rules',
  moodKeywords: 'mood_keywords',
  masterStylePrompt: 'master_style_prompt',
  negativePrompt: 'negative_prompt',
  consistencyScore: 'consistency_score',
  filtersEffects: 'filters_effects',
  compositionLayers: 'composition_layers',
  colorGrading: 'color_grading',
  textContent: 'text_content',
}
const SNAKE_TO_CAMEL = Object.fromEntries(
  Object.entries(CAMEL_TO_SNAKE).map(([k, v]) => [v, k])
)

const mapManifestToServer = (m) => {
  if (!m) return null
  const out = {}
  for (const [k, v] of Object.entries(m)) {
    out[CAMEL_TO_SNAKE[k] || k] = v
  }
  return out
}

const mapManifestToClient = (m) => {
  if (!m) return null
  const out = {}
  for (const [k, v] of Object.entries(m)) {
    out[SNAKE_TO_CAMEL[k] || k] = v
  }
  return out
}

const toServer = (mb) => ({
  id: mb.id,
  name: mb.name || 'Untitled',
  images: (mb.images || []).map(img => ({
    id: img.id,
    url: img.url,
    width: img.width ?? null,
    height: img.height ?? null,
  })),
  manifest: mapManifestToServer(mb.manifest),
  audit_status: mb.auditStatus || 'idle',
  locked: !!mb.locked,
})

const toClient = (row) => ({
  id: row.id,
  name: row.name,
  images: row.images || [],
  manifest: mapManifestToClient(row.manifest),
  auditStatus: row.audit_status || 'idle',
  locked: !!row.locked,
  updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
})

// ─── HTTP ──────────────────────────────────────────────────────────

export async function listMoodboards() {
  try {
    const r = await fetch(`${base()}/moodboards`, { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    return Array.isArray(d) ? d.map(toClient) : []
  } catch {
    return null
  }
}

export async function upsertMoodboard(mb) {
  try {
    const r = await fetch(`${base()}/moodboards/${encodeURIComponent(mb.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toServer(mb)),
    })
    return r.ok
  } catch {
    return false
  }
}

export async function deleteMoodboardRemote(id) {
  try {
    const r = await fetch(`${base()}/moodboards/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    })
    return r.ok
  } catch {
    return false
  }
}

// ─── Merge & sync ──────────────────────────────────────────────────

const stampMb = (mb) => ({ ...mb, updatedAt: Date.now() })

const sigMb = (mb) => {
  if (!mb) return ''
  // Excluye updatedAt para detectar cambios reales de contenido
  try {
    const { updatedAt, ...rest } = mb
    return JSON.stringify(rest)
  } catch {
    return ''
  }
}

const mergeMb = (a, b) => {
  const m = new Map()
  const push = (it) => {
    if (!it || !it.id) return
    const prev = m.get(it.id)
    if (!prev) { m.set(it.id, it); return }
    const ta = Number(it.updatedAt || 0)
    const tb = Number(prev.updatedAt || 0)
    m.set(it.id, ta >= tb ? it : prev)
  }
  for (const it of a || []) push(it)
  for (const it of b || []) push(it)
  return Array.from(m.values())
}

/**
 * Hook React: estado moodboards sincronizado cross-user.
 * Igual API que un useReducer (devuelve [state, dispatch, ready]).
 */
export function useSyncedMoodboards(reducer, fallback = []) {
  const cacheKey = 'cdp-moodboards-v1'
  const [moodboards, setMoodboards] = React.useState(() => {
    try { const s = localStorage.getItem(cacheKey); if (s) return JSON.parse(s) || [] }
    catch { /* ignore */ }
    return fallback
  })
  const [ready, setReady] = React.useState(false)
  const prevSigsRef = React.useRef(new Map()) // id → signature

  const dispatch = React.useCallback((action) => {
    setMoodboards(prev => {
      const next = reducer(prev, action)
      // Marcar updatedAt para los que cambiaron
      const prevById = new Map(prev.map(m => [m.id, m]))
      return next.map(mb => {
        const old = prevById.get(mb.id)
        if (!old || sigMb(old) !== sigMb(mb)) return stampMb(mb)
        return mb
      })
    })
  }, [reducer])

  // Hidratación inicial
  React.useEffect(() => {
    let live = true
    ;(async () => {
      const remote = await listMoodboards()
      if (!live) return
      const seed = (() => {
        try { const s = localStorage.getItem(cacheKey); if (s) return JSON.parse(s) || [] }
        catch { /* ignore */ }
        return fallback
      })()
      const merged = remote == null ? seed : mergeMb(seed, remote)
      setMoodboards(merged)
      const sigs = new Map()
      for (const mb of merged) sigs.set(mb.id, sigMb(mb))
      prevSigsRef.current = sigs
      setReady(true)
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persistir cambios: PUT por moodboard cambiado (debounced)
  React.useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(cacheKey, JSON.stringify(moodboards)) } catch { /* ignore */ }
    const changed = []
    const sigs = new Map()
    for (const mb of moodboards) {
      const sig = sigMb(mb)
      sigs.set(mb.id, sig)
      if (prevSigsRef.current.get(mb.id) !== sig) changed.push(mb)
    }
    // Detectar deletes
    const deleted = []
    for (const id of prevSigsRef.current.keys()) {
      if (!sigs.has(id)) deleted.push(id)
    }
    if (!changed.length && !deleted.length) return
    const t = setTimeout(async () => {
      prevSigsRef.current = sigs
      for (const mb of changed) {
        await upsertMoodboard(mb)
      }
      for (const id of deleted) {
        await deleteMoodboardRemote(id)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [moodboards, ready])

  // Polling cross-user
  React.useEffect(() => {
    if (!ready) return
    const id = setInterval(async () => {
      const remote = await listMoodboards()
      if (remote == null) return
      setMoodboards(prev => {
        const merged = mergeMb(prev, remote)
        // Si nada cambió, no re-renderizar
        try {
          if (JSON.stringify(merged) === JSON.stringify(prev)) return prev
        } catch { /* ignore */ }
        // Actualizar firmas de referencia para no re-PUTear lo que vino del server
        const sigs = new Map()
        for (const mb of merged) sigs.set(mb.id, sigMb(mb))
        prevSigsRef.current = sigs
        return merged
      })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [ready])

  return [moodboards, dispatch, ready]
}
