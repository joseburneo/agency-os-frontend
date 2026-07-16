import { Route, Check } from "lucide-react";
import { ModuleHeader, Panel, Pill, SectionLabel, StatTile, cn } from "@/components/portal/ui";
import type { RoadmapItem, RoadmapStatus, JourneyKind } from "@/lib/portal/types";

// Milestone kind colors — same family as the Library journey.
const KIND_C: Record<JourneyKind, string> = {
  call: "#FFD60A",
  decision: "#26D07C",
  build: "#5AA2FF",
  milestone: "#26D07C",
  launch: "#A98BFF",
};

const STATUS_META: Record<RoadmapStatus, { label: string; tone: "green" | "gold" | "muted" }> = {
  done: { label: "Done", tone: "green" },
  in_progress: { label: "In progress", tone: "gold" },
  planned: { label: "Planned", tone: "muted" },
};

function fmtDate(iso: string): string {
  if (!iso) return "Planned";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return "Planned";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Timeline node marker: solid green check (done), pulsing gold dot (in flight),
// hollow dashed ring (planned). All 16px so the connecting line stays centred.
function Marker({ status }: { status: RoadmapStatus }) {
  if (status === "done") {
    return (
      <span className="absolute left-0 top-1 grid place-items-center w-4 h-4 rounded-full bg-[#26D07C] shadow-[0_0_8px_rgba(38,208,124,0.45)]">
        <Check className="w-2.5 h-2.5 text-[#0A0E1A]" strokeWidth={3.5} />
      </span>
    );
  }
  if (status === "in_progress") {
    return (
      <span className="absolute left-0 top-1 grid place-items-center w-4 h-4">
        <span className="absolute inset-0 rounded-full bg-[#FFD60A]/30 animate-ping" />
        <span className="relative w-2.5 h-2.5 rounded-full bg-[#FFD60A] shadow-[0_0_10px_rgba(255,214,10,0.7)]" />
      </span>
    );
  }
  return (
    <span className="absolute left-0 top-1 grid place-items-center w-4 h-4">
      <span className="w-3 h-3 rounded-full border border-dashed border-white/30" />
    </span>
  );
}

export function RoadmapView({ wsName, items }: { wsName: string; items: RoadmapItem[] }) {
  const done = items.filter((i) => i.status === "done").length;
  const inProgress = items.filter((i) => i.status === "in_progress").length;
  const planned = items.filter((i) => i.status === "planned").length;
  const pct = items.length > 0 ? Math.round((done / items.length) * 100) : 0;
  // First non-done node gets the "Up next" marker — where delivered ends and
  // the forward plan begins, inside the same continuous timeline.
  const upNextIdx = items.findIndex((i) => i.status !== "done");

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Route}
        title="Client Success Roadmap"
        desc={`Everything we've delivered for ${wsName} since day one — and exactly what's coming next.`}
        meta={
          items.length > 0 ? (
            <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground tabular-nums">
              <span className="text-foreground font-semibold">{done}</span> delivered ·{" "}
              <span className="text-foreground font-semibold">{inProgress}</span> in flight ·{" "}
              <span className="text-foreground font-semibold">{planned}</span> planned
            </span>
          ) : undefined
        }
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C] animate-pulse" /> live
          </span>
        }
      />

      {items.length === 0 ? (
        <Panel className="p-8 flex flex-col items-center gap-2 text-center">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20">
            <Route className="w-5 h-5" />
          </span>
          <div className="text-[14px] font-semibold text-foreground mt-1">Nothing here yet</div>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md">
            The roadmap starts the moment we kick off. Milestones will appear here as we deliver.
          </p>
        </Panel>
      ) : (
        <>
          {/* Progress summary */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <StatTile label="Delivered" value={String(done)} tone="good" sub="milestones shipped" />
              <StatTile label="In progress" value={String(inProgress)} tone="warn" sub="in flight now" />
              <StatTile label="Planned" value={String(planned)} sub="coming next" />
            </div>
            <Panel className="p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                  Delivery progress
                </span>
                <span className="text-[11px] tabular-nums font-semibold text-[#26D07C]">{pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#26D07C] shadow-[0_0_8px_rgba(38,208,124,0.5)]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </Panel>
          </div>

          {/* The timeline — delivered flows straight into what's next */}
          <div className="flex flex-col gap-4">
            <SectionLabel>Roadmap</SectionLabel>
            <Panel className="p-5 md:p-6">
              <ol className="relative flex flex-col gap-7">
                {items.map((item, i) => {
                  const s = STATUS_META[item.status];
                  const upcoming = item.status !== "done";
                  return (
                    <li key={item.id} className="relative pl-8">
                      {i < items.length - 1 && (
                        <span
                          className={cn(
                            "absolute left-[7px] top-6 -bottom-7 w-px",
                            item.status === "done" && items[i + 1].status === "done"
                              ? "bg-[#26D07C]/30"
                              : "bg-border"
                          )}
                        />
                      )}
                      <Marker status={item.status} />
                      {i === upNextIdx && (
                        <SectionLabel className="mb-2 text-[#FFD60A]">Up next</SectionLabel>
                      )}
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-[11px] tabular-nums text-muted-foreground">
                          {fmtDate(item.date)}
                        </span>
                        <span
                          className="text-[10px] uppercase tracking-[0.14em] font-semibold"
                          style={{ color: KIND_C[item.kind] }}
                        >
                          {item.kind}
                        </span>
                        <Pill tone={s.tone}>{s.label}</Pill>
                      </div>
                      <div
                        className={cn(
                          "text-[14px] font-semibold mt-1.5 break-words",
                          item.status === "planned"
                            ? "text-foreground/75"
                            : upcoming
                              ? "text-foreground"
                              : "text-foreground/90"
                        )}
                      >
                        {item.title}
                      </div>
                      <p className="text-[13px] text-muted-foreground leading-relaxed mt-1 max-w-3xl break-words">
                        {item.detail}
                      </p>
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2.5">
                          {item.tags.map((t) => (
                            <Pill key={t} tone="muted">{t}</Pill>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
