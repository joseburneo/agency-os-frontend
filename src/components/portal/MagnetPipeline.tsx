"use client";

import { useMemo, useState } from "react";
import {
  ExternalLink, Lock, Mail, MessageCircle, Phone, Search, Sparkles,
} from "lucide-react";
import type { Lead } from "@/lib/portal/types";
import { Linkedin, Panel, SectionLabel, cn } from "./ui";

// The cockpit, as the prospect would work it, with THEIR ten people in it.
//
// It reads magnet_leads, never engaged_prospects. Seeding a prospect's leads into
// our own pipeline table to make this page work would be the same mistake that put
// 1,606 prospect-owned rows inside "our leads", and it would put another tenant's
// contacts in a table every workspace-scoped query has to be trusted with.
//
// Nothing here is invented. Every lead sits at "never contacted" because nothing
// has been sent to them, and the channels and the enrichment are drawn but locked.
// The wall is at the spend and at the send, never at the sight: that is already how
// Prospecting works inside a magnet (search yes, export no) and it is the honest
// version of a demo. A fabricated inbound reply would demo better and would make us
// exactly what we tell prospects we are not.

// The same vocabulary the real cockpit uses, so what the prospect sees in the demo
// is what he would be working in a month later. Cold is where every sourced lead
// starts and where the great majority of them live: it is a stage, not an absence.
const STAGES = [
  { key: "cold", label: "Cold", hint: "Sourced, not contacted yet" },
  { key: "mql", label: "MQL", hint: "Engaged, worth a real look" },
  { key: "sql", label: "SQL", hint: "Asked for something concrete" },
  { key: "discovery", label: "Discovery", hint: "Call booked or held" },
  { key: "proposal", label: "Proposal", hint: "Numbers are out" },
] as const;

// Rows written before the pipeline had this vocabulary carry "new". Same stage.
const stageOf = (l: Lead): string => {
  const s = (l.status || "cold").toLowerCase();
  return s === "new" ? "cold" : s;
};

function LockedAction({
  icon, label, detail,
}: { icon: React.ReactNode; label: string; detail: string }) {
  return (
    <div
      className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2.5 cursor-not-allowed"
      title="Included in the paid plan"
    >
      <span className="text-subtle shrink-0">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[12.5px] text-foreground/70 leading-tight">{label}</span>
        <span className="block text-[11px] text-subtle leading-tight mt-0.5">{detail}</span>
      </span>
      <Lock className="w-3 h-3 text-subtle ml-auto shrink-0" />
    </div>
  );
}

