import { notFound } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ArrowRight, Mail, MessageCircle, Phone, KanbanSquare,
  CalendarCheck, Flame, Inbox, Clock,
} from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { loadPortal, loadMagnetBrief } from "@/lib/portal/data";
import { MagnetOverview } from "@/components/portal/MagnetOverview";
import { enabledModules } from "@/lib/portal/modules";
import { SectionLabel, StatTile, ModuleHeader, ChannelDots, Panel, Pill, HeatDot, Linkedin } from "@/components/portal/ui";
import type { CrmStage, OutreachChannel, CrmSummary } from "@/lib/portal/types";

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

const EMPTY_SUMMARY: CrmSummary = {
  total: 0, wantsMeeting: 0, hotNow: 0, waitingUs: 0, waitingThem: 0,
  meetings: 0, withBuild: 0, top: [],
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
      <MagnetOverview slug={slug} name={magnet.name} owner={magnet.owner} brief={magnet.brief} domain={magnet.domain} leadCount={magnet.leadCount} />
    );
  }

  const live = await loadPortal(slug);
  const ws = live?.ws ?? getWorkspace(slug);
  const data = live?.data ?? getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const summary = data.crmSummary ?? EMPTY_SUMMARY;
  const hasWarm = summary.total > 0 || data.crm.length > 0;

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
  const hasCold = listStats.length > 0;

  // Channels shown reflect this workspace's enabled modules — never ads/Meta.
  const mods = new Set(enabledModules(slug));
  const channels: OutreachChannel[] = [];
  if (mods.has("email")) channels.push("email");
  if (mods.has("linkedin")) channels.push("linkedin");
  if (mods.has("whatsapp")) channels.push("whatsapp", "call");

  // The KPI row adapts to what this workspace actually has. A live inbox
  // (Kcal, a win-back) leads with its conversations; a pre-launch cold build
  // (Arco) leads with the list it is about to send. Both beat a row of zeros.
  const warmTiles = [
    { label: "Conversations", value: summary.total, sub: "live in your inbox", tone: "default" as const },
    { label: "Want to meet", value: summary.wantsMeeting, sub: "asked to talk", tone: "good" as const },
    { label: "Hot right now", value: summary.hotNow, sub: "high intent", tone: "warn" as const },
    { label: "Waiting on you", value: summary.waitingUs, sub: "they replied last", tone: "warn" as const },
    { label: "Waiting on them", value: summary.waitingThem, sub: "we replied last", tone: "default" as const },
    { label: "Meetings booked", value: summary.meetings, sub: "this quarter", tone: "good" as const },
  ];

  const top = summary.top.slice(0, 6);

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={LayoutDashboard}
        title="Dashboard"
        desc={`Everything happening in ${ws.name}, at a glance.`}
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-signal shadow-[0_0_6px_var(--glow-signal)]" /> live
          </span>
        }
      />

      {/* HERO — the one line that should make a skeptical MD lean in. Only for a
          workspace with a live inbox; a pre-launch build has nothing warm to say. */}
      {hasWarm && (
        <Panel className="relative overflow-hidden p-6 md:p-7">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.9]"
            style={{ background: "radial-gradient(120% 140% at 0% 0%, rgba(255,214,10,0.10), transparent 55%), radial-gradient(120% 140% at 100% 100%, rgba(38,208,124,0.10), transparent 55%)" }}
          />
          <div className="relative flex flex-col gap-5">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <SectionLabel>Your inbox</SectionLabel>
                <h2 className="mt-2 text-xl md:text-2xl font-extrabold text-foreground leading-tight max-w-xl">
                  {summary.wantsMeeting > 0
                    ? <><span className="text-gold-ink">{summary.wantsMeeting.toLocaleString()}</span> people asked to talk, sitting across <span className="text-gold-ink">{summary.total.toLocaleString()}</span> live conversations.</>
                    : <><span className="text-gold-ink">{summary.total.toLocaleString()}</span> live conversations, every reply captured.</>}
                </h2>
              </div>
              <Link
                href={`/w/${slug}/crm`}
                className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2.5 text-[13px] font-bold text-ink-inverse hover:bg-gold-hi transition-colors shrink-0"
              >
                Open Live Deals <ArrowRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { icon: Inbox, label: "Conversations", value: summary.total, tint: "text-foreground" },
                { icon: CalendarCheck, label: "Want to meet", value: summary.wantsMeeting, tint: "text-signal-ink" },
                { icon: Flame, label: "Hot right now", value: summary.hotNow, tint: "text-gold-ink" },
                { icon: Clock, label: "Waiting on you", value: summary.waitingUs, tint: "text-gold-ink" },
              ].map((m) => (
                <div key={m.label} className="rounded-xl border border-border bg-card/60 px-4 py-3.5">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    <m.icon className="w-3.5 h-3.5" /> {m.label}
                  </div>
                  <div className={`mt-1.5 text-3xl font-extrabold tabular-nums leading-none ${m.tint}`}>
                    {m.value.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Panel>
      )}

      {/* KPI row — warm-led when there's an inbox, else the cold pre-launch set. */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {hasWarm
          ? warmTiles.map((k) => (
              <StatTile key={k.label} label={k.label} value={k.value.toLocaleString()} sub={k.sub} tone={k.tone} />
            ))
          : data.kpis.map((k) => (
              <StatTile key={k.label} label={k.label} value={k.value} sub={k.sub} tone={k.tone} />
            ))}
      </div>

      {/* Warmest leads — the actionable centerpiece: the actual names asking to
          talk, ranked by heat, each a click from the full thread. */}
      {top.length > 0 && (
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Warmest leads right now</SectionLabel>
            <Link href={`/w/${slug}/crm`} className="inline-flex items-center gap-1 text-[11px] text-gold-ink hover:gap-2 transition-all">
              See all in Live Deals <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="mt-3 flex flex-col divide-y divide-border">
            {top.map((t) => (
              <Link
                key={t.id}
                href={`/w/${slug}/crm`}
                className="group py-3 flex items-center gap-3 -mx-2 px-2 rounded-lg hover:bg-white/[0.03] transition-colors"
              >
                <HeatDot value={t.heat} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-foreground truncate">{t.name || "—"}</span>
                    {t.company && <span className="text-[12px] text-muted-foreground truncate">· {t.company}</span>}
                  </div>
                  {t.reason && <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.reason}</div>}
                </div>
                {t.wantsMeeting && <Pill tone="green">wants to meet</Pill>}
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
              </Link>
            ))}
          </div>
        </Panel>
      )}

      {/* Warm pipeline snapshot — the shape of the funnel, once there are replies. */}
      {hasWarm && data.crm.length > 0 && (
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Pipeline snapshot</SectionLabel>
            <Link href={`/w/${slug}/crm`} className="inline-flex items-center gap-1 text-[11px] text-gold-ink hover:gap-2 transition-all">
              Open Live Deals <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="mt-4 flex flex-col gap-2.5">
            {stageCounts.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <div className="w-20 text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{s.label}</div>
                <div className="flex-1 h-6 rounded-md bg-white/[0.03] border border-border overflow-hidden">
                  <div
                    className="h-full rounded-md flex items-center px-2 text-[11px] font-bold text-ink-inverse"
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

      {/* Targeted Cold Leads — the cold foundation, per list with readiness. */}
      {hasCold && (
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Targeted Cold Leads</SectionLabel>
            <Link href={`/w/${slug}/target-lists`} className="inline-flex items-center gap-1 text-[11px] text-gold-ink hover:gap-2 transition-all">
              Open Targeted Cold Leads <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {/* Per-list breakdown with readiness. */}
          <div className="mt-4 flex flex-col divide-y divide-border">
            {listStats.map((l) => {
              const pct = l.n > 0 ? Math.round((l.ready / l.n) * 100) : 0;
              return (
                <div key={l.id} className="py-3 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold shrink-0" />
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
                      <div className="h-full rounded-full bg-signal" style={{ width: `${pct}%` }} />
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
