import { notFound } from "next/navigation";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { assertModuleVisible } from "@/lib/portal/access";
import { loadPortal } from "@/lib/portal/data";
import { SectionLabel, StatTile, ModuleHeader, Panel, StatusPill, CHANNEL_META } from "@/components/portal/ui";
import type { LinkedInCampaign } from "@/lib/portal/types";

const LinkedinIcon = CHANNEL_META.linkedin.icon;
const LI_COLOR = CHANNEL_META.linkedin.color; // #60A5FA

export default async function LinkedInPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "linkedin");
  const live = await loadPortal(slug);
  const ws = live?.ws ?? getWorkspace(slug);
  const data = live?.data ?? getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const campaigns: LinkedInCampaign[] = data.linkedinCampaigns;

  const invitesTotal = campaigns.reduce((s, c) => s + c.invitesSent, 0);
  const repliesTotal = campaigns.reduce((s, c) => s + c.replied, 0);
  const messagesTotal = campaigns.reduce((s, c) => s + c.messagesSent, 0);
  // Acceptance weighted by invites sent — a plain mean would overweight tiny campaigns.
  const avgAccepted =
    invitesTotal > 0
      ? campaigns.reduce((s, c) => s + c.accepted * c.invitesSent, 0) / invitesTotal
      : 0;
  const activeCount = campaigns.filter((c) => c.status === "active").length;

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={LinkedinIcon}
        title="LinkedIn Campaigns"
        desc="Connection + follow-up campaigns that run in parallel with email, from the same target lists."
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: LI_COLOR, boxShadow: `0 0 6px ${LI_COLOR}` }} />
            {activeCount} active
          </span>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Invites sent" value={invitesTotal.toLocaleString("en-US")} sub={`across ${campaigns.length} campaigns`} />
        <StatTile label="Avg acceptance" value={`${avgAccepted.toFixed(0)}%`} sub="weighted by invites" />
        <StatTile label="Replies" value={repliesTotal.toLocaleString("en-US")} sub="from accepted connections" tone="good" />
        <StatTile label="Messages sent" value={messagesTotal.toLocaleString("en-US")} sub="follow-up touches" />
      </div>

      <Panel className="p-5">
        <SectionLabel>Campaigns</SectionLabel>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground border-b border-border">
                <th className="py-2.5 pr-4 font-medium">Campaign</th>
                <th className="py-2.5 pr-4 font-medium">Status</th>
                <th className="py-2.5 pr-4 font-medium text-right">Invites</th>
                <th className="py-2.5 pr-4 font-medium w-[26%]">Accepted %</th>
                <th className="py-2.5 pr-4 font-medium text-right">Replied</th>
                <th className="py-2.5 font-medium text-right">Messages</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-b-0 hover:bg-white/[0.03] transition-colors">
                  <td className="py-3 pr-4">
                    <span className="inline-flex items-center gap-2.5 min-w-0">
                      <LinkedinIcon className="w-3.5 h-3.5 shrink-0" style={{ color: LI_COLOR }} />
                      <span className="text-[13px] font-medium text-foreground truncate">{c.name}</span>
                    </span>
                  </td>
                  <td className="py-3 pr-4">
                    <StatusPill status={c.status} />
                  </td>
                  <td className="py-3 pr-4 text-right text-[13px] tabular-nums text-foreground">
                    {c.invitesSent.toLocaleString("en-US")}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(0, c.accepted))}%`,
                            background: "linear-gradient(90deg,#FFD60A,rgba(255,214,10,0.35))",
                          }}
                        />
                      </div>
                      <span className="text-[12px] tabular-nums text-foreground w-9 text-right shrink-0">{c.accepted}%</span>
                    </div>
                  </td>
                  <td className="py-3 pr-4 text-right text-[13px] tabular-nums text-[#26D07C]">
                    {c.replied.toLocaleString("en-US")}
                  </td>
                  <td className="py-3 text-right text-[13px] tabular-nums text-foreground">
                    {c.messagesSent.toLocaleString("en-US")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
