# ──────────────────────────────────────────────────────────────────────────
# Cliender Desing Pro V1 — Backend FastAPI + LangGraph
# Puerto interno: 8000 · Puerto host: 3003 (categoría APIs)
# Cerebro: Anthropic Claude · Músculo: KIE.ai (lista cerrada de modelos)
# ──────────────────────────────────────────────────────────────────────────
FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      build-essential ffmpeg \
      fontconfig fonts-open-sans fonts-liberation \
 && fc-cache -fv \
 && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
RUN pip install --upgrade pip \
 && pip install \
      "fastapi>=0.115" "uvicorn[standard]>=0.30" \
      "pydantic>=2.7" "pydantic-settings>=2.4" \
      "anthropic>=0.39" "langgraph>=0.2.50" "httpx>=0.27" \
      "sse-starlette>=2.1" "python-multipart>=0.0.9" \
      "slowapi>=0.1.9" "pillow>=10" \
      "faster-whisper>=1.0"

COPY app ./app
COPY tests ./tests

# Crear usuario sin privilegios (C6: no correr como root)
RUN groupadd -r cdpro && useradd -r -g cdpro -d /app -s /sbin/nologin cdpro \
 && chown -R cdpro:cdpro /app
USER cdpro

EXPOSE 8000

# Healthcheck con Python urllib (M1: no requiere curl en image final)
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=5 \
  CMD python -c "import urllib.request,sys; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3); sys.exit(0)" || exit 1

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
