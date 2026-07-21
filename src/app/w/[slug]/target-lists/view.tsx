"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Target, Download, Search, ExternalLink, Eye, X, Send, Copy, Check, Phone, MessageCircle, Star } from "lucide-react";
import type { Workspace, WorkspaceData, Lead } from "@/lib/portal/types";
import { ModuleHeader, Panel, Pill, CompanyMark, ChannelDots, cn } from "@/components/portal/ui";

// Underline the parts of the email that are personalized to this lead — the
// first name, the company (both appear in the body), and the P.S. fact line.
// Approximates the old Build's highlighting without needing template markers.
function renderPersonalized(body: string, firstName: string, company: string) {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const tokens = [firstName, company].filter((t) => t && t.length > 1).map(esc);
  if (tokens.length === 0) return body;
  const re = new RegExp(`(${tokens.join("|")}|P\\.S\\.[^\\n]*)`, "g");
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(body)) !== null) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(
      <span
        key={i++}
        className="underline decoration-[#FFD60A]/70 decoration-2 underline-offset-2 text-[#FFD60A]"
      >
        {m[0]}
      </span>
    );
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex++;
  }
  if (last < body.length) out.push(body.slice(last));
  return out;
}

// The old portal truncated the VIP "why now" signal to ~120 chars in the cell,
// full text on hover (title). Same rule here.
function truncate(s: string, n = 120) {
  return s.length > n ? s.slice(0, n).trimEnd() + "…" : s;
}

// Built here, in the browser, on click — never server-side. A precomputed mailto href
// carries the whole body percent-encoded, so a 1,113-lead list would ship every email
// twice. `canSend` needs a real address plus a drafted body.
function openMailto(l: Lead) {
  if (!l.canSend) return;
  const q = `subject=${encodeURIComponent(l.emailSubject ?? "")}&body=${encodeURIComponent(l.emailBody ?? "")}`;
  window.location.href = `mailto:${l.emailDisplay}?${q}`;
}

// Same rule as data.ts listKey — kept inline so this client bundle never pulls in
// the server-only data module. Maps "List 2 · Has senior HR" -> "list-2-has-senior-hr".
const listKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

