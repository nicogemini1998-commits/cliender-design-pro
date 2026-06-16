import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atelier Swarm — Cliender",
  description: "Infraestructura creativa y supercomputación autónoma — Cliender",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">{children}</body>
    </html>
  );
}
