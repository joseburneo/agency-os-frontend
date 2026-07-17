import { notFound } from "next/navigation";
import { BookOpen, ArrowUpRight, Map, Zap, Lock } from "lucide-react";
import { isAgency } from "@/lib/portal/access";
import { ModuleHeader, Panel, Pill, SectionLabel } from "@/components/portal/ui";

// The internal Handbook — agency-only living documentation. The proxy already
// gates every non-/w page to the agency scope; we re-check here as defense in
// depth. Docs render from the gated /api/handbook/<slug> route.
const DOCS: {
  slug: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  tags: string[];
}[] = [
  {
    slug: "system-brief",
    title: "System Brief",
    desc: "How the whole platform works end to end: the architecture, the two repos, the data model, the infrastructure, the integrations, and the access checklist. The onboarding read for any new engineer.",
    icon: Map,
    tags: ["architecture", "onboarding", "data model", "infra"],
  },
  {
    slug: "optimization-roadmap",
    title: "Optimization Roadmap",
    desc: "A ranked, actionable review of where the system can be faster and safer — highest-leverage wins first. From a deep line-by-line review of both repos plus the data model and infra. No deletions, recommendations only.",
    icon: Zap,
    tags: ["performance", "9 high", "11 medium", "review"],
  },
];

export default async function HandbookPage() {
  if (!(await isAgency())) notFound();

  return (
    <div className="max-w-[1000px] mx-auto px-5 md:px-8 py-8 flex flex-col gap-7">
      <ModuleHeader
        icon={BookOpen}
        title="Handbook"
        desc="Internal living documentation for the Luxvance platform. Agency only — clients never see this."
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <Lock className="w-3.5 h-3.5" /> agency only
          </span>
        }
      />

      <div className="flex flex-col gap-4">
        <SectionLabel>Documents</SectionLabel>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DOCS.map((d) => {
            const Icon = d.icon;
            return (
              <a
                key={d.slug}
                href={`/api/handbook/${d.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="group"
              >
                <Panel className="p-5 h-full flex flex-col gap-3 transition-colors hover:border-white/20">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20 shrink-0">
                      <Icon className="w-5 h-5" />
                    </span>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:text-[#FFD60A] transition-colors" />
                  </div>
                  <div className="text-[16px] font-semibold text-foreground">{d.title}</div>
                  <p className="text-[13px] text-muted-foreground leading-relaxed flex-1">{d.desc}</p>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {d.tags.map((t) => (
                      <Pill key={t} tone="muted">{t}</Pill>
                    ))}
                  </div>
                </Panel>
              </a>
            );
          })}
        </div>
      </div>

      <Panel className="p-4 flex items-start gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#26D07C]/10 text-[#26D07C] border border-[#26D07C]/20 shrink-0">
          <Lock className="w-4 h-4" />
        </span>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          These docs open in a new tab and are served only to an authenticated agency session. They are
          never indexed and never reachable by a client or demo login. Share the content by giving someone
          agency access, not by copying a public link.
        </p>
      </Panel>
    </div>
  );
}
