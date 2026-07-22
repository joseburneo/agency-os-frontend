import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Panel, SectionLabel } from "./ui";

// The page a prospect lands on. It replaces the KPI dashboard for a magnet,
// because tiles reading "0 meetings booked" mean nothing to someone who has
// never used the product, while what they actually want to know is: what did
// you find out about my business, who did you decide my buyers are, and why.
//
// Everything here comes from the research stored when the magnet was built. No
// invented numbers, and any section whose field is missing simply does not
// render, so a thin brief produces a short page rather than empty headings.

type Brief = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : [];

export function MagnetOverview({
  slug, name, owner, brief,
}: { slug: string; name: string; owner: string; brief: Brief }) {
  const pa = (brief.primary_audience ?? {}) as Record<string, unknown>;
  const secondary = Array.isArray(brief.secondary_audiences)
    ? (brief.secondary_audiences as Record<string, unknown>[])
    : [];
  const talking = arr(brief.talking_points);
  const firstName = owner.split(" ")[0] || "";

  const facts: [string, string][] = [
    ["Who", str(pa.label)],
    ["Roles", arr(pa.job_titles).join(" · ")],
    ["Company type", str(pa.company_type)],
    ["Size", str(pa.headcount)],
    ["Where", str(pa.geography)],
    ["How many exist", str(pa.est_volume)],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <header>
        <div className="text-[11px] uppercase tracking-[0.18em] text-[#FFD60A] font-semibold">
          {str(brief.build_name) || "Your list"}
        </div>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
          {firstName ? `${firstName}, here is what we found` : "Here is what we found"}
        </h1>
        {str(brief.personal_note) && (
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground whitespace-pre-line">
            {str(brief.personal_note)}
          </p>
        )}
      </header>

      {str(brief.company_summary) && (
        <section>
          <SectionLabel>What we understood about {name}</SectionLabel>
          <Panel className="mt-2">
            <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line">
              {str(brief.company_summary)}
            </p>
            {str(brief.executive_summary) && (
              <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground whitespace-pre-line">
                {str(brief.executive_summary)}
              </p>
            )}
          </Panel>
        </section>
      )}

      {facts.length > 0 && (
        <section>
          <SectionLabel>Who we think buys from you</SectionLabel>
          <Panel className="mt-2">
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {facts.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">{k}</dt>
                  <dd className="text-[13.5px] text-foreground/90 leading-snug mt-0.5">{v}</dd>
                </div>
              ))}
            </dl>
            {str(pa.why_fit) && (
              <p className="mt-4 pt-4 border-t border-border text-[14px] leading-relaxed text-muted-foreground whitespace-pre-line">
                {str(pa.why_fit)}
              </p>
            )}
          </Panel>
        </section>
      )}

      {str(brief.outreach_angle) && (
        <section>
          <SectionLabel>The angle we would lead with</SectionLabel>
          <Panel className="mt-2">
            <p className="text-[14px] leading-relaxed text-foreground/90 whitespace-pre-line">
              {str(brief.outreach_angle)}
            </p>
            {talking.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {talking.map((t, i) => (
                  <li key={i} className="flex gap-2 text-[13.5px] leading-relaxed text-muted-foreground">
                    <span className="text-[#FFD60A] shrink-0">·</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      )}

      {secondary.length > 0 && (
        <section>
          <SectionLabel>Worth testing next</SectionLabel>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {secondary.map((a, i) => (
              <Panel key={i}>
                <div className="text-[13.5px] font-medium text-foreground">{str(a.label)}</div>
                {str(a.reasoning) && (
                  <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{str(a.reasoning)}</p>
                )}
              </Panel>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Your list</SectionLabel>
        <Link
          href={`/w/${slug}/target-lists`}
          className="mt-2 flex items-center gap-3 rounded-xl border border-[#FFD60A]/30 bg-[#FFD60A]/[0.05] px-4 py-3.5 hover:bg-[#FFD60A]/10 transition-colors"
        >
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-foreground">
              {str(pa.label) || "Your targeted leads"}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">
              Each one with their LinkedIn profile, and the email and LinkedIn message already written.
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#FFD60A] ml-auto shrink-0" />
        </Link>
      </section>

      {/* The ask. It closes the page because everything above earns it: they have
          just read what we found and are about to see the people. */}
      <section>
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[15px] font-semibold text-foreground">Want to optimise this list?</div>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
                Fifteen minutes to refine your ideal customer profile and confirm these are
                the right people. We rebuild it from what you tell us and hand it over with
                the email addresses, ready to send.
              </p>
            </div>
            <a
              href="https://www.luxvance.com/book"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-[#26D07C] px-4 py-2.5 text-[13px] font-semibold text-[#0A0E1A] hover:bg-[#3ad98c] transition-colors"
            >
              Book the 15 minutes <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </Panel>
      </section>
    </div>
  );
}
