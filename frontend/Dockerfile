# ──────────────────────────────────────────────────────────────────────────
# Cliender Desing Pro V1 — Prototipo HTML (multi-stage)
# A1: JSX precompilado con esbuild en build → SIN Babel en el navegador.
#     Arranque mucho más rápido, ~1.5MB menos de descarga, cero transpilación
#     en runtime. El flujo de dev sigue editando .jsx; el build los compila.
# B2: build multi-stage → la imagen final (nginx) NO incluye node ni toolchain.
# Puerto interno: 80 · Puerto host: 2002 (categoría HTML/manuales)
# ──────────────────────────────────────────────────────────────────────────

# ── Stage 1: precompilar JSX → JS (transform-only, sin bundle) ──────────────
FROM node:20-alpine AS jsxbuild
WORKDIR /src
RUN npm i -g esbuild@0.28.0
COPY prototype /src/prototype
# Cada .jsx → .js en su PROPIO scope (--format=iife): los archivos NO son módulos
# ESM y comparten sólo vía window (cada uno hace Object.assign(window,{...}) al final
# e importa con const X = window.X). El IIFE replica el aislamiento por-script que
# daba Babel-standalone y evita colisiones de top-level const (useState, Icon, …).
# React llega por UMD global (no por import); el orden de carga lo fija el HTML.
RUN set -e; for f in nodes vault ui leftmenu analytics astronaut app; do \
      esbuild "/src/prototype/$f.jsx" \
        --loader:.jsx=jsx --jsx=transform \
        --jsx-factory=React.createElement --jsx-fragment=React.Fragment \
        --format=iife --target=es2020 --outfile="/src/prototype/$f.js"; \
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
