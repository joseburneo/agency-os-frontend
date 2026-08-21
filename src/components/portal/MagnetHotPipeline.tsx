import { ArrowRight, Snowflake } from "lucide-react";
import Link from "next/link";
import { Panel, SectionLabel } from "./ui";

// The hot pipeline as a prospect sees it before anyone has answered: EMPTY, on
// purpose, and saying so.
//
// An empty tab normally reads as an unfinished product, which is exactly why the
// other empty modules stay out of a magnet. This one earns its place because the
// emptiness is the message. The cold pipeline next door holds all ten and none of
// them has been contacted; this board is where each of them lands the moment they
// answer, and seeing the six columns is how the prospect understands that the
// gift is the front of a system rather than a list (Jose, 2026-08-21).
//
// Nothing here is fabricated. We could have drawn three plausible cards moving
// down the funnel and it would demo better for about a minute, until he asked who
// they were. A board that is honestly empty is worth more than one that lies.

const FUNNEL: { title: string; hint: string; what: string; tone?: "green" }[] = [
  { title: "MQL", hint: "replied, mild interest",
    what: "They wrote back with something other than no. The card turns hot and lands here by itself." },
  { title: "SQL", hint: "asked for something concrete",
    what: "Pricing, a sample, a date. This is the line between a conversation and a deal." },
  { title: "Discovery booked", hint: "call scheduled",
    what: "The invite is out. The card carries the thread, the research and the notes into the call." },
  { title: "Discovery held", hint: "call done",
    what: "The recording and the summary attach themselves to the card, so the follow-up writes from what was actually said." },
  { title: "Proposal sent", hint: "numbers are out",
    what: "The proposal lives in the workspace, not in an attachment, and you can see when it was opened." },
  { title: "Won", hint: "closed", tone: "green",
    what: "They signed. The whole history of how it happened stays on the card." },
];

export function MagnetHotPipeline({ coldHref, count }: { coldHref: string; count: number }) {
  return (
    <div className="pb-10">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Hot pipeline</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Empty, and it should be. Nobody has been written to yet. This is the board
          your team would work in, and a lead appears here the moment it answers,
          carrying everything we already know about them.
        </p>
      </div>

      <Panel className="mb-5 flex flex-wrap items-center gap-3">
        <Snowflake className="w-4 h-4 shrink-0" style={{ color: "var(--info)" }} />
        <span className="text-[13px] text-foreground">
          Your {count} {count === 1 ? "lead is" : "leads are"} waiting in the cold pipeline.
        </span>
        <Link
          href={coldHref}
          className="ml-auto inline-flex items-center gap-1.5 text-[12.5px] text-gold-ink hover:underline"
        >
          Open the cold pipeline <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </Panel>

      <SectionLabel className="mb-2.5">The journey a lead takes</SectionLabel>
      {/* Its own scroller: six columns never fit a laptop, and the page body must
          not be the thing that scrolls sideways. */}
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {FUNNEL.map((s, i) => (
            <div key={s.title} className="w-[230px] shrink-0">
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-[10px] tabular-nums text-subtle">{i + 1}</span>
                <span
                  className={`text-[13px] font-semibold ${
                    s.tone === "green" ? "text-signal-ink" : "text-foreground"
                  }`}
                >
                  {s.title}
                </span>
                <span className="ml-auto text-[12px] tabular-nums text-subtle">0</span>
              </div>
              <div className="text-[11px] uppercase tracking-wider text-subtle mb-2">{s.hint}</div>
              <div
                className={`rounded-lg border border-dashed px-3 py-3 min-h-[104px] ${
                  s.tone === "green" ? "border-signal/30 bg-signal/[0.04]" : "border-border bg-card/30"
                }`}
              >
                <p className="text-[12px] text-muted-foreground leading-relaxed">{s.what}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
