// Cliender Desing Pro V1 — runtime config (plain JS, loaded before Babel scripts)
// Resuelve la URL base de la API segun el entorno. Preparado para VPS web (HTTPS).
//   - Override explicito: define window.__CDPRO_API_BASE antes de cargar este script.
//   - localhost/127.0.0.1 (dev): http://localhost:3003
//   - HTTPS (VPS prod): mismo origen + "/api" -> el reverse proxy (nginx/Caddy) mapea
//     /api -> backend:8000. Evita mixed-content (https page no puede llamar a http:3003).
//   - HTTP no-local (fallback): host:3003 directo.
window.CDPRO_CONFIG = {
  API_BASE: (function () {
    if (typeof window.__CDPRO_API_BASE === "string" && window.__CDPRO_API_BASE) return window.__CDPRO_API_BASE;
    var h = window.location.hostname;
    if (h === "localhost" || h === "127.0.0.1") return "http://localhost:3003";
    if (window.location.protocol === "https:") return window.location.origin + "/api";
    return window.location.protocol + "//" + h + ":3003";
  })(),
};

// ──────────────────────────────────────────────────────────────────────
// __store — colecciones compartidas cross-user (Supabase Storage via backend).
//
// Colecciones soportadas: projects · agents · flow-templates · clients · moodboards
//
//   get(name)          → GET  /store/{name}        → items[] | null
//   put(name, items)   → PUT  /store/{name}        (debounced 800ms)
//   mergeById(a, b)    → merge por id, último updatedAt gana
//   poll(name, apply)  → cada 30s GET y merge → apply(mergedItems)
//   stopPoll(name)
//
// Estrategia conflictos: last-write-wins por item (NO full replace).
// Cuando un usuario edita y otro polls, mergeById elige por updatedAt.
// ──────────────────────────────────────────────────────────────────────
window.__store = {
  _timers: {},
  _polls: {},

  _api() {
    return (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "";
  },

  async get(collection) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort("store_timeout"), 12000); // nunca colgar el arranque si la red se estanca
    try {
      const r = await fetch(`${this._api()}/store/${collection}`, { cache: "no-store", signal: ctrl.signal });
      if (!r.ok) return null;
      const d = await r.json();
      return Array.isArray(d.items) ? d.items : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(t);
    }
  },

  put(collection, items) {
    clearTimeout(this._timers[collection]);
    this._timers[collection] = setTimeout(() => {
      var api = this._api();
      var payload = JSON.stringify({ items: Array.isArray(items) ? items : [] });
      // Intento + 2 reintentos con backoff (1s, 3s). Si los 3 fallan → aviso visible.
      // Antes el .catch(() => {}) silencioso podía perder cambios sin avisar a nadie.
      var BACKOFF_MS = [1000, 3000];
      var attempt = function (n) {
        fetch(api + "/store/" + collection, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
        })
          .then(function (r) {
            if (!r.ok) throw new Error("HTTP " + r.status);
          })
          .catch(function () {
            if (n < BACKOFF_MS.length) {
              setTimeout(function () { attempt(n + 1); }, BACKOFF_MS[n]);
              return;
            }
            window.__notify && window.__notify({
              kind: "error",
              icon: "⚠",
              title: "Guardado no confirmado",
              body: 'No se pudo sincronizar "' + collection + '" — tus cambios pueden perderse al recargar.',
            });
          });
      };
      attempt(0);
    }, 800);
  },

  mergeById(a, b) {
    const m = new Map();
    const push = (it) => {
      if (!it || !it.id) return;
      const prev = m.get(it.id);
      if (!prev) { m.set(it.id, it); return; }
      const ta = Number(it.updatedAt || it.createdAt || 0);
      const tb = Number(prev.updatedAt || prev.createdAt || 0);
      m.set(it.id, ta >= tb ? it : prev);
    };
    (a || []).forEach(push);
    (b || []).forEach(push);
    return Array.from(m.values());
  },

  /**
   * Iniciar polling de una colección. `apply(merged)` recibe la lista mergeada
   * y se llama solo si cambió frente a la última versión que vio.
   * Cancela el polling previo de la misma colección si existía.
   */
  poll(collection, apply, intervalMs = 30000) {
    this.stopPoll(collection);
    // M1: escalonar el arranque de las colecciones para no disparar ráfagas
    // simultáneas, y pausar cuando la pestaña está oculta (ahorra batería/red/backend).
    const _offsets = { agents: 0, projects: 1500, "flow-templates": 3000, clients: 4500 };
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      const remote = await this.get(collection);
      if (remote == null) return;
      apply(remote, () => {});
    };
    setTimeout(() => {
      tick();
      this._polls[collection] = setInterval(tick, intervalMs);
    }, _offsets[collection] || 0);
    // Al volver a primer plano, refrescar de inmediato (no esperar 30s).
    if (typeof document !== "undefined" && !this._visWired) {
      this._visWired = true;
      document.addEventListener("visibilitychange", () => {
        if (!document.hidden) Object.keys(this._polls).forEach((c) => this.get(c).then((r) => r && this._applies && this._applies[c] && this._applies[c](r, () => {})));
      });
    }
    this._applies = this._applies || {};
    this._applies[collection] = apply;
  },
  _pollOLD(collection, apply, intervalMs = 30000) {
    this.stopPoll(collection);
    let lastSig = "";
    const tick = async () => {
      const remote = await this.get(collection);
      if (remote == null) return;
      apply(remote, (signature) => { lastSig = signature; });
    };
    tick();
    this._polls[collection] = setInterval(tick, intervalMs);
  },

  stopPoll(collection) {
    if (this._polls[collection]) {
      clearInterval(this._polls[collection]);
      delete this._polls[collection];
    }
  },
};

