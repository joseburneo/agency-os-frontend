"use client";

import { useMemo, useState } from "react";
import { Target, Download, Search, ExternalLink, PenLine, Eye } from "lucide-react";
import type { Workspace, WorkspaceData } from "@/lib/portal/types";
import { ModuleHeader, Panel, Pill, CompanyMark, ChannelDots, cn } from "@/components/portal/ui";

export function TargetListsView({ ws, data }: { ws: Workspace; data: WorkspaceData }) {
  const [activeList, setActiveList] = useState(data.lists[0]?.id ?? "");
  const [q, setQ] = useState("");

  const list = data.lists.find((l) => l.id === activeList) ?? data.lists[0];
  const leads = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.leads
      .filter((l) => l.listId === activeList)
      .filter((l) =>
        !term ? true : [l.name, l.company, l.sector, l.role].some((f) => f.toLowerCase().includes(term))
      );
  }, [data.leads, activeList, q]);

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        icon={Target}
        title="Target Lists"
        desc="Your cold leads. Hyper-targeted lists that feed the cold outreach: email, LinkedIn and LinkedIn Ads audiences."
        meta={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ws.accent, boxShadow: `0 0 6px ${ws.accent}` }} />
            {ws.coldLeads.toLocaleString()} cold leads in {ws.name}
          </span>
        }
        actions={
          <button className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground hover:border-white/20 transition-colors">
            <Download className="w-4 h-4" /> Download Excel
          </button>
        }
      />

      {/* List tabs */}
      <div className="flex flex-wrap gap-2">
        {data.lists.map((l) => {
          const active = l.id === activeList;
          return (
            <button
              key={l.id}
              onClick={() => setActiveList(l.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors",
                active
                  ? "border-[#FFD60A]/40 bg-[#FFD60A]/10 text-[#FFD60A]"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-white/20"
              )}
            >
              {l.name}
              <span className={cn("tabular-nums text-[11px] rounded-md px-1.5 py-0.5", active ? "bg-[#FFD60A]/15" : "bg-white/5")}>
                {l.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active list header */}
      {list && (
        <Panel className="p-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{list.name}</div>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">{list.note}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-muted-foreground">Activated on</span>
            <ChannelDots channels={list.channels} size={16} />
          </div>
        </Panel>
      )}

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, sector…"
            className="w-full h-10 rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/40"
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
          {leads.length} of {list?.count.toLocaleString()}
        </span>
      </div>

      {/* Table */}
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-4 py-3">Company</th>
                <th className="text-left font-medium px-4 py-3">Leader</th>
                <th className="text-left font-medium px-4 py-3">Role</th>
                <th className="text-left font-medium px-4 py-3">Sector</th>
                <th className="text-left font-medium px-4 py-3">LinkedIn</th>
                <th className="text-right font-medium px-4 py-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CompanyMark name={l.company} domain={l.domain} />
                      <span className="font-semibold text-foreground">{l.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {l.hasEmail ? l.emailMasked : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.role}</td>
                  <td className="px-4 py-3 text-muted-foreground">{l.sector}</td>
                  <td className="px-4 py-3">
                    {l.linkedin ? (
                      <span className="inline-flex items-center gap-1 text-[13px] text-blue-300">
                        View <ExternalLink className="w-3 h-3" />
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {l.hasDraft ? (
                        <button className="inline-flex items-center gap-1.5 rounded-md border border-[#FFD60A]/25 bg-[#FFD60A]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#FFD60A] hover:bg-[#FFD60A]/15 transition-colors">
                          <PenLine className="w-3.5 h-3.5" /> Draft
                        </button>
                      ) : l.hasEmail ? (
                        <span className="text-[11px] text-muted-foreground">draft pending</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">no email yet</span>
                      )}
                      <button className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:border-white/20 transition-colors">
                        <Eye className="w-3.5 h-3.5" /> Preview
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No leads match your search in this list.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Pill tone="muted">Enriched</Pill>
        Each lead carries role, company, sector, LinkedIn and a verified email, plus a per-contact dossier feeding the first line.
      </div>
    </div>
  );
}
