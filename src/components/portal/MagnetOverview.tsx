import Link from "next/link";
import { ArrowRight, ExternalLink } from "lucide-react";
import { Panel, Pill, SectionLabel, StatTile } from "./ui";
import { CompanyMark } from "./CompanyMark";

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
const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// Evidence gathered from the open web at build time. Each entry carries a live
// source, checked reachable before it was stored. What has a source is printed as
// a fact WITH its link; what does not is never printed as a fact at all, because
// the two replies that killed a magnet were both "you got my market wrong".
type Finding = { claim: string; url: string; date?: string };
const EVIDENCE_LABELS: Record<string, string> = {
  markets: "Where you sell",
  customers: "Who buys from you",
  offer: "What you sell",
  competitors: "Who you compete with",
  outbound: "Your outbound today",
  recent: "What just happened",
};
function findings(brief: Brief): [string, Finding][] {
  const raw = brief.evidence;
  if (!raw || typeof raw !== "object") return [];
  return Object.entries(raw as Record<string, unknown>)
    .map(([k, v]) => {
      const o = (v ?? {}) as Record<string, unknown>;
      return [k, { claim: str(o.claim), url: str(o.url), date: str(o.date) }] as [string, Finding];
    })
    .filter(([, f]) => f.claim && f.url);
}
const arr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : [];

