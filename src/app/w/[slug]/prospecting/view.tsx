"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radar, Search, Loader2, Sparkles, X, Check, Users, Building2, Lock, Download } from "lucide-react";
import { cn, Panel, SectionLabel, ModuleHeader, CompanyMark, LinkedInMark } from "@/components/portal/ui";

// ---------------------------------------------------------------- types

type Field = {
  name: string;
  type: string;                    // "string[]" | "string" | "number" | "boolean"
  description?: string;
  allowed_values?: string[];
  enum?: string[];
};

type Row = Record<string, unknown>;
type Filters = Record<string, unknown>;
type Source = "people" | "companies";

type ExportJob = {
  id: string;
  state: "running" | "done" | "error";
  total: number; found: number; verified: number; written: number;
  charged: number; skipped: number; reused: number; error?: string;
  credits?: Credits;
};

// The filters a salesperson actually reaches for, in the order they think of
// them. Everything else the schema reports is real and usable, it just lives
// behind "All filters" so the first screen is a decision and not an inventory.
const PRIMARY: Record<Source, string[]> = {
  people: [
    "job_title_keywords",
    "job_title_seniority_levels_v2",
    "locations",
    "company_sizes",
    "company_description_keywords",
    "company_industries_include",
  ],
  companies: [
    "description_keywords",
    "locations",
    "sizes",
    "industries",
    "annual_revenues",
  ],
};

// Which filters feed the free Icypeas counter. It only knows geography and job
// title, so anything else the user sets narrows the real list without moving
// the number — which is exactly why the number is labelled as a market size and
// never as the size of what they are about to get.
const GEO_FIELDS = ["locations", "location_countries_include", "location_cities_include", "country_names"];
const TITLE_FIELDS = ["job_title_keywords"];

const LABELS: Record<string, string> = {
  job_title_keywords: "Job title",
  job_title_seniority_levels_v2: "Seniority",
  locations: "Location",
  company_sizes: "Company size",
  sizes: "Company size",
  company_description_keywords: "What the company does",
  description_keywords: "What the company does",
  company_industries_include: "Industry",
  industries: "Industry",
  annual_revenues: "Revenue",
};

function label(f: Field) {
  return LABELS[f.name] ?? f.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function values(f: Field): string[] {
  return f.allowed_values ?? f.enum ?? [];
}

function asArray(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : v == null || v === "" ? [] : [String(v)];
}

// ---------------------------------------------------------------- inputs

/** Free-text list: type a value, Enter adds it. One value per chip, never a
 *  comma-joined string — Clay matches a joined string as a single literal and
 *  silently returns nobody, which is the failure this input exists to prevent. */
function TagInput({ value, onChange, placeholder }: {
  value: string[]; onChange: (v: string[]) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) onChange(Array.from(new Set([...value, ...parts])));
    setDraft("");
  };
  return (
    <div className="rounded-lg border border-border bg-background px-2 py-1.5 focus-within:border-gold/60 transition-colors">
      <div className="flex flex-wrap gap-1.5">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2 py-0.5 text-[12px] text-gold-ink">
            {v}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== v))}
                    className="text-subtle hover:text-foreground transition-colors" aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(draft); }
            if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft && commit(draft)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-[7rem] flex-1 bg-transparent py-0.5 text-[13px] outline-none placeholder:text-subtle"
        />
      </div>
    </div>
  );
}

/** Enum picker. Short lists render as chips; the 457-value industry list gets a
 *  search box, because a dropdown of 457 items is not a choice, it is a wall. */
