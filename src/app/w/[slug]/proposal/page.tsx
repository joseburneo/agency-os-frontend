import { assertModuleVisible } from "@/lib/portal/access";
import { FileText, ShieldCheck, Server, Cpu } from "lucide-react";
import { ModuleHeader, Panel } from "@/components/portal/ui";

// Commercial Proposal — the "with what" page (the Roadmap is the "when").
// Pepe/Terroir Comando only (MAGNET_EXTRAS). Shows the full tool + model stack
// behind the $1,750/mo plan so the technical depth is visible: many providers,
// one platform. Static by design; the numbers are the ones Jose quotes.

const fav = (domain: string) => `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;

function Chip({ domain, label }: { domain: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-white/[0.03] px-2 py-1 text-xs text-foreground whitespace-nowrap">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fav(domain)} alt="" width={14} height={14} style={{ borderRadius: 3 }} />
      {label}
    </span>
  );
}

const STAGES: { n: string; title: string; what: string; tools: [string, string][] }[] = [
  { n: "01", title: "Sourcing", what: "Partimos de vuestras listas y compramos los prospectos que faltan con nuestros proveedores, para maximizar la cobertura de cada país.", tools: [["clay.com", "Clay"]] },
  { n: "02", title: "Calificación", what: "Agentes de IA en paralelo visitan la web y el LinkedIn de cada contacto y deciden FIT o NOT FIT, uno a uno. La lista corta llega limpia antes de gastar un euro en correos.", tools: [["anthropic.com", "Claude · subagentes"], ["openai.com", "GPT-5"]] },
  { n: "03", title: "Correos", what: "Waterfall de proveedores: pagamos solo por correo encontrado, nunca por intento.", tools: [["icypeas.com", "Icypeas"], ["prospeo.io", "Prospeo"], ["enrow.io", "Enrow"]] },
  { n: "04", title: "Verificación", what: "Cada correo se verifica dos veces, con dos servicios distintos. Por eso no hay bounces que quemen vuestros dominios.", tools: [["millionverifier.com", "MillionVerifier"], ["bounceban.com", "BounceBan"]] },
  { n: "05", title: "Business Intelligence", what: "Research por contacto: qué venden, a quién, la mejor señal pública y el mejor ángulo. Todo queda guardado en la base de datos y alimenta cada mensaje.", tools: [["openai.com", "GPT-5"], ["google.com", "Person on the web"]] },
  { n: "06", title: "El copy", what: "Un email único por contacto, escrito por nuestro modelo insignia con el contexto de cada casa, y revisado por un control de calidad multi-agente de 6 bandas antes de salir.", tools: [["anthropic.com", "Claude · insignia"], ["anthropic.com", "QC 6 bandas"]] },
  { n: "07", title: "Envío", what: "Desde vuestro Smartlead, con vuestra firma y vuestro branding. Cuentas calentadas, mitad Google y mitad Microsoft, enviando en volúmenes humanos.", tools: [["smartlead.ai", "Smartlead"], ["google.com", "Google"], ["microsoft.com", "Microsoft"]] },
  { n: "08", title: "Respuestas", what: "Cada respuesta se clasifica al instante, el copiloto redacta el borrador con todo el contexto, y cada positivo se crea como contacto en vuestro HubSpot por API. Los seguimientos por LinkedIn y WhatsApp, con recordatorio y mensaje sugerido.", tools: [["hubspot.com", "HubSpot"], ["linkedin.com", "LinkedIn"], ["whatsapp.com", "WhatsApp"], ["openai.com", "GPT-5"]] },
];

const MODELS: [string, string][] = [
  ["Calificar la lista en batch", "Claude · subagentes en paralelo"],
  ["Research y señales por contacto", "Claude · subagentes"],
  ["El copy que lee el prospecto", "Modelo insignia · solo esto"],
  ["Control de calidad · 6 bandas", "Claude"],
  ["Clasificar cada respuesta", "GPT-5 · al instante"],
  ["Borrador de cada respuesta", "GPT-5 · con el hilo completo"],
];

export default async function ProposalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "proposal");

  return (
    <div className="space-y-6 max-w-5xl">
      <ModuleHeader
        icon={FileText}
        title="Commercial Proposal"
        desc="Todo lo de abajo, bajo una sola plataforma: esta. Plan de $1,750/mes · dos campañas al mes, un país cada una. Si usamos vuestra suscripción de Smartlead, lo descontamos del precio."
      />

      {/* ── The pipeline, stage by stage ─────────────────────────────── */}
      <Panel className="p-5">
        <div className="text-[13px] font-bold tracking-wide text-[#FFD60A] mb-1">{"// EL_PIPELINE · DE LA LISTA A LA REUNIÓN"}</div>
        <p className="text-sm text-muted-foreground mb-4">Ocho etapas. Cada una con su herramienta, cada herramienta ya integrada. Vosotros veis el resultado; la plataforma opera el resto.</p>
        <div className="divide-y divide-border">
          {STAGES.map((s) => (
            <div key={s.n} className="py-3 grid grid-cols-1 md:grid-cols-[44px_1fr_auto] gap-2 md:gap-4 items-start">
              <div className="text-[#FFD60A] font-bold text-sm pt-0.5">{s.n}</div>
              <div>
                <div className="font-semibold text-foreground text-sm">{s.title}</div>
                <div className="text-[13px] text-muted-foreground leading-relaxed">{s.what}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 md:justify-end md:max-w-[260px]">
                {s.tools.map(([d, l]) => <Chip key={l} domain={d} label={l} />)}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── Infrastructure with real prices ──────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-[#FFD60A]" />
            <span className="text-sm font-bold text-foreground">Dominios de envío</span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-3">Comprados a precio de registrador, sin margen (≈ $10–12 al año por dominio). Con dominios de reserva para la rotación: si un spam house lista uno, otro entra a trabajar.</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip domain="spaceship.com" label="Spaceship" />
            <Chip domain="dynadot.com" label="Dynadot" />
            <Chip domain="zapmail.ai" label="Zapmail" />
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <Server className="h-4 w-4 text-[#FFD60A]" />
            <span className="text-sm font-bold text-foreground">Cuentas de correo</span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-3">Cuentas certificadas (≈ $3–4 al mes por buzón), mitad Google y mitad Microsoft: así el correo llega bien a los dos mundos. Siempre calentándose, enviando como personas.</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip domain="google.com" label="Google Workspace" />
            <Chip domain="microsoft.com" label="Microsoft 365" />
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#26D07C]" />
            <span className="text-sm font-bold text-foreground">Vigilancia de deliverability</span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-3">Vuestros ~10 dominios y los nuevos, monitoreados contra los spam houses con alertas por webhook. Si uno cae en una lista, lo sabemos ese día, no cuando la campaña muere.</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip domain="hetrixtools.com" label="Monitoreo 24/7" />
            <Chip domain="google.com" label="Postmaster" />
          </div>
        </Panel>
        <Panel className="p-5">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="h-4 w-4 text-[#26D07C]" />
            <span className="text-sm font-bold text-foreground">GDPR</span>
          </div>
          <p className="text-[13px] text-muted-foreground mb-3">Política de privacidad e interés legítimo publicada online, footer de cumplimiento en cada correo, y supresión inmediata de quien pida no recibir más. Vender a Europa exige esto; viene incluido.</p>
          <div className="flex flex-wrap gap-1.5">
            <Chip domain="europa.eu" label="GDPR compliant" />
          </div>
        </Panel>
      </div>

      {/* ── Models ───────────────────────────────────────────────────── */}
      <Panel className="p-5">
        <div className="flex items-center gap-2 mb-1">
          <Cpu className="h-4 w-4 text-[#FFD60A]" />
          <span className="text-[13px] font-bold tracking-wide text-[#FFD60A]">{"// LOS_MODELOS · QUIÉN HACE QUÉ"}</span>
        </div>
        <p className="text-sm text-muted-foreground mb-4">La regla: el mejor modelo donde el texto lo lee un humano que importa; agentes en paralelo donde es volumen. Millones de tokens por campaña.</p>
        <div className="divide-y divide-border">
          {MODELS.map(([stage, model]) => (
            <div key={stage} className="py-2 flex items-baseline justify-between gap-4">
              <span className="text-[13px] text-muted-foreground">{stage}</span>
              <span className="text-[13px] font-semibold text-foreground text-right">{model}</span>
            </div>
          ))}
        </div>
      </Panel>

      {/* ── The prospect card, live example ──────────────────────────── */}
      <Panel className="p-5">
        <div className="text-[13px] font-bold tracking-wide text-[#FFD60A] mb-1">{"// LA_FICHA · ASÍ SE VE CADA CONTACTO QUE RESPONDE"}</div>
        <p className="text-sm text-muted-foreground mb-4">Ejemplo real de vuestra propia lista. Cuando alguien responde, esta ficha ya existe: el contexto no se busca, ya está.</p>
        <div className="rounded-lg border border-border bg-white/[0.02] p-4 grid grid-cols-1 lg:grid-cols-[1fr_1.1fr] gap-4">
          <div>
            <div className="flex items-center gap-3 mb-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={fav("gustoworld.com")} alt="" width={28} height={28} style={{ borderRadius: 6 }} />
              <div>
                <div className="font-semibold text-foreground text-sm">Christophe Heynen <span className="ml-2 rounded-full border border-[#26D07C]/50 bg-[#0F3D2A] px-2 py-0.5 text-[10px] text-[#26D07C]">Warm</span></div>
                <div className="text-xs text-muted-foreground">Owner · Master of Wine · Gustoworld</div>
              </div>
            </div>
            <div className="flex gap-1 mb-4">
              {["MQL", "SQL", "Discovery", "Proposal", "Won"].map((st, i) => (
                <span key={st} className={`rounded px-2 py-0.5 text-[10px] ${i === 0 ? "bg-[#FFD60A] text-black font-bold" : "border border-border text-muted-foreground"}`}>{st}</span>
              ))}
            </div>
            <div className="space-y-1.5 text-[12px] text-muted-foreground">
              <div>↙ respondió hace 2h · ↗ contestamos hace 1h · siguiente toque: LinkedIn, en 2 días</div>
              <div>Canales listos: <span className="text-foreground">Email · LinkedIn · WhatsApp · Llamada</span></div>
              <div>El copiloto redacta cada mensaje con el hilo completo; tú lo revisas y envías.</div>
            </div>
          </div>
          <div className="rounded-md border border-border bg-white/[0.02] p-3">
            <div className="text-[11px] font-bold tracking-widest text-[#FFD60A] mb-2">BUSINESS INTELLIGENCE · POR QUÉ ENCAJA</div>
            <div className="space-y-2 text-[12px] leading-relaxed">
              <div><span className="text-muted-foreground font-semibold">MEJOR ÁNGULO · </span><span className="text-foreground">Master of Wine al frente de un importador high-end (BE/LUX/FR): el gancho es de candidato a MW a MW, con una selección corta de parcelas, no el porfolio completo.</span></div>
              <div><span className="text-muted-foreground font-semibold">QUÉ VENDEN · </span><span className="text-foreground">Importación y distribución de vino de alta gama para clientes exigentes en Bélgica y Luxemburgo.</span></div>
              <div><span className="text-muted-foreground font-semibold">DOLOR PROBABLE · </span><span className="text-foreground">Diferenciar el libro con productores que no estén ya en todos los catálogos de la competencia.</span></div>
              <div><span className="text-muted-foreground font-semibold">SEÑAL DE COMPRA · </span><span className="text-foreground">Sus últimas incorporaciones son productores pequeños con historia de terroir: el perfil exacto de vuestras 16 bodegas.</span></div>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <Panel className="p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-foreground">
          <span className="font-bold text-[#FFD60A]">$1,750/mes</span> · todo lo de arriba, operado por nosotros, visible aquí.
          <span className="text-muted-foreground"> El cuándo está en el Client Success Roadmap.</span>
        </div>
        <a href="https://www.luxvance.com/book" className="rounded-md bg-[#FFD60A] px-4 py-2 text-sm font-bold text-black hover:opacity-90 transition-opacity">Agendar la segunda llamada</a>
      </Panel>
    </div>
  );
}
