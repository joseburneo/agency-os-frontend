import {
  Library,
  Building2,
  User,
  MessageSquareQuote,
  Target,
  Package,
  Sparkles,
  Layers,
  Users,
  ShieldQuestion,
  Quote,
  Link as LinkIcon,
  Phone,
  Search,
} from "lucide-react";
import type { IntelligenceSection, IntelligenceKind } from "@/lib/portal/types";
import { ModuleHeader, Panel, Pill, SectionLabel, StatTile } from "@/components/portal/ui";

// Group order + labels + icons — the reading order the agents (and the client)
// see: identity first, then who they sell to, then the evidence and raw notes.
const GROUPS: {
  kind: IntelligenceKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: "overview", label: "Overview", icon: Building2 },
  { kind: "founder", label: "Founder", icon: User },
  { kind: "voice", label: "Voice & tone", icon: MessageSquareQuote },
  { kind: "icp", label: "Ideal customer", icon: Target },
  { kind: "offer", label: "What they sell", icon: Package },
  { kind: "differentiator", label: "Why they win", icon: Sparkles },
  { kind: "segment", label: "Segments", icon: Layers },
  { kind: "persona", label: "Personas", icon: Users },
  { kind: "objection", label: "Objections", icon: ShieldQuestion },
  { kind: "proof", label: "Proof & recommendations", icon: Quote },
  { kind: "asset", label: "Assets & links", icon: LinkIcon },
  { kind: "call_note", label: "Call notes", icon: Phone },
  { kind: "research", label: "Research", icon: Search },
];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const URL_RE = /^https?:\/\//i;

// meta = { author, role, date, source, url… } → small muted pills; urls become links.
function MetaPills({ meta }: { meta: Record<string, string> }) {
  const entries = Object.entries(meta).filter(([, v]) => v);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) =>
        URL_RE.test(v) ? (
          <a
            key={k}
            href={v}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#FFD60A]/25 bg-[#FFD60A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FFD60A] hover:bg-[#FFD60A]/20 transition-colors"
          >
            <LinkIcon className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate normal-case tracking-normal">{v.replace(URL_RE, "")}</span>
          </a>
        ) : (
          <Pill key={k} tone="muted" className="max-w-full">
            <span className="opacity-60">{k}:</span>
            <span className="truncate normal-case tracking-normal">{v}</span>
          </Pill>
        )
      )}
    </div>
  );
}

export function IntelligenceView({
  wsName,
  sections,
}: {
  wsName: string;
  sections: IntelligenceSection[];
}) {
  const groups = GROUPS.map((g) => ({
    ...g,
    items: sections
      .filter((s) => s.kind === g.kind)
      .sort((a, b) => a.sort - b.sort),
  })).filter((g) => g.items.length > 0);

  // Most recent updatedAt across all sections — the freshness of the brain.
  const lastUpdated = sections.reduce<string>((acc, s) => {
    const t = new Date(s.updatedAt).getTime();
    if (isNaN(t)) return acc;
    return !acc || t > new Date(acc).getTime() ? s.updatedAt : acc;
  }, "");

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Library}
        title="Intelligence Library"
        desc={`The living brain behind ${wsName}. Everything we know about them — who they are, how they sell, how they sound. Every agent loads this before it writes a single word.`}
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" /> agents reading
          </span>
        }
      />

      {/* One brain, two readers — the client and the agents see the same thing. */}
      <Panel className="p-4 border-[#26D07C]/25 flex items-start sm:items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#26D07C]/10 text-[#26D07C] border border-[#26D07C]/20 shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          This is the <span className="text-[#26D07C] font-semibold">exact context</span> the reply and
          outreach agents read before generating a single line. What you see here is what they know —
          always in sync.
        </p>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Sections" value={String(sections.length)} sub="knowledge entries" />
        <StatTile label="Areas covered" value={String(groups.length)} sub={`of ${GROUPS.length} knowledge areas`} />
        <StatTile label="Last updated" value={fmtDate(lastUpdated)} sub="most recent section" tone="good" />
      </div>

      {sections.length === 0 ? (
        <Panel className="p-8 flex flex-col items-center gap-3 text-center">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20">
            <Library className="w-5 h-5" />
          </span>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md">
            This library is being assembled from the onboarding call, the website and our research.
            It&apos;ll appear here — and power every reply — as soon as it&apos;s published.
          </p>
        </Panel>
      ) : (
        groups.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.kind} className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <SectionLabel>{g.label}</SectionLabel>
                <Icon className="w-3.5 h-3.5 text-[#FFD60A]" />
                <span className="text-[11px] text-muted-foreground tabular-nums">{g.items.length}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.items.map((s) => (
                  <Panel key={s.id} className="p-5 flex flex-col gap-3 transition-colors hover:border-white/20">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-[15px] font-semibold text-[#FFD60A] leading-snug break-words min-w-0">
                        {s.title}
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                        {fmtDate(s.updatedAt)}
                      </span>
                    </div>
                    <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {s.body}
                    </p>
                    {s.meta && Object.keys(s.meta).length > 0 && (
                      <div className="mt-auto pt-3 border-t border-border">
                        <MetaPills meta={s.meta} />
                      </div>
                    )}
                  </Panel>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
