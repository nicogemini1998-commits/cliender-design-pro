import React from 'react'
import ReactDOM from 'react-dom'
import { Icon, StatusDot } from './nodes.jsx'
import { CDPRO_CONFIG } from './config.js'

/* leftmenu.jsx — LeftRail, drawers, panels, forms, agents wizard */

// ---------------------------------------------------------------------------
// Rail icons
// ---------------------------------------------------------------------------
const RailIcons = {
  Nodes: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="9" width="6" height="6" rx="1.5"/><rect x="15" y="3" width="6" height="6" rx="1.5"/><rect x="15" y="15" width="6" height="6" rx="1.5"/><path d="M9 12h3M12 12V6h3M12 12v6h3"/></svg>,
  Moodboard: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M12 3a8 8 0 1 0 0 16 3 3 0 0 1 0 6 11 11 0 1 1 0-22z"/><circle cx="7" cy="13" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="8" r="1.4" fill="currentColor" stroke="none"/><circle cx="17" cy="13" r="1.4" fill="currentColor" stroke="none"/></svg>,
  Gallery: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/></svg>,
  Clients: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3 2.7-5 6-5s6 2 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 19c.3-2.2 1.9-3.5 3.5-3.5 1.6 0 2.7 1 3 2.5"/></svg>,
  Projects: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M3 11h18"/></svg>,
  Settings: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .35 1.85l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.85-.35 1.7 1.7 0 0 0-1.05 1.55V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.85.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.65 15a1.7 1.7 0 0 0-1.55-1.05H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.65 9a1.7 1.7 0 0 0-.35-1.85l-.06-.06A2 2 0 1 1 7.07 4.26l.06.06A1.7 1.7 0 0 0 9 4.65a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 15 4.65a1.7 1.7 0 0 0 1.85-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.35 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.55 1z"/></svg>,
  Agents: (p) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"/><circle cx="19" cy="8" r="2.2"/><path d="M22 17c0-2.2-1.8-4-3-4.5"/><circle cx="5" cy="8" r="2.2"/><path d="M2 17c0-2.2 1.8-4 3-4.5"/><path d="M12 8v2M10 11h4" strokeLinecap="round"/></svg>,
};

function RailItem({ icon, label, active, onClick, count, hotkey }) {
  return (
    <button type="button" className={"rail-item " + (active ? "is-active" : "")}
      onClick={onClick} title={label + (hotkey ? ` (${hotkey})` : "")} data-tip={label}>
      <div className="rail-item-icon">{icon}</div>
      {count > 0 && <div className="rail-item-badge mono">{count}</div>}
      {active && <span className="rail-item-marker"/>}
    </button>
  );
}

function LeftRail({ activeTab, onTab, galleryCount, hasLockedMoodboard, clientsCount, projectsCount, agentsCount }) {
  return (
    <nav className="leftrail">
      <RailItem icon={<RailIcons.Nodes width={22} height={22}/>} label="Nodos" active={activeTab==="nodes"} onClick={()=>onTab(activeTab==="nodes"?null:"nodes")} hotkey="N"/>
      <RailItem icon={<RailIcons.Clients width={22} height={22}/>} label="Clientes" active={activeTab==="clients"} onClick={()=>onTab(activeTab==="clients"?null:"clients")} hotkey="C" count={clientsCount}/>
      <RailItem icon={<RailIcons.Projects width={22} height={22}/>} label="Proyectos" active={activeTab==="projects"} onClick={()=>onTab(activeTab==="projects"?null:"projects")} hotkey="P" count={projectsCount}/>
      <RailItem icon={<RailIcons.Moodboard width={22} height={22}/>} label="Moodboard" active={activeTab==="moodboard"} onClick={()=>onTab(activeTab==="moodboard"?null:"moodboard")} hotkey="M" count={hasLockedMoodboard?1:0}/>
      <RailItem icon={<RailIcons.Gallery width={22} height={22}/>} label="Galería" active={activeTab==="gallery"} onClick={()=>onTab(activeTab==="gallery"?null:"gallery")} hotkey="G" count={galleryCount}/>
      <RailItem icon={<RailIcons.Agents width={22} height={22}/>} label="Agentes Creativos" active={activeTab==="agents"} onClick={()=>onTab(activeTab==="agents"?null:"agents")} hotkey="A" count={agentsCount}/>
      <div className="rail-spacer"/>
      <RailItem icon={<RailIcons.Settings width={20} height={20}/>} label="Ajustes" active={activeTab==="settings"} onClick={()=>onTab(activeTab==="settings"?null:"settings")}/>
    </nav>
  );
}

