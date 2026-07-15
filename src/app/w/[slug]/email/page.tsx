import { notFound } from "next/navigation";
import { Mail } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { ModuleHeader, Panel, SectionLabel, StatTile, StatusPill, Pill, cn } from "@/components/portal/ui";
import type { EmailCampaign } from "@/lib/portal/types";

function pct(n: number, decimals = 1) {
  return `${n.toFixed(decimals).replace(/\.0$/, "")}%`;
}

function StepDots({ steps }: { steps: number }) {
  return (
    <span className="inline-flex items-center gap-1" title={`${steps}-step sequence`}>
      {Array.from({ length: steps }).map((_, i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-[#FFD60A]/70"
          style={{ opacity: 1 - i * 0.14 }}
        />
      ))}
      <span className="ml-1 text-[11px] text-muted-foreground tabular-nums">{steps}</span>
    </span>
  );
}

export default async function EmailCampaignsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const campaigns: EmailCampaign[] = data.emailCampaigns;

  // Aggregates — sending campaigns only for rate averages (drafts with 0 sent would skew them).
  const totalSent = campaigns.reduce((acc, c) => acc + c.sent, 0);
  const sending = campaigns.filter((c) => c.sent > 0);
  const avgOpen =
    totalSent > 0 ? sending.reduce((acc, c) => acc + c.openRate * c.sent, 0) / totalSent : 0;
  const avgReply =
    totalSent > 0 ? sending.reduce((acc, c) => acc + c.replyRate * c.sent, 0) / totalSent : 0;
  const totalPositive = campaigns.reduce((acc, c) => acc + c.positive, 0);
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  const maxReply = Math.max(0, ...sending.map((c) => c.replyRate));
  const bestId = sending.find((c) => c.replyRate === maxReply && maxReply > 0)?.id;

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Mail}
        title="Email Campaigns"
        desc="Your cold email campaigns — one sequence per target list, sending from warmed burner inboxes."
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" />
            {activeCount} sending
          </span>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatTile label="Total sent" value={totalSent.toLocaleString()} sub="emails, all campaigns" />
        <StatTile label="Avg open rate" value={pct(avgOpen, 0)} sub="weighted by volume" />
        <StatTile label="Avg reply rate" value={pct(avgReply)} sub="weighted by volume" />
        <StatTile label="Positive replies" value={totalPositive.toLocaleString()} sub="handed to the CRM" tone="good" />
        <StatTile label="Active campaigns" value={String(activeCount)} sub={`of ${campaigns.length} total`} />
      </div>

      {/* Campaign table */}
      <Panel className="p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <SectionLabel>Campaigns</SectionLabel>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {campaigns.length} sequences · {totalSent.toLocaleString()} sends
          </span>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground border-b border-border">
                <th className="text-left font-medium py-2 pr-4">Campaign</th>
                <th className="text-left font-medium py-2 pr-4">Status</th>
                <th className="text-left font-medium py-2 pr-4">Steps</th>
                <th className="text-right font-medium py-2 pr-4">Sent</th>
                <th className="text-right font-medium py-2 pr-4">Open %</th>
                <th className="text-right font-medium py-2 pr-4 w-36">Reply %</th>
                <th className="text-right font-medium py-2">Positive</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => {
                const isBest = c.id === bestId;
                const barW = maxReply > 0 ? (c.replyRate / maxReply) * 100 : 0;
                return (
                  <tr
                    key={c.id}
                    className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className={cn("font-medium truncate", isBest ? "text-[#FFD60A]" : "text-foreground")}>
                          {c.name}
                        </span>
                        {isBest && <Pill tone="gold">Top</Pill>}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusPill status={c.status} />
                    </td>
                    <td className="py-3 pr-4">
                      <StepDots steps={c.steps} />
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-foreground">
                      {c.sent > 0 ? c.sent.toLocaleString() : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-foreground">
                      {c.sent > 0 ? pct(c.openRate, 0) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className="relative inline-flex items-center justify-end w-28 h-5">
                        <span
                          className="absolute inset-y-0.5 right-0 rounded-sm"
                          style={{
                            width: `${barW}%`,
                            background: isBest
                              ? "linear-gradient(90deg, rgba(255,214,10,0.04), rgba(255,214,10,0.18))"
                              : "linear-gradient(90deg, rgba(255,255,255,0.01), rgba(255,255,255,0.07))",
                          }}
                        />
                        <span
                          className={cn(
                            "relative tabular-nums pr-1",
                            isBest ? "text-[#FFD60A] font-semibold" : "text-foreground"
                          )}
                        >
                          {c.sent > 0 ? pct(c.replyRate) : <span className="text-muted-foreground">—</span>}
                        </span>
                      </span>
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {c.positive > 0 ? (
                        <span className="text-[#26D07C] font-semibold">{c.positive}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] text-muted-foreground">
            Rates are weighted by send volume. Positive replies flow straight into the Sales CRM.
          </span>
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C]" />
            {totalPositive} positive from {totalSent.toLocaleString()} sends
          </span>
        </div>
      </Panel>
    </div>
  );
}
