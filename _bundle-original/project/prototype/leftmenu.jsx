// Hoist from sibling babel scripts
const Icon = window.Icon;
const StatusDot = window.StatusDot;

/* prototype/leftmenu.jsx
 * LeftRail — barra vertical de iconos en el borde izquierdo
 * NodesPanel — drawer con los 4 botones para añadir nodos
 *
 * Galería y Moodboard se abren reusando sus paneles existentes (vault.jsx y ui.jsx)
 * pero se montan como drawers izquierdos (CSS overriden en leftmenu.css).
 */

// ---------------------------------------------------------------------------
// Left rail icons (heroicons-flavoured, original drawings)
// ---------------------------------------------------------------------------
const RailIcons = {
  Nodes: (p) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="9" width="6" height="6" rx="1.5" />
      <rect x="15" y="3" width="6" height="6" rx="1.5" />
      <rect x="15" y="15" width="6" height="6" rx="1.5" />
      <path d="M9 12h3M12 12V6h3M12 12v6h3" />
    </svg>,

  Moodboard: (p) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M12 3a8 8 0 1 0 0 16 3 3 0 0 1 0 6 11 11 0 1 1 0-22z" />
      <circle cx="7" cy="13" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="17" cy="13" r="1.4" fill="currentColor" stroke="none" />
    </svg>,

  Gallery: (p) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </svg>,

  Clients: (p) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3 20c0-3 2.7-5 6-5s6 2 6 5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M14.5 19c.3-2.2 1.9-3.5 3.5-3.5 1.6 0 2.7 1 3 2.5" />
    </svg>,

  Projects: (p) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 11h18" />
    </svg>,

  Settings: (p) =>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .35 1.85l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.85-.35 1.7 1.7 0 0 0-1.05 1.55V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.85.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.55-1.05H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.35-1.85l-.06-.06A2 2 0 1 1 7.07 4.26l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.85-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1z" />
    </svg>

};

// ---------------------------------------------------------------------------
// Rail item
// ---------------------------------------------------------------------------
function RailItem({ icon, label, active, onClick, count, hotkey }) {
  return (
    <button
      type="button"
      className={"rail-item " + (active ? "is-active" : "")}
      onClick={onClick}
      title={label + (hotkey ? ` (${hotkey})` : "")}
      data-tip={label}>
      
      <div className="rail-item-icon">{icon}</div>
      {count > 0 && <div className="rail-item-badge mono">{count}</div>}
      {active && <span className="rail-item-marker" />}
    </button>);

}

// ---------------------------------------------------------------------------
// Left rail (the always-visible vertical icon bar)
// ---------------------------------------------------------------------------
function LeftRail({ activeTab, onTab, galleryCount, hasLockedMoodboard, clientsCount, projectsCount }) {
  return (
    <nav className="leftrail" data-comment-anchor="df1b74b7b0-nav-87-5">
      <RailItem
        icon={<RailIcons.Nodes width={22} height={22} />}
        label="Nodos"
        active={activeTab === "nodes"}
        onClick={() => onTab(activeTab === "nodes" ? null : "nodes")}
        hotkey="N" />
      
      <RailItem
        icon={<RailIcons.Clients width={22} height={22} />}
        label="Clientes"
        active={activeTab === "clients"}
        onClick={() => onTab(activeTab === "clients" ? null : "clients")}
        hotkey="C"
        count={clientsCount} />
      
      <RailItem
        icon={<RailIcons.Projects width={22} height={22} />}
        label="Proyectos"
        active={activeTab === "projects"}
        onClick={() => onTab(activeTab === "projects" ? null : "projects")}
        hotkey="P"
        count={projectsCount} />
      
      <RailItem
        icon={<RailIcons.Moodboard width={22} height={22} />}
        label="Moodboard"
        active={activeTab === "moodboard"}
        onClick={() => onTab(activeTab === "moodboard" ? null : "moodboard")}
        hotkey="M"
        count={hasLockedMoodboard ? 1 : 0} />
      
      <RailItem
        icon={<RailIcons.Gallery width={22} height={22} />}
        label="Galería"
        active={activeTab === "gallery"}
        onClick={() => onTab(activeTab === "gallery" ? null : "gallery")}
        hotkey="G"
        count={galleryCount} />
      
      <div className="rail-spacer" />
      <RailItem
        icon={<RailIcons.Settings width={20} height={20} />}
        label="Ajustes"
        active={activeTab === "settings"}
        onClick={() => onTab(activeTab === "settings" ? null : "settings")} />
      
    </nav>);

}

