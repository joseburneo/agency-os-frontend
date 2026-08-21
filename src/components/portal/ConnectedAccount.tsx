"use client";

import { useEffect, useState } from "react";
import { Linkedin, cn } from "./ui";

/**
 * Whose accounts this workspace sends from — with the face.
 *
 * The composer used to say "sends from your LinkedIn". True, and it answered nothing:
 * in a client workspace opened with an agency session, "your" is the whole question.
 * Naming the profile fixed the sentence; this is the version nobody has to read. Paul
 * looks at his own photograph before he presses send.
 *
 * It is also where the two email routes stop looking alike. A campaign leaves through
 * Instantly on a burner domain — that is cold, and deliberately not his real address.
 * His own Google or Microsoft inbox, connected through Unipile, is the warm one. Both
 * are "email" and they are not the same act, so the strip says which is which.
 */

type Owner = { name?: string; headline?: string; picture?: string; profile_url?: string };
type Account = {
  account_id: string;
  channel: "linkedin" | "email" | "whatsapp" | string;
  provider?: string;               // GOOGLE_OAUTH | OUTLOOK | LINKEDIN | WHATSAPP
  status?: string;                 // "OK" when the session is alive
  owner?: Owner;
};

/** The provider's own name for a mailbox, so "connected" says WHICH inbox.
 *  Matched on the family, not on the exact label: Unipile answers GOOGLE_OAUTH to a
 *  link we minted as GOOGLE, and that mismatch already cost us a dropped mailbox once. */
function providerLabel(p?: string): string {
  const t = (p || "").toUpperCase();
  if (t.includes("GOOGLE") || t.includes("GMAIL")) return "Google";
  if (t.includes("OUTLOOK") || t.includes("MICROSOFT")) return "Microsoft";
  if (t.includes("LINKEDIN")) return "LinkedIn";
  if (t.includes("WHATSAPP")) return "WhatsApp";
  return "";
}

function Initials({ name, size }: { name: string; size: number }) {
  const i = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase();
  return (
    <span
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full bg-secondary border border-border grid place-items-center text-[11px] font-semibold text-muted-foreground"
    >
      {i || "?"}
    </span>
  );
}

function Face({ owner, size = 28 }: { owner?: Owner; size?: number }) {
  const src = owner?.picture;
  // The photo lives in OUR storage — LinkedIn signs theirs with about a month of life,
  // and a face that vanishes with no error is the worst kind of failure. If it is
  // missing anyway, initials rather than a broken image.
  if (!src) return <Initials name={owner?.name || ""} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={owner?.name || "Connected account"}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className="shrink-0 rounded-full object-cover border border-border"
    />
  );
}

function AccountChip({ a }: { a: Account }) {
  const owner = a.owner;
  const name = owner?.name || "";
  const provider = providerLabel(a.provider || a.channel);
  const dead = a.status !== undefined && a.status !== "OK";

  const label =
    a.channel === "linkedin"
      ? (name ? `${name}'s LinkedIn` : "LinkedIn")
      : (name || provider || a.channel);

  const body = (
    <span className="flex items-center gap-2 min-w-0">
      {a.channel === "linkedin"
        ? <Face owner={owner} />
        : <Initials name={name || provider} size={28} />}
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          {a.channel === "linkedin" && (
            <Linkedin width={13} height={13} className="shrink-0" style={{ color: "var(--info)" }} />
          )}
          <span className="text-[12.5px] text-foreground truncate">{label}</span>
        </span>
        <span className={cn("block text-[11px] leading-tight",
          dead ? "text-gold-ink" : "text-signal-ink")}>
          {dead ? "Needs reconnecting" : "Connected"}
          {a.channel !== "linkedin" && provider ? ` · ${provider}` : ""}
        </span>
      </span>
    </span>
  );

  const cls = "flex items-center rounded-lg border border-border bg-card/60 px-2.5 py-1.5 max-w-[15rem]";
  return owner?.profile_url ? (
    <a href={owner.profile_url} target="_blank" rel="noopener noreferrer"
       title={owner.headline || label}
       className={cn(cls, "hover:border-white/20 transition-colors")}>
      {body}
    </a>
  ) : (
    <span title={owner?.headline || label} className={cls}>{body}</span>
  );
}

export function ConnectedAccounts({ workspace, className }:
  { workspace: string; className?: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);

  useEffect(() => {
    fetch(`/api/crm/channels?workspace=${encodeURIComponent(workspace)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setAccounts(Array.isArray(j?.accounts) ? j.accounts : []))
      .catch(() => setAccounts([]));
  }, [workspace]);

  // Nothing connected is not an error and does not deserve a row of its own here: the
  // place that asks for a connection is Settings, and saying it twice makes the page
  // nag rather than inform.
  if (!accounts || accounts.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {accounts.map((a) => <AccountChip key={a.account_id} a={a} />)}
    </div>
  );
}
