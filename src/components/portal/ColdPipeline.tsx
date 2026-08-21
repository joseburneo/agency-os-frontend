"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clock, Search, UserPlus } from "lucide-react";
import type { Lead, TargetList } from "@/lib/portal/types";
import { Panel, cn } from "./ui";
import { CompanyMark } from "./CompanyMark";
import { ProspectCard } from "@/components/crm/CrmBoard";

/**
 * The Cold Pipeline for a CLIENT workspace — the lists, worked one person at a time.
 *
 * This replaces the Coming Soon that stood here, and it exists because of what Paul
 * Herrick did on 2026-08-21: he worked a 596-row list from the top down sending
 * LinkedIn invitations, came back, and could not tell where he had stopped. Nothing on
 * screen distinguished the 99 people who had already accepted from the 250 whose
 * invitation was still pending from the 486 nobody had touched — every row simply said
 * "Connect". So the list could be READ but not WORKED, and about a hundred accepted
 * connections sat untouched for weeks.
 *
 * Everything here answers that. The state is the first sort key, the filter chips are
 * the three states, and the strip at the top says how many of each there are and what
 * has gone out this week. A list you can only read is a document; a list you can filter
 * by what is left to do is a tool.
 *
 * WHY NOT MagnetPipeline. Same three-column shape and the same visual language on
 * purpose, so the two can be merged later without a redesign — but not the same
 * component today. That one is what a PROSPECT sees in a magnet: its card body is a
 * pitch (locked actions, "the email we WOULD send", "this is ten, the plan is five
 * hundred"). A client is not being sold to; he is working. Bending the demo that sells
 * into the page that works, under time pressure, breaks the one to serve the other.
 */

type LiState = "connected" | "invited" | "not_connected" | "none";

const liStateOf = (l: Lead): LiState => l.liState ?? "none";

/** Connected first: those can be messaged today with no invitation and no quota spent,
 *  and they were the ones going unused. Then pending (nothing to do but wait), then the
 *  work queue, then rows with no profile at all. */
const LI_RANK: Record<LiState, number> = {
  connected: 0, invited: 1, not_connected: 2, none: 3,
};

const FILTERS = [
  { key: "all", label: "Everyone" },
  { key: "connected", label: "Connected" },
  { key: "invited", label: "Invite pending" },
  { key: "not_connected", label: "To invite" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const SORTS = [
  { key: "state", label: "By LinkedIn status" },
  { key: "company", label: "Company A–Z" },
  { key: "name", label: "Name A–Z" },
] as const;

type SortKey = (typeof SORTS)[number]["key"];

/** "4 Aug" — how long an invitation has been waiting. */
function shortDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** The small coloured word beside a person. Three states, three answers to "and now
 *  what?" — write to them, wait, or invite them. */
function StatePill({ lead, className }: { lead: Lead; className?: string }) {
  const s = liStateOf(lead);
  if (s === "none") {
    return <span className={cn("text-[11px] text-subtle", className)}>No profile</span>;
  }
  const map = {
    connected: { text: "Connected", tone: "text-signal-ink border-signal/30 bg-signal/[0.07]" },
    invited: { text: `Invited${shortDate(lead.liInvitedAt) ? ` ${shortDate(lead.liInvitedAt)}` : ""}`, tone: "text-muted-foreground border-border bg-card/60" },
    not_connected: { text: "To invite", tone: "text-info border-info/30 bg-info/[0.06]" },
  } as const;
  const m = map[s];
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] whitespace-nowrap",
      m.tone, className
    )}>
      {m.text}
    </span>
  );
}

/** One number and what it means. Deliberately flat rather than a card each: five boxes
 *  with shadows read as a dashboard, and this is a toolbar. */
function Stat({
  icon, value, label, hint, tone,
}: {
  icon?: React.ReactNode; value: React.ReactNode; label: string;
  hint?: string; tone?: string;
}) {
  return (
    <div className="flex-1 min-w-[128px] px-3.5 py-3" title={hint}>
      <div className="flex items-center gap-1.5">
        {icon && <span className={cn("shrink-0", tone ?? "text-subtle")}>{icon}</span>}
        <span className={cn("text-[19px] font-semibold tabular-nums leading-none", tone ?? "text-foreground")}>
          {value}
        </span>
      </div>
      <div className="text-[11.5px] text-muted-foreground mt-1.5 leading-tight">{label}</div>
    </div>
  );
}

