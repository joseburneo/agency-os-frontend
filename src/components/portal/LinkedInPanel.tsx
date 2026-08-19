"use client";

import { useEffect, useState } from "react";
import { Panel, SectionLabel } from "@/components/portal/ui";

/**
 * The week's LinkedIn budget, on the dashboard.
 *
 * Two honesty rules govern everything shown here, and both are deliberate.
 *
 * The invitation cap is OURS. LinkedIn publishes no remaining-invitations figure — any
 * product showing one is subtracting from a limit it picked. Ours is 100 a week per
 * profile, half of LinkedIn's real ceiling, and the panel says so out loud rather than
 * implying LinkedIn handed us the number.
 *
 * And "sent this week" is an estimate, not a count. An accepted invitation disappears
 * from LinkedIn's pending list, so the week is pending-this-week plus
 * connections-made-this-week. Close, never exact, and labelled.
 *
 * The row that earns its place is the last one: prospects already connected. That is
 * reach costing nothing — no invitation, no quota, no risk — and it stays invisible
 * unless something puts it on screen.
 */
type Status = {
  ok: boolean;
  healthy?: boolean;
  states?: Record<string, number>;
  quota?: {
    sent_this_week: number; cap: number; remaining: number;
    pending_total: number; pending_stale: number; stale_after_days: number;
    received_pending: number; connections: number; messages_this_week?: number;
  };
};

export function LinkedInPanel({ workspace }: { workspace: string }) {
  const [s, setS] = useState<Status | null>(null);
  useEffect(() => {
    fetch(`/api/crm/linkedin/status?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setS)
      .catch(() => setS(null));
  }, [workspace]);

  if (!s?.ok || !s.quota) return null;
  const q = s.quota;
  const st = s.states ?? {};
  const pct = Math.min(100, Math.round((q.sent_this_week / Math.max(1, q.cap)) * 100));
  const tight = q.remaining <= 10;

  return (
    <section className="flex flex-col gap-3">
      <SectionLabel>LinkedIn this week</SectionLabel>
      <Panel>
        <div className="p-4 flex flex-col gap-4">
          {!s.healthy && (
            <div className="text-[11px] text-gold-ink">
              The connected LinkedIn session needs reconnecting — nothing can send until it is.
            </div>
          )}

          {/* the budget */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[12px] text-muted-foreground">Invitations sent</span>
              <span className={`text-[13px] font-semibold tabular-nums ${tight ? "text-gold-ink" : "text-foreground"}`}>
                {q.sent_this_week} <span className="text-subtle font-normal">of {q.cap}</span>
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className={`h-full rounded-full ${tight ? "bg-gold" : "bg-signal"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className="text-[10.5px] text-subtle">
              {q.remaining} left. This limit is ours, set at half of LinkedIn&apos;s real ceiling —
              LinkedIn does not publish a remaining figure. The count is an estimate: an accepted
              invitation leaves their pending list.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat label="Messages sent" value={q.messages_this_week ?? 0} sub="this week" />
            <Stat label="Invitations pending" value={q.pending_total} sub="awaiting an answer" />
            <Stat label="Older than 30 days" value={q.pending_stale} sub="worth withdrawing" tone={q.pending_stale > 0 ? "warn" : undefined} />
            <Stat label="Waiting on you" value={q.received_pending} sub="they invited you" />
          </div>

          {/* the row that changes what you do today */}
          <div className="rounded-lg border border-signal/25 bg-signal/[0.05] px-3 py-2.5">
            <div className="text-[13px] text-foreground">
              <span className="font-semibold text-signal-ink tabular-nums">{st.connected ?? 0}</span> prospects are
              already connections — you can message them today, with no invitation and no quota spent.
            </div>
            <div className="mt-1 text-[10.5px] text-subtle tabular-nums">
              {st.invited ?? 0} invited and waiting · {st.not_connected ?? 0} not connected yet · {q.connections} connections in total
            </div>
          </div>

          {q.pending_stale > 0 && (
            <p className="text-[10.5px] text-muted-foreground">
              {q.pending_stale} invitations have gone unanswered for over {q.stale_after_days} days. A pile of
              ignored invitations drags the acceptance rate LinkedIn watches when it decides whether to
              restrict an account, so withdrawing them protects the profile.
            </p>
          )}
        </div>
      </Panel>
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: number; sub: string; tone?: "warn" }) {
  return (
    <div className="rounded-lg border border-border bg-secondary/25 px-2.5 py-2">
      <div className={`text-[16px] font-semibold tabular-nums ${tone === "warn" ? "text-gold-ink" : "text-foreground"}`}>{value}</div>
      <div className="text-[10.5px] text-muted-foreground leading-tight">{label}</div>
      <div className="text-[9.5px] text-subtle leading-tight">{sub}</div>
    </div>
  );
}
