import { notFound } from "next/navigation";
import { Library, FileText, BookOpen, Search, Package, Layers } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { ModuleHeader, Panel, Pill, SectionLabel } from "@/components/portal/ui";
import type { LibraryKind } from "@/lib/portal/types";

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
  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const items = data.library;
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
