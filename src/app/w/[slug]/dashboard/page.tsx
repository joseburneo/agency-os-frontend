import { notFound } from "next/navigation";
import Link from "next/link";
import { LayoutDashboard, ArrowRight, Mail, MessageCircle, Phone, KanbanSquare } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
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
  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const stageCounts = STAGE_ORDER.map((s) => ({
    ...s,
    n: data.crm.filter((c) => c.stage === s.key).length,
  }));
  const maxStage = Math.max(1, ...stageCounts.map((s) => s.n));

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

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Pipeline snapshot */}
        <Panel className="lg:col-span-3 p-5">
          <div className="flex items-center justify-between">
            <SectionLabel>Pipeline snapshot</SectionLabel>
            <Link href={`/w/${slug}/crm`} className="inline-flex items-center gap-1 text-[11px] text-[#FFD60A] hover:gap-2 transition-all">
              Open Sales CRM <ArrowRight className="w-3 h-3" />
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

        {/* Activity */}
        <Panel className="lg:col-span-2 p-5">
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
      </div>

      {/* Channels running */}
      <Panel className="p-5 flex items-center justify-between flex-wrap gap-4">
        <div>
          <SectionLabel>Channels running</SectionLabel>
          <div className="mt-2 flex items-center gap-4">
            <ChannelDots channels={["email", "linkedin", "whatsapp", "call", "ads"]} size={18} />
            <span className="text-[12px] text-muted-foreground">The agents work every channel from one shared memory.</span>
          </div>
        </div>
        <Pill tone="green">Autonomous · always on</Pill>
      </Panel>
    </div>
  );
}
