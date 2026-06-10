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
    </svg>,

  Agents: (p) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
      <circle cx="19" cy="8" r="2.2" />
      <path d="M22 17c0-2.2-1.8-4-3-4.5" />
      <circle cx="5" cy="8" r="2.2" />
      <path d="M2 17c0-2.2 1.8-4 3-4.5" />
      <path d="M12 8v2M10 11h4" strokeLinecap="round" />
    </svg>),

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
function LeftRail({ activeTab, onTab, galleryCount, hasLockedMoodboard, clientsCount, projectsCount, agentsCount }) {
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
      
      <RailItem
        icon={<RailIcons.Agents width={22} height={22} />}
        label="Agentes Creativos"
        active={activeTab === "agents"}
        onClick={() => onTab(activeTab === "agents" ? null : "agents")}
        hotkey="A"
        count={agentsCount} />
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
function NodesPanel({ onAdd, onClose, onSave, onNewCanvas, flowTemplates, onLoadTemplate, onDeleteTemplate }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const items = [
  { type: "prompt", label: "Prompt", hint: "Brief creativo", glyph: <Icon.PromptGlyph style={{ width: 28, height: 28 }} />, accent: "#6366F1" },
  { type: "image", label: "Imagen", hint: "Generación de imagen", glyph: <Icon.ImageGlyph style={{ width: 28, height: 28 }} />, accent: "#8B5CF6" },
  { type: "video", label: "Video", hint: "Generación de video", glyph: <Icon.VideoGlyph style={{ width: 28, height: 28 }} />, accent: "#10B981" },
  { type: "voice", label: "Voz", hint: "Narración / voz en off", glyph: <Icon.MicGlyph style={{ width: 28, height: 28 }} />, accent: "#F59E0B" },
  { type: "reference", label: "Personaje", hint: "Fotos de personaje / avatar",
    glyph: (
      <svg viewBox="0 0 28 28" fill="none" width={28} height={28}>
        <defs><linearGradient id="pGrd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FBBF24"/><stop offset="100%" stopColor="#D97706"/></linearGradient></defs>
        <circle cx="14" cy="10" r="5" stroke="url(#pGrd)" strokeWidth="1.5" fill="rgba(251,191,36,0.08)"/>
        <path d="M5 24c0-4.97 4.03-9 9-9s9 4.03 9 9" stroke="url(#pGrd)" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="14" cy="10" r="2" fill="url(#pGrd)" opacity="0.5"/>
      </svg>
    ), accent: "#F59E0B" },
  { type: "imageref", label: "Referencia", hint: "Fotos de referencia visual — conecta a Prompt o Imagen",
    glyph: (
      <svg viewBox="0 0 28 28" fill="none" width={28} height={28}>
        <defs><linearGradient id="rGrd" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#FB923C"/><stop offset="100%" stopColor="#EA580C"/></linearGradient></defs>
        <rect x="3.5" y="5" width="14" height="18" rx="2.5" stroke="url(#rGrd)" strokeWidth="1.4" fill="rgba(249,115,22,0.07)"/>
        <rect x="8" y="3" width="14" height="18" rx="2.5" stroke="url(#rGrd)" strokeWidth="1.4" fill="rgba(249,115,22,0.05)" opacity="0.7"/>
        <path d="M7 14l3.5-4 2.5 3 2-2.5 3 3.5" stroke="url(#rGrd)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ), accent: "#F97316" },
  { type: "note", label: "Nota", hint: "Anotación libre", glyph: <Icon.NoteGlyph style={{ width: 28, height: 28 }} />, accent: "#FBBF24" }];

  const fmt = (ts) => new Date(ts).toLocaleDateString("es-ES", { day:"2-digit", month:"short" });

  return (
    <>
      <DrawerHeader title="Nodos" subtitle="añadir al canvas" onClose={onClose} />
      <div className="drawer-body scroll-thin">

        <div className="nodes-canvas-actions">
          <button className="nodes-action-btn nodes-action-new" onClick={onNewCanvas}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            Nuevo canvas
          </button>
          <button className="nodes-action-btn nodes-action-save" onClick={onSave}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Guardar flujo
          </button>
        </div>

        <div className="drawer-section-label mono" style={{ marginTop: 18 }}>Generadores</div>
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

        <div className="drawer-section-label mono" style={{ marginTop: 22 }}>
          Plantillas guardadas
          {flowTemplates?.length > 0 && <span className="tpl-count-badge">{flowTemplates.length}</span>}
        </div>

        {(!flowTemplates || flowTemplates.length === 0) && (
          <div className="tpl-empty">
            <div style={{ fontSize: 22, marginBottom: 6 }}>💾</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", lineHeight: 1.5, textAlign: "center" }}>
              Guarda el flujo actual con "Guardar flujo".<br/>Cada guardado es independiente.
            </div>
          </div>
        )}

        <div className="nodes-list" style={{ marginTop: 4 }}>
          {(flowTemplates || []).map(t => (
            <div key={t.id} className="saved-tpl-card">
              <button className="saved-tpl-main" onClick={() => onLoadTemplate(t)}>
                <div className="saved-tpl-dots">
                  {["#A78BFA","#7DD3FC","#34D399"].map((c,i) =>
                    <span key={i} style={{ background: c, width:6, height:6, borderRadius:"50%", marginLeft: i?-2:0, display:"inline-block" }} />
                  )}
                </div>
                <div className="saved-tpl-meta">
                  <div className="saved-tpl-name">{t.name}</div>
                  <div className="saved-tpl-info mono">{t.nodeCount} nodos · {fmt(t.createdAt)}</div>
                </div>
                <span className="saved-tpl-load">Cargar →</span>
              </button>
              {confirmId === t.id ? (
                <button className="saved-tpl-del-confirm" onClick={() => { onDeleteTemplate(t.id); setConfirmId(null); }}>¿Borrar?</button>
              ) : (
                <button className="saved-tpl-del" onClick={() => setConfirmId(t.id)}>✕</button>
              )}
            </div>
          ))}
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
// Clientes activos de Cliender — fuente única de verdad (se expone en window.SAMPLE_CLIENTS)
// ---------------------------------------------------------------------------
const SAMPLE_CLIENTS = [
{
    "id": "cl-cliender",
    "name": "Cliender",
    "initials": "CL",
    "industry": "Agencia de Marketing Digital IA / Growth",
    "tagline": "Cliender · Powered by Claude",
    "contact": {
      "name": "Toni Ureña",
      "email": "toni@cliender.com",
      "role": "Co-founder & Director Comercial"
    },
    "palette": [
      "#6D28D9",
      "#A78BFA",
      "#C4B5FD",
      "#0A0A14",
      "#FFFFFF"
    ],
    "colorEmotion": "Púrpura IA: innovación, inteligencia, exclusividad tech. El negro profundo ancla. Blanco limpia.",
    "typography": {
      "display": "Geist",
      "text": "Geist",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "innovador",
      "directo",
      "experto",
      "cercano con clientes",
      "orientado a resultados"
    ],
    "toneTemperature": "Direct-premium (6/10 formal — profesional pero no corporativo)",
    "audience": [
      "Empresas con budget marketing 3k-30k/mes",
      "Directores de Marketing PYME",
      "Fundadores que escalan",
      "Negocios que quieren IA en marketing"
    ],
    "contentPillars": [
      "Casos de éxito de clientes reales",
      "IA aplicada al marketing (educación)",
      "Resultados y métricas (ROI demostrado)",
      "Behind the scenes del equipo Cliender",
      "Herramientas y automatizaciones que usamos",
      "Tendencias de marketing digital con IA"
    ],
    "compositionStyle": "Minimalismo tech premium. Fondos oscuros con acentos violeta. Tipografía grande y bold. Mockups de herramientas IA. Retratos del equipo auténticos. Gradientes violeta-negro.",
    "dont": [
      "clásico corporativo aburrido",
      "sobre-saturación de colores",
      "stock photos genéricas",
      "promesas sin métricas",
      "lenguaje excesivamente técnico"
    ],
    "cta": "Escala con IA",
    "taglineFull": "Tu marketing, multiplicado por IA",
    "valueProp": "Somos la agencia de marketing que usa Claude AI y automatización para entregar campañas, contenido y estrategia a velocidad y escala imposible para agencias tradicionales.",
    "productList": [
      "SALES: Estrategia comercial + propuestas + CRM",
      "MEDIA: Contenido IA + RRSS + ads + branding",
      "TECH: Automatizaciones + herramientas internas + LeadUp",
      "Studio: Cliender Design Pro (esta herramienta)",
      "LeadUp: plataforma propia de gestión de leads"
    ],
    "instagramHandle": "@cliender",
    "logo": {
      "url": "https://opjwsdaphsulnpuvpout.supabase.co/storage/v1/object/public/brand-assets/cliender/logo-isotipo-violet.png",
      "description": "Wordmark 'CLIENDER' en Geist Bold, color violeta #A78BFA sobre fondo negro #0A0A14. Las letras tienen tracking generoso. Puede ir acompañado del subítulo 'Powered by Claude' en Geist Light pequeño debajo. El isotipo es la letra 'C' estilizada en violeta con un trazo de gradiente que va de #6D28D9 a #C4B5FD.",
      "shape": "Wordmark horizontal. 'C' como isotipo standalone. Ratio wordmark: 8:1 (muy horizontal).",
      "colors": {
        "primary": "#A78BFA",
        "dark": "#6D28D9",
        "light": "#C4B5FD",
        "background": "#0A0A14",
        "onLight": "#6D28D9"
      },
      "typography": "Geist Bold, tracking 0.08em, todo mayúsculas",
      "variants": [
        "violeta sobre negro (principal)",
        "blanco sobre violeta",
        "negro sobre blanco",
        "isotipo C standalone"
      ],
      "usage": "Zona seguridad = altura de la C. No usar sobre fondos con colores de más de 2 tonos. El isotipo C mínimo 32px."
    },
    "logoUrl": "https://opjwsdaphsulnpuvpout.supabase.co/storage/v1/object/public/brand-assets/cliender/logo-isotipo-violet.png",
    "accent": "#A78BFA",
    "bgGradient": "linear-gradient(135deg, #0A0A14 0%, #6D28D9 60%, #A78BFA 100%)",
    "references": [
      "hubspot.com",
      "semrush.com",
      "hootsuite.com"
    ],
    "visualReferences": {
      "brands": [
        "HubSpot",
        "Semrush",
        "Later"
      ],
      "contentStyle": "Tech-premium oscuro: fondos negro profundo #0A0A14, acentos violeta #A78BFA, tipografía Geist Bold, datos y métricas como protagonistas, mockups de herramientas digitales reales",
      "instagramRefs": [
        "@hubspot",
        "@semrush",
        "@later_media"
      ],
      "videoStyle": "Motion graphics limpio sobre fondo oscuro, screen recordings de herramientas IA en acción, before/after de resultados reales con números, talking head equipo Cliender con fondo branded violeta, texto bold animado",
      "shootingStyle": "Estudio controlado con fondo oscuro o gradiente violeta, iluminación lateral suave, close-ups de pantallas/herramientas, planos del equipo trabajando",
      "avoid": "Stock photos genéricas, colores pasteles, informalidad, imágenes sin datos reales"
    },
    "projects": 12,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA",
      "TECH"
    ],
    "web": "cliender.com",
    "_pinned": true,
    "_color": "violet"
  },
{
    "id": "cl-savia",
    "name": "Savia Formación (AZ Consultoría)",
    "initials": "SV",
    "industry": "Formación",
    "tagline": "Personas que impulsan organizaciones",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#1A1A1A",
      "#ACCB46",
      "#6EC1E4",
      "#FFFFFF"
    ],
    "colorEmotion": "Verde lima vital (#ACCB46) + azul cielo (#6EC1E4): crecimiento humano, empleabilidad y respaldo institucional SEPE",
    "typography": {
      "display": "Nexa",
      "text": "Avenir",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "profesional",
      "cercano",
      "transformador",
      "humano"
    ],
    "toneTemperature": "Cálido-profesional (6/10 formal)",
    "audience": [
      "Desempleados/trabajadores Andalucía 25-50 buscando certificados de profesionalidad gratuitos SEPE",
      "Profesionales sector agrario, jardinería, control de plagas y medioambiente",
      "Empresas/pymes que aprovechan crédito FUNDAE para formación bonificada",
      "Municipios Costa del Sol (Fuengirola, Mijas, Marbella, Torremolinos)"
    ],
    "contentPillars": [
      "Formación subvencionada SEPE (cursos gratuitos homologados)",
      "Certificados de profesionalidad con validez nacional",
      "Planes a medida para empresas (crédito FUNDAE)",
      "Sector especializado: agrario, jardinería, control de plagas"
    ],
    "compositionStyle": "Retratos corporativos cálidos, espacios de trabajo abiertos, diversidad real",
    "dont": [
      "tecnicismos vacíos",
      "jerga corporativa",
      "promesas sin evidencia"
    ],
    "logo": {
      "url": "",
      "description": "Logo oficial (Manual de Identidad Corporativa): wordmark 'SAVIA' en gris #878887 con el símbolo de persona/brote en verde lima #ACCB46 reemplazando la V; 'FORMACIÓN' debajo en gris. Tipografía Nexa Bold (logo) + Avenir (texto). Variantes sobre blanco, negro, gris y verde.",
      "shape": "Wordmark SAVIA + símbolo brote (persona) en la V + FORMACIÓN debajo. Ver Manual de Identidad en brand assets.",
      "colors": {
        "primary": "#ACCB46",
        "secondary": "#878887",
        "dark": "#1A1A1A"
      },
      "typography": "Nexa Bold (logo) + Avenir Black/Book (texto)",
      "variants": [
        "color sobre blanco",
        "blanco sobre negro/verde",
        "símbolo brote standalone"
      ],
      "usage": "Colores oficiales: verde lima #ACCB46 (Pantone P 157-7 C) + gris #878887 (Pantone P 176-5 C). No usar verde bosque ni navy."
    },
    "accent": "#ACCB46",
    "bgGradient": "linear-gradient(135deg, #878887 0%, #ACCB46 100%)",
    "references": [
      "centros SEPE acreditados Costa del Sol",
      "certificados de profesionalidad Málaga"
    ],
    "visualReferences": {
      "brands": [
        "Savia Formación"
      ],
      "contentStyle": "Fotografía corporativa cálida y auténtica: espacios de oficina abiertos con luz natural, retratos de personas reales trabajando, paleta verde lima + gris con fondos claros",
      "instagramRefs": [],
      "videoStyle": "Testimonios en cámara de empleados/directivos, time-lapses de espacios de trabajo, datos de impacto humano, entrevistas en formato documental breve",
      "shootingStyle": "Luz natural o rebotada suave, entornos de trabajo reales, personas en acción (no posadas), planos medios y close-ups de expresiones",
      "avoid": "Stock photos de oficinas vacías, sonrisas forzadas, lenguaje corporativo vacío"
    },
    "projects": 8,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "saviaformacion.com",
    "instagramHandle": "@savia.formacion"
  },
{
    "id": "cl-beta",
    "name": "Beta Formación",
    "initials": "BF",
    "industry": "Formación / Educación",
    "tagline": "La emoción de aprender",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#2D2966",
      "#C9D332",
      "#878787",
      "#FFFFFF"
    ],
    "colorEmotion": "Navy profundo (#2D2966) + lima (#C9D332): rigor académico con energía. Colores REALES del logo oficial",
    "typography": {
      "display": "Poppins",
      "text": "Inter",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "motivador",
      "accesible",
      "dinámico",
      "práctico"
    ],
    "toneTemperature": "Energético-accesible (4/10 formal)",
    "audience": [
      "Desempleados y trabajadores en activo (Valencia)",
      "Opositores a función pública (AGE, Sanidad, Justicia, Educación)",
      "Menores de 30 (Garantía Juvenil)",
      "Empresas (formación bonificada FUNDAE)"
    ],
    "contentPillars": [
      "Formación para el empleo (gratuita SEPE)",
      "Oposiciones y función pública",
      "Idiomas y certificaciones",
      "Formación corporativa bonificada"
    ],
    "compositionStyle": "Planos dinámicos, personas estudiando, colores contrastados, texto bold",
    "dont": [
      "academicismo excesivo",
      "tecnicismos innecesarios",
      "pasividad"
    ],
    "logo": {
      "url": "",
      "description": "Logo 'β BETA FORMACIÓN': letra griega β vectorizada en rojo #E94560 como símbolo + wordmark en Poppins Bold. β tiene trazo redondeado grosor uniforme, 1.2u alto. Wordmark 0.7u alto. Fondo oscuro #1A1A2E variante principal.",
      "shape": "β + wordmark. β: trazo redondeado, ratio 1:1.2. Wordmark a la derecha alineado centro.",
      "colors": {
        "primary": "#E94560",
        "secondary": "#0F3460",
        "background": "#1A1A2E"
      },
      "typography": "Poppins Bold para wordmark, β vectorial propio",
      "variants": [
        "rojo sobre oscuro (principal)",
        "azul sobre blanco",
        "β isotipo standalone"
      ],
      "usage": "No usar β sobre fondos rojos. Zona seguridad = anchura de la β."
    },
    "accent": "#C9D332",
    "bgGradient": "linear-gradient(135deg, #2D2966 0%, #C9D332 100%)",
    "references": [
      "academias oposiciones Valencia",
      "centros FP acreditados Valencia"
    ],
    "visualReferences": {
      "brands": [
        "Domestika",
        "Ironhack",
        "Founderz"
      ],
      "contentStyle": "Energético y aspiracional: fondo oscuro con acentos rojo-azul, tipografía Poppins Bold grande, testimonios de alumnos reales con métricas de transformación, thumbnails de cursos impactantes",
      "instagramRefs": [
        "@domestika",
        "@ironhack",
        "@founderz.school"
      ],
      "videoStyle": "Reels rápidos de transformación (antes/después profesional), testimonios de 30s con subtítulos animados bold, clips de clases en acción, texto motivacional sobre fondo branded",
      "shootingStyle": "Entorno de estudio moderno, luz contrastada, planos dinámicos con movimiento, close-ups de pantallas con contenido del curso",
      "avoid": "Aulas aburridas, profesores estáticos, lenguaje académico sin vida"
    },
    "projects": 5,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "betaformacion.com",
    "instagramHandle": "@betaformacion"
  },
{
    "id": "cl-ehei",
    "name": "MIA Digital University (EHEI)",
    "initials": "EH",
    "industry": "Educación Superior / Internacional",
    "tagline": "Embrace the Challenge of the Digital Revolution",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#081E3F",
      "#29A35A",
      "#F7BC0A",
      "#FFFFFF"
    ],
    "colorEmotion": "Navy (#081E3F) + verde (#29A35A) + oro (#F7BC0A): universidad digital rigurosa e internacional. Colores REALES miauniversity.com",
    "typography": {
      "display": "Poppins",
      "text": "Poppins",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "institucional",
      "internacional",
      "riguroso",
      "aspiracional"
    ],
    "toneTemperature": "Formal-aspiracional (8/10 formal)",
    "audience": [
      "Graduados universitarios",
      "Profesionales con Máster",
      "Perfil internacional 25-40"
    ],
    "contentPillars": [
      "Rankings y acreditaciones",
      "Experiencia campus",
      "Alumni network",
      "Convenios empresa"
    ],
    "compositionStyle": "Arquitectura europea clásica, retratos elegantes, composición simétrica",
    "dont": [
      "informalidad",
      "abreviaciones",
      "lenguaje coloquial"
    ],
    "logo": {
      "url": "",
      "description": "Logo oficial EHEI (Logo.svg en brand assets): paleta vino #AD5369 / #91475C, oro #FFD878 y azul #4695BC sobre blanco. Iniciales 'EHEI' con wordmark 'European Higher Education Institute'.",
      "shape": "Ver asset oficial Logo.svg en '00. CONTEXTO DEL CLIENTE/01. Marca y Brand Assets/Branding/'.",
      "colors": {
        "primary": "#FFD878",
        "secondary": "#AD5369",
        "accent": "#4695BC"
      },
      "typography": "Playfair Display (wordmark)",
      "variants": [
        "logo color sobre blanco",
        "logo blanco sobre oscuro"
      ],
      "usage": "Usar colores oficiales del Logo.svg: vino, oro, azul. No sustituir por goldenrod/navy. Mínimo 40px ancho."
    },
    "accent": "#29A35A",
    "bgGradient": "linear-gradient(135deg, #081E3F 0%, #29A35A 100%)",
    "references": [
      "ie.edu",
      "esade.edu",
      "iese.edu"
    ],
    "visualReferences": {
      "brands": [
        "IE Business School",
        "ESADE",
        "IESE"
      ],
      "contentStyle": "Elegancia institucional europea: arquitectura clásica y moderna en contraste, retratos de alto ejecutivo en entornos de prestigio, paleta navy-dorado, composición simétrica y ordenada",
      "instagramRefs": [
        "@ie.university",
        "@esade",
        "@iesebschool"
      ],
      "videoStyle": "Campus tours cinematográficos, testimonios de alumni en posiciones directivas internacionales, eventos y conferencias de prestigio, planos aéreos de campus europeos",
      "shootingStyle": "Fotografía con lente 85mm, DOF reducido, luz dorada de ventana o exterior crepuscular, composición formal con espacio negativo generoso",
      "avoid": "Informalidad visual, colores llamativos, lenguaje coloquial, planos demasiado dinámicos"
    },
    "projects": 4,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA",
      "TECH"
    ],
    "web": "miauniversity.com"
  },
{
    "id": "cl-integratec",
    "name": "Integra Tec (Formatel)",
    "initials": "IT",
    "industry": "Teleformación / e-Learning",
    "tagline": "Go to the next level",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#2C3E50",
      "#4F73B8",
      "#36A9E1",
      "#F4A63D"
    ],
    "colorEmotion": "Azul corporativo (#4F73B8) + cian (#36A9E1) + acento naranja: tecnología accesible B2B. Colores REALES del CSS",
    "typography": {
      "display": "Causten",
      "text": "Poppins",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "claro",
      "eficiente",
      "tecnológico",
      "orientado a resultados"
    ],
    "toneTemperature": "Directo-eficiente (5/10 formal)",
    "audience": [
      "Empresas que forman empleados online",
      "Responsables de formación B2B"
    ],
    "contentPillars": [
      "ROI de la formación",
      "Casos de cliente",
      "Demo plataforma",
      "Novedades FUNDAE"
    ],
    "compositionStyle": "Mockups digitales limpios, dashboards, iconografía tech, fondo navy con bloques de color",
    "dont": [
      "promesas sin métricas",
      "complejidad innecesaria",
      "lenguaje pasivo"
    ],
    "logo": {
      "url": "",
      "description": "Logo oficial Integra Tec School (brand assets en Logos/LOGOS_ITS/): bloques de color sobre navy #16304f — azul #36a9e1, verde/teal #5eb9a8, magenta #e74071. Acentos secundarios naranja #f4a63d y morado #7d4fb8.",
      "shape": "Ver assets oficiales en '00. CONTEXTO DEL CLIENTE/01. Marca y Brand Assets/Logos/LOGOS_ITS/' (logo_ITS_empleo.svg).",
      "colors": {
        "primary": "#36a9e1",
        "secondary": "#5eb9a8",
        "accent": "#e74071",
        "dark": "#16304f"
      },
      "typography": "Inter",
      "variants": [
        "logo color sobre blanco",
        "logo blanco (logo_ITS_empleo_BLANCO)"
      ],
      "usage": "Marca multicolor real: navy + azul + teal + magenta. No sustituir por azul Tailwind monocromo."
    },
    "accent": "#4F73B8",
    "bgGradient": "linear-gradient(135deg, #2C3E50 0%, #4F73B8 100%)",
    "references": [
      "docebo.com",
      "talentlms.com",
      "360learning.com"
    ],
    "visualReferences": {
      "brands": [
        "Docebo",
        "TalentLMS",
        "360Learning"
      ],
      "contentStyle": "SaaS B2B moderno: dashboards de plataforma en pantalla, mockups de interfaz limpia, métricas de finalización y ROI de formación, fondos oscuros tech con acentos azul",
      "instagramRefs": [
        "@docebo",
        "@360learning",
        "@litmos"
      ],
      "videoStyle": "Demo walkthrough de plataforma con narración, infografías animadas de datos FUNDAE, casos de empresa con antes/después de indicadores de formación, entrevistas a responsables de RRHH",
      "shootingStyle": "Screen recordings de alta calidad, mockups en dispositivos reales (laptop/tablet), entornos de oficina corporativa limpia, planos de empleados usando la plataforma",
      "avoid": "Interfaces confusas, datos sin contexto, lenguaje excesivamente técnico"
    },
    "projects": 6,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "TECH"
    ],
    "web": "integratechnologyschool.com",
    "instagramHandle": "@integratechnologyschool"
  },
{
    "id": "cl-garalma",
    "name": "Glamour Pao Bella",
    "initials": "GP",
    "industry": "Estética y Belleza",
    "tagline": "Descubre tu mejor versión",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#503D26",
      "#865C4C",
      "#DFB09C",
      "#FCF9F5"
    ],
    "colorEmotion": "Tierra cálida: marrón (#865C4C) + rosa nude (#DFB09C) + terracota: elegancia femenina natural. Colores REALES de la web",
    "typography": {
      "display": "Source Sans 3",
      "text": "Source Sans 3",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "cercano",
      "femenino",
      "experto",
      "cuidador"
    ],
    "toneTemperature": "Cálido-cercano (3/10 formal)",
    "audience": [
      "Mujeres de Pontevedra y alrededores",
      "Hombres (sección de servicios masculinos propia)",
      "Clientas de tratamientos faciales, corporales y estética avanzada"
    ],
    "contentPillars": [
      "Tratamientos y servicios del centro",
      "Resultados reales antes/después",
      "Consejos de belleza y autocuidado",
      "Promociones y citas"
    ],
    "compositionStyle": "Estética limpia y femenina, tonos neutros y cálidos, close-ups de tratamientos reales, ambientación auténtica del local",
    "dont": [
      "lenguaje clínico frío",
      "stock photos genéricas de belleza",
      "exceso de texto en posts"
    ],
    "logo": {
      "url": "",
      "description": "Logo Glamour Pao Bella — paleta tierra cálida real (#865C4C marrón, #DFB09C rosa nude, #9F3924 terracota, #FCF9F5 crema). Tipografía Source Sans 3. Pendiente logo vectorial oficial (solicitar por IG @glamourpaobella.nails).",
      "shape": "Pendiente de brand assets vectoriales.",
      "colors": {
        "primary": "#865C4C",
        "secondary": "#DFB09C",
        "accent": "#9F3924"
      },
      "typography": "Source Sans 3",
      "variants": [
        "pendiente vectorial"
      ],
      "usage": "Colores web confirmados. Solicitar logo SVG/AI oficial al cliente."
    },
    "accent": "#865C4C",
    "bgGradient": "linear-gradient(135deg, #503D26 0%, #865C4C 100%)",
    "references": [
      "glamourpaobella.com"
    ],
    "visualReferences": {
      "brands": [
        "Glamour Pao Bella"
      ],
      "contentStyle": "Centro de estética femenino en Pontevedra: tonos neutros dorados/crema, close-ups de tratamientos reales, ambientación auténtica del local, antes/después de clientas reales",
      "instagramRefs": [],
      "videoStyle": "Reels de tratamientos en acción, time-lapses de manicura/maquillaje, testimonios de clientas satisfechas, tour del espacio",
      "shootingStyle": "Luz natural o cálida de estudio, close-ups de manos y rostros en tratamiento, ambientación real del local sin stock genérico",
      "avoid": "Imágenes de stock genéricas, colores fríos azulados, lenguaje técnico médico, promesas exageradas"
    },
    "projects": 3,
    "activeBoardId": null,
    "verticals": [
      "MEDIA"
    ],
    "web": "glamourpaobella.com"
  },
{
    "id": "cl-mvr",
    "name": "Academia Telde (Grupo MVR)",
    "initials": "MV",
    "industry": "Formación / Servicios (Canarias)",
    "tagline": "25 años formando Profesionales",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#2C3E50",
      "#C0001E",
      "#4F73B8",
      "#FFFFFF"
    ],
    "colorEmotion": "Rojo carmesí (#C0001E) + azul (#4F73B8): tradición formativa canaria con solidez. Colores REALES de la web",
    "typography": {
      "display": "Open Sans",
      "text": "Open Sans",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "estratégico",
      "sólido",
      "ambicioso",
      "profesional"
    ],
    "toneTemperature": "Estratégico-formal (7/10 formal)",
    "audience": [
      "Empresas en Canarias",
      "Responsables de formación B2B",
      "Directivos de grupo"
    ],
    "contentPillars": [
      "Resultados grupo",
      "Formación sectorial",
      "Talento directivo",
      "RSC"
    ],
    "compositionStyle": "Rojo carmesí como protagonista, fotografía corporativa, datos y resultados como eje central",
    "dont": [
      "improvisación",
      "lenguaje informal",
      "promesas sin base"
    ],
    "logo": {
      "url": "",
      "description": "Logo Grupo MVR: wordmark en rojo carmesí #C0001E sobre fondo oscuro o blanco. Tipografía Inter Bold. Ver brand assets en grupomvr.com.",
      "shape": "Wordmark horizontal GRUPO MVR.",
      "colors": {
        "primary": "#C0001E",
        "background": "#1A0000",
        "light": "#E53030"
      },
      "typography": "Inter Bold",
      "variants": [
        "rojo sobre oscuro (principal)",
        "rojo sobre blanco",
        "blanco sobre rojo"
      ],
      "usage": "Ver brand assets oficiales en grupomvr.com."
    },
    "accent": "#C0001E",
    "bgGradient": "linear-gradient(135deg, #2C3E50 0%, #C0001E 100%)",
    "references": [
      "academias formación Canarias",
      "centros FP Gran Canaria"
    ],
    "visualReferences": {
      "brands": [
        "Grupo MVR"
      ],
      "contentStyle": "Formación corporativa canaria: rojo carmesí sobre negro, fotografía de equipo, datos de impacto, testimonios de empresas clientes",
      "instagramRefs": [
        "@grupomvrformacion"
      ],
      "videoStyle": "Presentaciones de resultados, testimonios de clientes B2B, hitos del grupo, equipo en acción",
      "shootingStyle": "Entornos corporativos canarios, luz natural, planos de equipo y dirección, datos de impacto visibles",
      "avoid": "Informalidad, colores fuera de brand, lenguaje populista"
    },
    "projects": 7,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "academiatelde.com",
    "instagramHandle": "@grupomvrformacion"
  },
{
    "id": "cl-innova",
    "name": "Innova Humana",
    "initials": "IH",
    "industry": "Formación y empleo / Intervención social",
    "tagline": "Impulsamos personas. Activamos oportunidades",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#053793",
      "#F47920",
      "#4D4D4D",
      "#FFFFFF"
    ],
    "colorEmotion": "Naranja (#F47920) + azul (#053793) sobre gris: energía de inserción social y rigor técnico (Instituto Técnico del Agua). Colores REALES",
    "typography": {
      "display": "Open Sans",
      "text": "Open Sans",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "cercano",
      "innovador",
      "comprometido",
      "humano"
    ],
    "toneTemperature": "Inspirador-cercano (5/10 formal)",
    "audience": [
      "Personas en inclusión social y laboral",
      "Demandantes de empleo",
      "Desarrollo personal y profesional"
    ],
    "contentPillars": [
      "Formación para el empleo",
      "Orientación e inserción laboral",
      "Intervención social",
      "Casos de transformación"
    ],
    "compositionStyle": "Fotografía cálida, grupos diversos, espacios luminosos; bloques geométricos naranja/negro/gris al estilo del manual",
    "dont": [
      "burocracia",
      "frialdad corporativa",
      "verde (no es color de marca)"
    ],
    "logo": {
      "url": "",
      "description": "Isologo oficial (Manual de Marca): símbolo 'iH' (H con i integrada formando una persona sentada) en naranja #ff740e + gris #545454, junto al wordmark 'INNOVA HUMANA' y bajada 'FORMACIÓN Y EMPLEO'. Tipografía League Spartan (display) + Montserrat (texto). Variantes sobre naranja, blanco, negro y gris.",
      "shape": "Isologo iH (persona) + INNOVA (naranja) / HUMANA (gris) + FORMACIÓN Y EMPLEO. Ver Manual de Marca en brand assets.",
      "colors": {
        "primary": "#ff740e",
        "secondary": "#545454",
        "dark": "#000000"
      },
      "typography": "League Spartan (display) + Montserrat (texto)",
      "variants": [
        "color sobre blanco/gris",
        "blanco sobre negro",
        "isotipo iH standalone"
      ],
      "usage": "Colores oficiales: naranja #ff740e + negro #000000 + gris #545454. NO usar verde. El isotipo iH puede ir solo."
    },
    "accent": "#F47920",
    "bgGradient": "linear-gradient(135deg, #053793 0%, #F47920 100%)",
    "references": [
      "innova humana (formación y empleo)"
    ],
    "visualReferences": {
      "brands": [
        "Innova Humana"
      ],
      "contentStyle": "Centro socioformativo moderno y humano: fotografía cálida de personas reales, bloques geométricos naranja/negro/gris del manual, foco en inclusión, empleo y desarrollo personal",
      "instagramRefs": [],
      "videoStyle": "Testimonios de transformación en formato documental, sesiones de formación y orientación reales, impacto en inserción laboral, historias de personas",
      "shootingStyle": "Luz natural en espacios abiertos, planos de grupos y acompañamiento, close-ups de expresiones auténticas, entornos formativos reales",
      "avoid": "Frialdad corporativa, burocracia visual, paleta verde (no es de marca)"
    },
    "projects": 5,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "innova-humana.com",
    "instagramHandle": "@innovahumana"
  },
{
    "id": "cl-inprogress",
    "name": "Inprogress Escuela",
    "initials": "IP",
    "industry": "Formación Técnica Profesional",
    "tagline": "Escuela Técnica y Profesional",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#333333",
      "#F49313",
      "#B49313",
      "#FFFFFF"
    ],
    "colorEmotion": "Naranja (#F49313) + oro (#B49313) sobre gris: formación técnica práctica y directa. Colores REALES del CSS",
    "typography": {
      "display": "Anton",
      "text": "Montserrat",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "práctico",
      "motivador",
      "directo",
      "orientado al empleo"
    ],
    "toneTemperature": "Energético-práctico (3/10 formal)",
    "audience": [
      "Jóvenes 16-25",
      "Buscan primer empleo",
      "Cambio de sector profesional"
    ],
    "contentPillars": [
      "Empleos conseguidos",
      "Salidas profesionales",
      "Becas y ayudas",
      "Día a día en clase"
    ],
    "compositionStyle": "Planos de taller real, herramientas, uniformes, jóvenes trabajando",
    "dont": [
      "academicismo",
      "promesas vacías",
      "complejidad"
    ],
    "logo": {
      "url": "",
      "description": "Barra de progreso parcialmente rellena (50-70%, nunca 100%) como símbolo en naranja→amarillo degradado (#F7931E→#FDB913), radius 4pt. Wordmark 'INPROGRESS' en Poppins Bold caps + 'ESCUELA' en Poppins Regular tracking alto debajo. Concepto: siempre en progreso.",
      "shape": "Barra 180x18pt. Relleno degradado H. Wordmark proporcional debajo o al lado.",
      "colors": {
        "primary": "#F7931E",
        "gradient": "#F7931E a #FDB913",
        "background": "#1A1A2E"
      },
      "typography": "Poppins Bold (INPROGRESS) + Poppins Regular tracking alto (ESCUELA)",
      "variants": [
        "barra+wordmark horizontal",
        "barra encima wordmark",
        "solo barra progreso isotipo"
      ],
      "usage": "La barra nunca al 100% — siempre en progreso. Relleno mínimo 40%. No usar sin barra."
    },
    "accent": "#F49313",
    "bgGradient": "linear-gradient(135deg, #333333 0%, #F49313 100%)",
    "references": [
      "ironhack.com",
      "thepowermba.com",
      "nuclio.school"
    ],
    "visualReferences": {
      "brands": [
        "Ironhack",
        "The Power MBA",
        "Nuclio Digital School"
      ],
      "contentStyle": "Formación técnica energética: talleres reales con herramientas profesionales, jóvenes en acción, paleta naranja-amarillo sobre fondo oscuro, texto bold con porcentajes de inserción laboral",
      "instagramRefs": [
        "@ironhack",
        "@thepowermba",
        "@nuclio.school"
      ],
      "videoStyle": "Reels de día de clase real, testimonios de alumnos colocados con salario, before/after de habilidades adquiridas, demos de proyectos finales, speed edit de proceso formativo",
      "shootingStyle": "Talleres con luz de trabajo real, close-ups de manos sobre herramientas/teclados, planos de grupos colaborando, pantallas con proyectos reales visibles",
      "avoid": "Academicismo visual, aulas vacías, promesas sin datos de inserción"
    },
    "projects": 4,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "inprogressformacion.com"
  },
{
    "id": "cl-safe",
    "name": "Safe Abogados",
    "initials": "SA",
    "industry": "Legal / Despacho de Abogados",
    "tagline": "Somos tus abogados en Valladolid",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#2C3848",
      "#36475a",
      "#a7987c",
      "#F8F5F1"
    ],
    "colorEmotion": "Azul pizarra (#36475a) + tierra dorada (#a7987c) + acento coral (#ff4c40): seriedad legal cercana. Colores REALES del CSS",
    "typography": {
      "display": "Montserrat",
      "text": "Montserrat",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "serio",
      "preciso",
      "confiable",
      "cercano"
    ],
    "toneTemperature": "Formal-tranquilizador (8/10 formal)",
    "audience": [
      "Personas en proceso judicial",
      "Empresas con conflictos laborales",
      "Autónomos"
    ],
    "contentPillars": [
      "Derechos del ciudadano",
      "Consultas frecuentes",
      "Casos resueltos",
      "Cambios legislativos"
    ],
    "compositionStyle": "Interiores despacho serios, detalle documentos, profesionales en traje",
    "dont": [
      "ambigüedad",
      "promesas de resultado",
      "lenguaje alarmista"
    ],
    "logo": {
      "url": "",
      "description": "Escudo hexagonal (base apuntada) con contorno dorado #DAA520 2pt, interior transparente/negro. Letra 'S' en Libre Baskerville Italic centrada dentro, dorado. Wordmark 'SAFE ABOGADOS': 'SAFE' en Libre Baskerville Bold dorado + 'ABOGADOS' en Source Serif Regular #F5F5DC tamaño 0.6x. Sin relleno sólido en el escudo.",
      "shape": "Escudo hexagonal 1:1.3, vértice inferior agudo. S cap-height 60% del alto. Wordmark a la derecha alineado centro.",
      "colors": {
        "primary": "#DAA520",
        "secondary": "#B8860B",
        "background": "#0D1117",
        "cream": "#F5F5DC"
      },
      "typography": "Libre Baskerville Italic (S + SAFE) + Source Serif Regular (ABOGADOS)",
      "variants": [
        "escudo+wordmark horizontal",
        "solo escudo dorado",
        "crema sobre dark"
      ],
      "usage": "Escudo nunca relleno sólido. S siempre italic. Mínimo escudo 24px."
    },
    "accent": "#a7987c",
    "bgGradient": "linear-gradient(135deg, #2C3848 0%, #36475a 100%)",
    "references": [
      "perezllorca.com",
      "unalex.es",
      "deloitte.com/legal"
    ],
    "visualReferences": {
      "brands": [
        "Pérez-Llorca",
        "Uría Menéndez",
        "Deloitte Legal"
      ],
      "contentStyle": "Despacho legal de confianza: interiores de despacho serios con luz dorada, documentos y códigos legales como elementos visuales, paleta negro-dorado de autoridad, tipografía serif con peso",
      "instagramRefs": [
        "@perezllorca",
        "@uria_menendez",
        "@garrigues_abogados"
      ],
      "videoStyle": "Explainers legales breves de derechos ciudadanos, consultas frecuentes respondidas en 60s, casos resueltos anonimizados con impacto real, equipo de abogados presentándose",
      "shootingStyle": "Despacho real con libros de derecho al fondo, luz lateral cálida de lámpara, plano medio del abogado hablando a cámara, detalle de documentos firmados",
      "avoid": "Alarmismo, promesas de resultado garantizado, lenguaje informal o coloquial"
    },
    "projects": 3,
    "activeBoardId": null,
    "verticals": [
      "SALES"
    ],
    "web": "safeabogados.com",
    "instagramHandle": "@jaimesanzfernandezsoto"
  },
{
    "id": "cl-miramar",
    "name": "Miramar Stays",
    "initials": "MS",
    "industry": "Turismo / Estancias y cruceros",
    "tagline": "Turismo de calidad",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#503D26",
      "#8E5C1B",
      "#B18B59",
      "#EDEAE3"
    ],
    "colorEmotion": "Dorado-marrón cálido (#B18B59 / #8E5C1B): lujo natural y experiencia premium. Colores REALES de la web (NO azul)",
    "typography": {
      "display": "The Seasons",
      "text": "Inter",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "evocador",
      "exclusivo",
      "experiencial",
      "mediterráneo"
    ],
    "toneTemperature": "Aspiracional-evocador (5/10 formal)",
    "audience": [
      "Parejas 40-65",
      "Familias premium",
      "Viajeros experienciales"
    ],
    "contentPillars": [
      "Destinos y estancias",
      "Experiencia a bordo / alojamiento",
      "Gastronomía y eventos",
      "Ofertas temporada"
    ],
    "compositionStyle": "Mar, estancias y cubierta; atardeceres; lujo natural sin ostentar. 3 sub-marcas: Porto Cabana (azul mar), Ferrol (tonos beige), Rural Lambre (tonos verdes)",
    "dont": [
      "precio como argumento",
      "masificación",
      "genérico"
    ],
    "logo": {
      "url": "",
      "description": "Marca paraguas 'Miramar Stays' (razón social Miramar Cruises SL) con 3 sub-marcas: Porto Cabana, Ferrol, Rural Lambre. Assets oficiales (PDF/AI) en '00. CONTEXTO DEL CLIENTE/01. Marca y Brand Assets/Branding/'. Porto Cabana usa paleta azul mar; Ferrol beige; Lambre verde. NOTA: hex exactos pendientes de extraer de los dossieres (PDF imagen).",
      "shape": "Wordmark 'MIRAMAR' + sub-marca. Ver dossieres oficiales por sub-marca.",
      "colors": {
        "primary": "#003049",
        "wave": "#00B4D8",
        "middle": "#0077B6"
      },
      "typography": "Cormorant Garamond + Inter (pendiente confirmar con manual)",
      "variants": [
        "Porto Cabana (azul)",
        "Ferrol (beige)",
        "Rural Lambre (verde)"
      ],
      "usage": "Marca comercial: Miramar Stays. Razón social legal: Miramar Cruises SL. Cada sub-marca tiene su paleta."
    },
    "accent": "#B18B59",
    "bgGradient": "linear-gradient(135deg, #503D26 0%, #B18B59 100%)",
    "references": [
      "Porto Cabana",
      "Ferrol by Miramar Stays",
      "Rural Lambre"
    ],
    "visualReferences": {
      "brands": [
        "Porto Cabana",
        "Ferrol by Miramar Stays",
        "Rural Lambre"
      ],
      "contentStyle": "Turismo de estancias mediterráneo: alojamientos junto al mar, horizontes al atardecer, aguas turquesas, lujo natural. Cada sub-marca con su paleta (Porto Cabana azul, Ferrol beige, Lambre verde)",
      "instagramRefs": [],
      "videoStyle": "Cinematografía de destino y estancia slow-mo al amanecer, planos del entorno y alojamiento, experiencias (gastronomía, mar), testimonios de huéspedes",
      "shootingStyle": "Golden hour, gran angular del entorno, close-ups de detalles de la estancia, planos del mar y la costa gallega",
      "avoid": "Turismo masivo, precios como argumento, imágenes de multitudes, estética low-cost"
    },
    "projects": 6,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "miramarstays.com",
    "instagramHandle": "@miramarstays"
  },
{
    "id": "cl-opositaxd",
    "name": "Oposita-XD",
    "initials": "OX",
    "industry": "Formación / Oposiciones",
    "tagline": "Aprueba con método",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#1A1A1A",
      "#F58148",
      "#188BF6",
      "#FFFFFF"
    ],
    "colorEmotion": "Naranja (#F58148) + azul (#188BF6): energía y método para oposiciones. Colores REALES del formulario activo",
    "typography": {
      "display": "Space Grotesk",
      "text": "Roboto",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "motivador",
      "estructurado",
      "cercano",
      "enfocado"
    ],
    "toneTemperature": "Motivador-estructurado (5/10 formal)",
    "audience": [
      "Opositores 22-40",
      "Personas con tiempo limitado",
      "Segunda oportunidad laboral"
    ],
    "contentPillars": [
      "Método de estudio",
      "Plazas convocadas",
      "Testimonios aprobados",
      "Tiempo de preparación"
    ],
    "compositionStyle": "Apuntes y libros de estudio, personas concentradas, contadores tiempo",
    "dont": [
      "ansiedad",
      "promesas de plaza garantizada",
      "vaguedad"
    ],
    "logo": {
      "url": "",
      "description": "Checkmark ✓ vectorial púrpura #7C3AED, trazo 4pt, esquinas redondeadas, altura 1.3u. Wordmark: 'OPOSITA' en Inter Black caps + '-XD' en Inter ExtraLight lila #A78BFA. Contraste bold/light refuerza método+diversión. ✓ standalone como badge de logro.",
      "shape": "✓: ángulo 45°/30°, trazo radius 3pt. OPOSITA caps bold. -XD mismo baseline lighter. Ratio ✓/texto 1.3:4.5.",
      "colors": {
        "primary": "#7C3AED",
        "light": "#A78BFA",
        "background": "#1E1E2E"
      },
      "typography": "Inter Black (OPOSITA) + Inter ExtraLight (-XD)",
      "variants": [
        "checkmark+wordmark horizontal",
        "checkmark encima wordmark",
        "solo ✓ badge"
      ],
      "usage": "-XD siempre en lighter weight. ✓ nunca relleno sólido — siempre trazo. Mínimo 20px."
    },
    "accent": "#F58148",
    "bgGradient": "linear-gradient(135deg, #1A1A1A 0%, #F58148 100%)",
    "references": [
      "opomania.net",
      "opositatest.com",
      "tusclases.es"
    ],
    "visualReferences": {
      "brands": [
        "OpoMania",
        "Oposita Test",
        "Tusclases"
      ],
      "contentStyle": "Metodología de estudio gamificada: contadores de tiempo, check lists visuales, estadísticas de progreso en morado, planos de opositores estudiando con método, texto bold motivacional",
      "instagramRefs": [
        "@opomania_es",
        "@opositatest",
        "@tusclases_es"
      ],
      "videoStyle": "Day in the life de un opositor con método, antes/después de planificación de estudio, testimonios de aprobados con número de plazas y tiempo de preparación, speed-through de temario",
      "shootingStyle": "Mesa de estudio ordenada con apuntes y tablet, planos de manos escribiendo o subrayando, entornos de estudio modernos, close-ups de apps de seguimiento de progreso",
      "avoid": "Ansiedad y agobio visual, promesas de plaza garantizada, aulas masificadas"
    },
    "projects": 5,
    "activeBoardId": null,
    "verticals": [
      "SALES",
      "MEDIA"
    ],
    "web": "opositaxd.net",
    "instagramHandle": "@oposita_xd"
  },
{
    "id": "cl-siete",
    "name": "El Siete Formación",
    "initials": "7F",
    "industry": "Formación y consultoría organizacional",
    "tagline": "Tu Consultoría de formación y desarrollo",
    "contact": {
      "name": "Vincent Piñón",
      "email": "vincent@cliender.com",
      "role": "Lead Account Manager"
    },
    "palette": [
      "#081E3F",
      "#E8B800",
      "#006666",
      "#FFFFFF"
    ],
    "colorEmotion": "Oro (#E8B800) + navy (#081E3F) + teal (#006666): cercanía accesible y solidez institucional. Colores REALES de la web",
    "typography": {
      "display": "Poppins",
      "text": "Poppins",
      "mono": "JetBrains Mono"
    },
    "voice": [
      "accesible",
      "directo",
      "institucional",
      "orientado a resultados"
    ],
    "toneTemperature": "Directo-accesible en formaciones · ejecutivo-consultoría en ECIA (5/10 formal)",
    "audience": [
      "Desempleados zona Moaña/Vigo (~80km) — formaciones coste cero",
      "Decisores RRHH y CEO de empresas +100 empleados (ECIA Mapa Conductual B2B)"
    ],
    "contentPillars": [
      "Formaciones coste cero",
      "Inserción y resultado tangible",
      "ECIA: intervención organizacional",
      "Jornadas y plazas limitadas"
    ],
    "compositionStyle": "Fondo oscuro (negro/gris carbón), acento amarillo mostaza, personas en acción real, logos institucionales (Xunta/SEPE/Gobierno) en franja inferior",
    "dont": [
      "ECIA: nunca 'curso'/'alumnos'/'aula'",
      "Formaciones: nunca 'gratis' (usar 'coste cero')",
      "AI-purple o pink",
      "stock con sonrisa forzada"
    ],
    "logo": {
      "url": "",
      "description": "Marca paraguas El Siete Formación: círculo amarillo mostaza con un '7' estilizado en su interior; wordmark 'el sie7e' con el 7 en amarillo. Claim 'Tu Consultoría de formación y desarrollo'. Sub-marca separada ECIA Mapa Conductual tiene logo propio (brújula con 4 colores de perfil conductual).",
      "shape": "Círculo amarillo mostaza con '7' estilizado centrado. Wordmark 'el sie7e' con el 7 destacado en amarillo.",
      "colors": {
        "primary": "#F5BC18",
        "dark": "#1A1A1A"
      },
      "typography": "Raleway",
      "variants": [
        "logo-el-siete-positivo-negativo",
        "logo-el-siete-negativo (SVG/PNG)"
      ],
      "usage": "Assets oficiales en '00. CONTEXTO DEL CLIENTE/01. Marca y Brand Assets/logos/'. Logos institucionales Xunta/SEPE/Gobierno en franja inferior, safe zone 140px mínimo."
    },
    "accent": "#E8B800",
    "bgGradient": "linear-gradient(135deg, #081E3F 0%, #E8B800 100%)",
    "references": [
      "elsieteformacion.com"
    ],
    "visualReferences": {
      "brands": [
        "El Siete Formación (marca paraguas)",
        "ECIA Mapa Conductual (sub-marca B2B)"
      ],
      "contentStyle": "Formación profesional accesible: fondo oscuro con acento amarillo mostaza, personas en acción real (cocina, oficina), entornos colectivos formativos y resultado tangible (plato, certificado, puesto). Logos institucionales en franja inferior. Espacio lateral para claims.",
      "instagramRefs": [],
      "videoStyle": "SeeDance: formaciones coste cero con plazas limitadas, acción real del oficio, mensaje directo zona Moaña/Vigo",
      "shootingStyle": "Personas en tarea real, luz cálida o de estudio según tipología, fondo oscuro que case con paleta, sin poses de stock forzadas",
      "avoid": "AI-purple/pink, lenguaje de 'curso' para ECIA, 'gratis', aulas infantiles, stock genérico"
    },
    "projects": 4,
    "activeBoardId": null,
    "verticals": [
      "MEDIA"
    ],
    "web": "elsieteformacion.com",
    "instagramHandle": "@elsiete.fyd"
  }
];
window.SAMPLE_CLIENTS = SAMPLE_CLIENTS;