function EnumInput({ options, value, onChange, multi }: {
  options: string[]; value: string[]; onChange: (v: string[]) => void; multi: boolean;
}) {
  const [q, setQ] = useState("");
  const big = options.length > 12;
  const shown = useMemo(() => {
    if (!q) return big ? options.slice(0, 40) : options;
    const needle = q.toLowerCase();
    return options.filter((o) => o.toLowerCase().includes(needle)).slice(0, 40);
  }, [q, options, big]);
  const toggle = (o: string) => {
    if (!multi) return onChange(value.includes(o) ? [] : [o]);
    onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o]);
  };
  return (
    <div className="space-y-1.5">
      {big && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${options.length} options`}
                 className="w-full rounded-lg border border-border bg-background py-1.5 pl-7 pr-2 text-[13px] outline-none focus:border-gold/60 placeholder:text-subtle" />
        </div>
      )}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v) => (
            <span key={v} className="inline-flex items-center gap-1 rounded-md bg-gold/10 px-2 py-0.5 text-[12px] text-gold-ink">
              {v}
              <button type="button" onClick={() => toggle(v)} className="text-subtle hover:text-foreground transition-colors" aria-label={`Remove ${v}`}>
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className={cn("flex flex-wrap gap-1.5", big && "max-h-40 overflow-y-auto")}>
        {shown.filter((o) => !value.includes(o)).map((o) => (
          <button key={o} type="button" onClick={() => toggle(o)}
                  className="rounded-md border border-border px-2 py-0.5 text-[12px] text-muted-foreground hover:border-gold/60 hover:text-foreground transition-colors">
            {o}
          </button>
        ))}
        {big && !q && options.length > 40 && (
          <span className="self-center text-[11px] text-subtle">+{options.length - 40} more, search to narrow</span>
        )}
      </div>
    </div>
  );
}

function FieldControl({ field, value, onChange }: {
  field: Field; value: unknown; onChange: (v: unknown) => void;
}) {
  const opts = values(field);
  const isList = field.type?.endsWith("[]");
  if (field.type === "boolean") {
    return (
      <button type="button" onClick={() => onChange(!value)}
              className={cn("flex h-6 w-11 items-center rounded-full border transition-colors",
                            value ? "border-gold bg-gold/20" : "border-border bg-background")}>
        <span className={cn("h-4 w-4 rounded-full bg-foreground/70 transition-transform", value ? "translate-x-6" : "translate-x-1")} />
      </button>
    );
  }
  if (field.type === "number") {
    return (
      <input type="number" value={value == null ? "" : String(value)}
             onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
             className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-[13px] outline-none focus:border-gold/60" />
    );
  }
  if (opts.length) {
    return <EnumInput options={opts} value={asArray(value)} multi={!!isList}
                      onChange={(v) => onChange(isList ? v : v[0])} />;
  }
  return <TagInput value={asArray(value)} onChange={(v) => onChange(v)} placeholder="Type and press Enter" />;
}

// ----------------------------------------------------------------- view

type Credits = {
  remaining: number;            // the smaller of the two — what the export gate honours
  allowance: number;            // the month's
  month_remaining?: number;
  daily_allowance?: number;
  daily_remaining?: number;
  used_today?: number;
  limit?: "day" | "month";      // which one is biting
};

export function ProspectingView({ slug, canExport }: { slug: string; canExport: boolean }) {
  const [source, setSource] = useState<Source>("people");
  const [fields, setFields] = useState<Record<Source, Field[]>>({ people: [], companies: [] });
  const [filters, setFilters] = useState<Filters>({});
  const [prompt, setPrompt] = useState("");
  const [interpreting, setInterpreting] = useState(false);
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [market, setMarket] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [wall, setWall] = useState(false);
  const [credits, setCredits] = useState<Credits | null>(null);
  const [job, setJob] = useState<ExportJob | null>(null);

  const schema = fields[source];
  const byName = useMemo(() => Object.fromEntries(schema.map((f) => [f.name, f])), [schema]);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const r = await fetch(`/api/prospecting/fields?source=${source}`);
        const d = await r.json();
        if (live && Array.isArray(d.fields)) setFields((p) => ({ ...p, [source]: d.fields }));
      } catch { /* the panel simply stays empty; the chat path still works */ }
    })();
    return () => { live = false; };
  }, [source]);

  // The free counter. Debounced because it fires on every chip added, and
  // deliberately not gated behind a button: costing nothing is what lets a user
  // negotiate their market until the number looks right.
  const countTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const geography = GEO_FIELDS.flatMap((f) => asArray(filters[f]));
    const titles = TITLE_FIELDS.flatMap((f) => asArray(filters[f]));
    if (!geography.length && !titles.length) { setMarket(null); return; }
    if (countTimer.current) clearTimeout(countTimer.current);
    countTimer.current = setTimeout(async () => {
      try {
        const r = await fetch("/api/prospecting/count", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ geography, titles }),
        });
        const d = await r.json();
        setMarket(typeof d.total === "number" ? d.total : null);
      } catch { setMarket(null); }
    }, 450);
    return () => { if (countTimer.current) clearTimeout(countTimer.current); };
  }, [filters]);

  // The seat's remaining credits. Read from the server on mount and refreshed
  // after every export, because the balance is derived from the rows exported
  // this month rather than from a counter the browser could drift away from.
  useEffect(() => {
    if (!canExport) return;
    let live = true;
    (async () => {
      try {
        const d = await (await fetch("/api/prospecting/context")).json();
        if (live && d?.credits) setCredits(d.credits);
      } catch { /* the meter simply does not render */ }
    })();
    return () => { live = false; };
  }, [canExport]);

  async function startExport(rows: Row[], picked: Set<string>) {
    const chosen = rows.filter((r, i) => picked.has(rowKey(r, i)));
    if (!chosen.length) return;
    setError("");
    try {
      const r = await fetch("/api/prospecting/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: chosen, list_name: "Find Prospects" }),
      });
      const d = await r.json();
      if (r.status === 403) { setWall(true); return; }
      if (!r.ok) throw new Error(d?.detail?.message || d?.detail || d?.error || "Export failed");
      setJob({ id: d.job_id, state: "running", total: d.accepted, found: 0,
               verified: 0, written: 0, charged: 0, skipped: 0, reused: 0 });
      poll(d.job_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    }
  }

  function poll(id: string) {
    const tick = async () => {
      try {
        const d: ExportJob = await (await fetch(`/api/prospecting/export/${id}`)).json();
        setJob(d);
        if (d.credits) setCredits(d.credits);
        if (d.state === "running") setTimeout(tick, 2500);
      } catch { setTimeout(tick, 4000); }
    };
    setTimeout(tick, 2000);
  }

  const setFilter = useCallback((name: string, v: unknown) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (v == null || v === "" || (Array.isArray(v) && v.length === 0)) delete next[name];
      else next[name] = v;
      return next;
    });
  }, []);

  async function interpret() {
    if (!prompt.trim()) return;
    setInterpreting(true); setError("");
    try {
      const r = await fetch("/api/prospecting/interpret", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: prompt, source }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.detail || d?.error || "Could not read that description");
      setFilters(d.filters ?? {});
      if (typeof d?.market?.total === "number") setMarket(d.market.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setInterpreting(false); }
  }

  async function runSearch() {
    setSearching(true); setError(""); setSelected(new Set());
    try {
      const r = await fetch("/api/prospecting/search", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters, source, limit: 100 }),
      });
      const d = await r.json();
      if (r.status === 402) { setWall(true); return; }
      if (!r.ok) throw new Error(d?.detail?.message || d?.detail || d?.error || "Search failed");
      setRows(Array.isArray(d.rows) ? d.rows : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally { setSearching(false); }
  }

  const rowKey = (r: Row, i: number) =>
    String(r.linkedin_url || r.domain || r.full_name || r.name || i);

  const activeCount = Object.keys(filters).length;
  const primary = PRIMARY[source].map((n) => byName[n]).filter(Boolean) as Field[];
  const rest = schema.filter((f) => !PRIMARY[source].includes(f.name));

  return (
    <div className="space-y-4">
      <ModuleHeader
        icon={LinkedInMark}
        title="Find Prospects"
        desc="Describe the market you want. Correct the filters. See who is really there."
      />

      <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)] xl:grid-cols-[400px_minmax(0,1fr)]">
        {/* ------------------------------------------------ left: filters */}
        <div className="space-y-3">
          <Panel className="p-3 space-y-2.5">
            <SectionLabel>Describe it</SectionLabel>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) interpret(); }}
              rows={3}
              placeholder="Companies in Chile that export grapes, and I want to reach the export managers"
              className="w-full resize-none rounded-lg border border-border bg-background p-2.5 text-[13px] leading-relaxed outline-none focus:border-gold/60 placeholder:text-subtle"
            />
            <button
              type="button" onClick={interpret} disabled={interpreting || !prompt.trim()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gold px-3 py-2 text-[13px] font-medium text-ink-inverse disabled:opacity-40 transition-opacity"
            >
              {interpreting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {interpreting ? "Reading your market" : "Fill the filters"}
            </button>
            <p className="text-[11px] leading-relaxed text-subtle">
              This writes the filters below. Everything here is free, so change them and
              count as often as you like. Nothing is bought until you export.
            </p>
          </Panel>

          <Panel className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Filters</SectionLabel>
              <div className="flex rounded-lg border border-border p-0.5">
                {(["people", "companies"] as Source[]).map((s) => (
                  <button key={s} type="button" onClick={() => { setSource(s); setFilters({}); setRows(null); }}
                          className={cn("rounded-md px-2 py-0.5 text-[11px] capitalize transition-colors",
                                        source === s ? "bg-gold/15 text-gold-ink" : "text-muted-foreground hover:text-foreground")}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {schema.length === 0 && <p className="text-[12px] text-subtle">Loading filters…</p>}

            {primary.map((f) => (
              <div key={f.name} className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">{label(f)}</div>
                <FieldControl field={f} value={filters[f.name]} onChange={(v) => setFilter(f.name, v)} />
              </div>
            ))}

            {rest.length > 0 && (
              <div className="pt-1">
                <button type="button" onClick={() => setShowAll((s) => !s)}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">
                  {showAll ? "Hide" : `All filters (${rest.length} more)`}
                </button>
                {showAll && (
                  <div className="mt-2.5 space-y-3 border-t border-border pt-2.5">
                    {rest.map((f) => (
                      <div key={f.name} className="space-y-1">
                        <div className="text-[11px] font-medium text-muted-foreground">{label(f)}</div>
                        {f.description && <div className="text-[10px] leading-snug text-subtle">{f.description}</div>}
                        <FieldControl field={f} value={filters[f.name]} onChange={(v) => setFilter(f.name, v)} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Panel>
        </div>

        {/* ------------------------------------------------ right: results */}
        <div className="space-y-3">
          <Panel className="flex flex-wrap items-center justify-between gap-3 p-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-subtle">Market size</div>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-semibold tabular-nums text-foreground">
                  {market == null ? "—" : market.toLocaleString()}
                </span>
                <span className="text-[11px] text-subtle">
                  {market == null ? "set a location or a title" : "people with these titles, in this geography"}
                </span>
              </div>
            </div>
            {credits && (
              // `remaining` is already the smaller of the month and the day, so this is
              // the number that will actually be honoured. When the day is what is
              // biting, say so underneath: "0 left" with 3,600 sitting in the month
              // reads as a bug and earns a support message.
              <div className="text-right">
                <div className="text-[11px] uppercase tracking-[0.18em] text-subtle">Credits left</div>
                <div className="text-lg font-semibold tabular-nums text-foreground">
                  {credits.remaining.toLocaleString()}
                  <span className="text-[11px] font-normal text-subtle"> / {credits.allowance.toLocaleString()}</span>
                </div>
                {credits.limit === "day" && credits.daily_allowance != null && (
                  <div className="text-[11px] text-subtle mt-0.5" title="A daily pace limit, so a month cannot be spent in one afternoon. It resets tomorrow.">
                    {credits.daily_remaining?.toLocaleString() ?? 0} of today&apos;s{" "}
                    {credits.daily_allowance.toLocaleString()}
                  </div>
                )}
              </div>
            )}
            <button type="button" onClick={runSearch} disabled={searching || activeCount === 0}
                    className="inline-flex items-center gap-2 rounded-lg bg-gold px-4 py-2 text-[13px] font-medium text-ink-inverse disabled:opacity-40 transition-opacity">
              {searching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              {searching ? "Searching" : "Show me who is there"}
            </button>
          </Panel>

          {error && (
            <Panel className="border-red-500/40 p-3 text-[12px] text-red-500">{error}</Panel>
          )}

          {job && (
            <Panel className="p-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px]">
                  {job.state === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-gold-ink" />}
                  {job.state === "done" && <Check className="h-3.5 w-3.5 text-gold-ink" />}
                  <span className="font-medium text-foreground">
                    {job.state === "running" && `Buying and verifying ${job.total} contacts`}
                    {job.state === "done" && `${job.written} contacts are in your list`}
                    {job.state === "error" && "The export stopped"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground tabular-nums">
                  <span>found <b className="text-foreground">{job.found}</b></span>
                  <span>verified <b className="text-foreground">{job.verified}</b></span>
                  {job.reused > 0 && <span>reused free <b className="text-foreground">{job.reused}</b></span>}
                  <span>charged <b className="text-foreground">{job.charged}</b></span>
                </div>
              </div>
              {job.state === "error" && job.error && (
                <p className="mt-2 text-[12px] text-red-500">{job.error}</p>
              )}
              {job.state === "done" && (
                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
                  {job.skipped > 0 && (
                    <>
                      {job.skipped} were left out: no address found, or it did not clear
                      verification. You were not charged for those.{" "}
                    </>
                  )}
                  Open Targeted Cold Leads to write the outreach.
                </p>
              )}
            </Panel>
          )}

          {wall && (
            <Panel className="p-5 text-center space-y-2">
              <Lock className="mx-auto h-5 w-5 text-gold-ink" />
              <div className="text-[15px] font-medium text-foreground">This preview has used its searches</div>
              <p className="mx-auto max-w-md text-[13px] leading-relaxed text-muted-foreground">
                Counting the market stays free, always. Running the list and exporting
                contacts with verified emails comes with a seat. Let us set one up for you.
              </p>
            </Panel>
          )}

          {rows && rows.length > 0 && (
            <Panel className="overflow-hidden p-0">
              <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <div className="text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">{rows.length}</span> shown
                  {selected.size > 0 && <> · <span className="font-medium text-gold-ink">{selected.size}</span> selected</>}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button"
                          onClick={() => setSelected(selected.size === rows.length ? new Set() : new Set(rows.map(rowKey)))}
                          className="rounded-md border border-border px-2 py-1 text-[12px] text-muted-foreground hover:text-foreground transition-colors">
                    {selected.size === rows.length ? "Clear" : "Select all"}
                  </button>
                  <button
                    type="button"
                    disabled={selected.size === 0 || job?.state === "running"}
                    onClick={() => { canExport ? startExport(rows, selected) : setWall(true); }}
                    title={canExport ? undefined : "Exporting contacts comes with a seat"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-gold px-3 py-1.5 text-[12px] font-medium text-ink-inverse disabled:opacity-40 transition-opacity"
                  >
                    {job?.state === "running"
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : canExport ? <Download className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    Export to pipeline
                    {/* "up to" is the honest word: a contact whose address is
                        never found, or never clears the waterfall, is not
                        charged for. */}
                    {selected.size > 0 && <span>· up to {selected.size} credits</span>}
                  </button>
                </div>
              </div>

              <div className="max-h-[62vh] overflow-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border text-[11px] uppercase tracking-[0.14em] text-subtle">
                      <th className="w-8 px-3 py-2" />
                      <th className="px-2 py-2 font-normal">{source === "people" ? "Name" : "Company"}</th>
                      {source === "people" && <th className="px-2 py-2 font-normal">Role</th>}
                      <th className="px-2 py-2 font-normal">{source === "people" ? "Company" : "Sector"}</th>
                      <th className="px-2 py-2 font-normal">Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => {
                      const k = rowKey(r, i);
                      const on = selected.has(k);
                      const company = String(r.company || r.name || "");
                      const domain = String(r.domain || "");
                      return (
                        <tr key={k}
                            onClick={() => setSelected((prev) => {
                              const n = new Set(prev); n.has(k) ? n.delete(k) : n.add(k); return n;
                            })}
                            className={cn("cursor-pointer border-b border-border/60 transition-colors hover:bg-gold/5",
                                          on && "bg-gold/10")}>
                          <td className="px-3 py-2">
                            <span className={cn("flex h-4 w-4 items-center justify-center rounded border transition-colors",
                                                on ? "border-gold bg-gold" : "border-border")}>
                              {on && <Check className="h-3 w-3 text-ink-inverse" />}
                            </span>
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center gap-2">
                              {source === "companies" && domain && <CompanyMark domain={domain} name={company} />}
                              <span className="font-medium text-foreground">
                                {String(r.full_name || r.name || "—")}
                              </span>
                            </div>
                          </td>
                          {source === "people" && (
                            <td className="px-2 py-2 text-muted-foreground">{String(r.role || "—")}</td>
                          )}
                          <td className="px-2 py-2 text-muted-foreground">
                            {source === "people" ? (
                              <div className="flex items-center gap-2">
                                {domain && <CompanyMark domain={domain} name={company} />}
                                <span>{company || "—"}</span>
                              </div>
                            ) : (String(r.sector || "—"))}
                          </td>
                          <td className="px-2 py-2 text-muted-foreground">{String(r.country || r.location || "—")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}

          {rows && rows.length === 0 && (
            <Panel className="p-8 text-center">
              <div className="text-[14px] text-foreground">Nothing came back for those filters</div>
              <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
                Usually one filter too many. Try removing the industry or widening the
                location, then count again before you search.
              </p>
            </Panel>
          )}

          {!rows && !wall && (
            <Panel className="p-10 text-center">
              {source === "people"
                ? <Users className="mx-auto h-6 w-6 text-subtle" />
                : <Building2 className="mx-auto h-6 w-6 text-subtle" />}
              <div className="mt-2 text-[14px] text-foreground">Your results will appear here</div>
              <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
                Describe the market on the left, or set the filters yourself. The counter
                above updates for free as you go.
              </p>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
