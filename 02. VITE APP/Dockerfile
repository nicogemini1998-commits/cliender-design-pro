# ──────────────────────────────────────────────────────────────────────────
# Cliender Desing Pro V1 — Vite App (React 18 + Three.js + Blendy)
# Puerto interno: 80 (nginx)  ·  Puerto host: 1005 (bloque 1XXX UIs)
# Build con pnpm (lock incluido) · sirve estático con nginx
# ──────────────────────────────────────────────────────────────────────────

# Stage 1 — build
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

COPY package.json pnpm-lock.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm run build

# Stage 2 — runtime nginx
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/dist /usr/share/nginx/html

# SPA fallback + healthz
RUN printf '%s\n' \
  'server {' \
  '  listen 80 default_server;' \
  '  server_name _;' \
  '  root /usr/share/nginx/html;' \
  '  index index.html;' \
  '  location = /healthz { return 200 "ok"; add_header Content-Type text/plain; }' \
  '  location / { try_files $uri $uri/ /index.html; }' \
  '}' > /etc/nginx/conf.d/default.conf

RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null || exit 1