// ---------------------------------------------------------------------------
// NodesPanel — drawer contents para añadir nodos
// ---------------------------------------------------------------------------
function NodesPanel({ onAdd, onClose }) {
  const items = [
  { type: "prompt", label: "Prompt", hint: "Brief creativo", glyph: <Icon.PromptGlyph style={{ width: 28, height: 28 }} />, accent: "#6366F1" },
  { type: "image", label: "Imagen", hint: "Generación de imagen", glyph: <Icon.ImageGlyph style={{ width: 28, height: 28 }} />, accent: "#8B5CF6" },
  { type: "video", label: "Video", hint: "Generación de video", glyph: <Icon.VideoGlyph style={{ width: 28, height: 28 }} />, accent: "#10B981" },
  { type: "note", label: "Nota", hint: "Anotación libre", glyph: <Icon.NoteGlyph style={{ width: 28, height: 28 }} />, accent: "#F59E0B" }];

  return (
    <>
      <DrawerHeader title="Nodos" subtitle="añadir al canvas" onClose={onClose} />
      <div className="drawer-body scroll-thin">
        <div className="drawer-section-label mono">Generadores</div>
        <div className="nodes-list">
          {items.filter((i) => i.type !== "note").map((it) =>
          <NodeAddCard key={it.type} item={it} onAdd={() => onAdd(it.type)} />
          )}
        </div>
        <div className="drawer-section-label mono" style={{ marginTop: 16 }}>Anotación</div>
        <div className="nodes-list">
          {items.filter((i) => i.type === "note").map((it) =>
          <NodeAddCard key={it.type} item={it} onAdd={() => onAdd(it.type)} />
          )}
        </div>

        <div className="drawer-section-label mono" style={{ marginTop: 22 }}>Plantillas</div>
        <div className="nodes-list">
          <TemplateCard
            title="Producto editorial"
            subtitle="Prompt → Imagen (gpt-imagenes-2)"
            colors={["#6366F1", "#8B5CF6"]}
            onUse={() => window.__addTemplate?.("product-editorial")} />
          
          <TemplateCard
            title="Reel vertical"
            subtitle="Prompt → Video (seedance-2.0)"
            colors={["#6366F1", "#10B981"]}
            onUse={() => window.__addTemplate?.("reel-vertical")} />
          
          <TemplateCard
            title="Storyboard 3 frames"
            subtitle="Prompt → 3× Imagen + Nota"
            colors={["#6366F1", "#8B5CF6", "#F59E0B"]}
            onUse={() => window.__addTemplate?.("storyboard")} />
          
        </div>
      </div>
    </>);

}

function NodeAddCard({ item, onAdd }) {
  return (
    <button className="node-add-card" onClick={onAdd} style={{ "--add-c": item.accent }}>
      <div className="node-add-icon">{item.glyph}</div>
      <div className="node-add-meta">
        <div className="node-add-title">{item.label}</div>
        <div className="node-add-hint mono">{item.hint}</div>
      </div>
      <div className="node-add-plus">+</div>
    </button>);

}

function TemplateCard({ title, subtitle, colors, onUse }) {
  return (
    <button className="tpl-card" onClick={onUse}>
      <div className="tpl-icons">
        {colors.map((c, i) =>
        <span key={i} className="tpl-dot" style={{ background: c, boxShadow: `0 0 8px ${c}66`, marginLeft: i ? -6 : 0 }} />
        )}
      </div>
      <div className="tpl-meta">
        <div className="tpl-title">{title}</div>
        <div className="tpl-sub mono">{subtitle}</div>
      </div>
      <div className="tpl-arrow">→</div>
    </button>);

}

// ---------------------------------------------------------------------------
// Drawer chrome (header reused across all drawer contents)
// ---------------------------------------------------------------------------
function DrawerHeader({ title, subtitle, onClose }) {
  return (
    <div className="drawer-head">
      <div>
        <div className="drawer-title">{title}</div>
        {subtitle && <div className="drawer-kicker mono">{subtitle}</div>}
      </div>
      <button className="super-close" onClick={onClose} aria-label="cerrar">✕</button>
    </div>);

}

