# ──────────────────────────────────────────────────────────────────────────
# Design Pro — HTML prototype (static nginx)
# Internal port: 80
# Serves Canvas Prototype.html + Login.html + prototype/ (React via CDN)
# ──────────────────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY nginx.conf /etc/nginx/conf.d/default.conf

# JSON array form in COPY supports spaces in the file name
COPY ["Canvas Prototype.html", "/usr/share/nginx/html/index.html"]
COPY ["Login.html", "/usr/share/nginx/html/Login.html"]
COPY prototype /usr/share/nginx/html/prototype

# Ensure files are world-readable so nginx can serve them
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=20s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/healthz >/dev/null || exit 1
