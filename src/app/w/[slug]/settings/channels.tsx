"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronRight, Loader2, RefreshCw, X } from "lucide-react";
import { Linkedin, SectionLabel } from "@/components/portal/ui";

// Connections: the page where a client hands us their own LinkedIn, mailbox and
// WhatsApp.
//
// This is not settings housekeeping, it is the switch that makes the rest of the
// product true. Paul Herrick sent ~200 LinkedIn invitations off our lists and about
// half were accepted; roughly a hundred of those people have never been followed up
// and NONE of them exist in his CRM, because nothing is connected. The moment
// LinkedIn is connected they arrive, with their conversations.
//
// The password is never typed on this page and never reaches our servers. Connect
// redirects to the provider's own hosted login, which is also what handles 2FA and
// LinkedIn's checkpoints, and it redirects back here when it is done.
//
// Only kind='client' workspaces render this, and the backend refuses anything else
// outright: 41 of 46 workspaces are magnets, opened by prospects on a bare link with
// no password, and a connect button they could reach would invite a stranger to hand
// us their LinkedIn session on a paid seat.

type Account = {
  account_id: string;
  channel: string;
  label: string;
  enabled: boolean;
  status: string;
};

// `null` = not asked yet; `"down"` = asked and got no answer. Those are different
// things and used to render identically — disabled buttons and no words — which
// reads as a dead feature rather than a service that is briefly unreachable.
type Info = { accounts: Account[]; configured: boolean } | "down" | null;

type Provider = { key: string; name: string; domain: string };

type Row = {
  channel: string;
  title: string;
  blurb: string;
  providers: Provider[];
};

const ROWS: Row[] = [
  {
    channel: "linkedin",
    title: "LinkedIn",
    blurb: "Your connections, your sent invitations and every conversation, in the CRM.",
    providers: [{ key: "linkedin", name: "LinkedIn", domain: "linkedin.com" }],
  },
  {
    channel: "email",
    title: "Email",
    blurb: "One-to-one replies stay on the same thread as everything else.",
    providers: [
      { key: "email", name: "Gmail", domain: "gmail.com" },
      { key: "outlook", name: "Outlook", domain: "outlook.com" },
    ],
  },
  {
    channel: "whatsapp",
    title: "WhatsApp",
    blurb: "The channel most deals actually close on.",
    providers: [{ key: "whatsapp", name: "WhatsApp", domain: "whatsapp.com" }],
  },
];

