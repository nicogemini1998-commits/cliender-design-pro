import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen w-screen overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_25%_20%,rgba(167,139,250,0.18),transparent_55%),radial-gradient(circle_at_80%_80%,rgba(52,211,153,0.10),transparent_55%)]" />
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col items-start justify-center gap-10 px-8">
        <div className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-[var(--text-muted)]">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-violet)]" />
          Atelier Swarm · Cliender
        </div>
        <h1 className="text-5xl font-medium leading-tight tracking-tight md:text-6xl">
          Infraestructura creativa y
          <br />
          <span className="text-[var(--accent-violet)]">supercomputación autónoma</span>.
        </h1>
        <p className="max-w-xl text-base text-[var(--text-muted)]">
          Lienzo infinito de nodos editables + enjambre de 5 agentes Claude que orquestan generación
          visual estrictamente en Kid.ai. Liquid Glass · Style Vault · Multi-cliente.
        </p>
        <div className="flex gap-3">
          <Link
            href="/canvas"
            className="rounded-full bg-[var(--accent-violet)] px-5 py-2.5 text-sm font-medium text-black transition hover:scale-[1.02]"
          >
            Abrir Canvas →
          </Link>
          <a
            href="/api/atelier/health"
            className="rounded-full border border-[var(--border)] px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] transition hover:bg-white/5"
          >
            Backend health
          </a>
        </div>
        <p className="mt-4 text-xs text-[var(--text-muted)]">
          ¿Quieres ver el prototipo HTML original? →{" "}
          <a href="http://localhost:2002" className="underline">
            http://localhost:2002
          </a>
        </p>
      </div>
    </main>
  );
}
