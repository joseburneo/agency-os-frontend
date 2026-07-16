import Link from "next/link";
import { ArrowRight, Users, Snowflake, Flame, CalendarCheck, TrendingUp } from "lucide-react";
import { WORKSPACES } from "@/lib/portal/mock";
import { loadWorkspaces } from "@/lib/portal/data";
import { SectionLabel, StatTile, Pill, usd } from "@/components/portal/ui";

// AGENCY VIEW — the front door. Jose sees his own workspace + every client
// workspace, with a cross-workspace rollup. Enter one to get the client view.
export default async function AgencyView() {
  const workspaces = (await loadWorkspaces()) ?? WORKSPACES;
  const total = workspaces.reduce(
    (a, w) => ({
      cold: a.cold + w.coldLeads,
      warm: a.warm + w.warmLeads,
      meet: a.meet + w.meetings,
      pipe: a.pipe + w.pipelineUsd,
    }),
    { cold: 0, warm: 0, meet: 0, pipe: 0 }
  );

  return (
    <div className="max-w-[1300px] mx-auto flex flex-col gap-8">
      {/* Header */}
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <SectionLabel>Luxvance // Platform</SectionLabel>
          <h1 className="text-3xl font-extrabold tracking-tight mt-2">
            Agency view<span className="text-[#FFD60A]">.</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Your workspace and every client, one place. Each workspace is its own database.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" />
          All systems live
        </div>
      </div>

      {/* Rollup */}
      <div>
        <SectionLabel className="mb-3">Across all workspaces</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatTile label="Workspaces" value={String(workspaces.length)} sub="active" />
          <StatTile label="Cold leads" value={total.cold.toLocaleString()} sub="in target lists" />
          <StatTile label="Warm pipeline" value={String(total.warm)} sub="replied · working" tone="good" />
          <StatTile label="Meetings" value={String(total.meet)} sub="this quarter" tone="good" />
          <StatTile label="Pipeline" value={usd(total.pipe)} sub="weighted" tone="warn" />
        </div>
      </div>

      {/* Workspaces */}
      <div>
        <SectionLabel className="mb-3">Workspaces</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {workspaces.map((w) => {
            const initials = w.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
            return (
              <Link
                key={w.slug}
                href={`/w/${w.slug}/dashboard`}
                className="group relative rounded-2xl border border-border bg-card p-5 hover:border-white/20 transition-colors overflow-hidden"
              >
                <span
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{ background: `linear-gradient(90deg, ${w.accent}, transparent)` }}
                />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className="grid place-items-center w-11 h-11 rounded-xl text-sm font-bold shrink-0"
                      style={{ background: `${w.accent}1a`, color: w.accent }}
                    >
                      {initials}
                    </span>
                    <div className="min-w-0">
                      <div className="text-lg font-bold text-foreground truncate">{w.name}</div>
                      <div className="text-[12px] text-muted-foreground truncate">
                        {w.owner} · {w.ownerRole}
                      </div>
                    </div>
                  </div>
                  <Pill tone="gold">{w.plan}</Pill>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-5">
                  <MiniStat icon={Snowflake} label="Cold" value={w.coldLeads.toLocaleString()} />
                  <MiniStat icon={Flame} label="Warm" value={String(w.warmLeads)} accent="#26D07C" />
                  <MiniStat icon={CalendarCheck} label="Meetings" value={String(w.meetings)} />
                  <MiniStat icon={TrendingUp} label="Pipeline" value={usd(w.pipelineUsd)} accent="#FFD60A" />
                </div>

                <div className="mt-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <Users className="w-3.5 h-3.5" /> Client view
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#FFD60A] group-hover:gap-2.5 transition-all">
                    Enter workspace <ArrowRight className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniStat({
  icon: Icon,
  label,
  value,
  accent = "#F5F5F0",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Icon className="w-3 h-3" /> {label}
      </div>
      <div className="text-base font-bold tabular-nums mt-1" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
