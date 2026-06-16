# ──────────────────────────────────────────────────────────────────────────
# Cliender Desing Pro V1 — Prototipo HTML (multi-stage)
# A1: JSX precompilado en build → SIN Babel en el navegador (arranque rápido,
#     ~1.5MB menos de descarga, cero transpilación en runtime).
# B2: build multi-stage → la imagen final (nginx) NO incluye node ni toolchain.
# Puerto interno: 80 · Puerto host: 2002 (categoría HTML/manuales)
# ──────────────────────────────────────────────────────────────────────────

# ── Stage 1: precompilar JSX → JS ───────────────────────────────────────────
# Se usa Babel (NO esbuild) a propósito: @babel/plugin-transform-block-scoping
# convierte const/let → var con hoisting, replicando EXACTAMENTE la semántica que
# daba @babel/standalone en el navegador. El código (App, 4800 líneas) declara
# effects/memos que dependen de estado declarado cientos de líneas después; con
# const/let reales (esbuild) eso es TDZ ("Cannot access X before initialization").
# Con var hoisted no hay TDZ. preset-react sólo transforma JSX; async/await y arrow
# quedan INTACTOS (no se necesita regenerator). Cada archivo se envuelve en un IIFE
# para aislar su scope (como hacía Babel por-script) — comparten sólo vía window.
FROM node:20-alpine AS jsxbuild
WORKDIR /src
RUN npm init -y >/dev/null 2>&1 && \
    npm i --no-audit --no-fund \
      @babel/core@7 @babel/cli@7 @babel/preset-react@7 @babel/plugin-transform-block-scoping@7
# CACHEBUST invalida solo el COPY+compile (npm install permanece cacheado)
ARG CACHEBUST=1
COPY prototype /src/prototype
RUN set -e; for f in nodes vault ui leftmenu analytics astronaut app; do \
      npx babel "/src/prototype/$f.jsx" \
        --presets @babel/preset-react \
        --plugins @babel/plugin-transform-block-scoping \
        -o "/tmp/$f.raw.js"; \
      { echo '(function(){'; cat "/tmp/$f.raw.js"; echo '})();'; } > "/src/prototype/$f.js"; \
    done; \
    rm -f /src/prototype/*.jsx /src/prototype/*.backup

# ── Stage 2: nginx estático (imagen final, sin node) ────────────────────────
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

# JSON array form en COPY soporta espacios en el nombre del archivo
COPY ["Canvas Prototype.html", "/usr/share/nginx/html/index.html"]
COPY ["Login.html", "/usr/share/nginx/html/Login.html"]
# prototype ya viene con los .js precompilados (sin .jsx, sin .backup)
COPY --from=jsxbuild /src/prototype /usr/share/nginx/html/prototype

# Fix permisos: OneDrive sync copia con 0700, nginx no podría leer (403)
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null || exit 1