// ---------------------------------------------------------------------------
// Sample clients — pre-cargados para demo
// ---------------------------------------------------------------------------
const SAMPLE_CLIENTS = [
{
  id: "cl-neo",
  name: "Neo Studio",
  initials: "NS",
  industry: "Tech / SaaS",
  tagline: "Tools for thinking",
  contact: { name: "Mira Chen", email: "mira@neostudio.io", role: "Brand Director" },
  palette: ["#0F1018", "#7C5CFF", "#22D3EE", "#F4F4F5"],
  typography: { display: "Söhne", text: "Söhne", mono: "Berkeley Mono" },
  voice: ["preciso", "técnico", "calmado", "anti-hype"],
  dont: ["emojis", "exclamaciones", "frases vacías"],
  accent: "#7C5CFF",
  bgGradient: "linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)",
  references: ["linear.app", "vercel.com", "raycast.com"],
  projects: 12,
  activeBoardId: "mb-neon-tokyo"
},
{
  id: "cl-lumiere",
  name: "Atelier Lumière",
  initials: "AL",
  industry: "Luxury / Fashion",
  tagline: "Heritage in light",
  contact: { name: "Henri Vasseur", email: "h.vasseur@lumiere.fr", role: "Creative Lead" },
  palette: ["#1A0F08", "#A47551", "#D9B58C", "#F2E3CB"],
  typography: { display: "GT Sectra", text: "Söhne", mono: "JetBrains Mono" },
  voice: ["editorial", "refinado", "discreto", "atemporal"],
  dont: ["jerga", "abreviaciones", "trending words"],
  accent: "#D9B58C",
  bgGradient: "linear-gradient(135deg, #5C3D2E 0%, #D9B58C 100%)",
  references: ["loropiana.com", "hermes.com", "cabana-magazine.com"],
  projects: 7,
  activeBoardId: "mb-warm-editorial"
},
{
  id: "cl-verde",
  name: "Verde Botánica",
  initials: "VB",
  industry: "Wellness / Sustainable",
  tagline: "Slow goods, deeply made",
  contact: { name: "Alma Ortiz", email: "alma@verdebotanica.mx", role: "Founder" },
  palette: ["#1E2419", "#3F5E3A", "#A4C29A", "#F4F1E8"],
  typography: { display: "Editorial New", text: "Söhne", mono: "JetBrains Mono" },
  voice: ["sereno", "honesto", "táctil", "didáctico"],
  dont: ["greenwashing", "superlativos", "stock imagery"],
  accent: "#A4C29A",
  bgGradient: "linear-gradient(135deg, #3F5E3A 0%, #A4C29A 100%)",
  references: ["aesop.com", "byredo.com", "officinaprofumo.it"],
  projects: 4,
  activeBoardId: null
}];


// ---------------------------------------------------------------------------
// ClientsPanel — listado y detalle
// ---------------------------------------------------------------------------
function ClientsPanel({ clients, activeClientId, setActiveClientId, onClose, onOpenCreate }) {
  const active = clients.find((c) => c.id === activeClientId);
  return (
    <>
      <DrawerHeader
        title={active ? active.name : "Clientes"}
        subtitle={active ? active.industry : "marcas conectadas a Claude"}
        onClose={onClose} />
      
      <div className="drawer-body scroll-thin">
        {active ?
        <ClientDetail client={active} onBack={() => setActiveClientId(null)} /> :

        <>
            <div className="claude-bridge">
              <div className="claude-bridge-icon">✦</div>
              <div className="claude-bridge-text">
                <div className="claude-bridge-title">Conectado al cerebro Claude</div>
                <div className="claude-bridge-sub mono">contexto completo · brand DNA · consistencia</div>
              </div>
              <span className="claude-bridge-dot" />
            </div>
            <div className="drawer-section-label mono">Activos</div>
            <div className="clients-list">
              {clients.map((c) =>
            <ClientCard key={c.id} client={c} onClick={() => setActiveClientId(c.id)} />
            )}
            </div>
            <div className="empty-state" style={{ marginTop: 18, padding: "18px 16px" }}>
              <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase" }}>auto-sync</div>
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
                Los clientes se sincronizan automáticamente desde la memoria central.
              </div>
            </div>
          </>
        }
      </div>
    </>);

}

function ClientCard({ client, onClick }) {
  return (
    <button className="client-card" onClick={onClick}>
      <div className="client-avatar" style={{ background: client.bgGradient }}>
        <span className="client-avatar-text">{client.initials}</span>
      </div>
      <div className="client-card-meta">
        <div className="client-card-name">{client.name}</div>
        <div className="client-card-sub mono">{client.industry}</div>
      </div>
      <div className="client-card-side">
        <div className="client-palette-mini">
          {client.palette.slice(0, 4).map((c, i) =>
          <span key={i} style={{ background: c }} />
          )}
        </div>
        <span className="client-projects mono">{client.projects} flows</span>
      </div>
    </button>);

}