function DrawerHeader({ title, subtitle, onClose }) {
  return (
    <div className="drawer-head">
      <div>
        <div className="drawer-title">{title}</div>
        {subtitle && <div className="drawer-kicker mono">{subtitle}</div>}
      </div>
      <button className="super-close" onClick={onClose} aria-label="cerrar">✕</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NodesPanel
// ---------------------------------------------------------------------------
function NodeAddCard({ item, onAdd }) {
  return (
    <button className="node-add-card" onClick={onAdd} style={{"--add-c": item.accent}}>
      <div className="node-add-icon">{item.glyph}</div>
      <div className="node-add-meta">
        <div className="node-add-title">{item.label}</div>
        <div className="node-add-hint mono">{item.hint}</div>
      </div>
      <div className="node-add-plus">+</div>
    </button>
  );
}

function NodesPanel({ onAdd, onClose, onSave, onNewCanvas, flowTemplates, onLoadTemplate, onDeleteTemplate }) {
  const [confirmId, setConfirmId] = React.useState(null);
  const items = [
    { type:"prompt", label:"Prompt", hint:"Brief creativo",       glyph:<Icon.PromptGlyph style={{width:28,height:28}}/>, accent:"#6366F1" },
    { type:"image",  label:"Imagen", hint:"Generación de imagen", glyph:<Icon.ImageGlyph  style={{width:28,height:28}}/>, accent:"#8B5CF6" },
    { type:"video",  label:"Video",  hint:"Generación de video",  glyph:<Icon.VideoGlyph  style={{width:28,height:28}}/>, accent:"#10B981" },
    { type:"note",   label:"Nota",   hint:"Anotación libre",      glyph:<Icon.NoteGlyph   style={{width:28,height:28}}/>, accent:"#F59E0B" },
  ];
  const fmt = (ts) => new Date(ts).toLocaleDateString("es-ES", {day:"2-digit",month:"short"});
  return (
    <>
      <DrawerHeader title="Nodos" subtitle="añadir al canvas" onClose={onClose}/>
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
        <div className="drawer-section-label mono" style={{marginTop:18}}>Generadores</div>
        <div className="nodes-list">{items.filter(i=>i.type!=="note").map(it=><NodeAddCard key={it.type} item={it} onAdd={()=>onAdd(it.type)}/>)}</div>
        <div className="drawer-section-label mono" style={{marginTop:16}}>Anotación</div>
        <div className="nodes-list">{items.filter(i=>i.type==="note").map(it=><NodeAddCard key={it.type} item={it} onAdd={()=>onAdd(it.type)}/>)}</div>
        <div className="drawer-section-label mono" style={{marginTop:22}}>
          Plantillas guardadas
          {flowTemplates?.length>0 && <span className="tpl-count-badge">{flowTemplates.length}</span>}
        </div>
        {(!flowTemplates||flowTemplates.length===0) && (
          <div className="tpl-empty">
            <div style={{fontSize:22,marginBottom:6}}>💾</div>
            <div style={{fontSize:11,color:"var(--text-3)",lineHeight:1.5,textAlign:"center"}}>Guarda el flujo actual con "Guardar flujo".<br/>Cada guardado es independiente.</div>
          </div>
        )}
        <div className="nodes-list" style={{marginTop:4}}>
          {(flowTemplates||[]).map(t=>(
            <div key={t.id} className="saved-tpl-card">
              <button className="saved-tpl-main" onClick={()=>onLoadTemplate(t)}>
                <div className="saved-tpl-dots">{["#A78BFA","#7DD3FC","#34D399"].map((c,i)=><span key={i} style={{background:c,width:6,height:6,borderRadius:"50%",marginLeft:i?-2:0,display:"inline-block"}}/>)}</div>
                <div className="saved-tpl-meta"><div className="saved-tpl-name">{t.name}</div><div className="saved-tpl-info mono">{t.nodeCount} nodos · {fmt(t.createdAt)}</div></div>
                <span className="saved-tpl-load">Cargar →</span>
              </button>
              {confirmId===t.id
                ? <button className="saved-tpl-del-confirm" onClick={()=>{onDeleteTemplate(t.id);setConfirmId(null);}}>¿Borrar?</button>
                : <button className="saved-tpl-del" onClick={()=>setConfirmId(t.id)}>✕</button>
              }
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SAMPLE_CLIENTS (condensed — full brand data preserved)
// ---------------------------------------------------------------------------
const SAMPLE_CLIENTS = [
  {id:"cl-cliender",name:"Cliender",initials:"CL",industry:"Agencia de Marketing Digital IA / Growth",tagline:"Cliender · Powered by Claude",contact:{name:"Toni Ureña",email:"toni@cliender.com",role:"Co-founder & Director Comercial"},palette:["#6D28D9","#A78BFA","#C4B5FD","#0A0A14","#FFFFFF"],colorEmotion:"Púrpura IA: innovación, inteligencia, exclusividad tech. El negro profundo ancla. Blanco limpia.",typography:{display:"Geist",text:"Geist",mono:"JetBrains Mono"},voice:["innovador","directo","experto","cercano con clientes","orientado a resultados"],toneTemperature:"Direct-premium (6/10 formal)",audience:["Empresas con budget marketing 3k-30k/mes","Directores de Marketing PYME","Fundadores que escalan","Negocios que quieren IA en marketing"],contentPillars:["Casos de éxito de clientes reales","IA aplicada al marketing (educación)","Resultados y métricas (ROI demostrado)","Behind the scenes del equipo Cliender","Herramientas y automatizaciones que usamos","Tendencias de marketing digital con IA"],compositionStyle:"Minimalismo tech premium. Fondos oscuros con acentos violeta. Tipografía grande y bold. Mockups de herramientas IA. Retratos del equipo auténticos.",dont:["clásico corporativo aburrido","sobre-saturación de colores","stock photos genéricas","promesas sin métricas","lenguaje excesivamente técnico"],logo:{description:"Wordmark 'CLIENDER' en Geist Bold, color violeta #A78BFA sobre fondo negro #0A0A14.",shape:"Wordmark horizontal. 'C' como isotipo standalone.",colors:{primary:"#A78BFA",dark:"#6D28D9",light:"#C4B5FD",background:"#0A0A14",onLight:"#6D28D9"},typography:"Geist Bold, tracking 0.08em, todo mayúsculas",variants:["violeta sobre negro (principal)","blanco sobre violeta","negro sobre blanco","isotipo C standalone"],usage:"Zona seguridad = altura de la C. No usar sobre fondos con más de 2 tonos."},accent:"#A78BFA",bgGradient:"linear-gradient(135deg, #0A0A14 0%, #6D28D9 60%, #A78BFA 100%)",references:["anthropic.com","framer.com","linear.app"],projects:12,activeBoardId:null,verticals:["SALES","MEDIA","TECH"],web:"cliender.com",_pinned:true,_color:"violet"},
  {id:"cl-savia",name:"Savia (AZ Consultoría)",initials:"SV",industry:"Consultoría / RRHH",tagline:"Personas que impulsan organizaciones",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#0D1B2A","#1B7A4B","#4CAF7D","#F0FFF4"],colorEmotion:"Verde confianza: crecimiento, estabilidad, cercanía humana",typography:{display:"Inter",text:"Inter",mono:"JetBrains Mono"},voice:["profesional","cercano","transformador","humano"],toneTemperature:"Cálido-profesional (6/10 formal)",audience:["Directores de RRHH","CEOs de PYME","Responsables de formación"],contentPillars:["Gestión del talento","Cultura empresarial","Liderazgo","Empleabilidad"],compositionStyle:"Retratos corporativos cálidos, espacios de trabajo abiertos, diversidad real",dont:["tecnicismos vacíos","jerga corporativa","promesas sin evidencia"],logo:{url:"",description:"Wordmark 'SAVIA' en Inter Bold caps, color verde #1B7A4B.",shape:"Wordmark puro.",colors:{primary:"#1B7A4B",background:"#FFFFFF",darkVariant:"#FFFFFF sobre #0D1B2A"},typography:"Inter Bold",variants:["color sobre blanco","blanco sobre oscuro","isotipo S standalone"],usage:"Mínimo 24px alto digital."},accent:"#1B7A4B",bgGradient:"linear-gradient(135deg, #0D1B2A 0%, #1B7A4B 100%)",references:["adecco.es","manpower.es","cornerjob.com"],projects:8,activeBoardId:null,verticals:["SALES","MEDIA","TECH"],web:"savia.es"},
  {id:"cl-beta",name:"Beta Formación",initials:"BF",industry:"Formación / Educación",tagline:"Aprender para crecer",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#1A1A2E","#E94560","#0F3460","#F5F5F5"],colorEmotion:"Rojo-azul dinámico: energía y ambición con profundidad académica",typography:{display:"Poppins",text:"Inter",mono:"JetBrains Mono"},voice:["motivador","accesible","dinámico","práctico"],toneTemperature:"Energético-accesible (4/10 formal)",audience:["Jóvenes 18-30","Desempleados en reconversión","Profesionales que escalan"],contentPillars:["Casos de éxito alumni","Tips de productividad","Noticias sector","Tráiler de cursos"],compositionStyle:"Planos dinámicos, personas estudiando, colores contrastados, texto bold",dont:["academicismo excesivo","tecnicismos innecesarios","pasividad"],logo:{url:"",description:"Logo 'β BETA FORMACIÓN': letra griega β vectorizada en rojo #E94560.",shape:"β + wordmark.",colors:{primary:"#E94560",secondary:"#0F3460",background:"#1A1A2E"},typography:"Poppins Bold para wordmark, β vectorial propio",variants:["rojo sobre oscuro (principal)","azul sobre blanco","β isotipo standalone"],usage:"No usar β sobre fondos rojos."},accent:"#E94560",bgGradient:"linear-gradient(135deg, #1A1A2E 0%, #E94560 100%)",references:["domestika.org","udemy.com","hubspot.com/academy"],projects:5,activeBoardId:null,verticals:["SALES","MEDIA"],web:"betaformacion.es"},
  {id:"cl-ehei",name:"EHEI",initials:"EH",industry:"Educación Superior / Internacional",tagline:"Excellence in European Higher Education",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#0A1628","#C9A84C","#1E3A5F","#FAFAFA"],colorEmotion:"Azul marino + oro: excelencia institucional, prestigio europeo",typography:{display:"Playfair Display",text:"Source Serif",mono:"JetBrains Mono"},voice:["institucional","internacional","riguroso","aspiracional"],toneTemperature:"Formal-aspiracional (8/10 formal)",audience:["Graduados universitarios","Profesionales con Máster","Perfil internacional 25-40"],contentPillars:["Rankings y acreditaciones","Experiencia campus","Alumni network","Convenios empresa"],compositionStyle:"Arquitectura europea clásica, retratos elegantes, composición simétrica",dont:["informalidad","abreviaciones","lenguaje coloquial"],logo:{url:"",description:"Escudo heráldico ojival con iniciales 'EHEI' en Playfair Display Italic dorado #C9A84C.",shape:"Escudo ojival 1:1.4.",colors:{primary:"#C9A84C",background:"#0A1628",accent:"#1E3A5F"},typography:"Playfair Display Italic (iniciales) + Regular (wordmark)",variants:["escudo completo sobre oscuro","escudo dorado sobre blanco","solo escudo"],usage:"Nunca en colores no institucionales. No rotar. Mínimo 40px ancho."},accent:"#C9A84C",bgGradient:"linear-gradient(135deg, #0A1628 0%, #C9A84C 100%)",references:["lse.ac.uk","ie.edu","esade.edu"],projects:4,activeBoardId:null,verticals:["SALES","MEDIA","TECH"],web:"ehei.eu"},
  {id:"cl-integratec",name:"Integra Tec (Formatel)",initials:"IT",industry:"Teleformación / e-Learning",tagline:"Formación online que funciona",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#0F172A","#3B82F6","#60A5FA","#F8FAFC"],colorEmotion:"Azul tecnológico: eficiencia, claridad, fiabilidad digital",typography:{display:"Inter",text:"Inter",mono:"JetBrains Mono"},voice:["claro","eficiente","tecnológico","orientado a resultados"],toneTemperature:"Directo-eficiente (5/10 formal)",audience:["Empresas que forman empleados online","Responsables de formación B2B"],contentPillars:["ROI de la formación","Casos de cliente","Demo plataforma","Novedades FUNDAE"],compositionStyle:"Mockups digitales limpios, dashboards, iconografía tech, fondo oscuro",dont:["promesas sin métricas","complejidad innecesaria","lenguaje pasivo"],logo:{url:"",description:"Wordmark 'integra·tec' en Inter SemiBold minúsculas.",shape:"Wordmark horizontal puro. Ratio ~6:1.",colors:{primary:"#3B82F6",background:"#0F172A",light:"#F8FAFC"},typography:"Inter SemiBold, tracking -0.02em, todo minúsculas",variants:["azul sobre oscuro","navy sobre blanco","punto cuadrado pixel variant"],usage:"No usar en caps. El punto · es inviolable."},accent:"#3B82F6",bgGradient:"linear-gradient(135deg, #0F172A 0%, #3B82F6 100%)",references:["coursera.org","moodle.org","blackboard.com"],projects:6,activeBoardId:null,verticals:["SALES","TECH"],web:"formatel.es"},
  {id:"cl-garalma",name:"Garalma",initials:"GA",industry:"Empresa / Servicios",tagline:"Soluciones que perduran",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#1C1C1E","#FF6B35","#FF9F1C","#FFFCF2"],colorEmotion:"Naranja energía: proactividad, cercanía, resolución inmediata",typography:{display:"Montserrat",text:"Open Sans",mono:"JetBrains Mono"},voice:["directo","fiable","cercano","resolutivo"],toneTemperature:"Directo-cercano (4/10 formal)",audience:["PYMES locales","Autónomos","Pequeños negocios"],contentPillars:["Soluciones rápidas","Testimonios cliente","Proceso de trabajo","Promoción estacional"],compositionStyle:"Planos de servicio real, antes/después, personas trabajando, calidez",dont:["exceso de texto","términos técnicos sin explicar","ambigüedad"],logo:{url:"",description:"'GARALMA' en Montserrat ExtraBold caps naranja #FF6B35. La 'G' inicial lleva arco exterior vectorial.",shape:"Wordmark + isotipo integrado. G con arco exterior.",colors:{primary:"#FF6B35",text:"#1C1C1E",warm:"#FF9F1C"},typography:"Montserrat ExtraBold, caps, tracking 0.05em",variants:["naranja sobre oscuro","oscuro sobre blanco","G-arco isotipo standalone"],usage:"El arco de G nunca se elimina. Isotipo mínimo 20px."},accent:"#FF6B35",bgGradient:"linear-gradient(135deg, #1C1C1E 0%, #FF6B35 100%)",references:["amazon.es","leroy-merlin.es","ikea.com"],projects:3,activeBoardId:null,verticals:["SALES","MEDIA"],web:""},
  {id:"cl-mvr",name:"Grupo MVR",initials:"MV",industry:"Grupo Empresarial",tagline:"Crecimiento con estructura",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#111827","#6366F1","#818CF8","#F9FAFB"],colorEmotion:"Indigo corporativo: visión estratégica, solidez, ambición controlada",typography:{display:"Inter",text:"Inter",mono:"JetBrains Mono"},voice:["estratégico","sólido","ambicioso","profesional"],toneTemperature:"Estratégico-formal (7/10 formal)",audience:["Inversores","Directivos de grupo","Socios estratégicos B2B"],contentPillars:["Resultados grupo","Expansión y adquisiciones","Talento directivo","RSC"],compositionStyle:"Grafismo minimalista, datos protagonistas, fondos oscuros elegantes",dont:["improvisación","lenguaje informal","promesas sin base"],logo:{url:"",description:"Monograma 'MVR' en Inter Bold: M y V comparten vértice central.",shape:"Monograma cuadrado 1:1.",colors:{primary:"#6366F1",background:"#111827",soft:"#818CF8"},typography:"Inter Bold (monograma) + Inter Regular tracking alto (wordmark)",variants:["monograma sobre dark","sobre blanco","monograma+wordmark completo"],usage:"Mínimo 32px. El vértice compartido MV es crítico."},accent:"#6366F1",bgGradient:"linear-gradient(135deg, #111827 0%, #6366F1 100%)",references:["grupo-sos.com","inditex.com","mercadona.es"],projects:7,activeBoardId:null,verticals:["SALES","MEDIA","TECH"],web:""},
  {id:"cl-innova",name:"Innova Humana",initials:"IH",industry:"RRHH / Consultoría",tagline:"Innovación desde las personas",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#0F2027","#2ECC71","#27AE60","#ECF0F1"],colorEmotion:"Verde vivo: renovación, optimismo, innovación humana",typography:{display:"Nunito",text:"Inter",mono:"JetBrains Mono"},voice:["empático","innovador","inspirador","basado en evidencia"],toneTemperature:"Inspirador-cercano (5/10 formal)",audience:["Managers de personas","Equipos de RRHH","Líderes de cambio"],contentPillars:["Bienestar laboral","Psicología positiva aplicada","Casos reales","Herramientas de gestión"],compositionStyle:"Fotografía cálida, grupos diversos, espacios luminosos y naturales",dont:["burocracia","frialdad corporativa","tecnicismos de RRHH"],logo:{url:"",description:"Símbolo brote: 3 líneas curvas ascendentes en verde #2ECC71.",shape:"3 curvas Bézier ascendentes, separación 4pt.",colors:{primary:"#2ECC71",dark:"#27AE60",background:"#0F2027"},typography:"Nunito SemiBold, minúsculas, tracking 0.01em",variants:["símbolo+wordmark horizontal","apilado 2 líneas","solo brote verde"],usage:"Las 3 curvas no se reducen a 2. Mínimo 28px."},accent:"#2ECC71",bgGradient:"linear-gradient(135deg, #0F2027 0%, #2ECC71 100%)",references:["gallup.com","hbr.org","thinkers50.com"],projects:5,activeBoardId:null,verticals:["SALES","MEDIA"],web:"innovahumana.es"},
  {id:"cl-inprogress",name:"Inprogress Escuela",initials:"IP",industry:"Formación Técnica Profesional",tagline:"Formación que te coloca",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#1A1A2E","#F7931E","#FDB913","#FFFFFF"],colorEmotion:"Naranja-amarillo: energía juvenil, optimismo, empleabilidad directa",typography:{display:"Poppins",text:"Inter",mono:"JetBrains Mono"},voice:["práctico","motivador","directo","orientado al empleo"],toneTemperature:"Energético-práctico (3/10 formal)",audience:["Jóvenes 16-25","Buscan primer empleo","Cambio de sector profesional"],contentPillars:["Empleos conseguidos","Salidas profesionales","Becas y ayudas","Día a día en clase"],compositionStyle:"Planos de taller real, herramientas, uniformes, jóvenes trabajando",dont:["academicismo","promesas vacías","complejidad"],logo:{url:"",description:"Barra de progreso parcialmente rellena (50-70%) como símbolo en naranja→amarillo degradado.",shape:"Barra 180x18pt.",colors:{primary:"#F7931E",gradient:"#F7931E a #FDB913",background:"#1A1A2E"},typography:"Poppins Bold (INPROGRESS) + Poppins Regular tracking alto (ESCUELA)",variants:["barra+wordmark horizontal","barra encima wordmark","solo barra progreso isotipo"],usage:"La barra nunca al 100%. Relleno mínimo 40%."},accent:"#F7931E",bgGradient:"linear-gradient(135deg, #1A1A2E 0%, #F7931E 100%)",references:["fp.edu.es","fundae.es","leanlabrooster.com"],projects:4,activeBoardId:null,verticals:["SALES","MEDIA"],web:""},
  {id:"cl-safe",name:"Safe Abogados",initials:"SA",industry:"Legal / Despacho de Abogados",tagline:"Tu defensa, nuestra misión",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#0D1117","#B8860B","#DAA520","#F5F5DC"],colorEmotion:"Dorado + negro: autoridad, prestigio legal, sólida reputación",typography:{display:"Libre Baskerville",text:"Source Serif",mono:"JetBrains Mono"},voice:["serio","preciso","confiable","cercano"],toneTemperature:"Formal-tranquilizador (8/10 formal)",audience:["Personas en proceso judicial","Empresas con conflictos laborales","Autónomos"],contentPillars:["Derechos del ciudadano","Consultas frecuentes","Casos resueltos","Cambios legislativos"],compositionStyle:"Interiores despacho serios, detalle documentos, profesionales en traje",dont:["ambigüedad","promesas de resultado","lenguaje alarmista"],logo:{url:"",description:"Escudo hexagonal con contorno dorado #DAA520 2pt. Letra 'S' en Libre Baskerville Italic centrada.",shape:"Escudo hexagonal 1:1.3, vértice inferior agudo.",colors:{primary:"#DAA520",secondary:"#B8860B",background:"#0D1117",cream:"#F5F5DC"},typography:"Libre Baskerville Italic (S + SAFE) + Source Serif Regular (ABOGADOS)",variants:["escudo+wordmark horizontal","solo escudo dorado","crema sobre dark"],usage:"Escudo nunca relleno sólido. S siempre italic."},accent:"#DAA520",bgGradient:"linear-gradient(135deg, #0D1117 0%, #B8860B 100%)",references:["garrigues.com","cuatrecasas.com","legaltech.es"],projects:3,activeBoardId:null,verticals:["SALES","MEDIA"],web:"safeabogados.es"},
  {id:"cl-miramar",name:"Miramar Cruises",initials:"MC",industry:"Turismo / Cruceros",tagline:"El mar como experiencia",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#003049","#0077B6","#00B4D8","#CAF0F8"],colorEmotion:"Azules mar: evasión, lujo accesible, libertad mediterránea",typography:{display:"Cormorant Garamond",text:"Inter",mono:"JetBrains Mono"},voice:["evocador","exclusivo","experiencial","mediterráneo"],toneTemperature:"Aspiracional-evocador (5/10 formal)",audience:["Parejas 40-65","Familias premium","Viajeros experienciales"],contentPillars:["Destinos y rutas","A bordo experience","Gastronomía y eventos","Ofertas temporada"],compositionStyle:"Horizonte mar, cubierta barco, atardeceres, lujo natural sin ostentar",dont:["precio como argumento","masificación","genérico"],logo:{url:"",description:"Ola vectorial Bézier en azul claro #00B4D8 sobre toda la anchura del wordmark.",shape:"Ola: Bézier 1 ciclo, anchura = wordmark.",colors:{primary:"#003049",wave:"#00B4D8",middle:"#0077B6"},typography:"Cormorant Garamond Light Italic (MIRAMAR) + Inter Light caps (CRUISES)",variants:["ola+wordmark doble sobre blanco","negativa sobre azul marino","solo ola como sello"],usage:"Ola: siempre 1 sola curva. Nunca en no-azules."},accent:"#0077B6",bgGradient:"linear-gradient(135deg, #003049 0%, #0077B6 100%)",references:["msccruceros.es","costacruises.com","cunard.com"],projects:6,activeBoardId:null,verticals:["SALES","MEDIA"],web:"miramarcruises.es"},
  {id:"cl-opositaxd",name:"Oposita-XD",initials:"OX",industry:"Formación / Oposiciones",tagline:"Aprueba con método",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#1E1E2E","#7C3AED","#A78BFA","#EDE9FE"],colorEmotion:"Púrpura método: estructura mental, disciplina gamificada, confianza",typography:{display:"Inter",text:"Inter",mono:"JetBrains Mono"},voice:["motivador","estructurado","cercano","enfocado"],toneTemperature:"Motivador-estructurado (5/10 formal)",audience:["Opositores 22-40","Personas con tiempo limitado","Segunda oportunidad laboral"],contentPillars:["Método de estudio","Plazas convocadas","Testimonios aprobados","Tiempo de preparación"],compositionStyle:"Apuntes y libros de estudio, personas concentradas, contadores tiempo",dont:["ansiedad","promesas de plaza garantizada","vaguedad"],logo:{url:"",description:"Checkmark ✓ vectorial púrpura #7C3AED, trazo 4pt.",shape:"✓: ángulo 45°/30°.",colors:{primary:"#7C3AED",light:"#A78BFA",background:"#1E1E2E"},typography:"Inter Black (OPOSITA) + Inter ExtraLight (-XD)",variants:["checkmark+wordmark horizontal","checkmark encima wordmark","solo ✓ badge"],usage:"✓ nunca relleno sólido — siempre trazo."},accent:"#7C3AED",bgGradient:"linear-gradient(135deg, #1E1E2E 0%, #7C3AED 100%)",references:["adams.es","cef.es","preparadores.es"],projects:5,activeBoardId:null,verticals:["SALES","MEDIA","TECH"],web:"opositaxd.es"},
  {id:"cl-siete",name:"El Siete Formación",initials:"7F",industry:"Formación / Academia",tagline:"Siete pasos hacia tu futuro",contact:{name:"Vincent Piñón",email:"vincent@cliender.com",role:"Lead Account Manager"},palette:["#1A1A1A","#E63946","#457B9D","#F1FAEE"],colorEmotion:"Rojo-azul contraste: acción urgente + solidez académica",typography:{display:"Raleway",text:"Inter",mono:"JetBrains Mono"},voice:["energético","directo","cercano","orientado a resultados"],toneTemperature:"Energético-directo (4/10 formal)",audience:["Adultos en reconversión laboral","Jóvenes que dejan estudios reglados"],contentPillars:["Testimonios reales","Inserción laboral","Cursos en oferta","Open days"],compositionStyle:"Estudiantes auténticos, aulas dinámicas, colorido, energía positiva",dont:["pasividad","academicismo frío","lenguaje impersonal"],logo:{url:"",description:"Número '7' estilo europeo (con barra horizontal a mitad del trazo) vectorial, rojo #E63946.",shape:"7 europeo: trazo principal diagonal 140°, barra horizontal 50% trazo.",colors:{primary:"#E63946",secondary:"#457B9D",dark:"#1A1A1A"},typography:"Raleway ExtraLight tracking (EL SIETE) + Raleway Bold caps azul (FORMACIÓN)",variants:["7+wordmark completo","solo 7 rojo standalone","monocromático dark"],usage:"7 europeo con barra es inviolable."},accent:"#E63946",bgGradient:"linear-gradient(135deg, #1A1A1A 0%, #E63946 100%)",references:["masterclass.com","domestika.org","classgap.com"],projects:4,activeBoardId:null,verticals:["SALES","MEDIA"],web:"elsieteformacion.es"},
];

// ---------------------------------------------------------------------------
// ClientsPanel
// ---------------------------------------------------------------------------
function ClientDetailModal({ client, onClose }) {
  React.useEffect(() => {
    const onKey = (e) => { if (e.key==="Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return ReactDOM.createPortal(
    <div className="form-popup-backdrop" onClick={onClose}>
      <div className="form-popup client-modal" onClick={e=>e.stopPropagation()} style={{maxWidth:560,width:"90vw",maxHeight:"88vh",overflowY:"auto",padding:0}}>
        <div className="client-modal-head">
          <div className="client-modal-hero" style={{background:client.bgGradient}}>
            <div className="client-modal-initials">{client.initials}</div>
            <div className="client-modal-hero-text">
              <div className="client-modal-name">{client.name}</div>
              <div className="client-modal-tagline mono">"{client.tagline}"</div>
            </div>
          </div>
          <button className="client-modal-close" onClick={onClose} aria-label="Cerrar">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="client-modal-kpis">
          <div className="client-modal-kpi"><div className="client-modal-kpi-val">{client.projects||0}</div><div className="client-modal-kpi-label mono">proyectos</div></div>
          <div className="client-modal-kpi"><div className="client-modal-kpi-val">{client.contentPillars?.length||0}</div><div className="client-modal-kpi-label mono">pilares</div></div>
          <div className="client-modal-kpi"><div className="client-modal-kpi-val">{client.verticals?.length||1}</div><div className="client-modal-kpi-label mono">verticales</div></div>
        </div>
        <div className="client-modal-body">
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Paleta de marca</div>
            <div className="client-palette">{client.palette.map(c=><div key={c} className="client-swatch"><div className="client-swatch-color" style={{background:c}}/><div className="mono client-swatch-hex">{c}</div></div>)}</div>
            {client.colorEmotion && <div className="client-color-emotion mono">{client.colorEmotion}</div>}
          </div>
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Tipografía</div>
            <div className="client-typo">
              <div className="typo-row"><span className="mono typo-label">display</span><span className="typo-name">{client.typography.display}</span></div>
              <div className="typo-row"><span className="mono typo-label">texto</span><span className="typo-name">{client.typography.text}</span></div>
              <div className="typo-row"><span className="mono typo-label">mono</span><span className="typo-name">{client.typography.mono}</span></div>
            </div>
          </div>
          {client.audience?.length>0 && <div className="client-modal-section"><div className="drawer-section-label mono">Audiencia objetivo</div><div className="client-tags">{client.audience.map(a=><span key={a} className="client-tag client-tag-audience">{a}</span>)}</div></div>}
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Voz de marca</div>
            <div className="client-tags">{client.voice.map(v=><span key={v} className="client-tag client-tag-good">{v}</span>)}</div>
            {client.toneTemperature && <div className="client-tone-badge mono"><svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>{client.toneTemperature}</div>}
          </div>
          {client.contentPillars?.length>0 && <div className="client-modal-section"><div className="drawer-section-label mono">Pilares de contenido</div><div className="client-tags">{client.contentPillars.map((p,i)=><span key={p} className="client-tag client-tag-pillar"><span className="client-pillar-num">{i+1}</span>{p}</span>)}</div></div>}
          {client.compositionStyle && <div className="client-modal-section"><div className="drawer-section-label mono">Estilo visual / composición</div><div className="client-composition mono">{client.compositionStyle}</div></div>}
          <div className="client-modal-section"><div className="drawer-section-label mono">Anti-patrones — nunca usar</div><div className="client-tags">{client.dont.map(v=><span key={v} className="client-tag client-tag-bad">— {v}</span>)}</div></div>
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Referentes visuales</div>
            <div className="client-refs">{(client.references||[]).map(r=><a key={r} className="client-ref" href={`https://${r}`} target="_blank" rel="noopener"><span className="client-ref-dot"/><span className="mono">{r}</span><span className="client-ref-arrow">↗</span></a>)}</div>
          </div>
          <div className="client-modal-section">
            <div className="drawer-section-label mono">Contacto</div>
            <div className="client-contact">
              <div className="client-contact-avatar">{client.contact.name.split(" ").map(p=>p[0]).join("")}</div>
              <div><div className="client-contact-name">{client.contact.name}</div><div className="client-contact-role mono">{client.contact.role}</div><a className="client-contact-email" href={`mailto:${client.contact.email}`}>{client.contact.email}</a></div>
            </div>
          </div>
          <div style={{padding:"16px 0 4px",display:"flex",gap:8}}>
            <button className="btn-soft" style={{flex:1,justifyContent:"center"}} onClick={() => {
              const logo=client.logo;
              const lines=[`=== CONTEXTO IA: ${client.name} ===`,`Sector: ${client.industry} | Web: ${client.web||"N/A"}`,"",`LOGO:`,`  Descripción: ${logo?.description||"N/A"}`,`  Forma: ${logo?.shape||"N/A"}`,`  Tipografía logo: ${logo?.typography||"N/A"}`,`  Variantes: ${(logo?.variants||[]).join(" | ")||"N/A"}`,`  Reglas de uso: ${logo?.usage||"N/A"}`,`  Colores logo: ${logo?.colors?JSON.stringify(logo.colors):"N/A"}`,"",`PALETA: ${client.palette.join(" | ")}`,`EMOCIÓN DE COLOR: ${client.colorEmotion||"N/A"}`,"",`TIPOGRAFÍA MARCA: display=${client.typography.display} / texto=${client.typography.text}`,"",`VOZ: ${(client.voice||[]).join(", ")} | TONO: ${client.toneTemperature||"N/A"}`,"",`AUDIENCIA: ${(client.audience||[]).join(" | ")}`,"",`PILARES: ${(client.contentPillars||[]).map((p,i)=>`${i+1}. ${p}`).join(" | ")}`,"",`COMPOSICIÓN VISUAL: ${client.compositionStyle||"N/A"}`,"",`EVITAR: ${(client.dont||[]).join(" | ")}`,`REFERENTES: ${(client.references||[]).join(" | ")}`,];
              navigator.clipboard.writeText(lines.join("\n")).then(()=>window.__notify?.({kind:"success",icon:"❖",title:"Contexto IA copiado",body:"Pega en el Prompt Node — Claude ya tiene el ADN del cliente"}));
            }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{width:12,height:12}}><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              Copiar contexto IA
            </button>
            <button className="btn-soft" style={{flex:1,justifyContent:"center"}} onClick={onClose}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function ClientCard({ client, onClick }) {
  return (
    <button className={"client-card"+(client._pinned?" client-card--pinned":"")} onClick={onClick}
      style={client._pinned?{border:"1.5px solid rgba(167,139,250,0.55)",boxShadow:"0 0 18px rgba(167,139,250,0.18)"}:{}}>
      <div className="client-avatar" style={{background:client.bgGradient}}><span className="client-avatar-text">{client.initials}</span></div>
      <div className="client-card-meta">
        {client._pinned && <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}><span style={{fontSize:9,fontFamily:"var(--font-mono)",letterSpacing:"0.18em",textTransform:"uppercase",color:"#A78BFA",background:"rgba(167,139,250,0.12)",border:"1px solid rgba(167,139,250,0.3)",padding:"1px 6px",borderRadius:20}}>Nosotros</span></div>}
        <div className="client-card-name" style={client._pinned?{color:"#C4B5FD",fontWeight:600}:{}}>{client.name}</div>
        <div className="client-card-sub mono">{client.industry}</div>
      </div>
      <div className="client-card-side">
        <div className="client-palette-mini">{client.palette.slice(0,4).map((c,i)=><span key={i} style={{background:c}}/>)}</div>
        <span className="client-projects mono">{client.projects} flows</span>
      </div>
    </button>
  );
}

function ClientsPanel({ clients, activeClientId: activeClientIdProp, setActiveClientId: setActiveClientIdProp, onClose, onOpenCreate }) {
  const [localActiveId, setLocalActiveId] = React.useState(null);
  const selectClient = React.useCallback((id) => {
    setLocalActiveId(id);
    if (typeof setActiveClientIdProp==="function") setActiveClientIdProp(id);
  }, [setActiveClientIdProp]);
  const active = clients.find(c=>c.id===localActiveId);
  return (
    <>
      <DrawerHeader title="Clientes" subtitle="marcas conectadas a Claude" onClose={onClose}/>
      <div className="drawer-body scroll-thin">
        <div className="claude-bridge">
          <div className="claude-bridge-icon">✦</div>
          <div className="claude-bridge-text"><div className="claude-bridge-title">Conectado al cerebro Claude</div><div className="claude-bridge-sub mono">contexto completo · brand DNA · consistencia</div></div>
          <span className="claude-bridge-dot"/>
        </div>
        <div className="drawer-section-label mono">Activos</div>
        <div className="clients-list">{clients.map(c=><ClientCard key={c.id} client={c} onClick={()=>selectClient(c.id)}/>)}</div>
        <div className="empty-state" style={{marginTop:18,padding:"18px 16px"}}>
          <div className="mono" style={{fontSize:9.5,letterSpacing:"0.18em",color:"var(--text-3)",textTransform:"uppercase"}}>auto-sync</div>
          <div style={{marginTop:8,fontSize:12,color:"var(--text-3)",lineHeight:1.55}}>Los clientes se sincronizan automáticamente desde la memoria central.</div>
        </div>
      </div>
      {active && <ClientDetailModal client={active} onClose={()=>selectClient(null)}/>}
    </>
  );
}

// ---------------------------------------------------------------------------
// Form primitives
// ---------------------------------------------------------------------------
function FormField({ label, hint, children, wide }) {
  return (
    <div className={"form-field "+(wide?"is-wide":"")}>
      <div className="form-field-head"><span className="form-label mono">{label}</span>{hint && <span className="form-hint mono">{hint}</span>}</div>
      {children}
    </div>
  );
}
function FormGrid({ children }) { return <div className="form-grid">{children}</div>; }
function FormStepPill({ n, label, active, done, onClick }) {
  return (
    <button type="button" className={"form-step "+(active?"is-active ":" ")+(done?"is-done":"")} onClick={onClick}>
      <span className="form-step-n mono">{done?"✓":n}</span>
      <span className="form-step-label">{label}</span>
    </button>
  );
}
function TagInput({ value, onChange, placeholder, tone }) {
  const [draft, setDraft] = React.useState("");
  const add = () => { const t=draft.trim(); if(!t||value.includes(t))return; onChange([...value,t]); setDraft(""); };
  return (
    <div className="taginput">
      <div className="taginput-tags">{value.map(t=><span key={t} className={"client-tag "+(tone==="bad"?"client-tag-bad":"client-tag-good")}>{tone==="bad"?"— ":""}{t}<button type="button" className="taginput-remove" onClick={()=>onChange(value.filter(x=>x!==t))} aria-label="quitar">✕</button></span>)}</div>
      <input className="form-input form-input-sm" value={draft} onChange={e=>setDraft(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();add();}}} placeholder={placeholder}/>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewClientForm
// ---------------------------------------------------------------------------
const ACCENT_PRESETS = [
  {name:"Violet",accent:"#7C5CFF",bg:"linear-gradient(135deg, #7C5CFF 0%, #22D3EE 100%)"},
  {name:"Amber",accent:"#F59E0B",bg:"linear-gradient(135deg, #F59E0B 0%, #FB7185 100%)"},
  {name:"Emerald",accent:"#10B981",bg:"linear-gradient(135deg, #065F46 0%, #A4C29A 100%)"},
  {name:"Ocean",accent:"#0EA5E9",bg:"linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)"},
  {name:"Sand",accent:"#A47551",bg:"linear-gradient(135deg, #5C3D2E 0%, #D9B58C 100%)"},
  {name:"Carbon",accent:"#A1A1AA",bg:"linear-gradient(135deg, #18181B 0%, #71717A 100%)"},
];
const INDUSTRY_OPTIONS = ["Tech / SaaS","Luxury / Fashion","Wellness / Sustainable","F&B / Hospitality","Finance / Fintech","Media / Entertainment","Beauty / Cosmetics","Real Estate / Architecture"];

function NewClientForm({ onCreate, onCancel }) {
  const [step,setStep]=React.useState(1);
  const [data,setData]=React.useState({name:"",initials:"",industry:"Tech / SaaS",tagline:"",contactName:"",contactRole:"",contactEmail:"",palette:["#0F1018","#7C5CFF","#22D3EE","#F4F4F5"],typeDisplay:"Söhne",typeText:"Söhne",typeMono:"JetBrains Mono",voiceTags:["preciso","calmado"],dontTags:[],references:"",accentPreset:ACCENT_PRESETS[0]});
  const set=(patch)=>setData(d=>({...d,...patch}));
  React.useEffect(()=>{if(data.name&&!data.initials){const init=data.name.split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||"").join("");if(init)set({initials:init});}},[data.name]);
  const canStep1=data.name.trim().length>=2&&data.industry;
  const finish=()=>{onCreate({id:"cl-"+Math.random().toString(36).slice(2,8),name:data.name.trim(),initials:(data.initials||data.name.slice(0,2)).toUpperCase().slice(0,2),industry:data.industry,tagline:data.tagline.trim(),contact:{name:data.contactName.trim(),email:data.contactEmail.trim(),role:data.contactRole.trim()},palette:data.palette,typography:{display:data.typeDisplay,text:data.typeText,mono:data.typeMono},voice:data.voiceTags,dont:data.dontTags,accent:data.accentPreset.accent,bgGradient:data.accentPreset.bg,references:data.references.split(",").map(r=>r.trim()).filter(Boolean),projects:0,activeBoardId:null});};
  return (
    <div className="form-stage">
      <div className="form-hero" style={{background:data.accentPreset.bg}}>
        <div className="form-hero-fade"/>
        <div className="form-hero-content">
          <div className="form-hero-avatar"><span>{(data.initials||"··").slice(0,2)}</span></div>
          <div><div className="form-hero-name">{data.name||"Nuevo cliente"}</div><div className="form-hero-tag">"{data.tagline||"agrega un tagline editorial"}"</div><div className="form-hero-meta mono">{data.industry}</div></div>
        </div>
      </div>
      <div className="form-steps">
        <FormStepPill n={1} label="Identidad" active={step===1} done={canStep1&&step>1} onClick={()=>setStep(1)}/>
        <FormStepPill n={2} label="Contacto"  active={step===2} done={step>2}           onClick={()=>setStep(2)}/>
        <FormStepPill n={3} label="Marca"     active={step===3} done={step>3}           onClick={()=>setStep(3)}/>
      </div>
      {step===1&&<div className="form-section">
        <FormField label="Nombre"><input className="form-input" autoFocus value={data.name} onChange={e=>set({name:e.target.value})} placeholder="Atelier Nova"/></FormField>
        <FormGrid><FormField label="Iniciales" hint="auto"><input className="form-input form-input-sm" maxLength={3} value={data.initials} onChange={e=>set({initials:e.target.value.toUpperCase()})} placeholder="AN"/></FormField><FormField label="Industria" wide><div className="form-select-wrap"><select className="form-input" value={data.industry} onChange={e=>set({industry:e.target.value})}>{INDUSTRY_OPTIONS.map(o=><option key={o} value={o}>{o}</option>)}</select></div></FormField></FormGrid>
        <FormField label="Tagline" hint="frase corta, voz editorial"><input className="form-input" value={data.tagline} onChange={e=>set({tagline:e.target.value})} placeholder="Heritage in light"/></FormField>
        <FormField label="Identidad visual"><div className="accent-grid">{ACCENT_PRESETS.map(p=><button key={p.name} type="button" className={"accent-card "+(data.accentPreset.name===p.name?"is-on":"")} onClick={()=>set({accentPreset:p})}><div className="accent-card-bg" style={{background:p.bg}}/><span className="accent-card-name mono">{p.name}</span></button>)}</div></FormField>
      </div>}
      {step===2&&<div className="form-section">
        <FormField label="Persona de contacto"><input className="form-input" value={data.contactName} onChange={e=>set({contactName:e.target.value})} placeholder="Mira Chen"/></FormField>
        <FormGrid><FormField label="Rol" wide><input className="form-input" value={data.contactRole} onChange={e=>set({contactRole:e.target.value})} placeholder="Brand Director"/></FormField></FormGrid>
        <FormField label="Email"><input className="form-input" type="email" value={data.contactEmail} onChange={e=>set({contactEmail:e.target.value})} placeholder="hola@cliente.com"/></FormField>
        <FormField label="Referencias web" hint="separadas por coma"><input className="form-input" value={data.references} onChange={e=>set({references:e.target.value})} placeholder="linear.app, vercel.com"/></FormField>
      </div>}
      {step===3&&<div className="form-section">
        <FormField label="Paleta de marca" hint="4 hex codes"><div className="palette-row">{data.palette.map((c,i)=><label key={i} className="palette-cell" style={{background:c}}><input type="color" value={c} onChange={e=>{const next=[...data.palette];next[i]=e.target.value;set({palette:next})}}/><span className="palette-cell-hex mono">{c}</span></label>)}</div></FormField>
        <FormGrid><FormField label="Display font" wide><input className="form-input" value={data.typeDisplay} onChange={e=>set({typeDisplay:e.target.value})}/></FormField></FormGrid>
        <FormGrid><FormField label="Texto" wide><input className="form-input" value={data.typeText} onChange={e=>set({typeText:e.target.value})}/></FormField><FormField label="Mono" wide><input className="form-input" value={data.typeMono} onChange={e=>set({typeMono:e.target.value})}/></FormField></FormGrid>
        <FormField label="Voz de marca" hint="cómo habla"><TagInput value={data.voiceTags} onChange={v=>set({voiceTags:v})} placeholder="añadir tono…" tone="good"/></FormField>
        <FormField label="Anti-patrones" hint="qué nunca"><TagInput value={data.dontTags} onChange={v=>set({dontTags:v})} placeholder="añadir restricción…" tone="bad"/></FormField>
      </div>}
      <div className="form-foot">
        <button type="button" className="form-btn-ghost" onClick={step===1?onCancel:()=>setStep(step-1)}>{step===1?"Cancelar":"← Atrás"}</button>
        {step<3?<button type="button" className="form-btn-primary" disabled={step===1?!canStep1:false} onClick={()=>setStep(step+1)}>Siguiente →</button>:<button type="button" className="form-btn-primary" disabled={!canStep1} onClick={finish}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M12 5v14M5 12h14"/></svg>Crear cliente</button>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewMoodboardForm
// ---------------------------------------------------------------------------
function NewMoodboardForm({ onCreate, onCancel }) {
  const [name,setName]=React.useState("");
  const [color,setColor]=React.useState("#A78BFA");
  const presets=["#A78BFA","#7DD3FC","#34D399","#FBBF24","#FB7185","#C4B5FD","#F472B6","#60A5FA"];
  return (
    <div className="form-stage">
      <div className="form-section">
        <div className="moodboard-hero" style={{background:`linear-gradient(135deg, ${color}22, transparent 70%)`}}>
          <div className="moodboard-hero-orb" style={{background:color,boxShadow:`0 0 30px ${color}`}}/>
          <div className="moodboard-hero-text"><div className="moodboard-hero-kicker mono">nuevo moodboard</div><div className="moodboard-hero-title">{name||"Sin título"}</div></div>
        </div>
        <FormField label="Nombre del moodboard"><input className="form-input" autoFocus value={name} onChange={e=>setName(e.target.value)} placeholder="Style #042 · Otoño Editorial"/></FormField>
        <FormField label="Color de identificación">
          <div className="moodboard-color-grid">
            {presets.map(c=><button key={c} type="button" className={"mb-color-swatch "+(color===c?"is-on":"")} style={{background:c}} onClick={()=>setColor(c)}/>)}
            <label className="mb-color-custom" style={{background:color}}><input type="color" value={color} onChange={e=>setColor(e.target.value)}/><span className="mono">custom</span></label>
          </div>
        </FormField>
      </div>
      <div className="form-foot">
        <button type="button" className="form-btn-ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="form-btn-primary" disabled={!name.trim()} onClick={()=>onCreate({name:name.trim(),color,intent:"custom"})}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:12,height:12}}><path d="M12 5v14M5 12h14"/></svg>
          Crear moodboard
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewClientPopup
// ---------------------------------------------------------------------------
function NewClientPopup({ open, onCreate, onClose }) {
  if (!open) return null;
  return (
    <div className="form-popup-backdrop" onClick={onClose}>
      <div className="form-popup form-popup-lg" onClick={e=>e.stopPropagation()}>
        <div className="form-popup-head"><div><div className="form-popup-kicker mono">cerebro · clientes</div><div className="form-popup-title">Conectar nuevo cliente</div></div><button className="super-close" onClick={onClose}>✕</button></div>
        <NewClientForm onCancel={onClose} onCreate={data=>{onCreate(data);onClose();}}/>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ProjectsPanel
// ---------------------------------------------------------------------------
function ProjectCard({ project, active, onOpen, onDelete }) {
  return (
    <div className={"project-card "+(active?"is-active":"")}>
      <button className="project-card-main" onClick={onOpen}>
        <div className="project-card-thumbs">{(project.thumbs||["#A78BFA","#7DD3FC","#34D399"]).slice(0,3).map((c,i)=><span key={i} style={{background:c,transform:`translateX(${-i*8}px)`}}/>)}</div>
        <div className="project-card-meta"><div className="project-card-name">{project.name}</div><div className="project-card-stats mono">{project.nodes?.length||0} nodos · {project.edges?.length||0} conex. · {new Date(project.updatedAt).toLocaleDateString()}</div></div>
        <div className="project-card-arrow">→</div>
      </button>
      <button className="project-card-delete" onClick={e=>{e.stopPropagation();onDelete();}} title="Eliminar proyecto">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
      </button>
    </div>
  );
}

function ProjectsPanel({ projects, clients, onOpen, onCreate, onDelete, onClose, activeProjectId }) {
  const [showForm,setShowForm]=React.useState(false);
  const [newName,setNewName]=React.useState("");
  const inputRef=React.useRef(null);
  React.useEffect(()=>{if(showForm)setTimeout(()=>inputRef.current?.focus(),50);},[showForm]);
  const handleCreate=()=>{if(!newName.trim())return;onCreate(newName.trim());setNewName("");setShowForm(false);};
  const groups=clients.map(c=>({client:c,items:projects.filter(p=>p.clientId===c.id)}));
  const orphans=projects.filter(p=>!p.clientId);
  if(orphans.length) groups.push({client:null,items:orphans});
  return (
    <>
      <DrawerHeader title="Proyectos" subtitle="por cliente · flujos guardados" onClose={onClose}/>
      <div className="drawer-body scroll-thin">
        {showForm?(
          <div className="proj-new-form">
            <div className="drawer-section-label mono" style={{marginBottom:10}}>Nuevo proyecto</div>
            <input ref={inputRef} className="form-input" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleCreate();if(e.key==="Escape"){setShowForm(false);setNewName("");}}} placeholder="Nombre del proyecto…"/>
            <div style={{display:"flex",gap:6,marginTop:8}}><button className="form-btn-ghost" style={{flex:1}} onClick={()=>{setShowForm(false);setNewName("");}}>Cancelar</button><button className="form-btn-primary" style={{flex:1}} disabled={!newName.trim()} onClick={handleCreate}>Crear</button></div>
          </div>
        ):(
          <button className="add-client-btn" onClick={()=>setShowForm(true)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:14,height:14}}><path d="M12 5v14M5 12h14"/></svg>Nuevo proyecto</button>
        )}
        {projects.length===0&&!showForm&&<div className="empty-state"><div className="empty-state-icon">🗂</div><div className="empty-state-title">Sin proyectos todavía</div><div className="empty-state-body">Crea uno para guardar el flujo completo del canvas.</div></div>}
        {groups.filter(g=>g.items.length>0).map(g=>(
          <div key={g.client?.id||"_orphans"} className="project-group">
            <div className="project-group-head">
              {g.client?<div className="project-group-avatar" style={{background:g.client.bgGradient}}><span>{g.client.initials}</span></div>:<div className="project-group-avatar project-group-avatar-ghost">∅</div>}
              <div className="project-group-meta"><div className="project-group-name">{g.client?.name||"Sin cliente"}</div><div className="project-group-count mono">{g.items.length} proyecto{g.items.length===1?"":"s"}</div></div>
            </div>
            <div className="project-list">{g.items.map(p=><ProjectCard key={p.id} project={p} active={p.id===activeProjectId} onOpen={()=>onOpen(p)} onDelete={()=>onDelete(p)}/>)}</div>
          </div>
        ))}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SettingsPanel
// ---------------------------------------------------------------------------
const MASTER_EMAIL    = "nicolas@cliender.com";
const MASTER_PASSWORD = "Master123";

function SettingsPanel({ theme, setTheme, onClose }) {
  const [apiStatus,setApiStatus]=React.useState({anthropic:null,kie:null,backend:null});
  const [dangerStep,setDangerStep]=React.useState(0);
  const [dangerPwd,setDangerPwd]=React.useState("");
  const [dangerErr,setDangerErr]=React.useState("");
  React.useEffect(()=>{
    fetch(`${CDPRO_CONFIG.API_BASE}/health`,{signal:AbortSignal.timeout(3000)})
      .then(r=>r.json())
      .then(d=>setApiStatus({anthropic:d.anthropic!==false,kie:d.kie!==false,backend:true}))
      .catch(()=>setApiStatus({anthropic:false,kie:false,backend:false}));
  },[]);
  const userEmail=localStorage.getItem("cdpro_user")||"nico@cliender.com";
  const rawName=userEmail.split("@")[0];
  const userName=rawName.charAt(0).toUpperCase()+rawName.slice(1);
  const userInitials=rawName.slice(0,2).toUpperCase();
  const StatusBadge=({ok})=>{
    if(ok===null) return <span className="sett-badge sett-badge-checking">···</span>;
    return ok?<span className="sett-badge sett-badge-ok"><span className="sett-badge-dot"/>online</span>:<span className="sett-badge sett-badge-err"><span className="sett-badge-dot sett-badge-dot-err"/>offline</span>;
  };
  function handleDangerConfirm(){
    if(dangerPwd===MASTER_PASSWORD){localStorage.clear();window.__notify?.({kind:"info",icon:"✕",title:"Datos eliminados",body:"Recarga la página para empezar de cero."});setDangerStep(0);setDangerPwd("");setDangerErr("");}
    else setDangerErr("Contraseña incorrecta. Acceso denegado.");
  }
  return (
    <>
      <DrawerHeader title="Ajustes" subtitle="apariencia · integraciones · cuenta" onClose={onClose}/>
      <div className="drawer-body scroll-thin">
        <div className="sett-profile"><div className="sett-profile-avatar">{userInitials}</div><div className="sett-profile-info"><div className="sett-profile-name">{userName}</div><div className="sett-profile-email mono">{userEmail}</div></div><span className="sett-profile-pro mono">Pro</span></div>
        <div className="sett-workspace"><img src="prototype/assets/logos/Logo1Purple.svg" alt="Cliender" className="sett-ws-logo"/><div className="sett-ws-info"><div className="sett-ws-name">Design Pro Workspace</div><div className="sett-ws-meta mono">v0.4 · HBD Revolution SL · 11 clientes activos</div></div></div>
        <div className="sett-group">
          <div className="sett-group-label mono">Apariencia</div>
          <div className="sett-row"><div className="sett-row-left"><span className="sett-row-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg></span><div><div className="sett-row-title">Tema</div><div className="sett-row-sub mono">dark · light · auto</div></div></div><div className="sett-seg">{[{id:"dark",label:"Dark"},{id:"light",label:"Light"},{id:"system",label:"Auto"}].map(t=><button key={t.id} className={"sett-seg-btn"+(theme===t.id?" is-on":"")} onClick={()=>setTheme(t.id)}>{t.label}</button>)}</div></div>
          <div className="sett-row"><div className="sett-row-left"><span className="sett-row-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/></svg></span><div><div className="sett-row-title">Acento</div><div className="sett-row-sub mono">color dominante UI</div></div></div><div className="sett-accent-fixed"><span className="sett-accent-fixed-disc"/><span className="sett-accent-fixed-label mono">Cliender Purple</span></div></div>
          <div className="sett-row"><div className="sett-row-left"><span className="sett-row-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></span><div><div className="sett-row-title">Movimiento</div><div className="sett-row-sub mono">animaciones y edges</div></div></div><span className="sett-fixed-tag">Full</span></div>
          <div className="sett-row"><div className="sett-row-left"><span className="sett-row-icon"><svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></span><div><div className="sett-row-title">Densidad</div><div className="sett-row-sub mono">tamaño de nodos</div></div></div><span className="sett-fixed-tag">Confort</span></div>
        </div>
        <div className="sett-group">
          <div className="sett-group-label mono">Integraciones</div>
          <div className="sett-int-card"><div className="sett-int-icon" style={{background:"linear-gradient(135deg,#D97757,#C84F2F)"}}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/><path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/></svg></div><div className="sett-int-meta"><div className="sett-int-title">Anthropic Claude</div><div className="sett-int-sub mono">claude-sonnet-4-6 · cerebro cognitivo</div></div><StatusBadge ok={apiStatus.anthropic}/></div>
          <div className="sett-int-card"><div className="sett-int-icon" style={{background:"linear-gradient(135deg,#F59E0B,#D97706)"}}><span style={{color:"#0F1018",fontWeight:800,fontSize:15}}>K</span></div><div className="sett-int-meta"><div className="sett-int-title">KIE.ai</div><div className="sett-int-sub mono">gpt-image-2 · seedance-2.0 · motor visual</div></div><StatusBadge ok={apiStatus.kie}/></div>
          <div className="sett-int-card"><div className="sett-int-icon" style={{background:"linear-gradient(135deg,#4F6EF7,#2D4FDB)"}}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg></div><div className="sett-int-meta"><div className="sett-int-title">FastAPI Backend</div><div className="sett-int-sub mono">localhost:3003 · LangGraph · SSE</div></div><StatusBadge ok={apiStatus.backend}/></div>
        </div>
        <div className="sett-group"><div className="sett-group-label mono">Modelos activos</div><div className="sett-models"><div className="sett-model-chip"><span className="sett-model-dot" style={{background:"#C84F2F"}}/>claude-sonnet-4-6</div><div className="sett-model-chip"><span className="sett-model-dot" style={{background:"#F59E0B"}}/>gpt-image-2</div><div className="sett-model-chip"><span className="sett-model-dot" style={{background:"#60A5FA"}}/>seedance-2.0</div></div></div>
        <div className="sett-group"><div className="sett-group-label mono">Cuenta</div><button className="sett-btn" onClick={()=>{if(confirm("¿Cerrar sesión y volver al login?")){localStorage.removeItem("cdpro_session");window.location.href="Login.html";}}}>
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Cerrar sesión
        </button></div>
        <div className="sett-group sett-danger-zone">
          <div className="sett-group-label mono" style={{color:"rgba(251,113,133,0.65)"}}>Zona de peligro</div>
          {dangerStep===0&&<button className="sett-btn sett-btn-danger" onClick={()=>setDangerStep(1)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" style={{width:13,height:13}}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>Borrar todos los datos locales</button>}
          {dangerStep===1&&<div className="sett-danger-confirm"><div className="sett-danger-warn mono">⚠ Esta acción borrará localStorage completo y no se puede deshacer.</div><div className="sett-danger-confirm-actions"><button className="sett-btn" onClick={()=>setDangerStep(0)}>Cancelar</button><button className="sett-btn sett-btn-danger" onClick={()=>{setDangerStep(2);setDangerErr("");}}>Continuar</button></div></div>}
          {dangerStep===2&&<div className="sett-danger-auth"><div className="sett-danger-auth-label mono">Introduce la contraseña maestra</div><div className="sett-danger-auth-hint mono">{MASTER_EMAIL}</div><input type="password" className="sett-danger-input" placeholder="Contraseña maestra…" value={dangerPwd} autoFocus onChange={e=>{setDangerPwd(e.target.value);setDangerErr("");}} onKeyDown={e=>{if(e.key==="Enter")handleDangerConfirm();if(e.key==="Escape"){setDangerStep(0);setDangerPwd("");setDangerErr("");}}}/>{dangerErr&&<div className="sett-danger-error mono">{dangerErr}</div>}<div className="sett-danger-confirm-actions"><button className="sett-btn" onClick={()=>{setDangerStep(0);setDangerPwd("");setDangerErr("");}}>Cancelar</button><button className="sett-btn sett-btn-danger" onClick={handleDangerConfirm}>Borrar ahora</button></div></div>}
        </div>
        <div className="sett-foot"><img src="prototype/assets/logos/Logo1Purple.svg" alt="" className="sett-foot-logo"/><span className="mono">ClienderDesign v0.4 · {new Date().toISOString().slice(0,10)}</span></div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// SAMPLE_AGENTS
// ---------------------------------------------------------------------------
const SAMPLE_AGENTS = [
  {id:"ag-shaq",name:"Shaq",role:"Agente General",specialty:"Producción mixta, video + imagen",description:"Agente versátil listo para adaptarse a cualquier brief creativo. Equilibra la expresión visual con los objetivos de negocio.",tono:"Profesional con carácter propio",objetivo:"Maximizar impacto visual manteniendo coherencia de marca",sector:"Generalista",accent:"#6366F1",initials:"SQ",style:["versátil","adaptable","equilibrado"],avoid:[]},
];

// ---------------------------------------------------------------------------
// AgentFicha
// ---------------------------------------------------------------------------
function AgentFicha({ agent, onEdit, onDelete }) {
  const [expanded,setExpanded]=React.useState(false);
  const color=agent.accent||"#6366F1";
  return (
    <div className="agent-card" style={{"--agent-color":color}}>
      <div className="agent-card-head" onClick={()=>setExpanded(v=>!v)} style={{cursor:"pointer"}}>
        <span className="agent-card-avatar" style={{background:color}}>{agent.initials}</span>
        <div className="agent-card-info"><div className="agent-card-name">/{agent.name.toLowerCase()}</div><div className="agent-card-role mono">{agent.role}</div></div>
        <div className="agent-card-actions" onClick={e=>e.stopPropagation()}><button className="agent-card-btn" onClick={()=>onEdit(agent)} title="Editar">&#9998;</button><button className="agent-card-btn agent-card-btn-del" onClick={()=>onDelete(agent.id)} title="Eliminar">&#10005;</button></div>
        <span className="agent-card-chevron mono">{expanded?"▲":"▼"}</span>
      </div>
      <div className="agent-card-specialty mono">{agent.specialty}</div>
      {expanded&&(
        <div className="agent-ficha">
          {agent.description&&<div className="ficha-row"><span className="ficha-label mono">descripción</span><span className="ficha-val">{agent.description}</span></div>}
          {agent.tono&&<div className="ficha-row"><span className="ficha-label mono">tono</span><span className="ficha-val">{agent.tono}</span></div>}
          {agent.objetivo&&<div className="ficha-row"><span className="ficha-label mono">objetivo</span><span className="ficha-val">{agent.objetivo}</span></div>}
          {agent.sector&&<div className="ficha-row"><span className="ficha-label mono">sector</span><span className="ficha-val">{agent.sector}</span></div>}
          {agent.style?.length>0&&<div className="ficha-row ficha-row-tags"><span className="ficha-label mono">estilo</span><div className="agent-card-tags">{agent.style.map((s,i)=><span key={i} className="agent-tag">{s}</span>)}</div></div>}
          {agent.avoid?.length>0&&<div className="ficha-row ficha-row-tags"><span className="ficha-label mono">evitar</span><div className="agent-card-tags">{agent.avoid.map((s,i)=><span key={i} className="agent-tag agent-tag-avoid">{s}</span>)}</div></div>}
          <button className="ficha-edit-btn" onClick={()=>onEdit(agent)}>&#9998; Editar ficha completa</button>
        </div>
      )}
      {!expanded&&agent.style?.length>0&&<div className="agent-card-tags">{agent.style.slice(0,4).map((s,i)=><span key={i} className="agent-tag">{s}</span>)}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewAgentPopup
// ---------------------------------------------------------------------------
function NewAgentPopup({ open, initial, onSave, onClose }) {
  if (!open) return null;
  const ACCENTS=["#6366F1","#8B5CF6","#EC4899","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316","#84CC16","#A78BFA"];
  const blank={name:"",role:"",specialty:"",description:"",tono:"",objetivo:"",sector:"",accent:"#6366F1",initials:"",style:"",avoid:""};
  const [form,setForm]=React.useState(initial?{...initial,style:(initial.style||[]).join(", "),avoid:(initial.avoid||[]).join(", ")}:blank);
  const set=(k,v)=>setForm(f=>({...f,[k]:v}));
  const liveInitials=form.initials.trim()||form.name.trim().split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()||"").join("")||"?";
  const handleSubmit=(e)=>{e.preventDefault();if(!form.name.trim())return;onSave({id:initial?.id||("ag-"+Date.now().toString(36)),name:form.name.trim(),role:form.role.trim()||"Agente Creativo",specialty:form.specialty.trim(),description:form.description.trim(),tono:form.tono.trim(),objetivo:form.objetivo.trim(),sector:form.sector.trim(),accent:form.accent,initials:liveInitials,style:form.style.split(",").map(s=>s.trim()).filter(Boolean),avoid:form.avoid.split(",").map(s=>s.trim()).filter(Boolean)});};
  return (
    <div className="form-popup-backdrop" onClick={onClose}>
      <div className="agent-form-modal" onClick={e=>e.stopPropagation()}>
        <div className="agent-form-header">
          <div className="agent-form-avatar" style={{background:form.accent}}>{liveInitials}</div>
          <div className="agent-form-preview-info"><div className="agent-form-preview-name">{form.name?"/"+form.name.toLowerCase().replace(/\s+/g,"_"):"/nuevo_agente"}</div><div className="agent-form-preview-role mono">{form.role||"Agente Creativo"}</div></div>
          <button className="agent-form-close" onClick={onClose}>&#10005;</button>
        </div>
        <div className="agent-form-accents">{ACCENTS.map(c=><button key={c} type="button" className={"agent-accent-dot"+(form.accent===c?" is-active":"")} style={{background:c,boxShadow:form.accent===c?`0 0 0 2px var(--bg-1, #0f1116), 0 0 0 4px ${c}`:"none"}} onClick={()=>set("accent",c)}/>)}</div>
        <form onSubmit={handleSubmit} className="agent-form-body">
          <div className="agent-form-section-label">identidad</div>
          <div className="form-row"><div style={{flex:1}}><div className="field-label">Nombre *</div><input className="node-input" value={form.name} onChange={e=>set("name",e.target.value)} placeholder="Ej: Pablo, Aria..." required autoFocus/></div><div style={{width:80}}><div className="field-label">Iniciales</div><input className="node-input" value={form.initials} onChange={e=>set("initials",e.target.value.slice(0,3).toUpperCase())} placeholder="PB" maxLength={3}/></div></div>
          <div className="agent-form-section-label" style={{marginTop:16}}>perfil profesional</div>
          <div className="form-row"><div style={{flex:1}}><div className="field-label">Rol</div><input className="node-input" value={form.role} onChange={e=>set("role",e.target.value)} placeholder="Diseño & Producción"/></div><div style={{flex:1}}><div className="field-label">Sector</div><input className="node-input" value={form.sector} onChange={e=>set("sector",e.target.value)} placeholder="Moda, B2B, Generalista..."/></div></div>
          <div className="field-label" style={{marginTop:10}}>Especialidad</div>
          <input className="node-input" value={form.specialty} onChange={e=>set("specialty",e.target.value)} placeholder="Ej: Branding, identidad visual, RRSS"/>
          <div className="agent-form-section-label" style={{marginTop:16}}>dirección creativa</div>
          <div className="field-label">Descripción del agente</div>
          <textarea className="node-input node-textarea" rows={3} value={form.description} onChange={e=>set("description",e.target.value)} placeholder="Describe la personalidad y enfoque creativo..."/>
          <div className="form-row" style={{marginTop:10,gap:8}}><div style={{flex:1}}><div className="field-label">Tono de comunicación</div><input className="node-input" value={form.tono} onChange={e=>set("tono",e.target.value)} placeholder="Directo y audaz..."/></div><div style={{flex:1}}><div className="field-label">Objetivo principal</div><input className="node-input" value={form.objetivo} onChange={e=>set("objetivo",e.target.value)} placeholder="Maximizar impacto..."/></div></div>
          <div className="agent-form-section-label" style={{marginTop:16}}>estilo &amp; restricciones</div>
          <div className="field-label">Tags de estilo <span className="mono" style={{opacity:0.5}}>(separado por comas)</span></div>
          <input className="node-input" value={form.style} onChange={e=>set("style",e.target.value)} placeholder="editorial, minimalista, tipografía fuerte"/>
          <div className="field-label" style={{marginTop:10}}>Tags a evitar <span className="mono" style={{opacity:0.5}}>(separado por comas)</span></div>
          <input className="node-input" value={form.avoid} onChange={e=>set("avoid",e.target.value)} placeholder="stock imagery, colores genéricos"/>
          <div className="agent-form-footer"><button type="button" className="agent-form-btn-cancel" onClick={onClose}>Cancelar</button><button type="submit" className="agent-form-btn-save">{initial?"Guardar cambios":"Crear agente →"}</button></div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WIZARD_STEPS
// ---------------------------------------------------------------------------
const WIZARD_STEPS = [
  {id:"vertical",label:"¿Para qué vertical?",sub:"Define el área principal de aplicación",type:"single",options:[{id:"sales",icon:"🎯",label:"Sales",desc:"Propuestas, cierre, leads"},{id:"media",icon:"🎬",label:"Media",desc:"Vídeo, imagen, RRSS"},{id:"tech",icon:"⚡",label:"Tech",desc:"Software, automatización"},{id:"all",icon:"✶",label:"Todos",desc:"Generalista cross-vertical"}]},
  {id:"client",label:"¿Tipo de cliente objetivo?",sub:"Calibra el tono y la estética del agente",type:"single",options:[{id:"luxury",icon:"💎",label:"Lujo / Premium",desc:"Alta gama, exclusivo"},{id:"mass",icon:"📣",label:"Masivo B2C",desc:"Gran volumen, amplio público"},{id:"b2b",icon:"🏢",label:"B2B Corporativo",desc:"Empresas, sectorial"},{id:"startup",icon:"🚀",label:"Startup / Tech",desc:"Innovador, ágil, digital"}]},
  {id:"channel",label:"¿Canales principales?",sub:"Selecciona todos los que apliquen",type:"multi",options:[{id:"ig",icon:"📸",label:"Instagram",desc:"Feed · Stories · Reels"},{id:"video",icon:"▶",label:"Vídeo/Reels",desc:"TikTok, YT Shorts"},{id:"web",icon:"🌐",label:"Web/Landing",desc:"Páginas, CRO"},{id:"ads",icon:"📊",label:"Ads/Email",desc:"Performance, CRM"},{id:"tiktok",icon:"🎵",label:"TikTok",desc:"Virales, tendencias"},{id:"yt",icon:"🎥",label:"YouTube",desc:"Long form, tutoriales"}]},
  {id:"style",label:"¿Estilo visual del agente?",sub:"Puede ser múltiple — define la paleta creativa",type:"multi",options:[{id:"minimal",icon:"◻",label:"Minimalista",desc:"Limpio, espacio blanco"},{id:"editorial",icon:"📰",label:"Editorial",desc:"Tipografía fuerte, jerarquía"},{id:"bold",icon:"🔥",label:"Colorido/Bold",desc:"Vibrant, impacto visual"},{id:"dark",icon:"🌑",label:"Dark/Elegante",desc:"Oscuro, sofisticado"},{id:"organic",icon:"🌿",label:"Orgánico",desc:"Natural, texturas vivas"},{id:"futurist",icon:"🤖",label:"Futurista",desc:"Tech, geométrico, neo"}]},
  {id:"tone",label:"¿Voz del agente?",sub:"Cómo se comunica en briefings y resultados",type:"single",options:[{id:"direct",icon:"⚡",label:"Directo y audaz",desc:"Sin rodeos, potente"},{id:"natural",icon:"😊",label:"Cercano y natural",desc:"Humano, accesible"},{id:"soph",icon:"✨",label:"Sofisticado",desc:"Culto, refinado"},{id:"tech",icon:"🔬",label:"Técnico/Experto",desc:"Preciso, datos"}]},
  {id:"content",label:"¿Qué tipo de contenido genera?",sub:"Elige todos los formatos relevantes",type:"multi",options:[{id:"img",icon:"🖼",label:"Imagen estática",desc:"Fotos, gráficos, banners"},{id:"motion",icon:"🎬",label:"Vídeo/Motion",desc:"Reels, animaciones"},{id:"copy",icon:"✍",label:"Copy/Texto",desc:"Captions, scripts"},{id:"mix",icon:"🎨",label:"Mix completo",desc:"Campaña 360°"}]},
  {id:"goal",label:"¿Objetivo principal?",sub:"El KPI que más importa a este agente",type:"single",options:[{id:"sales",icon:"💰",label:"Generar ventas",desc:"Conversión, ROI"},{id:"brand",icon:"⭐",label:"Construir marca",desc:"Awareness, posicionamiento"},{id:"educate",icon:"📚",label:"Educar/Informar",desc:"Contenido de valor"},{id:"entertain",icon:"🎉",label:"Entretener",desc:"Engagement, viral"}]},
  {id:"refs",label:"¿Referentes visuales?",sub:"Marcas que inspiran el estilo — multi selección",type:"multi",options:[{id:"apple",icon:"🍎",label:"Apple",desc:"Ultra minimal, premium"},{id:"zara",icon:"👗",label:"Zara",desc:"Editorial, neutros"},{id:"netflix",icon:"N",label:"Netflix",desc:"Dark, impactante"},{id:"nike",icon:"✔",label:"Nike",desc:"Bold, motivacional"},{id:"hermes",icon:"🎀",label:"Hermès",desc:"Artesanal, detalle"},{id:"redbull",icon:"🐂",label:"Red Bull",desc:"Energía, extremo"}]},
  {id:"avoid",label:"¿Qué debe evitar siempre?",sub:"Define las líneas rojas del agente",type:"multi",options:[{id:"stock",icon:"❌",label:"Stock imagery",desc:"Fotos genéricas sin alma"},{id:"neon",icon:"🌈",label:"Colores neón",desc:"Saturados, agresivos"},{id:"informal",icon:"💬",label:"Lenguaje informal",desc:"Jerga, emojis excesivos"},{id:"generic",icon:"📋",label:"Diseño genérico",desc:"Plantillas sin adaptar"},{id:"complex",icon:"🌀",label:"Sobre-complicado",desc:"Mucho ruido visual"},{id:"old",icon:"⏰",label:"Estética anticuada",desc:"Tendencias pasadas"}]},
  {id:"risk",label:"¿Nivel de riesgo creativo?",sub:"¿Hasta dónde puede arriesgarse el agente?",type:"single",options:[{id:"conservative",icon:"🛡",label:"Conservador",desc:"Seguro, on-brand"},{id:"balanced",icon:"⚖",label:"Equilibrado",desc:"Creativo con límites"},{id:"bold2",icon:"🔥",label:"Arriesgado",desc:"Rompe reglas, destaca"},{id:"experimental",icon:"🧪",label:"Experimental",desc:"Vanguardia sin límites"}]},
];

// ---------------------------------------------------------------------------
// AIAgentPopup — wizard 10 pasos
// ---------------------------------------------------------------------------
function AIAgentPopup({ open, onSave, onClose }) {
  if (!open) return null;
  const TOTAL=WIZARD_STEPS.length;
  const [step,setStep]=React.useState(0);
  const [answers,setAnswers]=React.useState({});
  const [phase,setPhase]=React.useState("quiz");
  const [editGen,setEditGen]=React.useState(null);
  const [genData,setGenData]=React.useState(null);
  const cur=WIZARD_STEPS[step]||{};
  const sel=answers[cur.id]||[];
  const canNext=sel.length>0;
  const ACCENTS=["#8B5CF6","#EC4899","#6366F1","#10B981","#F59E0B","#EF4444","#06B6D4","#F97316"];
  const toggle=(optId)=>{setAnswers(prev=>{const existing=prev[cur.id]||[];if(cur.type==="single")return{...prev,[cur.id]:[optId]};if(existing.includes(optId))return{...prev,[cur.id]:existing.filter(x=>x!==optId)};return{...prev,[cur.id]:[...existing,optId]};});};
  const goNext=()=>{if(step<TOTAL-1){setStep(s=>s+1);return;}buildAgent();};
  const goPrev=()=>{if(step>0)setStep(s=>s-1);};
  const buildAgent=()=>{
    setPhase("generating");
    setTimeout(()=>{
      const get=(stepId)=>(answers[stepId]||[])[0];
      const getAll=(stepId)=>answers[stepId]||[];
      const findLabel=(stepId,id)=>(WIZARD_STEPS.find(s=>s.id===stepId)?.options||[]).find(o=>o.id===id)?.label||"";
      const styleLabels=getAll("style").map(id=>findLabel("style",id));
      const avoidLabels=getAll("avoid").map(id=>findLabel("avoid",id));
      const refLabels=getAll("refs").map(id=>findLabel("refs",id));
      const toneLabel=findLabel("tone",get("tone"));
      const goalLabel=findLabel("goal",get("goal"));
      const clientLabel=findLabel("client",get("client"));
      const vertLabel=findLabel("vertical",get("vertical"));
      const riskLabel=findLabel("risk",get("risk"));
      const names=["Aria","Nexo","Lumen","Vex","Orbit","Kael","Mira","Enzo","Lyra","Dex"];
      const name=names[Math.floor(Math.random()*names.length)];
      const accent=ACCENTS[Math.floor(Math.random()*ACCENTS.length)];
      const result={id:"ag-"+Date.now().toString(36),name,role:vertLabel?`Agente ${vertLabel}`:"Agente Creativo IA",specialty:[clientLabel,getAll("channel").slice(0,2).map(id=>findLabel("channel",id)).join(", ")].filter(Boolean).join(" · "),description:`Agente IA calibrado para ${clientLabel||"cualquier cliente"}. ${toneLabel?`Voz ${toneLabel.toLowerCase()}.`:""} ${goalLabel?`Meta: ${goalLabel.toLowerCase()}.`:""} ${riskLabel?`Perfil ${riskLabel.toLowerCase()}.`:""}`.trim(),tono:toneLabel||"Profesional y directo",objetivo:goalLabel||"Maximizar impacto visual",sector:clientLabel||"Generalista",accent,initials:name.slice(0,2).toUpperCase(),style:styleLabels.length?styleLabels:refLabels.length?refLabels.slice(0,3):["adaptable","enfocado"],avoid:avoidLabels};
      setGenData(result);setEditGen({...result,style:result.style.join(", "),avoid:result.avoid.join(", ")});setPhase("preview");
    },2000);
  };
  const saveGenerated=()=>{const initials=editGen.initials||editGen.name.slice(0,2).toUpperCase();onSave({...genData,...editGen,initials,style:editGen.style.split(",").map(s=>s.trim()).filter(Boolean),avoid:editGen.avoid.split(",").map(s=>s.trim()).filter(Boolean)});};
  const setEG=(k,v)=>setEditGen(g=>({...g,[k]:v}));
  return (
    <div className="form-popup-backdrop" onClick={onClose}>
      <div className="ai-wiz-modal" onClick={e=>e.stopPropagation()}>
        {phase==="quiz"&&(
          <>
            <div className="ai-wiz-progress-track"><div className="ai-wiz-progress-fill" style={{width:((step/TOTAL)*100)+"%"}}/></div>
            <div className="ai-wiz-topbar"><span className="ai-wiz-kicker mono">&#10022; crear agente con ia</span><div className="ai-wiz-step-dots">{WIZARD_STEPS.map((_,i)=><span key={i} className={"ai-wiz-dot"+(i===step?" active":i<step?" done":"")}/>)}</div><button className="agent-form-close" onClick={onClose}>&#10005;</button></div>
            <div className="ai-wiz-question-wrap" key={step}>
              {cur.type==="multi"&&<div className="ai-wiz-multi-badge mono">selección múltiple</div>}
              <div className="ai-wiz-q-label">{cur.label}</div>
              <div className="ai-wiz-q-sub mono">{cur.sub}</div>
              <div className={"ai-wiz-options ai-wiz-opts-"+(cur.options||[]).length}>
                {(cur.options||[]).map(opt=>{const active=sel.includes(opt.id);return(
                  <button key={opt.id} type="button" className={"ai-wiz-opt"+(active?" is-sel":"")} onClick={()=>toggle(opt.id)}>
                    <span className="ai-wiz-opt-icon">{opt.icon}</span><span className="ai-wiz-opt-name">{opt.label}</span><span className="ai-wiz-opt-desc mono">{opt.desc}</span>{active&&<span className="ai-wiz-opt-check">&#10003;</span>}
                  </button>
                );})}
              </div>
            </div>
            <div className="ai-wiz-nav"><button type="button" className="ai-wiz-nav-back" onClick={step>0?goPrev:onClose}>{step===0?"Cancelar":"← Anterior"}</button><button type="button" className={"ai-wiz-nav-next"+(canNext?"":" is-disabled")} onClick={canNext?goNext:undefined}>{step===TOTAL-1?"✶ Generar agente":"Siguiente →"}</button></div>
          </>
        )}
        {phase==="generating"&&(
          <div className="ai-wiz-generating"><div className="ai-wiz-gen-rings"><div className="ai-wiz-gen-ring r1"/><div className="ai-wiz-gen-ring r2"/><div className="ai-wiz-gen-ring r3"/><div className="ai-wiz-gen-core">&#10022;</div></div><div className="ai-wiz-gen-title">Construyendo tu agente</div><div className="ai-wiz-gen-sub mono">Analizando {TOTAL} parámetros · calibrando IA</div></div>
        )}
        {phase==="preview"&&editGen&&(
          <>
            <div className="ai-wiz-topbar"><span className="ai-wiz-kicker mono">&#10022; agente generado</span><button className="agent-form-close" onClick={onClose}>&#10005;</button></div>
            <div className="ai-wiz-preview-body">
              <div className="ai-wiz-preview-avatar-row"><span className="ai-wiz-preview-avatar" style={{background:editGen.accent}}>{editGen.initials}</span><div style={{flex:1}}><input className="node-input" value={editGen.name} onChange={e=>setEG("name",e.target.value)} placeholder="Nombre" style={{marginBottom:4}}/><input className="node-input" value={editGen.role} onChange={e=>setEG("role",e.target.value)} placeholder="Rol"/></div></div>
              <div className="field-label">Descripción</div>
              <textarea className="node-input node-textarea" rows={3} value={editGen.description} onChange={e=>setEG("description",e.target.value)}/>
              <div className="form-row" style={{marginTop:8,gap:8}}><div style={{flex:1}}><div className="field-label">Tono</div><input className="node-input" value={editGen.tono} onChange={e=>setEG("tono",e.target.value)}/></div><div style={{flex:1}}><div className="field-label">Sector</div><input className="node-input" value={editGen.sector} onChange={e=>setEG("sector",e.target.value)}/></div></div>
              <div className="field-label" style={{marginTop:8}}>Tags de estilo <span className="mono" style={{opacity:0.45}}>(comas)</span></div>
              <input className="node-input" value={editGen.style} onChange={e=>setEG("style",e.target.value)}/>
              <div className="field-label" style={{marginTop:8}}>Evitar <span className="mono" style={{opacity:0.45}}>(comas)</span></div>
              <input className="node-input" value={editGen.avoid} onChange={e=>setEG("avoid",e.target.value)}/>
            </div>
            <div className="ai-wiz-nav"><button type="button" className="ai-wiz-nav-back" onClick={()=>{setPhase("quiz");setStep(0);setGenData(null);setEditGen(null);}}>&#8592; Rehacer</button><button type="button" className="ai-wiz-nav-next" onClick={saveGenerated}>Guardar agente</button></div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AgentsPanel
// ---------------------------------------------------------------------------
function AgentsPanel({ agents, onAdd, onEdit, onDelete, onClose }) {
  const [showForm,setShowForm]=React.useState(false);
  const [showAI,setShowAI]=React.useState(false);
  const [editing,setEditing]=React.useState(null);
  const openCreate=()=>{setEditing(null);setShowForm(true);};
  const openEdit=(a)=>{setEditing(a);setShowForm(true);};
  const handleSave=(data)=>{if(editing)onEdit({...editing,...data});else onAdd(data);setShowForm(false);setShowAI(false);};
  return (
    <>
      <DrawerHeader title="Agentes Creativos" subtitle="personaliza tu equipo IA" onClose={onClose}/>
      <div className="drawer-body scroll-thin">
        <div className="agents-actions-row"><button className="agents-btn-new" onClick={openCreate}><span className="agents-btn-icon">+</span><span>Nuevo agente</span></button><button className="agents-btn-ai" onClick={()=>setShowAI(true)}><span className="agents-btn-icon">&#10022;</span><span>Crear con IA</span></button></div>
        {agents.length===0&&<div className="agent-panel-empty mono">Aún no tienes agentes. Crea el primero para personalizar cómo la supercomputadora interpreta cada brief.</div>}
        {agents.map(a=><AgentFicha key={a.id} agent={a} onEdit={openEdit} onDelete={onDelete}/>)}
      </div>
      {showForm&&<NewAgentPopup open={showForm} initial={editing} onSave={handleSave} onClose={()=>setShowForm(false)}/>}
      {showAI&&<AIAgentPopup open={showAI} onSave={handleSave} onClose={()=>setShowAI(false)}/>}
    </>
  );
}

export {
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
}
