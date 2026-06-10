// Cliender DesignPro — servicio de ensamblaje de video con Remotion
// POST /render { scenes:[{url,durationInFrames,caption,muted}], brand:{name,logoUrl,accent}, fps, width, height }
//   → renderiza mp4, lo sube a Supabase brand-assets/renders/, devuelve { url, durationInFrames, fps }
// GET /health → { status:"ok", bundled:bool }
const express = require("express");
const path = require("path");
const fs = require("fs");
const os = require("os");

const { bundle } = require("@remotion/bundler");
const { renderMedia, selectComposition, ensureBrowser } = require("@remotion/renderer");

const PORT = process.env.PORT || 4000;
const SUPABASE_URL = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || "";
const BROWSER_EXECUTABLE = process.env.REMOTION_BROWSER_EXECUTABLE || "/usr/bin/chromium";

const app = express();
app.use(express.json({ limit: "8mb" }));

let _bundlePromise = null;
function getBundle() {
  if (!_bundlePromise) {
    _bundlePromise = bundle({
      entryPoint: path.join(__dirname, "src", "index.jsx"),
      // webpackOverride: (c) => c,
    }).catch((e) => { _bundlePromise = null; throw e; });
  }
  return _bundlePromise;
}

async function uploadToSupabase(localPath, name) {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null; // sin Supabase configurado → devolver null, el caller sirve archivo local
  }
  const data = fs.readFileSync(localPath);
  const dest = `${SUPABASE_URL}/storage/v1/object/brand-assets/renders/${name}`;
  const res = await fetch(dest, {
    method: "POST",
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "video/mp4",
      "x-upsert": "true",
    },
    body: data,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Supabase upload ${res.status}: ${t.slice(0, 200)}`);
  }
  return `${SUPABASE_URL}/storage/v1/object/public/brand-assets/renders/${name}`;
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", bundled: !!_bundlePromise });
});

// servir archivos locales como fallback si no hay Supabase
const OUT_DIR = path.join(os.tmpdir(), "cdpro-renders");
fs.mkdirSync(OUT_DIR, { recursive: true });
app.use("/files", express.static(OUT_DIR));

app.post("/render", async (req, res) => {
  const t0 = Date.now();
  try {
    const body = req.body || {};
    const scenes = Array.isArray(body.scenes) ? body.scenes.filter((s) => s && s.url) : [];
    if (scenes.length === 0) {
      return res.status(400).json({ error: "scenes vacío: se requiere al menos 1 escena con url" });
    }
    const fps = Number(body.fps) || 30;
    const inputProps = {
      scenes: scenes.map((s) => ({
        url: String(s.url),
        kind: s.kind ? String(s.kind) : undefined,
        durationInFrames: Number(s.durationInFrames) || fps * 5,
        caption: s.caption ? String(s.caption) : "",
        muted: s.muted !== false,
        transition: s.transition ? String(s.transition) : undefined,
        transitionDurationInFrames: Number(s.transitionDurationInFrames) > 0 ? Number(s.transitionDurationInFrames) : undefined,
        kenburns: s.kenburns ? String(s.kenburns) : undefined,
      })),
      brand: body.brand || {},
      style: body.style || {},
      fps,
      width: Number(body.width) || 1080,
      height: Number(body.height) || 1920,
    };

    await ensureBrowser().catch(() => {});
    const serveUrl = await getBundle();
    const composition = await selectComposition({
      serveUrl,
      id: "Stitch",
      inputProps,
      browserExecutable: BROWSER_EXECUTABLE,
    });

    const name = `cdpro-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.mp4`;
    const outputLocation = path.join(OUT_DIR, name);

    await renderMedia({
      composition,
      serveUrl,
      codec: "h264",
      outputLocation,
      inputProps,
      browserExecutable: BROWSER_EXECUTABLE,
      concurrency: 2,
      chromiumOptions: { gl: "swiftshader" },
    });

    let url = null;
    try {
      url = await uploadToSupabase(outputLocation, name);
    } catch (e) {
      console.warn("[render] supabase upload failed:", e.message);
    }
    if (!url) {
      const host = req.headers["x-forwarded-host"] || req.headers.host || `localhost:${PORT}`;
      url = `http://${host}/files/${name}`;
    }

    res.json({
      url,
      durationInFrames: composition.durationInFrames,
      fps: composition.fps,
      width: composition.width,
      height: composition.height,
      ms: Date.now() - t0,
    });
  } catch (err) {
    console.error("[render] error:", err);
    res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[cdpro-remotion] listening on :${PORT}`);
  // pre-bundle en background para acelerar el primer render
  getBundle().then(() => console.log("[cdpro-remotion] bundle ready")).catch((e) => console.warn("bundle warm failed", e.message));
});
