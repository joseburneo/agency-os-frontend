import { notFound } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, ArrowRight, Mail, MessageCircle, Phone, KanbanSquare } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { loadPortal, loadMagnetBrief } from "@/lib/portal/data";
import { MagnetOverview } from "@/components/portal/MagnetOverview";
import { enabledModules } from "@/lib/portal/modules";
import { SectionLabel, StatTile, ModuleHeader, ChannelDots, Panel, Pill, Linkedin } from "@/components/portal/ui";
import type { CrmStage, OutreachChannel } from "@/lib/portal/types";

const STAGE_ORDER: { key: CrmStage; label: string }[] = [
  { key: "neutral", label: "Neutral" },
  { key: "mql", label: "MQL" },
  { key: "sql", label: "SQL" },
  { key: "discovery", label: "Discovery" },
  { key: "proposal_sent", label: "Proposal" },
  { key: "won", label: "Won" },
];

const ACT_ICON: Record<OutreachChannel | "crm", React.ComponentType<{ className?: string }>> = {
  email: Mail, linkedin: Linkedin, whatsapp: MessageCircle, call: Phone, ads: Mail, crm: KanbanSquare,
};

export default async function DashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  // A magnet gets a page, not a dashboard. KPI tiles reading "0 meetings booked"
  // say nothing to someone who has never used the product; what a prospect wants
  // is what we found out about their business and who we decided their buyers
  // are. Built from the research stored when the magnet was made.
  const magnet = await loadMagnetBrief(slug);
  if (magnet) {
    return (
      <MagnetOverview slug={slug} name={magnet.name} owner={magnet.owner} brief={magnet.brief} />
    );
  }

  const live = await loadPortal(slug);
  const ws = live?.ws ?? getWorkspace(slug);
  const data = live?.data ?? getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const stageCounts = STAGE_ORDER.map((s) => ({
    ...s,
    n: data.crm.filter((c) => c.stage === s.key).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

  // Per-list readiness — the cold foundation, the star for a pre-launch client.
  const listStats = data.lists.map((l) => {
    const leads = data.leads.filter((x) => x.listId === l.id);
    const n = leads.length || l.count;
    return {
      ...l,
      n,
      email: leads.filter((x) => x.hasEmail).length,
      li: leads.filter((x) => x.linkedin).length,
      ready: leads.filter((x) => x.hasDraft).length,
    };
  });

  // Channels shown reflect this workspace's enabled modules — never ads/Meta.
  const mods = new Set(enabledModules(slug));
  const channels: OutreachChannel[] = [];
  if (mods.has("email")) channels.push("email");
  if (mods.has("linkedin")) channels.push("linkedin");
  if (mods.has("whatsapp")) channels.push("whatsapp", "call");

  // Each workspace shows what it actually has: cold breakdown, warm funnel, or both.
  const hasWarm = data.crm.length > 0;
  const hasActivity = data.activity.length > 0;

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={LayoutDashboard}
        title="Dashboard"
        desc={`Everything happening in ${ws.name}, at a glance.`}
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" /> live
          </span>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {data.kpis.map((k) => (
          <StatTile key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />
        ))}
      </div>

      {/* Targeted Cold Leads — the cold foundation, per list with readiness. */}
      {listStats.length > 0 && (
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Targeted Cold Leads</SectionLabel>
            <Link href={`/w/${slug}/target-lists`} className="inline-flex items-center gap-1 text-[11px] text-[#FFD60A] hover:gap-2 transition-all">
              Open Targeted Cold Leads <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* TAM · Fit · Filters — slots ready; populated from the sourcing pipeline. */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: "Addressable market", sub: "TAM · from sourcing" },
              { label: "ICP fit", sub: "passed qualification" },
              { label: "Filters applied", sub: "ICP criteria" },
            ].map((m) => (
              <div key={m.label} className="rounded-lg border border-dashed border-border px-3 py-2.5">
                <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{m.label}</div>
                <div className="mt-0.5 text-lg font-bold text-muted-foreground/50 tabular-nums">—</div>
                <div className="text-[10px] text-muted-foreground/70">{m.sub}</div>
              </div>
            ))}
          </div>

          {/* Per-list breakdown with readiness. */}
          <div className="mt-4 flex flex-col divide-y divide-border">
            {listStats.map((l) => {
              const pct = l.n > 0 ? Math.round((l.ready / l.n) * 100) : 0;
              return (
                <div key={l.id} className="py-3 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#FFD60A] shrink-0" />
                      <span className="text-[13px] font-semibold text-foreground truncate">{l.name}</span>
                      <ChannelDots channels={l.channels} size={12} />
                    </div>
                    {l.note && <div className="text-[11px] text-muted-foreground mt-0.5 truncate pl-3.5">{l.note}</div>}
                  </div>
                  <div className="w-44 shrink-0 hidden sm:block">
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                      <span>ready to send</span>
                      <span className="tabular-nums text-foreground">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full bg-[#26D07C]" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                      {l.email.toLocaleString()} email · {l.li.toLocaleString()} LinkedIn
                    </div>
                  </div>
                  <div className="w-16 text-right shrink-0">
                    <div className="text-[15px] font-bold text-foreground tabular-nums">{l.n.toLocaleString()}</div>
                    <div className="text-[10px] text-muted-foreground">leads</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Warm pipeline + activity — only when there's warm data (Luxvance today). */}
      {(hasWarm || hasActivity) && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {hasWarm && (
            <Panel className="lg:col-span-3 p-5">
              <div className="flex items-center justify-between">
                <SectionLabel>Pipeline snapshot</SectionLabel>
                <Link href={`/w/${slug}/crm`} className="inline-flex items-center gap-1 text-[11px] text-[#FFD60A] hover:gap-2 transition-all">
                  Open Live Deals <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="mt-4 flex flex-col gap-2.5">
                {stageCounts.map((s) => (
                  <div key={s.key} className="flex items-center gap-3">
                    <div className="w-20 text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{s.label}</div>
                    <div className="flex-1 h-6 rounded-md bg-white/[0.03] border border-border overflow-hidden">
                      <div
                        className="h-full rounded-md flex items-center px-2 text-[11px] font-bold text-[#0A0E1A]"
                        style={{
                          width: `${Math.max(8, (s.n / maxStage) * 100)}%`,
                          background: s.key === "won" ? "#26D07C" : "linear-gradient(90deg,#FFD60A,rgba(255,214,10,0.35))",
                        }}
                      >
                        {s.n > 0 ? s.n : ""}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
          )}

          {hasActivity && (
            <Panel className={hasWarm ? "lg:col-span-2 p-5" : "lg:col-span-5 p-5"}>
              <SectionLabel>Activity</SectionLabel>
              <div className="mt-4 flex flex-col">
                {data.activity.map((a, i) => {
                  const Icon = ACT_ICON[a.channel];
                  return (
                    <div key={a.id} className={`flex items-start gap-3 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
                      <span className="grid place-items-center w-6 h-6 rounded-md bg-white/5 text-muted-foreground shrink-0 mt-0.5">
                        <Icon className="w-3.5 h-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] text-foreground leading-snug">{a.text}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{a.when}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* Channels running */}
      <Panel className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <SectionLabel>Channels running</SectionLabel>
          <div className="mt-2 flex items-center gap-4">
            <ChannelDots channels={channels} size={18} />
            <span className="text-[12px] text-muted-foreground">The agents work every channel from one shared memory.</span>
          </div>
        </div>
        <Pill tone="green">Autonomous · always on</Pill>
      </Panel>
    </div>
  );
}