export function MagnetPipeline({ leads, owner }: { leads: Lead[]; owner?: string }) {
  const [stage, setStage] = useState<string>("cold");
  const [openId, setOpenId] = useState<string | null>(leads[0]?.id ?? null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of leads) c[stageOf(l)] = (c[stageOf(l)] ?? 0) + 1;
    return c;
  }, [leads]);

  const shown = leads.filter((l) => stageOf(l) === stage);
  const open = leads.find((l) => l.id === openId) ?? shown[0] ?? null;

  return (
    <div className="pb-10">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Your pipeline</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          The same cockpit our clients work in, loaded with your ten. Every lead starts
          cold and moves right as they answer. Open a card to see everything we found on
          that person and exactly what would go out to them.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* The stages. All ten sit at "never contacted" because that is true. */}
        <nav className="w-full lg:w-52 shrink-0 flex lg:flex-col gap-1.5 overflow-x-auto">
          {STAGES.map((s) => {
            const n = counts[s.key] ?? 0;
            const active = stage === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setStage(s.key)}
                className={cn(
                  "text-left rounded-lg px-3 py-2.5 border transition-colors shrink-0 min-w-[160px] lg:min-w-0",
                  active
                    ? "border-gold/40 bg-gold/[0.07]"
                    : "border-border bg-card/40 hover:bg-card"
                )}
              >
                <span className="flex items-center gap-2">
                  <span className={cn("text-[13px] font-medium",
                    active ? "text-foreground" : "text-muted-foreground")}>
                    {s.label}
                  </span>
                  <span className={cn("ml-auto text-[12px] tabular-nums",
                    n > 0 ? "text-gold-ink" : "text-subtle")}>{n}</span>
                </span>
                <span className="block text-[11px] text-subtle mt-0.5 leading-tight">{s.hint}</span>
              </button>
            );
          })}
        </nav>

        {/* The cards */}
        <div className="w-full lg:w-72 shrink-0 space-y-1.5">
          {shown.length === 0 && (
            <Panel className="text-[13px] text-muted-foreground">
              Nobody at this stage yet. Everyone starts cold and moves right as they answer.
            </Panel>
          )}
          {shown.map((l) => (
            <button
              key={l.id}
              onClick={() => setOpenId(l.id)}
              className={cn(
                "w-full text-left rounded-lg border px-3 py-2.5 transition-colors",
                open?.id === l.id
                  ? "border-gold/40 bg-gold/[0.07]"
                  : "border-border bg-card/40 hover:bg-card"
              )}
            >
              <span className="block text-[13.5px] font-medium text-foreground truncate">{l.name}</span>
              <span className="block text-[12px] text-muted-foreground truncate">{l.role}</span>
              <span className="block text-[12px] text-subtle truncate mt-0.5">{l.company}</span>
            </button>
          ))}
        </div>

        {/* The card */}
        <div className="flex-1 w-full min-w-0 space-y-4">
          {!open ? (
            <Panel className="text-[13px] text-muted-foreground">
              Pick someone on the left to open their card.
            </Panel>
          ) : (
            <>
              <Panel>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[16px] font-semibold text-foreground">{open.name}</div>
                    <div className="text-[13px] text-muted-foreground mt-0.5">
                      {open.role}{open.company ? ` · ${open.company}` : ""}
                    </div>
                    {open.country && (
                      <div className="text-[12px] text-subtle mt-0.5">{open.country}</div>
                    )}
                  </div>
                  <span className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                    {STAGES.find((x) => x.key === stageOf(open))?.label ?? "Cold"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {open.hasEmail && (
                    <a
                      href={`mailto:${open.emailDisplay}`}
                      className="flex items-center gap-2.5 rounded-lg border border-signal/30 bg-signal/[0.06] px-3 py-2.5 hover:bg-signal/10 transition-colors"
                    >
                      <Mail className="w-4 h-4 text-signal-ink shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-[12.5px] text-foreground truncate">{open.emailDisplay}</span>
                        <span className="block text-[11px] text-signal-ink leading-tight">Verified, yours to use</span>
                      </span>
                    </a>
                  )}
                  {open.linkedinUrl && (
                    <a
                      href={open.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2.5 hover:bg-card transition-colors"
                    >
                      <Linkedin width={16} height={16} className="text-muted-foreground shrink-0" />
                      <span className="text-[12.5px] text-foreground">LinkedIn profile</span>
                      <ExternalLink className="w-3 h-3 text-subtle ml-auto shrink-0" />
                    </a>
                  )}
                  {open.linkedinCompany && (
                    <a
                      href={open.linkedinCompany}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 rounded-lg border border-border bg-card/60 px-3 py-2.5 hover:bg-card transition-colors"
                    >
                      <Linkedin width={16} height={16} className="text-muted-foreground shrink-0" />
                      <span className="text-[12.5px] text-foreground">Company page</span>
                      <ExternalLink className="w-3 h-3 text-subtle ml-auto shrink-0" />
                    </a>
                  )}
                </div>

                {/* Drawn, and locked. Showing the machinery is the pitch; running it
                    is what the plan buys. The number is masked rather than absent so
                    it is obvious the lookup is real and simply not switched on. */}
                <div className="mt-4 pt-4 border-t border-border">
                  <SectionLabel>On the paid plan</SectionLabel>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <LockedAction
                      icon={<Sparkles className="w-4 h-4" />}
                      label="Enrich via Clay"
                      detail="Direct mobile, cheapest provider first"
                    />
                    <LockedAction
                      icon={<Phone className="w-4 h-4" />}
                      label={"+•• ••• ••• •••"}
                      detail="Call from the card, recorded and logged"
                    />
                    <LockedAction
                      icon={<MessageCircle className="w-4 h-4" />}
                      label="WhatsApp"
                      detail="Same thread as their email and LinkedIn"
                    />
                    <LockedAction
                      icon={<Search className="w-4 h-4" />}
                      label="Fresh signals monthly"
                      detail="New triggers on this account, every month"
                    />
                  </div>
                </div>
              </Panel>

              {open.whyNow && (
                <section>
                  <SectionLabel>Why we picked them</SectionLabel>
                  <Panel className="mt-2">
                    <p className="text-[13.5px] text-foreground/90 leading-relaxed">
                      {open.whyNowDate && (
                        <span className="mr-2 text-[12px] tabular-nums text-muted-foreground">
                          {open.whyNowDate}
                        </span>
                      )}
                      {open.whyNow}
                    </p>
                    {open.whyNowUrl && (
                      <a
                        href={open.whyNowUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-[11.5px] text-gold-ink hover:underline"
                      >
                        Check the source <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}
                  </Panel>
                </section>
              )}

              {open.emailBody && (
                <section>
                  <SectionLabel>The email we would send</SectionLabel>
                  <Panel className="mt-2">
                    {open.emailSubject && (
                      <div className="text-[13px] font-medium text-foreground pb-2 mb-2 border-b border-border">
                        {open.emailSubject}
                      </div>
                    )}
                    <p className="text-[13.5px] text-foreground/90 leading-relaxed whitespace-pre-line">
                      {open.emailBody}
                    </p>
                  </Panel>
                </section>
              )}

              {open.linkedinNote && (
                <section>
                  <SectionLabel>The LinkedIn message</SectionLabel>
                  <Panel className="mt-2">
                    <p className="text-[13.5px] text-foreground/90 leading-relaxed whitespace-pre-line">
                      {open.linkedinNote}
                    </p>
                  </Panel>
                </section>
              )}
            </>
          )}

          <Panel className="border-gold/25 bg-gold/[0.04]">
            <div className="text-[13.5px] text-foreground font-medium">
              This is ten. The plan is five hundred a month.
            </div>
            <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">
              {owner ? `${owner}, your` : "Your"} team connects their own email, LinkedIn
              and WhatsApp here, works every card from one place, and we bring new lists
              and new signals every month.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
