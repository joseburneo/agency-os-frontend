"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldBan, Building2, Swords, MailX, Plus, Trash2, Loader2, Check,
} from "lucide-react";
import { ModuleHeader, SectionLabel, StatTile, Panel, Pill, cn } from "@/components/portal/ui";
import type { BlocklistEntry, BlocklistReason } from "@/lib/portal/types";

const REASONS: { key: BlocklistReason; label: string; icon: React.ComponentType<{ className?: string }>; tone: "gold" | "red" | "muted"; blurb: string }[] = [
  { key: "client", label: "Clients & partners", icon: Building2, tone: "gold", blurb: "Current, past and known relationships — never prospect these." },
  { key: "competitor", label: "Competitors", icon: Swords, tone: "red", blurb: "Direct competitors excluded from every list." },
  { key: "unsubscribe", label: "Unsubscribes", icon: MailX, tone: "muted", blurb: "Opt-outs and removal requests. Auto-fed from replies." },
];

const DOT: Record<BlocklistReason, string> = { client: "#FFD60A", competitor: "#F87171", unsubscribe: "#808080" };

export function BlocklistView({ slug, wsName, entries }: { slug: string; wsName: string; entries: BlocklistEntry[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState<BlocklistReason>("competitor");
  const [companyName, setCompanyName] = useState("");
  const [domain, setDomain] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);

  const byReason = (r: BlocklistReason) => entries.filter((e) => e.reason === r);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!companyName.trim() && !domain.trim() && !email.trim()) {
      setErr("Add a company, a domain, or an email.");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/blocklist/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, reason, companyName, domain, email, note }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(json?.error || "Could not add."); return; }
      setCompanyName(""); setDomain(""); setEmail(""); setNote("");
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1500);
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    try {
      await fetch("/api/blocklist/remove", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id }),
      });
      router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={ShieldBan}
        title="Blocklist"
        desc={`The do-not-contact book for ${wsName}. Every agent checks this before it reaches out — clients, competitors and opt-outs are silently skipped.`}
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <ShieldBan className="w-3.5 h-3.5" /> {entries.length.toLocaleString()} protected
          </span>
        }
      />

      {/* Bucket counts */}
      <div className="grid grid-cols-3 gap-3">
        {REASONS.map((r) => (
          <StatTile
            key={r.key}
            label={r.label}
            value={byReason(r.key).length.toLocaleString()}
            sub={r.key === "unsubscribe" ? "opt-outs on file" : r.key === "client" ? "protected relationships" : "excluded firms"}
            tone={r.key === "client" ? "warn" : "default"}
          />
        ))}
      </div>

      {/* Add composer */}
      <Panel className="p-5">
        <SectionLabel>Add to blocklist</SectionLabel>
        <form onSubmit={add} className="mt-4 flex flex-col gap-3">
          {/* Reason segmented control */}
          <div className="flex flex-wrap gap-1.5">
            {REASONS.map((r) => {
              const on = reason === r.key;
              const Icon = r.icon;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setReason(r.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "border-[#FFD60A]/40 bg-[#FFD60A]/10 text-[#FFD60A]"
                      : "border-border text-muted-foreground hover:text-foreground hover:border-white/20"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" /> {r.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground">{REASONS.find((r) => r.key === reason)?.blurb}</p>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            <Field label="Company" value={companyName} onChange={setCompanyName} placeholder="Acme Ltd" />
            <Field label="Domain" value={domain} onChange={setDomain} placeholder="acme.com" />
            <Field label="Email (optional)" value={email} onChange={setEmail} placeholder="person@acme.com" />
            <Field label="Note (optional)" value={note} onChange={setNote} placeholder="why blocked" />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={adding}
              className="inline-flex items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:brightness-105 disabled:opacity-60 transition"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : justAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              {justAdded ? "Added" : "Add entry"}
            </button>
            {err && <span className="text-[12px] text-red-400">{err}</span>}
          </div>
        </form>
      </Panel>

      {/* Buckets */}
      <div className="flex flex-col gap-5">
        {REASONS.map((r) => {
          const list = byReason(r.key);
          const Icon = r.icon;
          return (
            <Panel key={r.key} className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span
                    className="grid place-items-center w-7 h-7 rounded-lg border"
                    style={{ background: `${DOT[r.key]}1a`, color: DOT[r.key], borderColor: `${DOT[r.key]}40` }}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{r.label}</div>
                    <div className="text-[11px] text-muted-foreground">{r.blurb}</div>
                  </div>
                </div>
                <span className="text-sm font-bold tabular-nums text-muted-foreground">{list.length}</span>
              </div>

              {list.length === 0 ? (
                <div className="mt-4 rounded-lg border border-dashed border-border py-6 text-center text-[12px] text-muted-foreground">
                  Nothing here yet.
                </div>
              ) : (
                <div className="mt-4 flex flex-col divide-y divide-border">
                  {list.map((e) => (
                    <div key={e.id} className="group flex items-center gap-3 py-2.5">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: DOT[r.key] }} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium text-foreground truncate">
                            {e.companyName || e.domain || e.email}
                          </span>
                          {e.source === "auto_unsubscribe" && <Pill tone="muted">auto</Pill>}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {[e.domain, e.email, e.personName, e.note].filter(Boolean).join(" · ")}
                        </div>
                      </div>
                      <button
                        onClick={() => remove(e.id)}
                        disabled={busyId === e.id}
                        title="Remove"
                        className="grid place-items-center w-7 h-7 rounded-lg text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-100"
                      >
                        {busyId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#FFD60A]/40 focus:outline-none"
      />
    </label>
  );
}
