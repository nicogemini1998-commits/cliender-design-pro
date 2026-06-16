import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Paleta Dark Premium
        bg:       "#0A0A0A",
        surface:  "#141414",
        line:     "#262626",
        dot:      "#1F1F1F",
        accent:   "#8B5CF6",   // morado eléctrico
        success:  "#10B981",   // verde neón
        danger:   "#EF4444",
      },
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
      boxShadow: {
        "glow-purple": "0 0 18px rgba(139,92,246,0.22)",
        "glow-purple-strong": "0 0 28px rgba(139,92,246,0.45)",
        "glow-green": "0 0 18px rgba(16,185,129,0.22)",
      },
      keyframes: {
        ledBreath: {
          "0%,100%": { opacity: ".5", transform: "scale(.92)" },
          "50%":     { opacity: "1",  transform: "scale(1.08)" },
        },
        edgeDashFlow: { to: { strokeDashoffset: "-28" } },
        shimmer:      { "0%": { transform: "translateX(-100%)" }, "100%": { transform: "translateX(100%)" } },
        fadeUp:       { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
      animation: {
        "led-breath": "ledBreath 1.4s ease-in-out infinite",
        "edge-flow":  "edgeDashFlow 1.4s linear infinite",
        shimmer:      "shimmer 1.8s linear infinite",
        "fade-up":    "fadeUp 0.4s cubic-bezier(0.22,1,0.36,1)",
      },
    },
  },
  plugins: [],
};

export default config;