export function MagnetOverview({
  slug, name, owner, brief, domain, leadCount = 0,
}: { slug: string; name: string; owner: string; brief: Brief; domain?: string; leadCount?: number }) {
  const pa = (brief.primary_audience ?? {}) as Record<string, unknown>;
  const secondary = Array.isArray(brief.secondary_audiences)
    ? (brief.secondary_audiences as Record<string, unknown>[])
    : [];
  const talking = arr(brief.talking_points);
  const evidence = findings(brief);
  const market = (brief.market_map ?? null) as Record<string, unknown> | null;
  const peopleMatching = market ? num(market.people_matching) : null;
  // Only the numbers we actually measured. A missing one is left out rather than
  // shown as zero: "0 companies match your market" is a worse lie than silence.
  const marketTiles: { value: string; label: string }[] = [];
  if (market) {
    const add = (v: unknown, label: string, suffix = "") => {
      const n = num(v);
      if (n !== null && n > 0) marketTiles.push({ value: n.toLocaleString() + suffix, label });
    };
    add(market.people_matching, "match your profile", "+");
    add(market.companies_reviewed, "companies reviewed");
    add(market.with_signal, "with a live signal");
    add(market.shipped, "in your list");
  }
  const firstName = owner.split(" ")[0] || "";
  // A magnet can carry a step-by-step plan instead of (or beside) a list brief.
  const steps = Array.isArray(brief.plan_steps)
    ? (brief.plan_steps as Record<string, unknown>[]).filter((s) => str(s.title))
    : [];
  // Optional visual timeline: phases on a vertical rail plus a stat strip. A
  // program with dates reads faster as a picture than as prose, but only some
  // magnets are programs, so both arrays are opt-in fields of the brief.
  const phases = Array.isArray(brief.timeline)
    ? (brief.timeline as Record<string, unknown>[]).filter((p) => str(p.title))
    : [];
  const stats = Array.isArray(brief.timeline_stats)
    ? (brief.timeline_stats as Record<string, unknown>[]).filter((s) => str(s.value))
    : [];

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
        <div className="flex items-center gap-4">
          {/* Their own logo at the top: the first signal this page was made for
              THEM, not a template. Falls back to the monogram when the domain
              has no fetchable logo, so the header never shows a broken image. */}
          <CompanyMark name={name} domain={domain} size={48} />
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-[0.18em] text-gold-ink font-semibold">
              {str(brief.build_name) || "Your list"}
            </div>
            <div className="text-[13px] text-muted-foreground truncate">{name}</div>
          </div>
        </div>
        <h1 className="mt-4 text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
          {str(brief.headline) || (firstName ? `${firstName}, here is what we found` : "Here is what we found")}
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
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-subtle">{k}</dt>
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

      {evidence.length > 0 && (
        <section>
          <SectionLabel>What we verified, and where</SectionLabel>
          <Panel className="mt-2">
            <ul className="space-y-3">
              {evidence.map(([key, f]) => (
                <li key={key} className="text-[13.5px] leading-snug">
                  <span className="text-[10px] uppercase tracking-[0.14em] text-subtle">
                    {EVIDENCE_LABELS[key] ?? key}
                  </span>
                  <p className="mt-0.5 text-foreground/90">{f.claim}</p>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-gold-ink hover:underline"
                  >
                    {f.date ? `${f.date} · source` : "source"}
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </li>
              ))}
            </ul>
            <p className="mt-4 pt-4 border-t border-border text-[12.5px] text-muted-foreground leading-relaxed">
              Everything above has a live source you can open. Anything we could not
              verify is written as an assumption, not stated as fact. If we read your
              market wrong, that is the fastest thing to fix and the first thing we
              would ask you.
            </p>
          </Panel>
        </section>
      )}

      {market && (
        <section>
          <SectionLabel>Your market, and how we narrowed it</SectionLabel>
          <Panel className="mt-2">
            {marketTiles.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {marketTiles.map((t) => (
                  <StatTile key={t.label} value={t.value} label={t.label} />
                ))}
              </div>
            )}
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
              {peopleMatching !== null ? (
                <>
                  About <span className="text-foreground font-medium">
                    {peopleMatching.toLocaleString()}
                  </span>{" "}
                  people match the profile above. We reviewed a sample of them, kept
                  only the companies that fit, then kept only the ones with something
                  real that happened in the last three months. What is in your list is
                  what survived all three.
                </>
              ) : (
                <>
                  We reviewed the market above, kept only the companies that fit, then
                  kept only the ones with something real that happened in the last
                  three months. What is in your list is what survived all three.
                </>
              )}
            </p>
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
                    <span className="text-gold-ink shrink-0">·</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      )}

      {phases.length > 0 && (
        <section>
          <SectionLabel>{str(brief.timeline_label) || "The timeline"}</SectionLabel>
          {stats.length > 0 && (
            <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
              {stats.map((s, i) => (
                <StatTile
                  key={i}
                  label={str(s.label)}
                  value={str(s.value)}
                  sub={str(s.sub) || undefined}
                  tone={s.tone === "good" || s.tone === "warn" ? s.tone : "default"}
                />
              ))}
            </div>
          )}
          <Panel className="mt-2 px-5 py-5">
            {phases.map((p, i) => {
              const color =
                str(p.tone) === "green" ? "#26D07C" : str(p.tone) === "muted" ? "#8A93A6" : "#FFD60A";
              const last = i === phases.length - 1;
              return (
                <div key={i} className="relative flex gap-4 pb-6 last:pb-0">
                  {!last && (
                    <span
                      aria-hidden
                      className="absolute left-[7px] top-[22px] bottom-0 w-px bg-gradient-to-b from-white/20 to-white/5"
                    />
                  )}
                  <span
                    aria-hidden
                    className="relative z-10 mt-1 w-[15px] h-[15px] rounded-full border-2 shrink-0"
                    style={{ borderColor: color, background: "#0A0E1A", boxShadow: `0 0 8px ${color}55` }}
                  >
                    <span className="absolute inset-[2.5px] rounded-full" style={{ background: color }} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase tracking-[0.16em]"
                        style={{ color }}
                      >
                        {str(p.tag)}
                      </span>
                      {str(p.chip) && (
                        <Pill tone={str(p.tone) === "green" ? "green" : "gold"}>{str(p.chip)}</Pill>
                      )}
                    </div>
                    <div className="text-[14px] font-semibold text-foreground mt-0.5">{str(p.title)}</div>
                    {str(p.detail) && (
                      <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground max-w-xl">
                        {str(p.detail)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </Panel>
        </section>
      )}

      {steps.length > 0 && (
        <section>
          <SectionLabel>{str(brief.plan_label) || "The plan, step by step"}</SectionLabel>
          <div className="mt-2 flex flex-col gap-2">
            {steps.map((s, i) => (
              <Panel key={i} className="flex gap-4">
                <span className="shrink-0 text-[15px] font-bold text-gold-ink tabular-nums pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-foreground">{str(s.title)}</div>
                  {str(s.body) && (
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground whitespace-pre-line">
                      {str(s.body)}
                    </p>
                  )}
                </div>
              </Panel>
            ))}
          </div>
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

      {leadCount > 0 && (
      <section>
        <SectionLabel>Your list</SectionLabel>
        <Link
          href={`/w/${slug}/cold`}
          className="mt-2 flex items-center gap-3 rounded-xl border border-gold/30 bg-gold/[0.05] px-4 py-3.5 hover:bg-gold/10 transition-colors"
        >
          <div className="min-w-0">
            <div className="text-[14px] font-medium text-foreground">
              {str(pa.label) || "Your targeted leads"}
            </div>
            <div className="text-[12.5px] text-muted-foreground mt-0.5">
              Each one with their LinkedIn profile, the dated reason we picked them, an
              address where their mail server would confirm one, and the email and LinkedIn
              message already written.
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gold-ink ml-auto shrink-0" />
        </Link>
      </section>
      )}

      {/* The ask. It closes the page because everything above earns it: they have
          just read what we found and are about to see the people. Copy can be
          overridden per magnet (cta_title / cta_body / cta_button) so a plan-style
          magnet can ask for its own next step. */}
      <section>
        <Panel>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[15px] font-semibold text-foreground">
                {str(brief.cta_title) || "Want to optimise this list?"}
              </div>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed max-w-xl">
                {str(brief.cta_body) ||
                  "These ten are yours, addresses included. Fifteen minutes to confirm we read your market right, and to show you what this looks like at five hundred a month: your team working inside this workspace on their own email and LinkedIn, with direct phone numbers, and new lists and new signals from us every month."}
              </p>
            </div>
            <a
              href="https://www.luxvance.com/book"
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 inline-flex items-center justify-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-[13px] font-semibold text-ink-inverse hover:bg-signal-hi transition-colors"
            >
              {str(brief.cta_button) || "Book the 15 minutes"} <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </Panel>
      </section>
    </div>
  );
}
