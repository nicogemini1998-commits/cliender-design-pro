/**
 * Cross-user store client — habla con `/store/{collection}` del backend.
 *
 * El backend guarda cada colección como un único JSON en Supabase Storage
 * (`brand-assets/store/{collection}.json`). Estrategia:
 *   - GET hidrata al montar.
 *   - PUT debounced (700ms) cuando cambia el estado local.
 *   - Polling cada 30s + merge por id (último `updatedAt` gana por item).
 *
 * Esto evita "lo que hace un usuario no le sale a otros" y la pérdida
 * de items por last-write-wins cuando dos editan simultáneamente.
 *
 * Colecciones permitidas por el backend (whitelist en store.py):
 *   projects · agents · flow-templates · clients · moodboards
 */
import React from 'react'
import { CDPRO_CONFIG } from '../config'

const POLL_MS = 30_000
const DEBOUNCE_MS = 700

const base = () => CDPRO_CONFIG.API_BASE || ''

export async function getCollection(name) {
  try {
    const r = await fetch(`${base()}/store/${name}`, { cache: 'no-store' })
    if (!r.ok) return null
    const d = await r.json()
    return Array.isArray(d?.items) ? d.items : []
  } catch {
    return null
  }
}

export async function putCollection(name, items) {
  try {
    const r = await fetch(`${base()}/store/${name}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: Array.isArray(items) ? items : [] }),
    })
    return r.ok
  } catch {
    return false
  }
}

/**
 * Merge dos listas de items por `id`. Gana el que tenga mayor `updatedAt`
 * (o `createdAt` como fallback). Items sin `id` se descartan silenciosamente.
 */
export function mergeById(a, b) {
  const m = new Map()
  const push = (it) => {
    if (!it || !it.id) return
    const prev = m.get(it.id)
    if (!prev) { m.set(it.id, it); return }
    const ta = Number(it.updatedAt || it.createdAt || 0)
    const tb = Number(prev.updatedAt || prev.createdAt || 0)
    m.set(it.id, ta >= tb ? it : prev)
  }
  for (const it of a || []) push(it)
  for (const it of b || []) push(it)
  return Array.from(m.values())
}

const sameJson = (a, b) => {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

/**
 * Hook React que sincroniza una colección con el backend.
 *
 * @param {string} collection Nombre del recurso (debe estar en la whitelist).
 * @param {Array}  fallback   Datos seed si el servidor está vacío y no hay cache.
 * @returns {[items, setItems, ready]}
 */
export function useSyncedCollection(collection, fallback = []) {
  const cacheKey = `store-cache:${collection}`
  const [items, setItems] = React.useState(() => {
    try { const s = localStorage.getItem(cacheKey); if (s) return JSON.parse(s) || [] }
    catch { /* ignore */ }
    return fallback
  })
  const [ready, setReady] = React.useState(false)
  const lastSentRef = React.useRef('')

  // Hidratación inicial: GET + merge contra cache/fallback
  React.useEffect(() => {
    let live = true
    ;(async () => {
      const remote = await getCollection(collection)
      if (!live) return
      const seed = (() => {
        try { const s = localStorage.getItem(cacheKey); if (s) return JSON.parse(s) || [] }
        catch { /* ignore */ }
        return fallback
      })()
      const merged = remote == null ? seed : mergeById(seed, remote)
      setItems(merged)
      lastSentRef.current = JSON.stringify(merged)
      setReady(true)
    })()
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection])

  // Debounced PUT al backend + cache local
  React.useEffect(() => {
    if (!ready) return
    try { localStorage.setItem(cacheKey, JSON.stringify(items)) } catch { /* ignore */ }
    const serialized = JSON.stringify(items)
    if (serialized === lastSentRef.current) return
    const t = setTimeout(() => {
      lastSentRef.current = serialized
      putCollection(collection, items)
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, items, ready])

  // Polling cross-user
  React.useEffect(() => {
    if (!ready) return
    const id = setInterval(async () => {
      const remote = await getCollection(collection)
      if (remote == null) return
      setItems(prev => {
        const merged = mergeById(prev, remote)
        return sameJson(merged, prev) ? prev : merged
      })
    }, POLL_MS)
    return () => clearInterval(id)
  }, [collection, ready])

  return [items, setItems, ready]
}

/**
 * Stamp helper: marca un item como "modificado ahora" para que el merge
 * por updatedAt lo elija frente a versiones remotas más antiguas.
 */
export const stamp = (item) => ({ ...item, updatedAt: Date.now() })