export function TargetListsView({
  ws,
  data,
  canExport = true,
}: {
  ws: Workspace;
  data: WorkspaceData;
  // A magnet prospect (demo link) sees every real address and can send from the
  // workspace, but cannot download the list as a file. Seeing the value is the
  // magnet; taking the file home would be the whole product.
  canExport?: boolean;
}) {
  const searchParams = useSearchParams();
  // The sidebar deep-links each list via ?list=<key>; resolve it to a tab id.
  const listIdFromParam = (key: string | null) =>
    (key && data.lists.find((l) => listKey(l.name) === key)?.id) || data.lists[0]?.id || "";
  const [activeList, setActiveList] = useState(() => listIdFromParam(searchParams.get("list")));

  // Clicking a different list in the sidebar changes ?list= without remounting this
  // component, so sync the selected tab when the param changes.
  const paramList = searchParams.get("list");
  useEffect(() => {
    const id = listIdFromParam(paramList);
    if (id) setActiveList(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramList]);
  const [q, setQ] = useState("");
  const [preview, setPreview] = useState<Lead | null>(null);
  // Which copy button just fired ("<kind>-<leadId>") — flashes "✓ Copied" for 1.5s,
  // exactly like the old portal's copyMsg().
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const list = data.lists.find((l) => l.id === activeList) ?? data.lists[0];
  // The VIP list gets the white-glove columns (Why VIP, LinkedIn note, Phone).
  // Detected from the unfiltered rows so an empty search never flips the layout.
  const isVip = useMemo(
    () => data.leads.some((l) => l.listId === activeList && l.segment === "vip"),
    [data.leads, activeList]
  );
  // The "Has senior HR" list names each company's HR lead so Paul can position as a
  // partner. Show that person (name + title) as a column, the way the old portal did,
  // in place of Sector (which is empty for this list). Detected from unfiltered rows.
  const isHr = useMemo(
    () => data.leads.some((l) => l.listId === activeList && l.segment === "hashr"),
    [data.leads, activeList]
  );
  const leads = useMemo(() => {
    const term = q.trim().toLowerCase();
    return data.leads
      .filter((l) => l.listId === activeList)
      .filter((l) =>
        !term ? true : [l.name, l.company, l.sector, l.role, l.hrLeadName ?? ""].some((f) => f.toLowerCase().includes(term))
      )
      // Well-ordered: ready-to-send first, then have-email, then the rest.
      .sort((a, b) => Number(b.hasDraft) - Number(a.hasDraft) || Number(b.hasEmail) - Number(a.hasEmail));
  }, [data.leads, activeList, q]);

  // Copy with the old portal's graceful fallback: clipboard API when available,
  // window.prompt when not (or when the write is refused).
  const copyText = (key: string, text: string) => {
    const ok = () => {
      setCopied(key);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(null), 1500);
    };
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(ok, () => window.prompt("Copy the note:", text));
    } else {
      window.prompt("Copy the note:", text);
    }
  };

  // Client-side CSV of the rows currently on screen (active list + search filter),
  // with the columns the table shows. Addresses are real for everyone now, so the
  // export itself is the thing we withhold from a demo prospect.
  const downloadCsv = () => {
    if (!canExport) return;
    const csvEsc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const header = isVip
      ? ["Company", "Leader", "Role", "Why VIP", "Email", "LinkedIn", "LinkedIn note", "Phone"]
      : isHr
        ? ["Company", "Leader", "Role", "HR lead", "HR title", "Email", "LinkedIn"]
        : ["Company", "Leader", "Role", "Sector", "Email", "LinkedIn"];
    const rows = leads.map((l) => {
      const base = [l.company, l.name, l.role];
      const rest = isVip
        ? [l.whyNow ?? "", l.hasEmail ? l.emailDisplay : "", l.linkedinUrl ?? "", l.linkedinNote ?? "", l.phone ?? ""]
        : isHr
          ? [l.hrLeadName ?? "", l.hrLeadTitle ?? "", l.hasEmail ? l.emailDisplay : "", l.linkedinUrl ?? ""]
          : [l.sector, l.hasEmail ? l.emailDisplay : "", l.linkedinUrl ?? ""];
      return [...base, ...rest].map(csvEsc).join(",");
    });
    const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const blob = new Blob([[header.map(csvEsc).join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ws.slug}-${slugify(list?.name ?? "leads")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-6">
      <ModuleHeader
        icon={Target}
        title="Targeted Cold Leads"
        desc="Your hyper-targeted cold leads. The enriched lists that feed the cold outreach: email, LinkedIn and LinkedIn Ads audiences."
        meta={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ws.accent, boxShadow: `0 0 6px ${ws.accent}` }} />
            {ws.coldLeads.toLocaleString()} cold leads in {ws.name}
          </span>
        }
        actions={
          canExport ? (
            <button
              onClick={downloadCsv}
              title={`Download the ${leads.length} leads currently shown (CSV, opens in Excel)`}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-[13px] text-foreground hover:border-white/20 transition-colors"
            >
              <Download className="w-4 h-4" /> Download Excel
            </button>
          ) : null
        }
      />

      {/* List tabs */}
      <div className="flex flex-wrap gap-2">
        {data.lists.map((l) => {
          const active = l.id === activeList;
          return (
            <button
              key={l.id}
              onClick={() => setActiveList(l.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition-colors",
                active
                  ? "border-[#FFD60A]/40 bg-[#FFD60A]/10 text-[#FFD60A]"
                  : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-white/20"
              )}
            >
              {l.name}
              <span className={cn("tabular-nums text-[11px] rounded-md px-1.5 py-0.5", active ? "bg-[#FFD60A]/15" : "bg-white/5")}>
                {l.count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Active list header */}
      {list && (
        <Panel className="p-4 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{list.name}</div>
            <p className="text-[13px] text-muted-foreground mt-1 max-w-2xl">{list.note}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[11px] text-muted-foreground">Activated on</span>
            <ChannelDots channels={list.channels} size={16} />
          </div>
        </Panel>
      )}

      {/* VIP white-glove instructions — carried over from the old portal. These leads
          are excluded from the automated sequence and worked personally, in order:
          email first, then the LinkedIn invite, then the call. */}
      {isVip && (
        <Panel className="p-4 border-[#FFD60A]/25 bg-[#FFD60A]/[0.03]">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-4 h-4 text-[#FFD60A]" />
            <span className="text-sm font-semibold text-foreground">How to action each VIP</span>
            <Pill tone="gold">white-glove</Pill>
          </div>
          <ol className="text-[13px] text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>
              <b className="text-foreground font-semibold">Send</b>: opens your mail app with the full
              email ready to send from your own address.
            </li>
            <li>
              <b className="text-foreground font-semibold">View</b> (LinkedIn): opens their profile so
              you can send the invite.
            </li>
            <li>
              <b className="text-foreground font-semibold">Copy note</b>: copies a personalised
              connection message for that person to your clipboard; paste it into the LinkedIn invite.
              Send it as a follow-up <i>after</i> the email.
            </li>
            <li>
              <b className="text-foreground font-semibold">Call</b> (once we have the number): open
              warm: <i>&ldquo;I sent you a short note by email and on LinkedIn, I just wanted to make
              sure it reached you.&rdquo;</i>
            </li>
          </ol>
          <p className="text-[12px] text-muted-foreground mt-3">
            Prefer not to send these yourself? We are happy to run the VIPs through the sequencer
            instead, just say the word.
          </p>
        </Panel>
      )}

      {/* Search + count */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, company, sector…"
            className="w-full h-10 rounded-lg border border-border bg-input pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#FFD60A]/40"
          />
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap">
          {leads.length} of {list?.count.toLocaleString()}
        </span>
      </div>

      {/* Table */}
      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border">
                <th className="text-left font-medium px-4 py-3">Company</th>
                <th className="text-left font-medium px-4 py-3">Leader</th>
                <th className="text-left font-medium px-4 py-3">Role</th>
                {isVip ? (
                  <th className="text-left font-medium px-4 py-3">Why VIP</th>
                ) : isHr ? (
                  <th className="text-left font-medium px-4 py-3">HR lead</th>
                ) : (
                  <th className="text-left font-medium px-4 py-3">Sector</th>
                )}
                <th className="text-left font-medium px-4 py-3">LinkedIn</th>
                {isVip && <th className="text-left font-medium px-4 py-3">Note</th>}
                {isVip && <th className="text-left font-medium px-4 py-3">Phone</th>}
                <th className="text-right font-medium px-4 py-3">Email</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0 hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <CompanyMark name={l.company} domain={l.domain} />
                      <span className="font-semibold text-foreground">{l.company}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-foreground">{l.name}</div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {l.hasEmail ? l.emailDisplay : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{l.role}</td>
                  {isVip ? (
                    <td className="px-4 py-3 text-muted-foreground max-w-[260px]">
                      {l.whyNow ? (
                        <span className="text-[12px] leading-snug" title={l.whyNow}>
                          {truncate(l.whyNow)}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </td>
                  ) : isHr ? (
                    <td className="px-4 py-3">
                      {l.hrLeadName ? (
                        <>
                          <div className="text-foreground">{l.hrLeadName}</div>
                          {l.hrLeadTitle && (
                            <div className="text-[11px] text-muted-foreground">{l.hrLeadTitle}</div>
                          )}
                        </>
                      ) : (
                        <span className="text-muted-foreground">— (CEO-direct)</span>
                      )}
                    </td>
                  ) : (
                    <td className="px-4 py-3 text-muted-foreground">{l.sector}</td>
                  )}
                  <td className="px-4 py-3">
                    {l.linkedin ? (
                      l.linkedinUrl ? (
                        <a
                          href={l.linkedinUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[13px] text-blue-300 hover:text-blue-200"
                        >
                          View <ExternalLink className="w-3 h-3" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[13px] text-blue-300">
                          View <ExternalLink className="w-3 h-3" />
                        </span>
                      )
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {isVip && (
                    <td className="px-4 py-3">
                      {l.linkedinNote ? (
                        <button
                          onClick={() => copyText(`note-${l.id}`, l.linkedinNote!)}
                          title="Copy the personalised LinkedIn connection note for this person"
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors whitespace-nowrap",
                            copied === `note-${l.id}`
                              ? "border-[#26D07C]/30 bg-[#26D07C]/10 text-[#26D07C]"
                              : "border-border bg-card text-foreground hover:border-white/20"
                          )}
                        >
                          {copied === `note-${l.id}` ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" /> Copy note
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  )}
                  {isVip && (
                    <td className="px-4 py-3">
                      {l.phone ? (
                        <div className="flex items-center gap-1.5 whitespace-nowrap">
                          <a
                            href={
                              `https://wa.me/${l.phone.replace(/\D/g, "")}` +
                              // Prefill the prepared opener when we have one, so the
                              // chat opens written rather than blank.
                              (l.whatsappNote ? `?text=${encodeURIComponent(l.whatsappNote)}` : "")
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-md border border-[#26D07C]/25 bg-[#26D07C]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#26D07C] hover:bg-[#26D07C]/15 transition-colors"
                          >
                            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                          <a
                            href={`tel:${l.phone}`}
                            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:border-white/20 transition-colors"
                          >
                            <Phone className="w-3.5 h-3.5" /> Call
                          </a>
                          <button
                            onClick={() => copyText(`ph-${l.id}`, l.phone!)}
                            title={`Copy ${l.phone}`}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] font-mono transition-colors",
                              copied === `ph-${l.id}`
                                ? "border-[#26D07C]/30 bg-[#26D07C]/10 text-[#26D07C]"
                                : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-white/20"
                            )}
                          >
                            {copied === `ph-${l.id}` ? (
                              <>
                                <Check className="w-3.5 h-3.5" /> Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5" /> {l.phone}
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap">— (to enrich)</span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {l.canSend ? (
                        <button
                          type="button"
                          onClick={() => openMailto(l)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-[#FFD60A]/25 bg-[#FFD60A]/10 px-2.5 py-1.5 text-[12px] font-medium text-[#FFD60A] hover:bg-[#FFD60A]/15 transition-colors"
                          title={`Opens your mail app to ${l.hasEmail ? l.emailDisplay : "the lead"}, ready to send`}
                        >
                          <Send className="w-3.5 h-3.5" /> Send
                        </button>
                      ) : l.hasEmail ? (
                        <span className="text-[11px] text-muted-foreground">draft pending</span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">no email yet</span>
                      )}
                      {l.emailBody ? (
                        <button
                          onClick={() => setPreview(l)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] font-medium text-foreground hover:border-white/20 transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-2.5 py-1.5 text-[12px] text-muted-foreground/50">
                          <Eye className="w-3.5 h-3.5" /> Preview
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={isVip ? 8 : 6} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    No leads match your search in this list.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <Pill tone="muted">Enriched</Pill>
        Each lead carries role, company, sector, LinkedIn and a verified email, plus a per-contact dossier feeding the first line.
      </div>

      {/* Email preview drawer */}
      {preview && (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
          <button
            aria-label="Close preview"
            onClick={() => setPreview(null)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-xl h-full bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right">
            <div className="flex items-start justify-between gap-4 p-5 border-b border-border">
              <div className="flex items-center gap-3 min-w-0">
                <CompanyMark name={preview.company} domain={preview.domain} size={32} />
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate">{preview.name}</div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {preview.role} · {preview.company}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setPreview(null)}
                className="shrink-0 grid place-items-center w-8 h-8 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
              <div>
                <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">To</div>
                <div className="text-sm font-mono text-foreground">
                  {preview.hasEmail ? preview.emailDisplay : "no email yet"}
                </div>
              </div>
              {preview.emailSubject && (
                <div>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground mb-1">Subject</div>
                  <div className="text-sm font-medium text-foreground">{preview.emailSubject}</div>
                </div>
              )}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Message</div>
                  <div className="text-[10px] text-muted-foreground">
                    <span className="underline decoration-[#FFD60A]/70 decoration-2 underline-offset-2 text-[#FFD60A]">underlined</span> = personalized to this lead
                  </div>
                </div>
                <div className="rounded-lg border border-border bg-input p-4 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">
                  {renderPersonalized(preview.emailBody ?? "", preview.name.split(" ")[0] ?? "", preview.company)}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-border flex items-center justify-between gap-3">
              <span className="text-[11px] text-muted-foreground">
                Email 1 · opens in your mail app, from you, signature and all.
              </span>
              {preview.canSend && (
                <button
                  type="button"
                  onClick={() => openMailto(preview)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#FFD60A]/30 bg-[#FFD60A]/10 px-4 py-2 text-[13px] font-semibold text-[#FFD60A] hover:bg-[#FFD60A]/15 transition-colors"
                >
                  <Send className="w-4 h-4" /> Send through my email
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
