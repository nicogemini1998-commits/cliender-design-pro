# ──────────────────────────────────────────────────────────────────────────
# Cliender Desing Pro V1 — Prototipo HTML (nginx estático)
# Puerto interno: 80 · Puerto host: 2002 (categoría HTML/manuales)
# Sirve Canvas Prototype.html + Login.html + prototype/ (React vía CDN)
# ──────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

# JSON array form en COPY soporta espacios en el nombre del archivo
COPY ["Canvas Prototype.html", "/usr/share/nginx/html/index.html"]
COPY ["Login.html", "/usr/share/nginx/html/Login.html"]
COPY prototype /usr/share/nginx/html/prototype

# Fix permisos: OneDrive sync copia con 0700, nginx no podría leer (403)
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null || exit 1
