import { notFound } from "next/navigation";
import { KanbanSquare, ArrowRight } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import {
  cn,
  SectionLabel,
  Panel,
  StatTile,
  Pill,
  ChannelDots,
  CompanyMark,
  ModuleHeader,
  HeatDot,
} from "@/components/portal/ui";
import type { CrmCard, CrmStage, ReplyCategory } from "@/lib/portal/types";

const STAGES: { key: CrmStage; label: string }[] = [
  { key: "neutral", label: "Neutral" },
  { key: "mql", label: "MQL" },
  { key: "sql", label: "SQL" },
  { key: "discovery", label: "Discovery" },
  { key: "proposal_sent", label: "Proposal" },
  { key: "won", label: "Won" },
  { key: "lost", label: "Lost" },
];

const CATEGORY_TONE: Record<ReplyCategory, "green" | "gold" | "muted" | "red"> = {
  "Positive/SQL": "green",
  MQL: "gold",
  Neutral: "muted",
  Negative: "red",
};

function countPillTone(stage: CrmStage): "green" | "red" | "gold" {
  if (stage === "won") return "green";
  if (stage === "lost") return "red";
  return "gold";
}

function CrmCardView({ card, lost }: { card: CrmCard; lost: boolean }) {
  return (
    <Panel
      className={cn(
        "p-3.5 flex flex-col gap-2.5 transition-colors hover:border-white/20",
        lost && "opacity-60"
      )}
    >
      {/* Company row */}
      <div className="flex items-center gap-2 min-w-0">
        <CompanyMark name={card.company} size={20} />
        <span className="text-[13px] font-bold text-foreground truncate">{card.company}</span>
        <span className="ml-auto shrink-0">
          <HeatDot value={card.heat} />
        </span>
      </div>

      {/* Person */}
      <div className="text-[11px] text-muted-foreground truncate -mt-1">
        {card.person} <span className="opacity-60">· {card.personRole}</span>
      </div>

      {/* Category + country */}
      <div className="flex items-center gap-2">
        <Pill tone={CATEGORY_TONE[card.category]}>{card.category}</Pill>
        {card.buildSent && <Pill tone="green">Build sent</Pill>}
        <span className="ml-auto text-[10px] text-muted-foreground truncate">{card.country}</span>
      </div>

      {/* Reply snippet */}
      <p className="text-[12px] leading-snug text-muted-foreground italic line-clamp-2">
        <span className="opacity-50">&ldquo;</span>
        {card.snippet}
        <span className="opacity-50">&rdquo;</span>
      </p>

      <div className="border-t border-border" />

      {/* Footer */}
      <div className="flex items-center justify-between gap-2">
        <ChannelDots channels={card.channels} size={12} />
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FFD60A] truncate">
          {card.next} <ArrowRight className="w-3 h-3 shrink-0" />
        </span>
      </div>
    </Panel>
  );
}

export default async function CrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const cards = data.crm;
  const byStage = STAGES.map((s) => ({
    ...s,
    cards: cards.filter((c) => c.stage === s.key),
  }));

  const warmTotal = cards.filter((c) => c.stage !== "lost").length;
  const inDiscoveryPlus = cards.filter(
    (c) => c.stage === "discovery" || c.stage === "proposal_sent" || c.stage === "won"
  ).length;
  const won = cards.filter((c) => c.stage === "won").length;
  const buildsSent = cards.filter((c) => c.buildSent).length;

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={KanbanSquare}
        title="Sales CRM"
        desc="Replied prospects, warmed into booked calls. Every reply the agents earn lands here and moves right toward Won."
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" /> live
          </span>
        }
      />

      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Warm prospects" value={String(warmTotal)} sub="replied · in the funnel" />
        <StatTile label="In discovery+" value={String(inDiscoveryPlus)} sub="discovery, proposal, won" tone="warn" />
        <StatTile label="Won" value={String(won)} sub="closed this quarter" tone="good" />
        <StatTile label="Builds sent" value={String(buildsSent)} sub="personalized magnets delivered" />
      </div>

      {/* Kanban board */}
      <div>
        <SectionLabel className="mb-3">Warm funnel</SectionLabel>
        <div className="overflow-x-auto pb-2 -mx-1 px-1">
          <div className="flex gap-4 items-start">
            {byStage.map((s) => (
              <div key={s.key} className="min-w-[280px] w-[280px] shrink-0 flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center justify-between px-1">
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-[0.16em]",
                      s.key === "won"
                        ? "text-[#26D07C]"
                        : s.key === "lost"
                          ? "text-red-400/70"
                          : "text-foreground"
                    )}
                  >
                    {s.label}
                  </span>
                  <Pill tone={countPillTone(s.key)}>{s.cards.length}</Pill>
                </div>

                {/* Column body */}
                <div
                  className={cn(
                    "rounded-xl border border-border bg-white/[0.02] p-2 flex flex-col gap-2 min-h-[120px]",
                    s.key === "won" && "border-[#26D07C]/25 bg-[#26D07C]/[0.04]",
                    s.key === "lost" && "border-red-500/15"
                  )}
                >
                  {s.cards.length === 0 ? (
                    <div className="grid place-items-center py-8 text-[11px] text-muted-foreground/50">
                      — empty —
                    </div>
                  ) : (
                    s.cards.map((c) => <CrmCardView key={c.id} card={c} lost={s.key === "lost"} />)
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