function ClientDetail({ client, onBack }) {
  return (
    <div className="client-detail">
      <button className="client-back" onClick={onBack}>
        <span style={{ fontSize: 12 }}>←</span> Volver
      </button>

      {/* Dashboard hero */}
      <div className="client-dash">
        <div className="client-dash-row">
          <div className="client-dash-card">
            <div className="client-dash-kpi-label mono">flows totales</div>
            <div className="client-dash-kpi-val">{client.projects || 0}</div>
          </div>
          <div className="client-dash-card">
            <div className="client-dash-kpi-label mono">consistencia</div>
            <div className="client-dash-kpi-val">94<span style={{ fontSize: 14, color: "var(--text-3)" }}>%</span></div>
          </div>
          <div className="client-dash-card">
            <div className="client-dash-kpi-label mono">moodboards</div>
            <div className="client-dash-kpi-val">{client.activeBoardId ? 3 : 0}</div>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="client-hero" style={{ background: client.bgGradient }}>
        <div className="client-hero-fade" />
        <div className="client-hero-content">
          <div className="client-hero-initials">{client.initials}</div>
          <div className="client-hero-text">
            <div className="client-hero-name">{client.name}</div>
            <div className="client-hero-tagline">"{client.tagline}"</div>
          </div>
        </div>
      </div>

      {/* Quick info */}
      <div className="client-stats">
        <Stat label="Industria" value={client.industry} />
        <Stat label="Flows" value={client.projects} />
        <Stat label="Moodboard" value={client.activeBoardId ? "activo" : "—"} />
      </div>

      {/* Contact */}
      <Section label="Contacto">
        <div className="client-contact">
          <div className="client-contact-avatar">{client.contact.name.split(" ").map((p) => p[0]).join("")}</div>
          <div>
            <div className="client-contact-name">{client.contact.name}</div>
            <div className="client-contact-role mono">{client.contact.role}</div>
            <a className="client-contact-email" href={`mailto:${client.contact.email}`}>{client.contact.email}</a>
          </div>
        </div>
      </Section>

      {/* Palette */}
      <Section label="Paleta de marca">
        <div className="client-palette">
          {client.palette.map((c) =>
          <div key={c} className="client-swatch">
              <div className="client-swatch-color" style={{ background: c }} />
              <div className="mono client-swatch-hex">{c}</div>
            </div>
          )}
        </div>
      </Section>

      {/* Typography */}
      <Section label="Tipografía">
        <div className="client-typo">
          <TypoRow label="display" name={client.typography.display} />
          <TypoRow label="texto" name={client.typography.text} />
          <TypoRow label="mono" name={client.typography.mono} />
        </div>
      </Section>

      {/* Voice */}
      <Section label="Voz de marca">
        <div className="client-tags">
          {client.voice.map((v) => <span key={v} className="client-tag client-tag-good">{v}</span>)}
        </div>
      </Section>

      <Section label="Anti-patrones">
        <div className="client-tags">
          {client.dont.map((v) => <span key={v} className="client-tag client-tag-bad">— {v}</span>)}
        </div>
      </Section>

      {/* References */}
      <Section label="Referencias">
        <div className="client-refs">
          {client.references.map((r) =>
          <a key={r} className="client-ref" href={`https://${r}`} target="_blank" rel="noopener">
              <span className="client-ref-dot" />
              <span className="mono">{r}</span>
              <span className="client-ref-arrow">↗</span>
            </a>
          )}
        </div>
      </Section>

      <div className="client-actions">
        <button className="btn-soft">
          <Icon.Sparkles style={{ width: 12, height: 12 }} />
          Usar contexto en próximo flow
        </button>
      </div>
    </div>);

}

function Stat({ label, value }) {
  return (
    <div className="stat-cell">
      <div className="stat-label mono">{label}</div>
      <div className="stat-value">{value}</div>
    </div>);

}
function Section({ label, children }) {
  return (
    <div className="client-section">
      <div className="drawer-section-label mono">{label}</div>
      {children}
    </div>);

}
function TypoRow({ label, name }) {
  return (
    <div className="typo-row">
      <span className="mono typo-label">{label}</span>
      <span className="typo-name">{name}</span>
    </div>);

}

// ---------------------------------------------------------------------------
// NewClientForm — formulario completo y elegante
// ---------------------------------------------------------------------------
const ACCENT_PRESETS = [
{ name: "Violet", accent: "#7C5CFF", bg: "linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)" },
{ name: "Amber", accent: "#F59E0B", bg: "linear-gradient(135deg, #F59E0B 0%, #FB7185 100%)" },
{ name: "Emerald", accent: "#10B981", bg: "linear-gradient(135deg, #065F46 0%, #A4C29A 100%)" },
{ name: "Ocean", accent: "#0EA5E9", bg: "linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)" },
{ name: "Sand", accent: "#A47551", bg: "linear-gradient(135deg, #5C3D2E 0%, #D9B58C 100%)" },
{ name: "Carbon", accent: "#A1A1AA", bg: "linear-gradient(135deg, #18181B 0%, #71717A 100%)" }];

const INDUSTRY_OPTIONS = [
"Tech / SaaS", "Luxury / Fashion", "Wellness / Sustainable", "F&B / Hospitality",
"Finance / Fintech", "Media / Entertainment", "Beauty / Cosmetics", "Real Estate / Architecture"];