// ──────────────────────────────────────────────────────────────────────
// __moodboards — Cross-user sync de moodboards via tabla Supabase dedicada.
//
// Distinto de __store.moodboards porque las imágenes viven en Supabase
// Storage (URLs públicas) y el manifest persiste con audit_status='ready'.
//
//   list()              → GET  /moodboards        → mb[] | null  (snake→camel ya mapeado)
//   upsert(mb)          → PUT  /moodboards/{id}   (debounced 800ms por id)
//   remove(id)          → DELETE /moodboards/{id}
//   poll(apply)         → cada 30s list + apply(mb[])
// ──────────────────────────────────────────────────────────────────────
window.__moodboards = {
  _timers: {},
  _poll: null,

  _api() {
    return (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "";
  },

  _toServer(mb) {
    return {
      id: mb.id,
      name: mb.name || "Untitled",
      images: (mb.images || []).map((i) => ({
        id: i.id, url: i.url, width: i.width ?? null, height: i.height ?? null,
      })),
      manifest: mb.manifest ? window.__moodboards._manifestToServer(mb.manifest) : null,
      audit_status: mb.auditStatus || "idle",
      locked: !!mb.locked,
    };
  },

  _toClient(row) {
    return {
      id: row.id,
      name: row.name,
      images: row.images || [],
      manifest: row.manifest ? (window._mapManifest ? window._mapManifest(row.manifest) : row.manifest) : null,
      auditStatus: row.audit_status || "idle",
      locked: !!row.locked,
      updatedAt: row.updated_at ? Date.parse(row.updated_at) : Date.now(),
    };
  },

  _manifestToServer(m) {
    // Convierte camelCase → snake_case. Si el manifest ya está en snake (vino del server),
    // se queda igual.
    const C2S = {
      moodboardId: "moodboard_id",
      colorPalette: "color_palette",
      lightingStyle: "lighting_style",
      cameraLensFeel: "camera_lens_feel",
      characterTraits: "character_traits",
      compositionRules: "composition_rules",
      moodKeywords: "mood_keywords",
      masterStylePrompt: "master_style_prompt",
      negativePrompt: "negative_prompt",
      consistencyScore: "consistency_score",
      filtersEffects: "filters_effects",
      compositionLayers: "composition_layers",
      colorGrading: "color_grading",
      textContent: "text_content",
    };
    const out = {};
    for (const k of Object.keys(m || {})) out[C2S[k] || k] = m[k];
    return out;
  },

  async list() {
    try {
      const r = await fetch(`${this._api()}/moodboards`, { cache: "no-store" });
      if (!r.ok) return null;
      const d = await r.json();
      return Array.isArray(d) ? d.map(window.__moodboards._toClient) : null;
    } catch (e) {
      return null;
    }
  },

  /** Upsert por moodboard (debounced por id, no full collection).
   * Retry 1s/3s + aviso al agotar — un manifest de un audit de 3-6 min no puede
   * perderse en silencio. `_gens` invalida reintentos viejos si llega un upsert
   * o remove más nuevo del mismo id (no regresionar el server con payload viejo). */
  upsert(mb) {
    if (!mb || !mb.id) return;
    const id = mb.id;
    clearTimeout(this._timers[id]);
    this._gens = this._gens || {};
    const gen = (this._gens[id] = (this._gens[id] || 0) + 1);
    this._timers[id] = setTimeout(() => {
      const api = this._api();
      const payload = JSON.stringify(window.__moodboards._toServer(mb));
      const BACKOFF_MS = [1000, 3000];
      const attempt = (n) => {
        if (window.__moodboards._gens[id] !== gen) return; // supersedido
        fetch(api + "/moodboards/" + encodeURIComponent(id), {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: payload,
        })
          .then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); })
          .catch(() => {
            if (n < BACKOFF_MS.length) { setTimeout(() => attempt(n + 1), BACKOFF_MS[n]); return; }
            window.__notify && window.__notify({
              kind: "error", icon: "⚠",
              title: "Moodboard no sincronizado",
              body: '"' + (mb.name || id) + '" no se pudo guardar en el servidor — toca el moodboard de nuevo para reintentar.',
            });
          });
      };
      attempt(0);
    }, 800);
  },

  remove(id) {
    if (!id) return;
    clearTimeout(this._timers[id]);
    this._gens = this._gens || {};
    this._gens[id] = (this._gens[id] || 0) + 1; // invalida upserts en vuelo de este id
    const BACKOFF_MS = [1000, 3000];
    const attempt = (n) => {
      fetch(this._api() + "/moodboards/" + encodeURIComponent(id), { method: "DELETE" })
        .then((r) => { if (!r.ok && r.status !== 404) throw new Error("HTTP " + r.status); }) // 404 = ya borrado = éxito
        .catch(() => { if (n < BACKOFF_MS.length) setTimeout(() => attempt(n + 1), BACKOFF_MS[n]); });
      // Sin notify: el poll re-emite el DELETE cada 30s vía tombstone — avisar sería ruido.
    };
    attempt(0);
  },

  poll(apply, intervalMs = 30000) {
    if (this._poll) clearInterval(this._poll);
    const tick = async () => {
      if (typeof document !== "undefined" && document.hidden) return;  // M1: pausa en background
      const remote = await this.list();
      if (remote == null) return;
      apply(remote);
    };
    tick();
    this._poll = setInterval(tick, intervalMs);
    if (typeof document !== "undefined" && !this._visWired) {
      this._visWired = true;
      document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
    }
  },
  _pollOLD(apply, intervalMs = 30000) {
    if (this._poll) clearInterval(this._poll);
    const tick = async () => {
      const remote = await this.list();
      if (remote == null) return;
      apply(remote);
    };
    tick();
    this._poll = setInterval(tick, intervalMs);
  },

  stopPoll() {
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
  },
};