// ---------------------------------------------------------------------------
// ClientsPanel — listado y detalle
// ---------------------------------------------------------------------------
// Modal portal para la ficha de cliente
function ClientDetailModal({ client, onClose }) {
  // Cerrar con Escape
  React.useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="form-popup-backdrop" onClick={onClose}>
      <div
        className="form-popup client-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560, width: '90vw', maxHeight: '88vh', overflowY: 'auto', padding: 0 }}
      >
        {/* Header modal */}
        <div className="client-modal-head">
          <div className="client-modal-hero" style={{ background: client.bgGradient }}>
            <div className="client-modal-initials">{client.initials}</div>
            <div className="client-modal-hero-text">
              <div className="client-modal-name">{client.name}</div>
              <div className="client-modal-tagline mono">"{client.tagline}"</div>
            </div>
          </div>
          <button className="client-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* KPIs */}
        <div className="client-modal-kpis">
          <div className="client-modal-kpi">
            <div className="client-modal-kpi-val">{client.projects || 0}</div>
            <div className="client-modal-kpi-label mono">proyectos</div>
          </div>
          <div className="client-modal-kpi">
            <div className="client-modal-kpi-val">{client.contentPillars?.length || 0}</div>
            <div className="client-modal-kpi-label mono">pilares</div>
          </div>
          <div className="client-modal-kpi">
            <div className="client-modal-kpi-val">{client.verticals?.length || 1}</div>
            <div className="client-modal-kpi-label mono">verticales</div>
          </div>
        </div>

        <div className="client-modal-body">

          {/* Paleta + Emoción de color */}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Paleta de marca</div>
            <div className="client-palette">
              {client.palette.map((c) => (
                <div key={c} className="client-swatch">
                  <div className="client-swatch-color" style={{ background: c }} />
                  <div className="mono client-swatch-hex">{c}</div>
                </div>
              ))}
            </div>
            {client.colorEmotion && (
              <div className="client-color-emotion mono">{client.colorEmotion}</div>
            )}
          </div>

          {/* Tipografía */}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Tipografía</div>
            <div className="client-typo">
              <div className="typo-row"><span className="mono typo-label">display</span><span className="typo-name">{client.typography.display}</span></div>
              <div className="typo-row"><span className="mono typo-label">texto</span><span className="typo-name">{client.typography.text}</span></div>
              <div className="typo-row"><span className="mono typo-label">mono</span><span className="typo-name">{client.typography.mono}</span></div>
            </div>
          </div>

          {/* Audiencia */}
          {client.audience?.length > 0 && (
            <div className="client-modal-section">
              <div className="drawer-section-label mono">Audiencia objetivo</div>
              <div className="client-tags">
                {client.audience.map((a) => <span key={a} className="client-tag client-tag-audience">{a}</span>)}
              </div>
            </div>
          )}

          {/* Voz de marca + Tono */}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Voz de marca</div>
            <div className="client-tags">
              {client.voice.map((v) => <span key={v} className="client-tag client-tag-good">{v}</span>)}
            </div>
            {client.toneTemperature && (
              <div className="client-tone-badge mono">
                <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/>
                </svg>
                {client.toneTemperature}
              </div>
            )}
          </div>

          {/* Pilares de contenido */}
          {client.contentPillars?.length > 0 && (
            <div className="client-modal-section">
              <div className="drawer-section-label mono">Pilares de contenido</div>
              <div className="client-tags">
                {client.contentPillars.map((p, i) => (
                  <span key={p} className="client-tag client-tag-pillar">
                    <span className="client-pillar-num">{i + 1}</span>{p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Estilo de composición */}
          {client.compositionStyle && (
            <div className="client-modal-section">
              <div className="drawer-section-label mono">Estilo visual / composición</div>
              <div className="client-composition mono">{client.compositionStyle}</div>
            </div>
          )}

          {/* Anti-patrones */}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Anti-patrones — nunca usar</div>
            <div className="client-tags">
              {client.dont.map((v) => <span key={v} className="client-tag client-tag-bad">— {v}</span>)}
            </div>
          </div>

          {/* Webs de referencia */}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Referentes del sector</div>
            <div className="client-refs">
              {(client.references || []).map((r) => (
                <a key={r} className="client-ref" href={`https://${r}`} target="_blank" rel="noopener">
                  <span className="client-ref-dot" />
                  <span className="mono">{r}</span>
                  <span className="client-ref-arrow">↗</span>
                </a>
              ))}
            </div>
          </div>

          {/* Sistema de producción visual */}
          {client.visualReferences && (
            <div className="client-modal-section client-visual-system">
              <div className="drawer-section-label mono">Sistema de producción visual</div>

              {/* Marcas de referencia */}
              {client.visualReferences.brands?.length > 0 && (
                <div className="client-vr-row">
                  <div className="client-vr-label mono">marcas referentes</div>
                  <div className="client-tags">
                    {client.visualReferences.brands.map((b) => (
                      <span key={b} className="client-tag client-tag-brand">◈ {b}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Estilo de contenido */}
              {client.visualReferences.contentStyle && (
                <div className="client-vr-row">
                  <div className="client-vr-label mono">estilo visual</div>
                  <div className="client-vr-text mono">{client.visualReferences.contentStyle}</div>
                </div>
              )}

              {/* Instagram refs */}
              {client.visualReferences.instagramRefs?.length > 0 && (
                <div className="client-vr-row">
                  <div className="client-vr-label mono">instagram referentes</div>
                  <div className="client-tags">
                    {client.visualReferences.instagramRefs.map((h) => (
                      <a key={h} className="client-tag client-tag-ig"
                        href={`https://instagram.com/${h.replace('@','')}`}
                        target="_blank" rel="noopener">
                        {h} ↗
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Estilo de video */}
              {client.visualReferences.videoStyle && (
                <div className="client-vr-row">
                  <div className="client-vr-label mono">estilo de vídeo</div>
                  <div className="client-vr-text mono">{client.visualReferences.videoStyle}</div>
                </div>
              )}

              {/* Shooting style */}
              {client.visualReferences.shootingStyle && (
                <div className="client-vr-row">
                  <div className="client-vr-label mono">shooting / fotografía</div>
                  <div className="client-vr-text mono">{client.visualReferences.shootingStyle}</div>
                </div>
              )}

              {/* Evitar */}
              {client.visualReferences.avoid && (
                <div className="client-vr-row">
                  <div className="client-vr-label mono" style={{color:"var(--danger,#ef4444)"}}>evitar siempre</div>
                  <div className="client-vr-text mono" style={{color:"var(--danger,#ef4444)",opacity:0.8}}>{client.visualReferences.avoid}</div>
                </div>
              )}
            </div>
          )}

          {/* Contacto */}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Contacto</div>
            <div className="client-contact">
              <div className="client-contact-avatar">{client.contact.name.split(' ').map(p=>p[0]).join('')}</div>
              <div>
                <div className="client-contact-name">{client.contact.name}</div>
                <div className="client-contact-role mono">{client.contact.role}</div>
                <a className="client-contact-email" href={`mailto:${client.contact.email}`}>{client.contact.email}</a>
              </div>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ padding: '16px 0 4px', display: 'flex', gap: 8 }}>
            <button
              className="btn-soft"
              style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => {
                const logo = client.logo;
                const lines = [
                  `=== CONTEXTO IA: ${client.name} ===`,
                  `Sector: ${client.industry} | Web: ${client.web || 'N/A'}`,
                  ``,
                  `LOGO:`,
                  `  Descripción: ${logo?.description || 'N/A'}`,
                  `  Forma: ${logo?.shape || 'N/A'}`,
                  `  Tipografía logo: ${logo?.typography || 'N/A'}`,
                  `  Variantes: ${(logo?.variants||[]).join(' | ') || 'N/A'}`,
                  `  Reglas de uso: ${logo?.usage || 'N/A'}`,
                  `  Colores logo: ${logo?.colors ? JSON.stringify(logo.colors) : 'N/A'}`,
                  ``,
                  `PALETA: ${client.palette.join(' | ')}`,
                  `EMOCIÓN DE COLOR: ${client.colorEmotion || 'N/A'}`,
                  ``,
                  `TIPOGRAFÍA MARCA: display=${client.typography.display} / texto=${client.typography.text}`,
                  ``,
                  `VOZ: ${(client.voice||[]).join(', ')} | TONO: ${client.toneTemperature || 'N/A'}`,
                  ``,
                  `AUDIENCIA: ${(client.audience||[]).join(' | ')}`,
                  ``,
                  `PILARES: ${(client.contentPillars||[]).map((p,i) => `${i+1}. ${p}`).join(' | ')}`,
                  ``,
                  `COMPOSICIÓN VISUAL: ${client.compositionStyle || 'N/A'}`,
                  ``,
                  `EVITAR: ${(client.dont||[]).join(' | ')}`,
                  `REFERENTES: ${(client.references||[]).join(' | ')}`,
                ];
                navigator.clipboard.writeText(lines.join('\n')).then(() =>
                  window.__notify?.({ kind: 'success', icon: '❖', title: 'Contexto IA copiado', body: 'Pega en el Prompt Node — Claude ya tiene el ADN del cliente' })
                );
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 12, height: 12 }}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copiar contexto IA
            </button>
            <button className="btn-soft" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClientsPanel({ clients, activeClientId: activeClientIdProp, setActiveClientId: setActiveClientIdProp, onClose, onOpenCreate }) {
  const [localActiveId, setLocalActiveId] = React.useState(null);
  const selectClient = React.useCallback((id) => {
    setLocalActiveId(id);
    if (typeof setActiveClientIdProp === 'function') setActiveClientIdProp(id);
  }, [setActiveClientIdProp]);
  const active = clients.find((c) => c.id === localActiveId);
  return (
    <>
      <DrawerHeader
        title="Clientes"
        subtitle="marcas conectadas a Claude"
        onClose={onClose} />

      <div className="drawer-body scroll-thin">
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
            <ClientCard key={c.id} client={c} onClick={() => selectClient(c.id)} />
          )}
        </div>
        <div className="empty-state" style={{ marginTop: 18, padding: "18px 16px" }}>
          <div className="mono" style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "var(--text-3)", textTransform: "uppercase" }}>auto-sync</div>
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-3)", lineHeight: 1.55 }}>
            Los clientes se sincronizan automáticamente desde la memoria central.
          </div>
        </div>
      </div>

      {/* Modal portal — fuera del drawer */}
      {active && <ClientDetailModal client={active} onClose={() => selectClient(null)} />}
    </>);

}

function ClientCard({ client, onClick }) {
  return (
    <button className={"client-card" + (client._pinned ? " client-card--pinned" : "")} onClick={onClick}
      style={client._pinned ? { border: '1.5px solid rgba(167,139,250,0.55)', boxShadow: '0 0 18px rgba(167,139,250,0.18)' } : {}}>
      <div className="client-avatar" style={{ background: client.bgGradient }}>
        <span className="client-avatar-text">{client.initials}</span>
      </div>
      <div className="client-card-meta">
        {client._pinned && (
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:2 }}>
            <span style={{ fontSize:9, fontFamily:'var(--font-mono)', letterSpacing:'0.18em', textTransform:'uppercase', color:'#A78BFA', background:'rgba(167,139,250,0.12)', border:'1px solid rgba(167,139,250,0.3)', padding:'1px 6px', borderRadius:20 }}>Nosotros</span>
          </div>
        )}
        <div className="client-card-name" style={client._pinned ? { color:'#C4B5FD', fontWeight:600 } : {}}>{client.name}</div>
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

      {client.verticals && (
        <Section label="Verticales activas">
          <div className="client-tags">
            {client.verticals.map((v) => (
              <span key={v} className={"client-tag client-tag-vertical client-tag-" + v.toLowerCase()}>{v}</span>
            ))}
          </div>
        </Section>
      )}

      {client.web && (
        <Section label="Web">
          <a className="client-ref" href={"https://" + client.web} target="_blank" rel="noopener">
            <span className="client-ref-dot" />
            <span className="mono">{client.web}</span>
            <span className="client-ref-arrow">↗</span>
          </a>
        </Section>
      )}

      <div className="client-actions">
        <button className="btn-soft">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 12, height: 12 }}><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><path d="M12 5v14M5 12h14"/></svg>
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
          
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 12, height: 12 }}><path d="M12 5v14M5 12h14"/></svg>
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
  const [showForm, setShowForm] = React.useState(false);
  const [newName, setNewName] = React.useState('');
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    if (showForm) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showForm]);

  const handleCreate = () => {
    if (!newName.trim()) return;
    onCreate(newName.trim());
    setNewName('');
    setShowForm(false);
  };

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

        {showForm ? (
          <div className="proj-new-form">
            <div className="drawer-section-label mono" style={{ marginBottom: 10 }}>Nuevo proyecto</div>
            <input
              ref={inputRef}
              className="form-input"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') { setShowForm(false); setNewName(''); } }}
              placeholder="Nombre del proyecto…"
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button className="form-btn-ghost" style={{ flex: 1 }} onClick={() => { setShowForm(false); setNewName(''); }}>Cancelar</button>
              <button className="form-btn-primary" style={{ flex: 1 }} disabled={!newName.trim()} onClick={handleCreate}>Crear</button>
            </div>
          </div>
        ) : (
          <button className="add-client-btn" onClick={() => setShowForm(true)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 14, height: 14 }}><path d="M12 5v14M5 12h14"/></svg>
            Nuevo proyecto
          </button>
        )}

        {projects.length === 0 && !showForm &&
        <div className="empty-state">
            <div className="empty-state-icon">🗂</div>
            <div className="empty-state-title">Sin proyectos todavía</div>
            <div className="empty-state-body">
              Crea uno para guardar el flujo completo del canvas. Podrás retomarlo donde lo dejaste.
            </div>
          </div>
        }

        {groups.filter((g) => g.items.length > 0).map((g) =>
        <div key={g.client?.id || "_orphans"} className="project-group">
            <div className="project-group-head">
              {g.client
                ? <div className="project-group-avatar" style={{ background: g.client.bgGradient }}><span>{g.client.initials}</span></div>
                : <div className="project-group-avatar project-group-avatar-ghost">∅</div>
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
        
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{ width: 13, height: 13 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>);

}

// ---------------------------------------------------------------------------
// SettingsPanel — configuración funcional de la herramienta
// ---------------------------------------------------------------------------
const MASTER_EMAIL    = "nicolas@cliender.com";
const MASTER_PASSWORD = "Master123";

function SettingsPanel({ theme, setTheme, onClose }) {
  const [apiStatus, setApiStatus] = React.useState({ anthropic: null, kie: null, backend: null });
  const [dangerStep, setDangerStep] = React.useState(0); // 0=idle 1=confirm 2=password
  const [dangerPwd, setDangerPwd]   = React.useState("");
  const [dangerErr, setDangerErr]   = React.useState("");

  React.useEffect(() => {
    fetch(`${window.CDPRO_CONFIG.API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
      .then(r => r.json())
      .then(d => setApiStatus({
        anthropic: d.anthropic !== false,
        kie:       d.kie       !== false,
        backend:   true,
      }))
      .catch(() => setApiStatus({ anthropic: false, kie: false, backend: false }));
  }, []);

  const userEmail    = localStorage.getItem("cdpro-user-email") || "";
  const rawName      = userEmail.split("@")[0];
  const userName     = rawName.charAt(0).toUpperCase() + rawName.slice(1) || "Usuario";
  const userInitials = rawName.slice(0,2).toUpperCase() || "?";
  const userAvatarPhoto = (() => { try { const p = JSON.parse(localStorage.getItem("cliender-profile") || "{}"); return p.avatarPhoto || "prototype/assets/avatars/avatar-1.png"; } catch(e) { return "prototype/assets/avatars/avatar-1.png"; } })();

  const StatusBadge = ({ ok }) => {
    if (ok === null) return <span className="sett-badge sett-badge-checking">···</span>;
    return ok
      ? <span className="sett-badge sett-badge-ok"><span className="sett-badge-dot" />online</span>
      : <span className="sett-badge sett-badge-err"><span className="sett-badge-dot sett-badge-dot-err" />offline</span>;
  };

  function handleDangerConfirm() {
    if (dangerPwd === MASTER_PASSWORD) {
      localStorage.clear();
      window.__notify?.({ kind: "info", icon: "✕", title: "Datos eliminados", body: "Recarga la página para empezar de cero." });
      setDangerStep(0);
      setDangerPwd("");
      setDangerErr("");
    } else {
      setDangerErr("Contraseña incorrecta. Acceso denegado.");
    }
  }

  return (
    <>
      <DrawerHeader title="Ajustes" subtitle="apariencia · integraciones · cuenta" onClose={onClose} />
      <div className="drawer-body scroll-thin">

        {/* ── PERFIL — solo avatar + nombre ── */}
        <div className="sett-profile">
          <div className="sett-profile-avatar" style={{padding:0,overflow:"hidden"}}>
            <img src={userAvatarPhoto} alt="avatar"
              style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",display:"block",borderRadius:"inherit"}}
              onError={e=>{e.currentTarget.style.display="none"; e.currentTarget.parentNode.textContent=userInitials;}}/>
          </div>
          <div className="sett-profile-info">
            <div className="sett-profile-name">{userName}</div>
          </div>
          <span className="sett-profile-pro mono">Pro</span>
        </div>

        {/* ── WORKSPACE ── */}
        <div className="sett-workspace">
          <img src="prototype/assets/logos/Logo1Purple.svg" alt="Cliender" className="sett-ws-logo" />
          <div className="sett-ws-info">
            <div className="sett-ws-name">Design Pro Workspace</div>
            <div className="sett-ws-meta mono">v0.4 · HBD Revolution SL · 11 clientes activos</div>
          </div>
        </div>

        {/* ── APARIENCIA ── */}
        <div className="sett-group">
          <div className="sett-group-label mono">Apariencia</div>

          {/* Tema */}
          <div className="sett-row">
            <div className="sett-row-left">
              <span className="sett-row-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="4"/>
                  <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>
                </svg>
              </span>
              <div>
                <div className="sett-row-title">Tema</div>
                <div className="sett-row-sub mono">dark · light · auto</div>
              </div>
            </div>
            <div className="sett-seg">
              {[{id:"dark",label:"Dark"},{id:"light",label:"Light"},{id:"system",label:"Auto"}].map(t =>
                <button key={t.id} className={"sett-seg-btn" + (theme===t.id ? " is-on" : "")} onClick={() => setTheme(t.id)}>{t.label}</button>
              )}
            </div>
          </div>

          {/* Acento — fijo Cliender */}
          <div className="sett-row">
            <div className="sett-row-left">
              <span className="sett-row-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>
                </svg>
              </span>
              <div>
                <div className="sett-row-title">Acento</div>
                <div className="sett-row-sub mono">color dominante UI</div>
              </div>
            </div>
            <div className="sett-accent-fixed">
              <span className="sett-accent-fixed-disc" />
              <span className="sett-accent-fixed-label mono">Cliender Purple</span>
            </div>
          </div>

          {/* Movimiento — fijo Full */}
          <div className="sett-row">
            <div className="sett-row-left">
              <span className="sett-row-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
                </svg>
              </span>
              <div>
                <div className="sett-row-title">Movimiento</div>
                <div className="sett-row-sub mono">animaciones y edges</div>
              </div>
            </div>
            <span className="sett-fixed-tag">Full</span>
          </div>

          {/* Densidad — fija Confort */}
          <div className="sett-row">
            <div className="sett-row-left">
              <span className="sett-row-icon">
                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <rect x="14" y="14" width="7" height="7" rx="1"/>
                </svg>
              </span>
              <div>
                <div className="sett-row-title">Densidad</div>
                <div className="sett-row-sub mono">tamaño de nodos</div>
              </div>
            </div>
            <span className="sett-fixed-tag">Confort</span>
          </div>
        </div>

        {/* ── INTEGRACIONES ── */}
        <div className="sett-group">
          <div className="sett-group-label mono">Integraciones</div>

          {/* Anthropic */}
          <div className="sett-int-card">
            <div className="sett-int-icon" style={{background:"linear-gradient(135deg,#D97757,#C84F2F)"}}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
                <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
              </svg>
            </div>
            <div className="sett-int-meta">
              <div className="sett-int-title">Anthropic Claude</div>
              <div className="sett-int-sub mono">claude-sonnet-4-6 · cerebro cognitivo</div>
            </div>
            <StatusBadge ok={apiStatus.anthropic} />
          </div>

          {/* KIE.ai */}
          <div className="sett-int-card">
            <div className="sett-int-icon" style={{background:"linear-gradient(135deg,#F59E0B,#D97706)"}}>
              <span style={{color:"#0F1018",fontWeight:800,fontSize:15}}>K</span>
            </div>
            <div className="sett-int-meta">
              <div className="sett-int-title">KIE.ai</div>
              <div className="sett-int-sub mono">gpt-image-2 · seedance-2.0 · motor visual</div>
            </div>
            <StatusBadge ok={apiStatus.kie} />
          </div>

          {/* FastAPI Backend */}
          <div className="sett-int-card">
            <div className="sett-int-icon" style={{background:"linear-gradient(135deg,#4F6EF7,#2D4FDB)"}}>
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round">
                <rect x="2" y="3" width="20" height="14" rx="2"/>
                <path d="M8 21h8M12 17v4"/>
              </svg>
            </div>
            <div className="sett-int-meta">
              <div className="sett-int-title">FastAPI Backend</div>
              <div className="sett-int-sub mono">localhost:3003 · LangGraph · SSE</div>
            </div>
            <StatusBadge ok={apiStatus.backend} />
          </div>
        </div>

        {/* ── CUENTA ── */}
        <div className="sett-group">
          <div className="sett-group-label mono">Cuenta</div>
          <button className="sett-btn" onClick={() => {
            const _doLogout = () => { localStorage.removeItem("cdpro_session"); window.location.href = "Login.html"; };
            if (window.__confirm) window.__confirm("¿Cerrar sesión y volver al login?", { confirmText: "Cerrar sesión" }).then((ok) => { if (ok) _doLogout(); });
            else _doLogout();
          }}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Cerrar sesión
          </button>
        </div>

        {/* ── ZONA DE PELIGRO ── */}
        <div className="sett-group sett-danger-zone">
          <div className="sett-group-label mono" style={{color:"rgba(251,113,133,0.65)"}}>Zona de peligro</div>

          {dangerStep === 0 && (
            <button className="sett-btn sett-btn-danger" onClick={() => setDangerStep(1)}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
              Borrar todos los datos locales
            </button>
          )}

          {dangerStep === 1 && (
            <div className="sett-danger-confirm">
              <div className="sett-danger-warn mono">⚠ Esta acción borrará localStorage completo y no se puede deshacer.</div>
              <div className="sett-danger-confirm-actions">
                <button className="sett-btn" onClick={() => setDangerStep(0)}>Cancelar</button>
                <button className="sett-btn sett-btn-danger" onClick={() => { setDangerStep(2); setDangerErr(""); }}>Continuar</button>
              </div>
            </div>
          )}

          {dangerStep === 2 && (
            <div className="sett-danger-auth">
              <div className="sett-danger-auth-label mono">Introduce la contraseña maestra</div>
              <div className="sett-danger-auth-hint mono">{MASTER_EMAIL}</div>
              <input
                type="password"
                className="sett-danger-input"
                placeholder="Contraseña maestra…"
                value={dangerPwd}
                autoFocus
                onChange={e => { setDangerPwd(e.target.value); setDangerErr(""); }}
                onKeyDown={e => {
                  if (e.key === "Enter")  handleDangerConfirm();
                  if (e.key === "Escape") { setDangerStep(0); setDangerPwd(""); setDangerErr(""); }
                }}
              />
              {dangerErr && <div className="sett-danger-error mono">{dangerErr}</div>}
              <div className="sett-danger-confirm-actions">
                <button className="sett-btn" onClick={() => { setDangerStep(0); setDangerPwd(""); setDangerErr(""); }}>Cancelar</button>
                <button className="sett-btn sett-btn-danger" onClick={handleDangerConfirm}>Borrar ahora</button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="sett-foot">
          <img src="prototype/assets/logos/Logo1Purple.svg" alt="" className="sett-foot-logo" />
          <span className="mono">ClienderDesign v0.4 · {new Date().toISOString().slice(0,10)}</span>
        </div>

      </div>
    </>
  );
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
// SAMPLE_AGENTS — solo Shaq (agente por defecto)
// ---------------------------------------------------------------------------
const SAMPLE_AGENTS = [
  {
    id: "ag-shaq",
    name: "Shaq",
    role: "Agente General",
    specialty: "Producción mixta, video + imagen",
    description: "Agente versátil listo para adaptarse a cualquier brief creativo. Equilibra la expresión visual con los objetivos de negocio.",
    tono: "Profesional con carácter propio",
    objetivo: "Maximizar impacto visual manteniendo coherencia de marca",
    sector: "Generalista",
    accent: "#6366F1",
    initials: "SQ",
    style: ["versátil", "adaptable", "equilibrado"],
    avoid: [],
  },
];

// ---------------------------------------------------------------------------
// AgentFicha — tarjeta expandible con info completa
// ---------------------------------------------------------------------------
function AgentFicha({ agent, onEdit, onDelete }) {
  const [expanded, setExpanded] = React.useState(false);
  const color = agent.accent || "#6366F1";

  return (
    <div className="agent-card" style={{ "--agent-color": color }}>
      <div className="agent-card-head" onClick={() => setExpanded((v) => !v)} style={{ cursor: "pointer" }}>
        <span className="agent-card-avatar" style={{ background: color, padding:0, overflow:"hidden" }}>
          {agent.agentPhoto
            ? <img src={agent.agentPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",display:"block"}}
                onError={e=>{e.currentTarget.style.display="none";e.currentTarget.parentNode.textContent=agent.initials;}}/>
            : agent.initials}
        </span>
        <div className="agent-card-info">
          <div className="agent-card-name">/{agent.name.toLowerCase()}</div>
          <div className="agent-card-role mono">{agent.role}</div>
        </div>
        <div className="agent-card-actions" onClick={(e) => e.stopPropagation()}>
          <button className="agent-card-btn" onClick={() => onEdit(agent)} title="Editar">&#9998;</button>
          <button className="agent-card-btn agent-card-btn-del" onClick={() => onDelete(agent.id)} title="Eliminar">&#10005;</button>
        </div>
        <span className="agent-card-chevron mono">{expanded ? "▲" : "▼"}</span>
      </div>

      <div className="agent-card-specialty mono">{agent.specialty}</div>

      {expanded && (
        <div className="agent-ficha">
          {agent.description && (
            <div className="ficha-row">
              <span className="ficha-label mono">descripción</span>
              <span className="ficha-val">{agent.description}</span>
            </div>
          )}
          {agent.tono && (
            <div className="ficha-row">
              <span className="ficha-label mono">tono</span>
              <span className="ficha-val">{agent.tono}</span>
            </div>
          )}
          {agent.objetivo && (
            <div className="ficha-row">
              <span className="ficha-label mono">objetivo</span>
              <span className="ficha-val">{agent.objetivo}</span>
            </div>
          )}
          {agent.sector && (
            <div className="ficha-row">
              <span className="ficha-label mono">sector</span>
              <span className="ficha-val">{agent.sector}</span>
            </div>
          )}
          {agent.style?.length > 0 && (
            <div className="ficha-row ficha-row-tags">
              <span className="ficha-label mono">estilo</span>
              <div className="agent-card-tags">
                {agent.style.map((s, i) => <span key={i} className="agent-tag">{s}</span>)}
              </div>
            </div>
          )}
          {agent.avoid?.length > 0 && (
            <div className="ficha-row ficha-row-tags">
              <span className="ficha-label mono">evitar</span>
              <div className="agent-card-tags">
                {agent.avoid.map((s, i) => <span key={i} className="agent-tag agent-tag-avoid">{s}</span>)}
              </div>
            </div>
          )}
          <button className="ficha-edit-btn" onClick={() => onEdit(agent)}>&#9998; Editar ficha completa</button>
        </div>
      )}

      {!expanded && agent.style?.length > 0 && (
        <div className="agent-card-tags">
          {agent.style.slice(0, 4).map((s, i) => <span key={i} className="agent-tag">{s}</span>)}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentsPanel — listado y CRUD de agentes creativos
// ---------------------------------------------------------------------------
function AgentsPanel({ agents, onAdd, onEdit, onDelete, onClose }) {
  const [showForm, setShowForm] = React.useState(false);
  const [showAI, setShowAI] = React.useState(false);
  const [editing, setEditing] = React.useState(null);

  const openCreate = () => { setEditing(null); setShowForm(true); };
  const openEdit   = (a) => { setEditing(a);   setShowForm(true); };
  const handleSave = (data) => {
    if (editing) onEdit({ ...editing, ...data });
    else         onAdd(data);
    setShowForm(false);
    setShowAI(false);
  };

  return (
    <>
      <DrawerHeader title="Agentes Creativos" subtitle="personaliza tu equipo IA" onClose={onClose} />
      <div className="drawer-body scroll-thin">

        <div className="agents-actions-row">
          <button className="agents-btn-new" onClick={openCreate}>
            <span className="agents-btn-icon">+</span>
            <span>Nuevo agente</span>
          </button>
          <button className="agents-btn-ai" onClick={() => setShowAI(true)}>
            <span className="agents-btn-icon">&#10022;</span>
            <span>Crear con IA</span>
          </button>
        </div>

        {agents.length === 0 && (
          <div className="agent-panel-empty mono">
            Aún no tienes agentes. Crea el primero para personalizar
            cómo la supercomputadora interpreta cada brief.
          </div>
        )}

        {agents.map((a) => (
          <AgentFicha key={a.id} agent={a} onEdit={openEdit} onDelete={onDelete} />
        ))}
      </div>

      {showForm && (
        <NewAgentPopup
          open={showForm}
          initial={editing}
          onSave={handleSave}
          onClose={() => setShowForm(false)} />
      )}

      {showAI && (
        <AIAgentPopup
          open={showAI}
          onSave={handleSave}
          onClose={() => setShowAI(false)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// WIZARD_STEPS — 15 preguntas carousel para creación de agentes IA
// Tipos: "single" (una opción), "multi" (varias), "text" (input), "textarea"
// ---------------------------------------------------------------------------
const WIZARD_STEPS = [
  { id: "agent_name", label: "¿Cuál es el nombre de este agente?", sub: "Dale un nombre memorable y único", type: "text", placeholder: "Ej: Pablo, Aria, Max Creative..." },
  { id: "role", label: "¿Cuál es el rol principal?", sub: "Define su función y especialidad", type: "single",
    options: [
      { id: "creative",    icon: "🎨", label: "Creativo visual",   desc: "Diseño, imagen, estética" },
      { id: "copywriter",  icon: "✍",  label: "Copywriter",        desc: "Textos, headlines, scripts" },
      { id: "strategist",  icon: "🎯", label: "Estratega",         desc: "Planificación, dirección" },
      { id: "director",    icon: "🎬", label: "Director de arte",  desc: "Dirección visual, estilo" },
      { id: "analyst",     icon: "📊", label: "Analítico",         desc: "Datos, métricas, insights" },
      { id: "mixed",       icon: "⚙",  label: "Generalista",      desc: "Cross-vertical adaptable" },
    ],
  },
  { id: "industry", label: "¿Para qué sector o industria?", sub: "Contexto del negocio objetivo", type: "single",
    options: [
      { id: "fashion",     icon: "👗", label: "Moda/Lifestyle",    desc: "Ropa, accesorios, estilo" },
      { id: "tech_ai",     icon: "⚡", label: "Tech/IA",            desc: "Software, innovación" },
      { id: "education",   icon: "📚", label: "Educación",         desc: "Cursos, formación" },
      { id: "hospitality", icon: "🏨", label: "Hostelería",        desc: "Hoteles, restaurantes" },
      { id: "health",      icon: "⚕",  label: "Salud/Wellness",   desc: "Médico, bienestar" },
      { id: "general_b",   icon: "✶",  label: "General B2C",      desc: "Gran público" },
    ],
  },
  { id: "tone", label: "¿Qué tono de comunicación usa?", sub: "Cómo se dirige a la audiencia", type: "single",
    options: [
      { id: "bold_d",        icon: "⚡",  label: "Atrevido y directo",    desc: "Sin filtros, potente" },
      { id: "sophisticated", icon: "✨",  label: "Sofisticado",           desc: "Refinado, exclusivo" },
      { id: "close",         icon: "😊", label: "Cercano y humano",      desc: "Accesible, genuino" },
      { id: "technical",     icon: "🔬", label: "Técnico y preciso",     desc: "Exacto, data-driven" },
      { id: "inspirational", icon: "⭐",  label: "Inspiracional",        desc: "Motivador, aspiracional" },
    ],
  },
  { id: "content_type", label: "¿Qué tipo de contenido crea principalmente?", sub: "Formato de salida principal", type: "single",
    options: [
      { id: "image",     icon: "🖼",  label: "Imagen/foto",  desc: "Estática, gráficos" },
      { id: "short_vid", icon: "🎬", label: "Video corto",  desc: "Reels, TikToks" },
      { id: "long_vid",  icon: "🎥", label: "Video largo",  desc: "Documentales" },
      { id: "copy_t",    icon: "✍",  label: "Copy/texto",  desc: "Captions, artículos" },
      { id: "full_mix",  icon: "🎨", label: "Mix completo", desc: "Todo integrado" },
    ],
  },
  { id: "platform", label: "¿Qué plataforma es la principal?", sub: "Donde publica más contenido", type: "single",
    options: [
      { id: "ig_p",      icon: "📸", label: "Instagram",     desc: "Feed, Stories, Reels" },
      { id: "tiktok_p",  icon: "🎵", label: "TikTok",        desc: "Vídeos virales" },
      { id: "linkedin_p",icon: "💼", label: "LinkedIn",      desc: "Contenido profesional" },
      { id: "youtube_p", icon: "🎥", label: "YouTube",       desc: "Long form" },
      { id: "web_p",     icon: "🌐", label: "Web/Blog",      desc: "Sitio propio" },
      { id: "ads_p",     icon: "📊", label: "Campañas paid", desc: "Ads, email" },
    ],
  },
  { id: "audience", label: "¿Quién es la audiencia objetivo?", sub: "Perfil demográfico principal", type: "single",
    options: [
      { id: "gen_z",         icon: "📱", label: "Gen Z (16-24)",       desc: "Jóvenes, digitales" },
      { id: "millennials",   icon: "💻", label: "Millennials (25-35)", desc: "Profesionales jóvenes" },
      { id: "professionals", icon: "💼", label: "Profesionales 35+",  desc: "Maduros, establecidos" },
      { id: "b2b_aud",       icon: "🏢", label: "B2B empresas",       desc: "Clientes corporativos" },
      { id: "general_aud",   icon: "📢", label: "Masivo/general",     desc: "Público amplio" },
    ],
  },
  { id: "differentiator", label: "¿Cuál es el mayor diferenciador de la marca?", sub: "Su mayor ventaja competitiva", type: "single",
    options: [
      { id: "tech",     icon: "⚡", label: "Tecnología e IA",   desc: "Innovación y automatización" },
      { id: "quality",  icon: "💎", label: "Calidad premium",   desc: "Excelencia y exclusividad" },
      { id: "price",    icon: "💰", label: "Mejor valor",       desc: "Relación precio-resultado" },
      { id: "service",  icon: "🤝", label: "Servicio personal", desc: "Atención y cercanía" },
      { id: "results",  icon: "📊", label: "Resultados reales", desc: "ROI y métricas" },
      { id: "creative", icon: "🎨", label: "Creatividad única", desc: "Diferenciación visual" },
    ],
  },
  { id: "visual_style", label: "¿Qué estilo visual define la marca?", sub: "Paleta, composición y atmósfera", type: "single",
    options: [
      { id: "minimalist",icon: "◻",  label: "Minimalista y limpio",    desc: "Espacio blanco, sencillo" },
      { id: "dark_cin",  icon: "🌑", label: "Oscuro y cinematográfico",desc: "Mood, contraste" },
      { id: "colorful",  icon: "🎨", label: "Colorido y vibrante",     desc: "Saturado, energía" },
      { id: "editorial", icon: "📰", label: "Editorial y sofisticado", desc: "Tipografía, jerarquía" },
      { id: "raw_auth",  icon: "📸", label: "Raw y auténtico",         desc: "Natural, sin filtro" },
    ],
  },
  { id: "frequency", label: "¿Con qué frecuencia publica?", sub: "Ritmo de producción de contenido", type: "single",
    options: [
      { id: "daily",     icon: "📅", label: "Diario",           desc: "Todos los días" },
      { id: "freq_3",    icon: "📆", label: "3-4 veces/semana", desc: "Regular, constante" },
      { id: "weekly",    icon: "📊", label: "Semanal",          desc: "Una vez por semana" },
      { id: "campaigns", icon: "🎯", label: "Por campañas",     desc: "Según necesidad" },
    ],
  },
  { id: "avoid_txt", label: "¿Qué debe EVITAR siempre?", sub: "Selecciona los anti-patrones de esta marca", type: "multi",
    options: [
      { id: "stock",     icon: "📸", label: "Stock genérico",    desc: "Fotos de banco clichés" },
      { id: "corporate", icon: "🏢", label: "Lenguaje corp.",    desc: "Jerga vacía y formal" },
      { id: "neon",      icon: "🌈", label: "Colores neón",      desc: "Saturación excesiva" },
      { id: "posed",     icon: "🧍", label: "Poses forzadas",    desc: "Artificialidad" },
      { id: "complex",   icon: "📊", label: "Información densa", desc: "Gráficos recargados" },
      { id: "low_fi",    icon: "📵", label: "Baja calidad",      desc: "Pixelado, mal editado" },
    ],
  },
  { id: "visual_ref", label: "¿Qué estética te inspira más?", sub: "El referente visual que más admiras", type: "single",
    options: [
      { id: "apple",   icon: "🍎", label: "Apple minimal",   desc: "Minimalismo premium" },
      { id: "netflix", icon: "🎬", label: "Netflix dark",    desc: "Cinematográfico oscuro" },
      { id: "nike",    icon: "👟", label: "Nike bold",       desc: "Potente y dinámico" },
      { id: "spotify", icon: "🟢", label: "Spotify color",  desc: "Datos y color vivo" },
      { id: "airbnb",  icon: "🏠", label: "Airbnb human",   desc: "Editorial y cercano" },
      { id: "tesla",   icon: "⚡", label: "Tesla futurista", desc: "Tech y aspiracional" },
    ],
  },
  { id: "cta", label: "¿Cuál es el CTA más usado?", sub: "Acción principal que pide al usuario", type: "single",
    options: [
      { id: "buy_now",    icon: "💳", label: "Compra ahora",    desc: "E-commerce directo" },
      { id: "book_apt",   icon: "📅", label: "Reserva tu cita", desc: "Servicios, agenda" },
      { id: "download_c", icon: "⬇",  label: "Descarga gratis", desc: "Lead magnet" },
      { id: "follow_c",   icon: "👁",  label: "Síguenos",       desc: "Comunidad, RRSS" },
      { id: "discover_c", icon: "🔍", label: "Descúbrelo",      desc: "Curiosidad, click" },
      { id: "custom_c",   icon: "⚙",  label: "Personalizado",  desc: "Otro CTA propio" },
    ],
  },
];

// ---------------------------------------------------------------------------
// NewAgentPopup — cards + portal, igual que wizard IA
// ---------------------------------------------------------------------------
const _AGENT_SECTORS = [
  { id:"fashion",    icon:"👗", label:"Moda / Lifestyle",  desc:"Ropa, lujo, estilo" },
  { id:"tech",       icon:"⚡", label:"Tech / IA",          desc:"Innovación, software" },
  { id:"education",  icon:"📚", label:"Educación",          desc:"Cursos, formación" },
  { id:"hospitality",icon:"🏨", label:"Hostelería",         desc:"Hoteles, restaurantes" },
  { id:"health",     icon:"⚕",  label:"Salud / Wellness",  desc:"Médico, bienestar" },
  { id:"general",   icon:"✶",   label:"General B2C",        desc:"Gran público" },
];
const _AGENT_TONOS = [
  { id:"bold",   icon:"⚡", label:"Atrevido",      desc:"Sin filtros, potente" },
  { id:"lux",    icon:"✨", label:"Sofisticado",   desc:"Refinado, exclusivo" },
  { id:"close",  icon:"😊", label:"Cercano",       desc:"Accesible, genuino" },
  { id:"tech",   icon:"🔬", label:"Técnico",       desc:"Exacto, data-driven" },
  { id:"inspo",  icon:"⭐", label:"Inspiracional", desc:"Motivador, aspiracional" },
];
const _AGENT_VSTYLES = [
  { id:"minimal",  icon:"◻", label:"Minimalista",     desc:"Limpio, espacio blanco" },
  { id:"dark_cin", icon:"🌑", label:"Cinematográfico", desc:"Oscuro, contraste" },
  { id:"editorial",icon:"📰", label:"Editorial",       desc:"Tipografía, jerarquía" },
  { id:"colorful", icon:"🎨", label:"Vibrante",        desc:"Saturado, energía" },
  { id:"raw",      icon:"📸", label:"Raw / Auténtico", desc:"Natural, sin filtro" },
  { id:"futurist", icon:"🔮", label:"Futurista",       desc:"CGI, tech visual" },
];
const _AGENT_OBJS = [
  { id:"engagement", icon:"💬", label:"Engagement",  desc:"Interacción y comunidad" },
  { id:"conversion", icon:"💳", label:"Conversión",  desc:"Ventas y leads" },
  { id:"branding",   icon:"✦",  label:"Branding",    desc:"Identidad y reconocimiento" },
  { id:"education",  icon:"📖", label:"Educación",   desc:"Informar y formar" },
];
const _AGENT_COLORS = ["#8B5CF6","#6366F1","#EC4899","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"];

function NewAgentPopup({ open, initial, onSave, onClose }) {
  if (!open) return null;
  const ACCENTS = _AGENT_COLORS;
  const blank = { name:"", role:"", description:"", accent:"#8B5CF6", initials:"", sector:"", tono:"", vstyle:[], objetivo:"", agentPhoto:"" };
  const [form, setForm] = React.useState(() => {
    if (!initial) return blank;
    return { name:initial.name||"", role:initial.role||"", description:initial.description||"",
             accent:initial.accent||"#8B5CF6", initials:initial.initials||"",
             agentPhoto:initial.agentPhoto||"",
             sector:_AGENT_SECTORS.find(s=>(initial.sector||"").toLowerCase().includes(s.label.split("/")[0].trim().toLowerCase()))?.id||"",
             tono:_AGENT_TONOS.find(t=>(initial.tono||"").toLowerCase().includes(t.label.toLowerCase()))?.id||"",
             vstyle:(initial.style||[]).map(s=>_AGENT_VSTYLES.find(x=>s.toLowerCase().includes(x.label.toLowerCase()))?.id||"").filter(Boolean),
             objetivo:_AGENT_OBJS.find(o=>(initial.objetivo||"").toLowerCase().includes(o.label.toLowerCase()))?.id||"" };
  });

  const set = (k, v) => setForm(f => ({...f, [k]: v}));
  const toggleVstyle = id => set("vstyle", form.vstyle.includes(id) ? form.vstyle.filter(x=>x!==id) : [...form.vstyle, id]);
  const liveInitials = form.initials.trim() || form.name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||"").join("") || "?";

  React.useEffect(() => {
    const fn = e => { if (e.key==="Escape") onClose(); };
    document.addEventListener("keydown", fn);
    return () => document.removeEventListener("keydown", fn);
  }, []);

  const handleSave = () => {
    if (!form.name.trim()) return;
    const sl = _AGENT_SECTORS.find(s=>s.id===form.sector)?.label || "";
    const tl = _AGENT_TONOS.find(t=>t.id===form.tono)?.label || "";
    const vs = form.vstyle.map(s=>_AGENT_VSTYLES.find(x=>x.id===s)?.label||s);
    const ol = _AGENT_OBJS.find(o=>o.id===form.objetivo)?.label || "";
    onSave({ id:initial?.id||("ag-"+Date.now().toString(36)), name:form.name.trim(),
      role:form.role.trim()||"Agente Creativo", specialty:"", description:form.description.trim(),
      tono:tl, objetivo:ol, sector:sl, accent:form.accent, initials:liveInitials, style:vs, avoid:[],
      agentPhoto:form.agentPhoto||"" });
  };

  const SectionLabel = ({children}) => (
    <div className="mono" style={{fontSize:9,letterSpacing:"0.18em",textTransform:"uppercase",color:"var(--accent,#A78BFA)",opacity:.7,marginBottom:10,marginTop:18,display:"flex",alignItems:"center",gap:6}}>
      <span style={{width:4,height:4,borderRadius:"50%",background:"var(--accent,#A78BFA)",boxShadow:"0 0 5px var(--accent,#A78BFA)",display:"inline-block"}}/>
      {children}
    </div>
  );

  const content = (
    <div className="form-popup-backdrop" onClick={onClose} style={{zIndex:9000}}>
      <div className="ai-wiz-modal" style={{maxWidth:660}} onClick={e=>e.stopPropagation()}>

        {/* Progress bar */}
        <div className="ai-wiz-progress-track">
          <div className="ai-wiz-progress-fill" style={{width: form.name&&form.sector&&form.tono ? "100%" : form.name ? "55%" : "15%"}}/>
        </div>

        {/* Topbar */}
        <div className="ai-wiz-topbar">
          <div style={{width:28,height:28,borderRadius:8,background:form.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,color:"#fff",flexShrink:0,transition:"background .2s",overflow:"hidden",padding:0}}>
            {form.agentPhoto
              ? <img src={form.agentPhoto} alt="" style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top",display:"block"}}/>
              : liveInitials}
          </div>
          <span className="ai-wiz-kicker mono">
            {initial ? "✎ editar agente" : "✦ nuevo agente"}
            {form.name ? " · /" + form.name.toLowerCase().replace(/\s+/g,"_") : ""}
          </span>
          {/* Color picker */}
          <div style={{display:"flex",gap:5,alignItems:"center"}}>
            {_AGENT_COLORS.map(c=>(
              <button key={c} type="button" onClick={()=>set("accent",c)}
                style={{width:14,height:14,borderRadius:"50%",background:c,border:"none",cursor:"pointer",flexShrink:0,
                  outline:form.accent===c?"2.5px solid "+c:"none",outlineOffset:2,transition:"outline .15s"}}/>
            ))}
          </div>
          <button className="agent-form-close" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>

        <div className="ai-wiz-question-wrap" style={{paddingBottom:6}}>

          {/* Avatar del agente — 6 iconos preset */}
          <SectionLabel>avatar del agente</SectionLabel>
          <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:10,marginBottom:14}}>
            {Array.from({length:6},(_,i)=>{
              const url=`prototype/assets/avatars/agent-${i+1}.png`;
              const isSel=form.agentPhoto===url;
              return (
                <button key={i} type="button" onClick={()=>set("agentPhoto",url)}
                  title={`Icono ${i+1}`}
                  style={{padding:0,border:"none",background:"none",cursor:"pointer",borderRadius:14,overflow:"hidden",position:"relative",
                    boxShadow:isSel?"0 0 0 3px var(--accent,#A78BFA),0 4px 16px rgba(167,139,250,0.4)":"0 0 0 1px rgba(255,255,255,0.08)",
                    transform:isSel?"scale(1.1)":"scale(1)",transition:"box-shadow .2s,transform .2s"}}
                  onMouseEnter={e=>{if(!isSel)e.currentTarget.style.transform="scale(1.06)";}}
                  onMouseLeave={e=>{if(!isSel)e.currentTarget.style.transform="scale(1)";}}>
                  <img src={url} alt="" style={{width:"100%",aspectRatio:"1",objectFit:"cover",objectPosition:"top",display:"block"}}
                    onError={e=>{e.currentTarget.parentNode.style.opacity=".3";}}/>
                  {isSel&&<span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(167,139,250,0.28)",fontSize:13,color:"#fff"}}>✓</span>}
                </button>
              );
            })}
          </div>

          {/* Nombre + Rol */}
          <SectionLabel>identidad</SectionLabel>
          <div className="form-row" style={{gap:10,marginBottom:0}}>
            <div style={{flex:2}}>
              <div className="field-label" style={{fontSize:11,marginBottom:5,opacity:.55}}>Nombre *</div>
              <input className="ai-wiz-text-input" value={form.name} onChange={e=>set("name",e.target.value)}
                placeholder="Ej: Aria, Pablo, Nova…" required autoFocus/>
            </div>
            <div style={{flex:1}}>
              <div className="field-label" style={{fontSize:11,marginBottom:5,opacity:.55}}>Rol</div>
              <input className="ai-wiz-text-input" value={form.role} onChange={e=>set("role",e.target.value)} placeholder="Director creativo"/>
            </div>
          </div>

          {/* Sector */}
          <SectionLabel>sector</SectionLabel>
          <div className="ai-wiz-options ai-wiz-opts-6">
            {_AGENT_SECTORS.map(s=>(
              <button key={s.id} type="button" className={"ai-wiz-opt"+(form.sector===s.id?" is-sel":"")} onClick={()=>set("sector",s.id)}>
                <span className="ai-wiz-opt-icon">{s.icon}</span>
                <span className="ai-wiz-opt-name">{s.label}</span>
                <span className="ai-wiz-opt-desc mono">{s.desc}</span>
                {form.sector===s.id&&<span className="ai-wiz-opt-check">✓</span>}
              </button>
            ))}
          </div>

          {/* Tono */}
          <SectionLabel>tono de comunicación</SectionLabel>
          <div className="ai-wiz-options ai-wiz-opts-5">
            {_AGENT_TONOS.map(t=>(
              <button key={t.id} type="button" className={"ai-wiz-opt"+(form.tono===t.id?" is-sel":"")} onClick={()=>set("tono",t.id)}>
                <span className="ai-wiz-opt-icon">{t.icon}</span>
                <span className="ai-wiz-opt-name">{t.label}</span>
                <span className="ai-wiz-opt-desc mono">{t.desc}</span>
                {form.tono===t.id&&<span className="ai-wiz-opt-check">✓</span>}
              </button>
            ))}
          </div>

          {/* Estilo visual (multi) */}
          <SectionLabel>estilo visual <span style={{opacity:.4,fontSize:8,fontFamily:"inherit"}}> · selección múltiple</span></SectionLabel>
          <div className="ai-wiz-options ai-wiz-opts-6">
            {_AGENT_VSTYLES.map(s=>(
              <button key={s.id} type="button" className={"ai-wiz-opt"+(form.vstyle.includes(s.id)?" is-sel":"")} onClick={()=>toggleVstyle(s.id)}>
                <span className="ai-wiz-opt-icon">{s.icon}</span>
                <span className="ai-wiz-opt-name">{s.label}</span>
                <span className="ai-wiz-opt-desc mono">{s.desc}</span>
                {form.vstyle.includes(s.id)&&<span className="ai-wiz-opt-check">✓</span>}
              </button>
            ))}
          </div>

          {/* Objetivo */}
          <SectionLabel>objetivo principal</SectionLabel>
          <div className="ai-wiz-options ai-wiz-opts-4">
            {_AGENT_OBJS.map(o=>(
              <button key={o.id} type="button" className={"ai-wiz-opt"+(form.objetivo===o.id?" is-sel":"")} onClick={()=>set("objetivo",o.id)}>
                <span className="ai-wiz-opt-icon">{o.icon}</span>
                <span className="ai-wiz-opt-name">{o.label}</span>
                <span className="ai-wiz-opt-desc mono">{o.desc}</span>
                {form.objetivo===o.id&&<span className="ai-wiz-opt-check">✓</span>}
              </button>
            ))}
          </div>

          {/* Descripción (opcional) */}
          <div className="field-label" style={{fontSize:11,marginBottom:5,marginTop:18,opacity:.45}}>
            Descripción adicional <span className="mono">(opcional)</span>
          </div>
          <textarea className="ai-wiz-textarea-input" rows={2} value={form.description}
            onChange={e=>set("description",e.target.value)}
            placeholder="Personalidad, contexto o instrucciones extra para este agente…"/>
        </div>

        <div className="ai-wiz-nav">
          <button type="button" className="ai-wiz-nav-back" onClick={onClose}>Cancelar</button>
          <button type="button" className={"ai-wiz-nav-next"+(form.name.trim()?"":" is-disabled")}
            onClick={form.name.trim()?handleSave:undefined}>
            {initial ? "✓ Guardar cambios" : "✦ Crear agente"}
          </button>
        </div>

      </div>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
}

// ---------------------------------------------------------------------------
// AIAgentPopup — wizard premium con IA real (Claude via /agent/build-profile)
// ---------------------------------------------------------------------------
const GEN_STEPS_LABELS = [
  "Analizando perfil y sector…",
  "Calibrando voz y tono de marca…",
  "Diseñando especialidad y nicho…",
  "Construyendo descripción profesional…",
  "Aplicando estilo y anti-patrones…",
  "Finalizando agente IA…",
];

function AIAgentPopup({ open, onSave, onClose }) {
  if (!open) return null;
  const TOTAL = WIZARD_STEPS.length;
  const [step, setStep] = React.useState(0);
  const [answers, setAnswers] = React.useState({});
  const [phase, setPhase] = React.useState("quiz");
  const [editGen, setEditGen] = React.useState(null);
  const [genData, setGenData] = React.useState(null);
  const [genStepIdx, setGenStepIdx] = React.useState(0);
  const [genError, setGenError] = React.useState(null);

  const cur = WIZARD_STEPS[step] || {};
  const sel = answers[cur.id] || [];
  const textVal = typeof answers[cur.id] === "string" ? answers[cur.id] : "";
  const isTextType = cur.type === "text" || cur.type === "textarea";
  // agent_name es opcional — si lo dejan vacío se auto-genera un nombre
  const isOptional = cur.id === "agent_name" || cur.id === "tagline" || cur.id === "extra_info";
  const canNext = isOptional || (isTextType ? textVal.trim().length > 0 : sel.length > 0);

  // Keyboard nav: Enter avanza, Esc cierra
  React.useEffect(() => {
    const onKey = (e) => {
      if (phase !== "quiz") return;
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "Enter" && !e.shiftKey) {
        if (document.activeElement?.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (canNext) goNext();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [phase, canNext, step]);

  const toggle = (optId) => {
    setAnswers((prev) => {
      const existing = prev[cur.id] || [];
      if (cur.type === "single") return { ...prev, [cur.id]: [optId] };
      if (existing.includes(optId)) return { ...prev, [cur.id]: existing.filter((x) => x !== optId) };
      return { ...prev, [cur.id]: [...existing, optId] };
    });
  };
  const setText = (val) => setAnswers((prev) => ({ ...prev, [cur.id]: val }));
  const goNext = () => {
    if (!canNext) return;
    if (step < TOTAL - 1) { setStep((s) => s + 1); return; }
    buildAgent();
  };
  const goPrev = () => { if (step > 0) setStep((s) => s - 1); };

  // Construye mapa de respuestas con labels legibles para el LLM
  const buildAnswerMap = () => {
    const out = {};
    WIZARD_STEPS.forEach((s) => {
      const val = answers[s.id];
      if (!val || (Array.isArray(val) && val.length === 0)) return;
      if (s.type === "single" || s.type === "multi") {
        const ids = Array.isArray(val) ? val : [val];
        const labels = ids.map((id) => (s.options || []).find((o) => o.id === id)?.label || id);
        out[s.label || s.id] = labels.join(", ");
      } else {
        out[s.label || s.id] = val;
      }
    });
    return out;
  };

  const buildAgent = async () => {
    setPhase("generating");
    setGenStepIdx(0);
    setGenError(null);
    let idx = 0;
    const ticker = setInterval(() => {
      idx++;
      if (idx >= GEN_STEPS_LABELS.length) { clearInterval(ticker); return; }
      setGenStepIdx(idx);
    }, 650);

    try {
      const base = (window.CDPRO_CONFIG && window.CDPRO_CONFIG.API_BASE) || "http://localhost:3003";
      const resp = await fetch(base + "/agent/build-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: buildAnswerMap(),
          suggested_name: typeof answers.agent_name === "string" ? answers.agent_name : "",
        }),
      });
      clearInterval(ticker);
      setGenStepIdx(GEN_STEPS_LABELS.length - 1);
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      const data = await resp.json();
      if (data.error && !data.name) throw new Error(data.error);
      const result = {
        id: "ag-" + Date.now().toString(36),
        name: data.name || "Aria", initials: (data.name || "AI").slice(0, 2).toUpperCase(),
        role: data.role || "Agente Creativo IA",
        specialty: data.specialty || "",
        description: data.description || "",
        tono: data.tono || "",
        objetivo: data.objetivo || "",
        sector: data.sector || "",
        tagline: data.tagline || "",
        style: Array.isArray(data.style) ? data.style : [],
        avoid: Array.isArray(data.avoid) ? data.avoid : [],
        accent: data.accent || "#8B5CF6",
      };
      setGenData(result);
      setEditGen({ ...result, style: result.style.join(", "), avoid: result.avoid.join(", ") });
      setTimeout(() => setPhase("preview"), 350);
    } catch (err) {
      clearInterval(ticker);
      const ACCENTS = ["#8B5CF6","#EC4899","#6366F1","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"];
      const NAMES = ["Aria","Nexo","Lumen","Vex","Orbit","Kael","Mira","Enzo","Lyra","Dex"];
      const nameTxt = typeof answers.agent_name === "string" ? answers.agent_name.trim() : "";
      const name = nameTxt || NAMES[Math.floor(Math.random() * NAMES.length)];
      const findLabel = (sid, id) => (WIZARD_STEPS.find((s) => s.id === sid)?.options || []).find((o) => o.id === id)?.label || "";
      const getSel = (sid) => ((answers[sid] || [])[0]);
      const roleL = findLabel("role", getSel("role"));
      const indL  = findLabel("industry", getSel("industry"));
      const toneL = findLabel("tone", getSel("tone"));
      const avoidTxt = typeof answers.avoid_txt === "string" ? answers.avoid_txt : "";
      const result = {
        id: "ag-" + Date.now().toString(36), name, initials: name.slice(0,2).toUpperCase(),
        role: roleL ? `Agente ${roleL}` : "Agente Creativo IA",
        specialty: indL || "Marketing Digital",
        description: `Agente IA ${indL ? "para " + indL : ""}. Voz ${(toneL || "profesional").toLowerCase()}.`,
        tono: toneL || "Profesional y directo",
        objetivo: "Engagement · CTA: Descúbrelo",
        sector: indL || "Generalista", tagline: "",
        style: ["editorial","clean"],
        avoid: avoidTxt ? avoidTxt.split(",").map(s=>s.trim()).filter(Boolean) : [],
        accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
      };
      setGenData(result);
      setEditGen({ ...result, style: result.style.join(", "), avoid: result.avoid.join(", ") });
      setGenError("Generado localmente (backend no disponible)");
      setTimeout(() => setPhase("preview"), 350);
    }
  };

  const saveGenerated = () => {
    const initials = (editGen.initials || editGen.name.slice(0,2)).toUpperCase();
    onSave({
      ...genData, ...editGen, initials,
      style: editGen.style.split(",").map((s) => s.trim()).filter(Boolean),
      avoid: editGen.avoid.split(",").map((s) => s.trim()).filter(Boolean),
    });
  };

  const setEG = (k, v) => setEditGen((g) => ({ ...g, [k]: v }));

  // Portal a document.body para escapar del drawer (overflow:hidden / transform rompen position:fixed)
  const content = (
    <div className="form-popup-backdrop" onClick={onClose} style={{ zIndex: 9000 }}>
      <div className="ai-wiz-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── QUIZ ── */}
        {phase === "quiz" && (
          <>
            <div className="ai-wiz-progress-track">
              <div className="ai-wiz-progress-fill" style={{ width: ((step / TOTAL) * 100) + "%" }} />
            </div>
            <div className="ai-wiz-topbar">
              <span className="ai-wiz-kicker mono">&#10022; crear agente con ia</span>
              <span className="ai-wiz-counter mono">{step + 1} / {TOTAL}</span>
              <button className="agent-form-close" onClick={onClose} aria-label="Cerrar">&#10005;</button>
            </div>
            <div className="ai-wiz-question-wrap" key={step}>
              {cur.type === "multi" && <div className="ai-wiz-multi-badge mono">selección múltiple</div>}
              <div className="ai-wiz-q-label">{cur.label}</div>
              <div className="ai-wiz-q-sub mono">{cur.sub}</div>
              {(cur.type === "single" || cur.type === "multi") && (
                <div className={"ai-wiz-options ai-wiz-opts-" + (cur.options || []).length}>
                  {(cur.options || []).map((opt) => {
                    const active = sel.includes(opt.id);
                    return (
                      <button key={opt.id} type="button"
                        className={"ai-wiz-opt" + (active ? " is-sel" : "")}
                        onClick={() => toggle(opt.id)}>
                        <span className="ai-wiz-opt-icon">{opt.icon}</span>
                        <span className="ai-wiz-opt-name">{opt.label}</span>
                        <span className="ai-wiz-opt-desc mono">{opt.desc}</span>
                        {active && <span className="ai-wiz-opt-check">&#10003;</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {cur.type === "text" && (
                <div className="ai-wiz-form-group">
                  <input className="ai-wiz-text-input" type="text"
                    value={textVal} onChange={(e) => setText(e.target.value)}
                    placeholder={cur.placeholder || "Escribe aquí..."} autoFocus />
                </div>
              )}
              {cur.type === "textarea" && (
                <div className="ai-wiz-form-group">
                  <textarea className="ai-wiz-textarea-input"
                    value={textVal} onChange={(e) => setText(e.target.value)}
                    placeholder={cur.placeholder || "Escribe aquí..."} rows={4} autoFocus />
                </div>
              )}
            </div>
            <div className="ai-wiz-nav">
              <button type="button" className="ai-wiz-nav-back" onClick={step > 0 ? goPrev : onClose}>
                {step === 0 ? "Cancelar" : "← Atrás"}
              </button>
              {/* Saltar — siempre disponible (excepto en último paso donde generamos) */}
              {step < TOTAL - 1 && (
                <button type="button" className="ai-wiz-nav-skip"
                  onClick={() => setStep((s) => s + 1)}>
                  Saltar
                </button>
              )}
              <button type="button" className={"ai-wiz-nav-next" + (canNext ? "" : " is-disabled")}
                onClick={canNext ? goNext : undefined}>
                {step === TOTAL - 1 ? "✦ Generar con IA" : "Siguiente →"}
              </button>
            </div>
          </>
        )}

        {/* ── GENERATING ── */}
        {phase === "generating" && (
          <div className="ai-wiz-generating">
            <div className="ai-wiz-gen-fluid" aria-hidden="true" />
            <div className="ai-wiz-gen-rings">
              <div className="ai-wiz-gen-ring r1" />
              <div className="ai-wiz-gen-ring r2" />
              <div className="ai-wiz-gen-ring r3" />
              <div className="ai-wiz-gen-core" />
            </div>
            <div className="ai-wiz-gen-title">Construyendo tu agente IA</div>
            <div className="ai-wiz-gen-sub mono">Claude está analizando {TOTAL} parámetros</div>
            <div className="ai-wiz-gen-steps">
              {GEN_STEPS_LABELS.map((label, i) => (
                <div key={i} className={
                  "ai-wiz-gen-step" +
                  (i < genStepIdx ? " done" : i === genStepIdx ? " active" : "")
                } style={{ animationDelay: i * 0.1 + "s" }}>
                  <span className="ai-wiz-gen-step-dot" />{label}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {phase === "preview" && editGen && (
          <>
            <div className="ai-wiz-progress-track">
              <div className="ai-wiz-progress-fill" style={{ width: "100%" }} />
            </div>
            <div className="ai-wiz-topbar">
              <span className="ai-wiz-kicker mono">&#10022; agente generado · revisa y ajusta</span>
              <button className="agent-form-close" onClick={onClose} aria-label="Cerrar">&#10005;</button>
            </div>
            <div className="ai-wiz-preview-body">
              <div className="ai-wiz-preview-tag mono">&#10003; generado con claude ia</div>
              {genError && (
                <div className="mono" style={{ fontSize:10, opacity:0.4, marginBottom:8 }}>{genError}</div>
              )}
              <div className="ai-wiz-preview-avatar-row">
                <span className="ai-wiz-preview-avatar" style={{ background: editGen.accent }}>
                  {editGen.initials}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input className="node-input" value={editGen.name}
                    onChange={(e) => setEG("name", e.target.value)} placeholder="Nombre" style={{ marginBottom: 5 }} />
                  <input className="node-input" value={editGen.role}
                    onChange={(e) => setEG("role", e.target.value)} placeholder="Rol" />
                </div>
              </div>
              {editGen.specialty && (
                <div className="mono" style={{ fontSize:10, opacity:0.45, marginBottom:10, letterSpacing:"0.1em" }}>
                  {editGen.specialty}
                </div>
              )}
              <div className="field-label">Descripción</div>
              <textarea className="node-input node-textarea" rows={3}
                value={editGen.description} onChange={(e) => setEG("description", e.target.value)} />
              <div className="form-row" style={{ marginTop:10, gap:8 }}>
                <div style={{ flex:1 }}>
                  <div className="field-label">Tono</div>
                  <input className="node-input" value={editGen.tono} onChange={(e) => setEG("tono", e.target.value)} />
                </div>
                <div style={{ flex:1 }}>
                  <div className="field-label">Sector</div>
                  <input className="node-input" value={editGen.sector} onChange={(e) => setEG("sector", e.target.value)} />
                </div>
              </div>
              <div className="field-label" style={{ marginTop:10 }}>Tagline</div>
              <input className="node-input" value={editGen.tagline || ""} onChange={(e) => setEG("tagline", e.target.value)} placeholder="Frase de marca del agente…" />
              <div className="field-label" style={{ marginTop:10 }}>
                Tags estilo <span className="mono" style={{ opacity:0.4 }}>(comas)</span>
              </div>
              <input className="node-input" value={editGen.style} onChange={(e) => setEG("style", e.target.value)} />
              <div className="field-label" style={{ marginTop:10 }}>
                Evitar <span className="mono" style={{ opacity:0.4 }}>(comas)</span>
              </div>
              <input className="node-input" value={editGen.avoid} onChange={(e) => setEG("avoid", e.target.value)} />
              <div style={{ height:12 }} />
            </div>
            <div className="ai-wiz-nav">
              <button type="button" className="ai-wiz-nav-back"
                onClick={() => { setPhase("quiz"); setStep(0); setGenData(null); setEditGen(null); setGenError(null); }}>
                ← Rehacer
              </button>
              <button type="button" className="ai-wiz-nav-next" onClick={saveGenerated}>
                ✦ Guardar agente
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
  return ReactDOM.createPortal(content, document.body);
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
  RailIcons,
  AgentsPanel,
  NewAgentPopup,
  SAMPLE_AGENTS,
  AgentFicha,
  AIAgentPopup,
  WIZARD_STEPS,
});