function NewClientForm({ onCreate, onCancel }) {
  const [step, setStep] = React.useState(1);
  const [data, setData] = React.useState({
    name: "",
    initials: "",
    industry: "Tech / SaaS",
    tagline: "",
    contactName: "",
    contactRole: "",
    contactEmail: "",
    palette: ["#0F1018", "#7C5CFF", "#22D3EE", "#F4F4F5"],
    typeDisplay: "Söhne",
    typeText: "Söhne",
    typeMono: "JetBrains Mono",
    voiceTags: ["preciso", "calmado"],
    dontTags: [],
    references: "",
    accentPreset: ACCENT_PRESETS[0]
  });
  const set = (patch) => setData((d) => ({ ...d, ...patch }));

  // auto initials
  React.useEffect(() => {
    if (data.name && !data.initials) {
      const init = data.name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
      if (init) set({ initials: init });
    }
  }, [data.name]);

  const canStep1 = data.name.trim().length >= 2 && data.industry;
  const canStep2 = true; // contact opcional
  const canFinish = canStep1;

  const finish = () => {
    onCreate({
      id: "cl-" + Math.random().toString(36).slice(2, 8),
      name: data.name.trim(),
      initials: (data.initials || data.name.slice(0, 2)).toUpperCase().slice(0, 2),
      industry: data.industry,
      tagline: data.tagline.trim(),
      contact: {
        name: data.contactName.trim(),
        email: data.contactEmail.trim(),
        role: data.contactRole.trim()
      },
      palette: data.palette,
      typography: { display: data.typeDisplay, text: data.typeText, mono: data.typeMono },
      voice: data.voiceTags,
      dont: data.dontTags,
      accent: data.accentPreset.accent,
      bgGradient: data.accentPreset.bg,
      references: data.references.split(",").map((r) => r.trim()).filter(Boolean),
      projects: 0,
      activeBoardId: null
    });
  };

  return (
    <div className="form-stage">
      {/* Live preview hero */}
      <div className="form-hero" style={{ background: data.accentPreset.bg }}>
        <div className="form-hero-fade" />
        <div className="form-hero-content">
          <div className="form-hero-avatar">
            <span>{(data.initials || "··").slice(0, 2)}</span>
          </div>
          <div>
            <div className="form-hero-name">{data.name || "Nuevo cliente"}</div>
            <div className="form-hero-tag">"{data.tagline || "agrega un tagline editorial"}"</div>
            <div className="form-hero-meta mono">{data.industry}</div>
          </div>
        </div>
      </div>

      {/* Step pills */}
      <div className="form-steps">
        <FormStepPill n={1} label="Identidad" active={step === 1} done={canStep1 && step > 1} onClick={() => setStep(1)} />
        <FormStepPill n={2} label="Contacto" active={step === 2} done={step > 2} onClick={() => setStep(2)} />
        <FormStepPill n={3} label="Marca" active={step === 3} done={step > 3} onClick={() => setStep(3)} />
      </div>

      {step === 1 &&
      <div className="form-section">
          <FormField label="Nombre">
            <input className="form-input" autoFocus value={data.name} onChange={(e) => set({ name: e.target.value })} placeholder="Atelier Nova" />
          </FormField>
          <FormGrid>
            <FormField label="Iniciales" hint="auto">
              <input className="form-input form-input-sm" maxLength={3} value={data.initials} onChange={(e) => set({ initials: e.target.value.toUpperCase() })} placeholder="AN" />
            </FormField>
            <FormField label="Industria" wide>
              <div className="form-select-wrap">
                <select className="form-input" value={data.industry} onChange={(e) => set({ industry: e.target.value })}>
                  {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </FormField>
          </FormGrid>
          <FormField label="Tagline" hint="frase corta, voz editorial">
            <input className="form-input" value={data.tagline} onChange={(e) => set({ tagline: e.target.value })} placeholder="Heritage in light" />
          </FormField>
          <FormField label="Identidad visual">
            <div className="accent-grid">
              {ACCENT_PRESETS.map((p) =>
            <button
              key={p.name}
              type="button"
              className={"accent-card " + (data.accentPreset.name === p.name ? "is-on" : "")}
              onClick={() => set({ accentPreset: p })}>
              
                  <div className="accent-card-bg" style={{ background: p.bg }} />
                  <span className="accent-card-name mono">{p.name}</span>
                </button>
            )}
            </div>
          </FormField>
        </div>
      }

      {step === 2 &&
      <div className="form-section">
          <FormField label="Persona de contacto">
            <input className="form-input" value={data.contactName} onChange={(e) => set({ contactName: e.target.value })} placeholder="Mira Chen" />
          </FormField>
          <FormGrid>
            <FormField label="Rol" wide>
              <input className="form-input" value={data.contactRole} onChange={(e) => set({ contactRole: e.target.value })} placeholder="Brand Director" />
            </FormField>
          </FormGrid>
          <FormField label="Email">
            <input className="form-input" type="email" value={data.contactEmail} onChange={(e) => set({ contactEmail: e.target.value })} placeholder="hola@cliente.com" />
          </FormField>
          <FormField label="Referencias web" hint="separadas por coma">
            <input className="form-input" value={data.references} onChange={(e) => set({ references: e.target.value })} placeholder="linear.app, vercel.com" />
          </FormField>
        </div>
      }

      {step === 3 &&
      <div className="form-section">
          <FormField label="Paleta de marca" hint="4 hex codes">
            <div className="palette-row">
              {data.palette.map((c, i) =>
            <label key={i} className="palette-cell" style={{ background: c }}>
                  <input
                type="color"
                value={c}
                onChange={(e) => {
                  const next = [...data.palette];
                  next[i] = e.target.value;
                  set({ palette: next });
                }} />
              
                  <span className="palette-cell-hex mono">{c}</span>
                </label>
            )}
            </div>
          </FormField>

          <FormGrid>
            <FormField label="Display font" wide>
              <input className="form-input" value={data.typeDisplay} onChange={(e) => set({ typeDisplay: e.target.value })} />
            </FormField>
          </FormGrid>
          <FormGrid>
            <FormField label="Texto" wide>
              <input className="form-input" value={data.typeText} onChange={(e) => set({ typeText: e.target.value })} />
            </FormField>
            <FormField label="Mono" wide>
              <input className="form-input" value={data.typeMono} onChange={(e) => set({ typeMono: e.target.value })} />
            </FormField>
          </FormGrid>

          <FormField label="Voz de marca" hint="cómo habla">
            <TagInput value={data.voiceTags} onChange={(v) => set({ voiceTags: v })} placeholder="añadir tono…" tone="good" />
          </FormField>
          <FormField label="Anti-patrones" hint="qué nunca">
            <TagInput value={data.dontTags} onChange={(v) => set({ dontTags: v })} placeholder="añadir restricción…" tone="bad" />
          </FormField>
        </div>
      }

      <div className="form-foot">
        <button type="button" className="form-btn-ghost" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
          {step === 1 ? "Cancelar" : "← Atrás"}
        </button>
        {step < 3 ?
        <button
          type="button"
          className="form-btn-primary"
          disabled={step === 1 ? !canStep1 : !canStep2}
          onClick={() => setStep(step + 1)}>
          
            Siguiente →
          </button> :

        <button type="button" className="form-btn-primary" disabled={!canFinish} onClick={finish}>
            <Icon.Plus style={{ width: 12, height: 12 }} />
            Crear cliente
          </button>
        }
      </div>
    </div>);

}

// ---------------------------------------------------------------------------
// NewMoodboardForm — para Style Vault
// ---------------------------------------------------------------------------
function NewMoodboardForm({ onCreate, onCancel }) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState("#A78BFA");
  const presets = ["#A78BFA", "#7DD3FC", "#34D399", "#FBBF24", "#FB7185", "#C4B5FD", "#F472B6", "#60A5FA"];
  return (
    <div className="form-stage">
      <div className="form-section">
        <div className="moodboard-hero" style={{ background: `linear-gradient(135deg, ${color}22, transparent 70%)` }}>
          <div className="moodboard-hero-orb" style={{ background: color, boxShadow: `0 0 30px ${color}` }} />
          <div className="moodboard-hero-text">
            <div className="moodboard-hero-kicker mono">nuevo moodboard</div>
            <div className="moodboard-hero-title">{name || "Sin título"}</div>
          </div>
        </div>

        <FormField label="Nombre del moodboard">
          <input className="form-input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Style #042 · Otoño Editorial" />
        </FormField>

        <FormField label="Color de identificación">
          <div className="moodboard-color-grid">
            {presets.map((c) =>
            <button
              key={c}
              type="button"
              className={"mb-color-swatch " + (color === c ? "is-on" : "")}
              style={{ background: c }}
              onClick={() => setColor(c)} />

            )}
            <label className="mb-color-custom" style={{ background: color }}>
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} />
              <span className="mono">custom</span>
            </label>
          </div>
        </FormField>
      </div>

      <div className="form-foot">
        <button type="button" className="form-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button
          type="button"
          className="form-btn-primary"
          disabled={!name.trim()}
          onClick={() => onCreate({ name: name.trim(), color, intent: "custom" })}>
          
          <Icon.Plus style={{ width: 12, height: 12 }} />
          Crear moodboard
        </button>
      </div>
    </div>);

}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------
function FormField({ label, hint, children, wide }) {
  return (
    <div className={"form-field " + (wide ? "is-wide" : "")}>
      <div className="form-field-head">
        <span className="form-label mono">{label}</span>
        {hint && <span className="form-hint mono">{hint}</span>}
      </div>
      {children}
    </div>);

}
function FormGrid({ children }) {return <div className="form-grid">{children}</div>;}