// The real brand mark, from the domain's own favicon at 64px so it stays crisp at
// 22. Falls back to a monogram tile rather than a broken image, and LinkedIn falls
// back to our own vector because it is the one people look for first.
function Mark({ domain, name, size = 22 }: { domain: string; name: string; size?: number }) {
  const [bad, setBad] = useState(false);
  if (!bad) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
        width={size}
        height={size}
        alt={name}
        onError={() => setBad(true)}
        className="shrink-0 rounded-[5px]"
        style={{ width: size, height: size }}
      />
    );
  }
  if (domain === "linkedin.com") {
    return <Linkedin width={size} height={size} style={{ color: "var(--li-blue)" }} className="shrink-0" />;
  }
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-[5px] bg-secondary text-muted-foreground"
      style={{ width: size, height: size, fontSize: size * 0.5 }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export function ChannelConnect({ slug }: { slug: string }) {
  const [info, setInfo] = useState<Info>(null);
  const [busy, setBusy] = useState("");
  const [picking, setPicking] = useState("");
  const [err, setErr] = useState("");
  const [back, setBack] = useState<{ ok: boolean; what: string } | null>(null);

  const load = useCallback(() => {
    fetch(`/api/crm/channels?workspace=${encodeURIComponent(slug)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setInfo(j ? { accounts: j.accounts ?? [], configured: !!j.configured } : "down"))
      .catch(() => setInfo("down"));
  }, [slug]);

  useEffect(load, [load]);

  // Coming back from the provider. Read from the URL directly rather than through
  // useSearchParams, which would force this subtree into a Suspense boundary for a
  // banner, then clear it so a refresh does not replay a stale "Connected".
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const okKey = q.get("connected");
    const badKey = q.get("failed");
    if (!okKey && !badKey) return;
    setBack({ ok: !!okKey, what: okKey || badKey || "" });
    const url = new URL(window.location.href);
    url.searchParams.delete("connected");
    url.searchParams.delete("failed");
    window.history.replaceState({}, "", url.toString());
    load();
  }, [load]);

  // The connect flow leaves the tab and comes back. Without this the person returns
  // to a panel still reading "Not connected" and reasonably concludes it failed.
  useEffect(() => {
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load]);

  const connect = async (provider: string) => {
    setBusy(provider);
    setErr("");
    try {
      const r = await fetch(`/api/crm/channels/link?workspace=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.url) {
        setErr(j.detail || j.error || "Could not start the connection. Try again in a moment.");
        setBusy("");
        return;
      }
      // Same tab, not a popup: blockers eat popups, and the provider sends you
      // straight back here when it is done.
      window.location.href = j.url;
    } catch {
      setErr("Could not reach the server. Try again in a moment.");
      setBusy("");
    }
  };

  const disconnect = async (accountId: string) => {
    setBusy(accountId);
    try {
      await fetch(`/api/crm/channels/disconnect?workspace=${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id: accountId }),
      });
      load();
    } finally {
      setBusy("");
    }
  };

  const ok = info && info !== "down" ? info : null;
  const live = (channel: string) =>
    (ok?.accounts ?? []).filter((a) => a.channel === channel && a.enabled);

  const ready = !!ok?.configured;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionLabel>Connections</SectionLabel>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Connect the accounts you already work from. Your conversations and contacts
            come into this workspace, and the copilot writes with them as context. You
            sign in on the {"provider's"} own page, so your password is never typed here
            and never reaches us.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          title="Check again"
          className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[10.5px] text-muted-foreground transition-colors hover:text-gold-ink"
        >
          <RefreshCw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {back && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-[12px] ${
            back.ok
              ? "border-signal/30 bg-signal/[0.07] text-signal-ink"
              : "border-gold/30 bg-gold/[0.06] text-foreground"
          }`}
        >
          {back.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <X className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span className="flex-1">
            {back.ok
              ? "Connected. We are pulling in your conversations now — give it a minute, then open the CRM."
              : "That did not complete. Nothing was changed, you can try again."}
          </span>
          <button type="button" onClick={() => setBack(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {info === "down" && (
        <div className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3.5 py-2.5 text-[12px] text-foreground">
          We cannot reach the connection service right now. Nothing is broken on your
          side — press Refresh in a minute.
        </div>
      )}
      {ok && !ready && (
        <div className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3.5 py-2.5 text-[12px] text-foreground">
          Connecting accounts is not switched on yet. We are on it.
        </div>
      )}

      {err && (
        <div className="rounded-lg border border-danger-soft/30 bg-danger-soft/[0.06] px-3.5 py-2.5 text-[12px] text-danger-soft">
          {err}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {ROWS.map((row) => {
          const on = live(row.channel);
          const connected = on.length > 0;
          const single = row.providers.length === 1;
          const open = picking === row.channel;

          return (
            <div key={row.channel} className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Mark domain={row.providers[0].domain} name={row.title} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-foreground">{row.title}</span>
                    {connected ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-signal/30 bg-signal/10 px-2 py-0.5 text-[10.5px] text-signal-ink">
                        <Check className="h-2.5 w-2.5" /> Connected
                      </span>
                    ) : (
                      <span className="rounded-full border border-border px-2 py-0.5 text-[10.5px] text-subtle">
                        Not connected
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[12px] text-muted-foreground">{row.blurb}</p>
                </div>

                <button
                  type="button"
                  onClick={() => (single ? connect(row.providers[0].key) : setPicking(open ? "" : row.channel))}
                  disabled={!ready || busy === row.providers[0].key}
                  className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-[12px] font-semibold transition-colors disabled:opacity-40 ${
                    connected
                      ? "border border-border text-muted-foreground hover:border-gold/40 hover:text-gold-ink"
                      : "bg-gold text-ink-inverse hover:bg-gold-hi"
                  }`}
                >
                  {busy === row.providers[0].key ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  {connected ? "Reconnect" : "Connect"}
                  {!single && <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />}
                </button>
              </div>

              {/* Which mailbox. Asked only when it matters, so the common case stays
                  one click and the choice does not become a form to fill in. */}
              {open && !single && (
                <div className="flex flex-wrap gap-2 border-t border-border/70 px-4 py-3">
                  {row.providers.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => connect(p.key)}
                      disabled={busy === p.key}
                      className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-[12px] text-foreground transition-colors hover:border-gold/40 disabled:opacity-40"
                    >
                      {busy === p.key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mark domain={p.domain} name={p.name} size={16} />}
                      {p.name}
                    </button>
                  ))}
                </div>
              )}

              {on.map((a) => (
                <div
                  key={a.account_id}
                  className="flex items-center gap-2 border-t border-border/70 px-4 py-2 text-[11.5px] text-muted-foreground"
                >
                  <span className="truncate">{a.label || a.account_id}</span>
                  {/* A LinkedIn session dies on its own every few weeks. Saying so is the
                      difference between "reconnect me" and "your product is broken". */}
                  {a.status && a.status !== "OK" && (
                    <span className="shrink-0 text-gold-ink">needs reconnecting</span>
                  )}
                  <button
                    type="button"
                    onClick={() => disconnect(a.account_id)}
                    disabled={busy === a.account_id}
                    className="ml-auto shrink-0 transition-colors hover:text-danger-soft disabled:opacity-40"
                  >
                    Disconnect
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] leading-relaxed text-subtle">
        LinkedIn signs you out every few weeks on its own, so expect to reconnect about
        once a month. We keep invitations under 100 a week on purpose, which is half of
        {" "}
        {"LinkedIn's"} own ceiling.
      </p>
    </div>
  );
}
