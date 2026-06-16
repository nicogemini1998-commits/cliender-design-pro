# Plan de Deploy Web en VPS — Cliender Desing Pro (solo desktop)

> Objetivo: servir la herramienta en el VPS, accesible por navegador desktop (Windows, Linux, macOS · Chrome/Firefox/Safari/Edge). NO móvil/táctil.

---

## Estado actual (preparado)
- ✅ `config.js` resuelve `API_BASE` para 3 entornos: dev local, VPS HTTPS (`origin + /api`), override (`window.__CDPRO_API_BASE`). **Evita mixed-content** en HTTPS.
- ✅ Backend con auth por `CDPRO_API_KEY` (todos los métodos) + rate-limit + SSRF guard.
- ✅ Modales con prefijos `-webkit-` (Safari desktop OK).
- ✅ nginx sirve `.jsx` como `text/babel` con `no-store`.

## Lo que falta para producción web (en orden)

### 1. Reverse proxy con HTTPS (CRÍTICO)
En el VPS, delante de los containers, poner **Caddy** (TLS automático) o **nginx + certbot**:
```
dominio.com           → cdpro-prototype:80   (la UI)
dominio.com/api/*     → cdpro-backend:8000   (la API, quitando el prefijo /api)
```
Con esto `config.js` usa `https://dominio.com/api` automáticamente. Ejemplo Caddyfile:
```
dominio.com {
  handle /api/* {
    uri strip_prefix /api
    reverse_proxy cdpro-backend:8000
  }
  handle { reverse_proxy cdpro-prototype:80 }
}
```

### 2. Activar autenticación (CRÍTICO en VPS público)
- Definir `CDPRO_API_KEY` (≥32 chars) en el `.env` del backend.
- El frontend debe enviar `X-API-Key` en cada fetch. **PENDIENTE**: añadir el header en `config.js` (un wrapper de fetch) o inyectar la key tras login. Sin esto, con la key activa todo da 401.
- Alternativa interna: limitar por IP/VPN en el reverse proxy en lugar de API key.

### 3. CSP de producción
- `nginx.conf` ya tiene CSP con `unpkg.com` (React/Babel CDN) y `unsafe-eval` (Babel runtime).
- Para endurecer: self-hostear React + Babel (copiar los UMD a `/vendor/`) y quitar `unpkg.com` del CSP. `unsafe-eval` solo se elimina al pre-compilar (ver punto 5).

### 4. Cross-browser desktop (verificar)
- Probar en Chrome, Firefox, Safari, Edge: canvas (pan/zoom/drag con ratón), generación, galería, modales.
- Riesgo bajo: el stack es React UMD estándar. `backdrop-filter` ya con `-webkit-`.

### 5. Rendimiento / carga rápida (mejora mayor, futura)
- Hoy: Babel transpila ~6000 líneas JSX **en el navegador** → 1-3s de arranque.
- Producción ideal: migrar a la build **Next.js** (`02. PRODUCCION NEXTJS/`) → bundle compilado, code-splitting, sin Babel runtime, sin `unsafe-eval`. Carga 5-10× más rápida.
- Mientras tanto (quick win): minificar los `.jsx` no es trivial con Babel-in-browser; el mayor salto es la compilación Next.js.

## Checklist de salida a VPS
- [ ] Reverse proxy HTTPS (Caddy/nginx+certbot) con `/api` → backend
- [ ] `CDPRO_API_KEY` definida + header en frontend (o restricción por IP/VPN)
- [ ] `.env` del backend con `ANTHROPIC_API_KEY`, `KID_AI_API_KEY`, Supabase
- [ ] `environment=prod` (desactiva /docs)
- [ ] CSP revisada (self-host vendor o SRI)
- [ ] Smoke test cross-browser desktop
- [ ] Backups de Supabase (galería, moodboards, store)