function FormStepPill({ n, label, active, done, onClick }) {
  return (
    <button type="button" className={"form-step " + (active ? "is-active " : "") + (done ? "is-done" : "")} onClick={onClick}>
      <span className="form-step-n mono">{done ? "✓" : n}</span>
      <span className="form-step-label">{label}</span>
    </button>);

}

function TagInput({ value, onChange, placeholder, tone }) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const t = draft.trim();
    if (!t || value.includes(t)) return;
    onChange([...value, t]);
    setDraft("");
  };
  return (
    <div className="taginput">
      <div className="taginput-tags">
        {value.map((t) =>
        <span key={t} className={"client-tag " + (tone === "bad" ? "client-tag-bad" : "client-tag-good")}>
            {tone === "bad" ? "— " : ""}{t}
            <button type="button" className="taginput-remove" onClick={() => onChange(value.filter((x) => x !== t))} aria-label="quitar">✕</button>
          </span>
        )}
      </div>
      <input
        className="form-input form-input-sm"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {if (e.key === "Enter") {e.preventDefault();add();}}}
        placeholder={placeholder} />
      
    </div>);

}

// ---------------------------------------------------------------------------
// ProjectsPanel — proyectos agrupados por cliente
// ---------------------------------------------------------------------------
function ProjectsPanel({ projects, clients, onOpen, onCreate, onDelete, onClose, activeProjectId }) {
  // group by clientId
  const groups = clients.map((c) => ({
    client: c,
    items: projects.filter((p) => p.clientId === c.id)
  }));
  const orphans = projects.filter((p) => !p.clientId);
  if (orphans.length) groups.push({ client: null, items: orphans });

  return (
    <>
      <DrawerHeader title="Proyectos" subtitle="por cliente · flujos guardados" onClose={onClose} />
      <div className="drawer-body scroll-thin">
        <button className="add-client-btn" onClick={onCreate} data-comment-anchor="3c86d0caaa-button-846-9">
          <Icon.Plus style={{ width: 14, height: 14 }} />
          Nuevo proyecto
        </button>

        {projects.length === 0 &&
        <div className="empty-state">
            <div className="empty-state-icon">🗂</div>
            <div className="empty-state-title">Sin proyectos todavía</div>
            <div className="empty-state-body">
              Crea uno para guardar el flujo completo del canvas (nodos, conexiones, brief). Podrás retomar el trabajo donde lo dejaste.
            </div>
          </div>
        }

        {groups.filter((g) => g.items.length > 0).map((g) =>
        <div key={g.client?.id || "_orphans"} className="project-group">
            <div className="project-group-head">
              {g.client ?
            <div className="project-group-avatar" style={{ background: g.client.bgGradient }}>
                  <span>{g.client.initials}</span>
                </div> :

            <div className="project-group-avatar project-group-avatar-ghost">∅</div>
            }
              <div className="project-group-meta">
                <div className="project-group-name">{g.client?.name || "Sin cliente"}</div>
                <div className="project-group-count mono">{g.items.length} proyecto{g.items.length === 1 ? "" : "s"}</div>
              </div>
            </div>
            <div className="project-list">
              {g.items.map((p) =>
            <ProjectCard
              key={p.id}
              project={p}
              active={p.id === activeProjectId}
              onOpen={() => onOpen(p)}
              onDelete={() => onDelete(p)} />

            )}
            </div>
          </div>
        )}
      </div>
    </>);

}