type Status = {
  ok: boolean;
  healthy?: boolean;
  quota?: {
    sent_this_week: number; cap: number; remaining: number;
    pending_total: number; pending_stale: number; stale_after_days: number;
    connections: number; messages_this_week?: number;
  };
};

export function ColdPipeline({
  lists, leads, workspace, owner,
}: {
  lists: TargetList[];
  leads: Lead[];
  workspace: string;
  owner?: string;
}) {
  const [listId, setListId] = useState<string>(lists[0]?.id ?? "");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("state");   // falls back to company below
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [opening, setOpening] = useState(false);
  const [openErr, setOpenErr] = useState("");
  // lead id -> prospect id, or null when this person cannot become one. Cached so
  // walking the list does not re-promote anybody.
  const [pid, setPid] = useState<Record<string, number | null>>({});

  // The week's sending, which only LinkedIn and our own message store know. Everything
  // else on this page is already in the leads we were handed, so this is the one call.
  useEffect(() => {
    fetch(`/api/crm/linkedin/status?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [workspace]);

  const ofList = useMemo(
    () => leads.filter((l) => l.listId === listId),
    [leads, listId]
  );

  // Counted on the whole list, never on the filtered view: a count that moves when you
  // filter is a count of the filter, and the point of these is to say how much work is
  // left while you are looking at part of it.
  const counts = useMemo(() => {
    const c = { connected: 0, invited: 0, not_connected: 0, none: 0 };
    for (const l of ofList) c[liStateOf(l)] += 1;
    return c;
  }, [ofList]);

  // A workspace with no LinkedIn account connected has no state on any lead, and three
  // zeroes beside "Connected" would read as a broken page rather than as a channel
  // nobody has switched on. Kcal and Connect Resources are exactly that today.
  const hasLi = useMemo(() => leads.some((l) => l.liState), [leads]);

  const perList = useMemo(() => {
    const m: Record<string, { connected: number; invited: number; total: number }> = {};
    for (const l of leads) {
      const e = (m[l.listId] ??= { connected: 0, invited: 0, total: 0 });
      e.total += 1;
      const s = liStateOf(l);
      if (s === "connected") e.connected += 1;
      if (s === "invited") e.invited += 1;
    }
    return m;
  }, [leads]);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const rows = ofList
      .filter((l) => (filter === "all" ? true : liStateOf(l) === filter))
      .filter((l) =>
        !term ? true
          : [l.name, l.company, l.role, l.sector].some((f) => (f ?? "").toLowerCase().includes(term))
      );
    // Every sort ends on the id. Without a final deterministic key, equal rows keep
    // whatever order the data arrived in — which is exactly how this list reshuffled
    // itself under Paul while he was working down it.
    return rows.sort((a, b) => {
      if (sort === "company") return a.company.localeCompare(b.company) || a.id.localeCompare(b.id);
      if (sort === "name") return a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
      return LI_RANK[liStateOf(a)] - LI_RANK[liStateOf(b)]
        || a.company.localeCompare(b.company)
        || a.id.localeCompare(b.id);
    });
  }, [ofList, filter, q, sort]);

  const open = shown.find((l) => l.id === openId) ?? shown[0] ?? null;
  const list = lists.find((l) => l.id === listId);
  const qt = status?.quota;

  // Picking somebody opens their card right here, rather than sending them to another
  // page and back. Promotion is what makes that possible — a target_list_lead is a row
  // in a list, an engaged_prospect is somebody being worked, and the card hangs off the
  // second — and it is safe to do on selection now that the sidebar counts hot by
  // category rather than by "a row exists" (migration 040). Before that, browsing your
  // own list pushed the Hot Pipeline badge up by one per click.
  //
  // The endpoint is idempotent, so coming back to somebody costs a lookup and creates
  // nothing. Results are cached per lead so walking up and down the list is instant
  // after the first pass.
  useEffect(() => {
    const lead = open;
    if (!lead || pid[lead.id] !== undefined) return;
    let live = true;
    setOpening(true);
    setOpenErr("");
    fetch(`/api/crm/lead/${encodeURIComponent(lead.id)}/work`, { method: "POST" })
      .then(async (r) => {
        const j = await r.json().catch(() => null);
        if (!live) return;
        if (!r.ok || !j?.prospect_id) {
          // Since migration 039 an address is no longer required — LinkedIn is a
          // channel, not a consolation. What is still refused is somebody with neither
          // an address nor a profile, and the backend says so in those words.
          setPid((m) => ({ ...m, [lead.id]: null }));
          setOpenErr(j?.detail || j?.error || "This person cannot be opened as a card yet.");
          return;
        }
        setPid((m) => ({ ...m, [lead.id]: j.prospect_id as number }));
      })
      .catch(() => { if (live) setOpenErr("Could not open this card."); })
      .finally(() => { if (live) setOpening(false); });
    return () => { live = false; };
  }, [open, pid]);

  return (
    <div className="pb-10">
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-foreground">Cold pipeline</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1 max-w-2xl leading-relaxed">
          Your lists, worked one person at a time. Connected first — those you can message
          today without spending an invitation — then the invitations still pending, then
          the people nobody has reached yet.
        </p>
      </div>

      {/* The strip. Where the list stands, and what has gone out this week. */}
      <Panel className="mb-5 p-0 overflow-hidden">
        <div className="flex flex-wrap divide-x divide-border">
          {!hasLi && (
            <Stat
              value={ofList.length}
              label="People in this list"
              hint="Connect a LinkedIn account in Settings to see who is already a connection, who has a pending invitation, and who is still to invite."
            />
          )}
          {hasLi && (
          <>
          <Stat
            icon={<Check className="w-4 h-4" />}
            value={counts.connected}
            label="Connected — message them now"
            tone="text-signal-ink"
            hint="Already a first-degree connection. No invitation, no weekly quota, no risk."
          />
          <Stat
            icon={<Clock className="w-4 h-4" />}
            value={counts.invited}
            label="Invitation pending"
            hint="Sent and waiting. LinkedIn never reports a refusal, so an invitation stays pending until it is accepted or withdrawn."
          />
          <Stat
            icon={<UserPlus className="w-4 h-4" />}
            value={counts.not_connected}
            label="Still to invite"
            hint="The work queue for this list."
          />
          </>
          )}
          <Stat
            value={qt ? `${qt.sent_this_week}` : "—"}
            label={qt ? `Invitations sent this week of ${qt.cap}` : "Invitations this week"}
            tone={qt && qt.remaining <= 10 ? "text-gold-ink" : undefined}
            hint="An estimate, and ours: LinkedIn publishes no remaining-quota figure. Our cap is 100 a week per profile, half of LinkedIn's real ceiling. An accepted invitation leaves the pending list, so the week is pending-this-week plus connections-made-this-week."
          />
          <Stat
            value={qt?.messages_this_week ?? "—"}
            label="LinkedIn messages this week"
            hint="Our count, from the message store. LinkedIn publishes no sent-message figure either."
          />
        </div>
        {status && status.ok && status.healthy === false && (
          <div className="border-t border-border px-3.5 py-2 text-[11.5px] text-gold-ink">
            The connected LinkedIn session needs reconnecting — nothing can send until it is.
          </div>
        )}
      </Panel>

      {/* The lists, across the top. They were a left rail, which cost a whole column of
          width to six items that are picked once and then not touched again — width the
          card needs, because the card is itself three columns. */}
      <nav className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
        {lists.map((l) => {
          const s = perList[l.id] ?? { connected: 0, invited: 0, total: 0 };
          const active = l.id === listId;
          return (
            <button
              key={l.id}
              onClick={() => { setListId(l.id); setOpenId(null); }}
              className={cn(
                "text-left rounded-lg px-3 py-2 border transition-colors shrink-0",
                active ? "border-gold/40 bg-gold/[0.07]" : "border-border bg-card/40 hover:bg-card"
              )}
            >
              <span className="flex items-center gap-2">
                <span className={cn("text-[13px] font-medium leading-tight whitespace-nowrap",
                  active ? "text-foreground" : "text-muted-foreground")}>
                  {l.name}
                </span>
                <span className="text-[12px] tabular-nums text-subtle">{s.total}</span>
              </span>
              <span className="mt-0.5 flex items-center gap-2 text-[11px] text-subtle whitespace-nowrap">
                <span className="text-signal-ink tabular-nums">{s.connected}</span> connected
                <span className="tabular-nums">{s.invited}</span> pending
              </span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col lg:flex-row gap-5 items-stretch">
        {/* The people in it. */}
        <div className="w-full lg:w-[18rem] shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-subtle absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Name, company, role"
                className="w-full rounded-lg border border-border bg-card/40 pl-8 pr-2.5 py-1.5 text-[12.5px] text-foreground placeholder:text-subtle focus:outline-none focus:border-gold/40"
              />
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded-lg border border-border bg-card/40 px-2 py-1.5 text-[12px] text-muted-foreground focus:outline-none focus:border-gold/40"
            >
              {SORTS.filter((o) => hasLi || o.key !== "state")
                .map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </div>

          <div className={cn("flex flex-wrap gap-1.5 mb-2.5", !hasLi && "hidden")}>
            {FILTERS.map((f) => {
              const n = f.key === "all" ? ofList.length : counts[f.key];
              const active = filter === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setOpenId(null); }}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[11.5px] transition-colors",
                    active
                      ? "border-gold/40 bg-gold/[0.09] text-foreground"
                      : "border-border bg-card/40 text-muted-foreground hover:bg-card"
                  )}
                >
                  {f.label} <span className="tabular-nums text-subtle">{n}</span>
                </button>
              );
            })}
          </div>

          {/* Its own scroll, so the card beside it stays put while you go down the
              list. A list of 596 that moves the whole page is unworkable. */}
          <div className="space-y-1.5 lg:max-h-[70vh] lg:overflow-y-auto lg:pr-1.5">
            {shown.length === 0 && (
              <Panel className="text-[13px] text-muted-foreground">
                Nobody here with that filter.
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
                <span className="flex items-start gap-2.5">
                  <CompanyMark name={l.company} domain={l.domain} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-foreground truncate leading-tight">
                      {l.company}
                    </span>
                    <span className="block text-[12.5px] text-foreground/80 truncate mt-1 leading-tight">
                      {l.name}
                    </span>
                    <span className="block text-[11.5px] text-subtle truncate leading-tight">{l.role}</span>
                  </span>
                </span>
                <span className="mt-2 block"><StatePill lead={l} /></span>
              </button>
            ))}
          </div>
        </div>

        {/* The person, in the card the hot pipeline uses. Cold and hot are not two
            places — they are one question, has this person written back — so it is one
            card, and for somebody cold it is honestly empty. The written email and
            LinkedIn message are not shown here as a read-only block any more: they are
            loaded into the composer, so this is where you press send rather than where
            you copy and paste. */}
        <div className="flex-1 w-full min-w-0 rounded-xl border border-border bg-card/40 overflow-hidden min-h-[70vh] lg:h-[76vh] flex flex-col">
          {!open ? (
            <div className="p-6 text-[13px] text-muted-foreground">
              Pick someone on the left to open their card.
            </div>
          ) : pid[open.id] ? (
            <ProspectCard id={pid[open.id] as number} workspace={workspace} />
          ) : opening ? (
            <div className="p-6 text-[13px] text-muted-foreground">Opening {open.name}…</div>
          ) : (
            // A person with neither an address nor a profile cannot become a card. The
            // row is still worth showing: it says who they are and why nothing can be
            // done about them yet, instead of an empty panel.
            <div className="p-6">
              <div className="flex items-start gap-3">
                <CompanyMark name={open.company} domain={open.domain} size={40} />
                <div className="min-w-0">
                  <div className="text-[17px] font-semibold text-foreground leading-tight">{open.name}</div>
                  <div className="text-[13px] text-muted-foreground mt-1">{open.role}</div>
                  <div className="text-[13px] text-foreground/80">{open.company}</div>
                </div>
              </div>
              <p className="mt-4 text-[12.5px] text-gold-ink">
                {openErr || "This person cannot be opened as a card yet."}
              </p>
            </div>
          )}
        </div>
      </div>

      {list && (
        <p className="mt-5 text-[11.5px] text-subtle">
          {owner ? `${owner} — ` : ""}
          {list.name}: {ofList.length} people. LinkedIn status last checked when the
          account was refreshed; it updates on its own overnight.
        </p>
      )}
    </div>
  );
}
