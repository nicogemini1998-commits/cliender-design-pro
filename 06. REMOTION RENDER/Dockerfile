# Cliender DesignPro — Remotion render service
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation fonts-noto-color-emoji fonts-noto-cjk \
    libnss3 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 libcups2 \
    libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libasound2 libpango-1.0-0 libcairo2 \
    ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

ENV REMOTION_BROWSER_EXECUTABLE=/usr/bin/chromium
ENV PORT=4000
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY . .
EXPOSE 4000
CMD ["node", "server.js"]