function ProjectCard({ project, active, onOpen, onDelete }) {
  return (
    <div className={"project-card " + (active ? "is-active" : "")}>
      <button className="project-card-main" onClick={onOpen}>
        <div className="project-card-thumbs">
          {(project.thumbs || ["#A78BFA", "#7DD3FC", "#34D399"]).slice(0, 3).map((c, i) =>
          <span key={i} style={{ background: c, transform: `translateX(${-i * 8}px)` }} />
          )}
        </div>
        <div className="project-card-meta">
          <div className="project-card-name">{project.name}</div>
          <div className="project-card-stats mono">
            {project.nodes?.length || 0} nodos · {project.edges?.length || 0} conex. · {new Date(project.updatedAt).toLocaleDateString()}
          </div>
        </div>
        <div className="project-card-arrow">→</div>
      </button>
      <button
        className="project-card-delete"
        onClick={(e) => {e.stopPropagation();onDelete();}}
        title="Eliminar proyecto">
        
        <Icon.Trash style={{ width: 13, height: 13 }} />
      </button>
    </div>);

}

// ---------------------------------------------------------------------------
// SettingsPanel — configuración funcional de la herramienta
// ---------------------------------------------------------------------------
function SettingsPanel({ theme, setTheme, accent, setAccent, motion, setMotion, density, setDensity, onClose }) {
  const accents = [
  { id: "violet", color: "#A78BFA", label: "Violeta" },
  { id: "teal", color: "#34D399", label: "Verde" },
  { id: "amber", color: "#FBBF24", label: "Ámbar" },
  { id: "rose", color: "#FB7185", label: "Rosa" },
  { id: "blue", color: "#7DD3FC", label: "Azul" }];

  return (
    <>
      <DrawerHeader title="Ajustes" subtitle="apariencia · comportamiento · datos" onClose={onClose} />
      <div className="drawer-body scroll-thin">
        <div className="settings-section">
          <div className="settings-section-label mono">Apariencia</div>

          <div className="settings-row">
            <div className="settings-row-meta">
              <div className="settings-row-title">Tema</div>
              <div className="settings-row-sub mono">dark · light · sigue al sistema</div>
            </div>
            <div className="theme-seg">
              {[
              { id: "dark", label: "Dark" },
              { id: "light", label: "Light" },
              { id: "system", label: "Auto" }].
              map((t) =>
              <button
                key={t.id}
                className={"theme-seg-btn " + (theme === t.id ? "is-on" : "")}
                onClick={() => setTheme(t.id)}>
                {t.label}</button>
              )}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-meta">
              <div className="settings-row-title">Color de acento</div>
              <div className="settings-row-sub mono">tono dominante de la interfaz</div>
            </div>
            <div className="settings-accents">
              {accents.map((a) =>
              <button
                key={a.id}
                className={"settings-accent " + (accent === a.id ? "is-on" : "")}
                onClick={() => setAccent(a.id)}
                title={a.label}
                style={{ "--ac": a.color }}>
                
                  <span className="settings-accent-disc" style={{ background: a.color }} />
                </button>
              )}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-meta">
              <div className="settings-row-title">Movimiento</div>
              <div className="settings-row-sub mono">animaciones de los edges y orbes</div>
            </div>
            <div className="theme-seg">
              {[
              { id: "full", label: "Full" },
              { id: "reduced", label: "Reducido" },
              { id: "off", label: "Off" }].
              map((m) =>
              <button
                key={m.id}
                className={"theme-seg-btn " + (motion === m.id ? "is-on" : "")}
                onClick={() => setMotion(m.id)}>
                {m.label}</button>
              )}
            </div>
          </div>

          <div className="settings-row">
            <div className="settings-row-meta">
              <div className="settings-row-title">Densidad</div>
              <div className="settings-row-sub mono">tamaño de nodos y paneles</div>
            </div>
            <div className="theme-seg">
              {[
              { id: "compact", label: "Compacto" },
              { id: "comfortable", label: "Confort" },
              { id: "spacious", label: "Espacioso" }].
              map((d) =>
              <button
                key={d.id}
                className={"theme-seg-btn " + (density === d.id ? "is-on" : "")}
                onClick={() => setDensity(d.id)}>
                {d.label}</button>
              )}
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-label mono">Integraciones</div>
          <div className="settings-card">
            <div className="settings-card-row">
              <div className="settings-int-icon" style={{ background: "linear-gradient(135deg,#D97757,#C84F2F)" }}>
                <span style={{ color: "#fff", fontWeight: 600 }}>✦</span>
              </div>
              <div className="settings-card-meta">
                <div className="settings-card-title">API de Anthropic</div>
                <div className="settings-card-sub mono">claude · cerebro cognitivo · contexto de clientes</div>
              </div>
              <span className="settings-status settings-status-ok">connected</span>
            </div>
          </div>
          <div className="settings-card">
            <div className="settings-card-row">
              <div className="settings-int-icon" style={{ background: "linear-gradient(135deg,#FBBF24,#F59E0B)" }}>
                <span style={{ color: "#0F1018", fontWeight: 700 }}>K</span>
              </div>
              <div className="settings-card-meta">
                <div className="settings-card-title">API de Kid.ai</div>
                <div className="settings-card-sub mono">músculo creativo · gpt-imagenes-2 · nano-banana · veo3 · seedance</div>
              </div>
              <span className="settings-status settings-status-ok">connected</span>
            </div>
          </div>
        </div>

        <div className="settings-section">
          <div className="settings-section-label mono">Sesión</div>
          <button className="settings-action" onClick={() => {
            if (confirm("¿Cerrar sesión y volver al login?")) {
              window.location.href = "Login.html";
            }
          }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>

        <div className="settings-section">
          <div className="settings-section-label mono">Datos</div>
          <button className="settings-action settings-action-primary" onClick={() => {
            if (confirm("¿Borrar todos los datos locales (clientes, moodboards, proyectos, galería)? Esta acción no se puede deshacer.")) {
              localStorage.clear();
              window.__notify?.({ kind: "info", icon: "✕", title: "Datos eliminados", body: "Recarga la página para empezar de cero." });
            }
          }}>
            <Icon.Trash style={{ width: 13, height: 13 }} />
            Borrar todos los datos locales
          </button>
        </div>

        <div className="settings-foot mono">
          ClienderDesign v0.4 · build {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </>);

}

// ---------------------------------------------------------------------------
// NewClientPopup — popup elegante (modal) en lugar de inline
// ---------------------------------------------------------------------------
function NewClientPopup({ open, onCreate, onClose }) {
  if (!open) return null;
  return (
    <div className="form-popup-backdrop" onClick={onClose}>
      <div className="form-popup form-popup-lg" onClick={(e) => e.stopPropagation()}>
        <div className="form-popup-head">
          <div>
            <div className="form-popup-kicker mono">cerebro · clientes</div>
            <div className="form-popup-title">Conectar nuevo cliente</div>
          </div>
          <button className="super-close" onClick={onClose}>✕</button>
        </div>
        <NewClientForm
          onCancel={onClose}
          onCreate={(data) => {onCreate(data);onClose();}} />
        
      </div>
    </div>);

}


// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------
Object.assign(window, {
  LeftRail,
  NodesPanel,
  ClientsPanel,
  ProjectsPanel,
  SettingsPanel,
  NewClientForm,
  NewClientPopup,
  NewMoodboardForm,
  SAMPLE_CLIENTS,
  DrawerHeader,
  RailIcons
});