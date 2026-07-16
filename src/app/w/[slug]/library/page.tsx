import { notFound } from "next/navigation";
import { Library, FileText, BookOpen, Search, Package, Layers } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { isModuleEnabled } from "@/lib/portal/modules";
import { loadPortal } from "@/lib/portal/data";
import { ModuleHeader, Panel, Pill, SectionLabel } from "@/components/portal/ui";
import type { LibraryKind, JourneyKind } from "@/lib/portal/types";

// Journey timeline colors, by milestone kind.
const KIND_C: Record<JourneyKind, string> = {
  call: "#FFD60A",
  decision: "#26D07C",
  build: "#5AA2FF",
  milestone: "#26D07C",
  launch: "#A98BFF",
};

function fmtDate(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const KIND_META: Record<
  LibraryKind,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    tone: "gold" | "green" | "blue" | "muted";
  }
> = {
  dossier: { icon: FileText, label: "Dossier", tone: "gold" },
  playbook: { icon: BookOpen, label: "Playbook", tone: "green" },
  research: { icon: Search, label: "Research", tone: "blue" },
  asset: { icon: Package, label: "Asset", tone: "muted" },
};

export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isModuleEnabled(slug, "library")) notFound();
  const live = await loadPortal(slug);
  const ws = live?.ws ?? getWorkspace(slug);
  const data = live?.data ?? getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const items = data.library;
  const journey = data.journey;
  const totalSources = items.reduce((sum, it) => sum + it.sources, 0);

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Library}
        title="Intelligence Library"
        desc="The workspace brain — the enriched dossiers, playbooks and research the agents write from. This is what makes the outreach feel one-to-one."
        meta={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
            <span className="text-foreground font-semibold">{items.length}</span> items ·{" "}
            <span className="text-foreground font-semibold">{totalSources}</span> research sources
          </span>
        }
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" /> agents reading
          </span>
        }
      />

      {/* How the brain is fed */}
      <Panel className="p-4 flex items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#26D07C]/10 text-[#26D07C] border border-[#26D07C]/20 shrink-0">
          <Layers className="w-4 h-4" />
        </span>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          Both lead populations feed this brain: the <span className="text-foreground font-semibold">cold</span>{" "}
          target lists sharpen the ICP research, and every{" "}
          <span className="text-foreground font-semibold">warm</span> reply in the CRM teaches the playbooks
          what actually lands.
        </p>
      </Panel>

      {/* Journey — the relationship timeline */}
      {journey.length > 0 && (
        <div className="flex flex-col gap-4">
          <SectionLabel>Journey</SectionLabel>
          <Panel className="p-5 md:p-6">
            <ol className="relative flex flex-col gap-6">
              {journey.map((j, i) => (
                <li key={j.id} className="relative pl-8">
                  {i < journey.length - 1 && (
                    <span className="absolute left-[6px] top-5 -bottom-6 w-px bg-border" />
                  )}
                  <span
                    className="absolute left-0 top-1.5 w-3.5 h-3.5 rounded-full border-2"
                    style={{
                      borderColor: KIND_C[j.kind],
                      background: "var(--background)",
                      boxShadow: `0 0 8px ${KIND_C[j.kind]}55`,
                    }}
                  />
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[11px] tabular-nums text-muted-foreground">{fmtDate(j.date)}</span>
                    <span className="text-[10px] uppercase tracking-[0.14em] font-semibold" style={{ color: KIND_C[j.kind] }}>
                      {j.kind}
                    </span>
                  </div>
                  <div className="text-[14px] font-semibold text-foreground mt-1">{j.title}</div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed mt-1 max-w-3xl">{j.detail}</p>
                  {j.tags && j.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      {j.tags.map((t) => (
                        <Pill key={t} tone="muted">{t}</Pill>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <SectionLabel>Library</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {items.map((item) => {
            const meta = KIND_META[item.kind];
            const Icon = meta.icon;
            return (
              <Panel
                key={item.id}
                className="p-5 flex flex-col gap-3 transition-colors hover:border-white/20"
              >
                <div className="flex items-center justify-between gap-3">
                  <Pill tone={meta.tone}>
                    <Icon className="w-3 h-3" />
                    {meta.label}
                  </Pill>
                </div>
                <div className="text-[15px] font-semibold text-foreground leading-snug">{item.title}</div>
                <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-3">{item.summary}</p>
                <div className="mt-auto pt-3 border-t border-border flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-foreground tabular-nums">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#FFD60A] shadow-[0_0_6px_rgba(255,214,10,0.6)]" />
                    {item.sources} source{item.sources === 1 ? "" : "s"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">updated {item.updated}</span>
                </div>
              </Panel>
            );
          })}
        </div>
      </div>
    </div>
  );
}
