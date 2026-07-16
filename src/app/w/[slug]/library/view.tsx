"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Library,
  Building2,
  User,
  MessageSquareQuote,
  Target,
  Package,
  Sparkles,
  Layers,
  Users,
  ShieldQuestion,
  Quote,
  Link as LinkIcon,
  Phone,
  Search,
  BookMarked,
  Pencil,
  Trash2,
  Plus,
  Save,
  X,
  Loader2,
  Check,
} from "lucide-react";
import type { IntelligenceSection, IntelligenceKind } from "@/lib/portal/types";
import { ModuleHeader, Panel, Pill, SectionLabel, StatTile, cn } from "@/components/portal/ui";

// Group order + labels + icons — the reading order the agents (and the client)
// see: identity first, then who they sell to, then the evidence and raw notes.
// "playbook" leads: it's the rules of engagement every agent obeys above all,
// so it gets a distinctive gold treatment below.
const GROUPS: {
  kind: IntelligenceKind;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { kind: "playbook", label: "Rules of engagement", icon: BookMarked },
  { kind: "overview", label: "Overview", icon: Building2 },
  { kind: "founder", label: "Founder", icon: User },
  { kind: "voice", label: "Voice & tone", icon: MessageSquareQuote },
  { kind: "icp", label: "Ideal customer", icon: Target },
  { kind: "offer", label: "What they sell", icon: Package },
  { kind: "differentiator", label: "Why they win", icon: Sparkles },
  { kind: "segment", label: "Segments", icon: Layers },
  { kind: "persona", label: "Personas", icon: Users },
  { kind: "objection", label: "Objections", icon: ShieldQuestion },
  { kind: "proof", label: "Proof & recommendations", icon: Quote },
  { kind: "asset", label: "Assets & links", icon: LinkIcon },
  { kind: "call_note", label: "Call notes", icon: Phone },
  { kind: "research", label: "Research", icon: Search },
];

// The kind picker in the editor — canonical order for choosing where a new
// piece of knowledge belongs.
const KIND_OPTIONS: { value: IntelligenceKind; label: string }[] = [
  { value: "playbook", label: "Rules of engagement" },
  { value: "overview", label: "Overview" },
  { value: "founder", label: "Founder" },
  { value: "voice", label: "Voice & tone" },
  { value: "icp", label: "Ideal customer" },
  { value: "offer", label: "What they sell" },
  { value: "differentiator", label: "Why they win" },
  { value: "proof", label: "Proof & recommendations" },
  { value: "segment", label: "Segments" },
  { value: "persona", label: "Personas" },
  { value: "objection", label: "Objections" },
  { value: "asset", label: "Assets & links" },
  { value: "call_note", label: "Call notes" },
  { value: "research", label: "Research" },
];

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const URL_RE = /^https?:\/\//i;

// meta = { author, role, date, source, url… } → small muted pills; urls become links.
function MetaPills({ meta }: { meta: Record<string, string> }) {
  const entries = Object.entries(meta).filter(([, v]) => v);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {entries.map(([k, v]) =>
        URL_RE.test(v) ? (
          <a
            key={k}
            href={v}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#FFD60A]/25 bg-[#FFD60A]/10 px-2 py-0.5 text-[10px] font-semibold text-[#FFD60A] hover:bg-[#FFD60A]/20 transition-colors"
          >
            <LinkIcon className="w-2.5 h-2.5 shrink-0" />
            <span className="truncate normal-case tracking-normal">{v.replace(URL_RE, "")}</span>
          </a>
        ) : (
          <Pill key={k} tone="muted" className="max-w-full">
            <span className="opacity-60">{k}:</span>
            <span className="truncate normal-case tracking-normal">{v}</span>
          </Pill>
        )
      )}
    </div>
  );
}

// ── Editing state shapes ─────────────────────────────────────────────────
// editor.id === null → creating a new section; a string → editing that one.
type EditorState = { id: string | null; kind: IntelligenceKind; title: string; body: string };

const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.03] px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-[#FFD60A]/40 focus:outline-none";

export function IntelligenceView({
  slug,
  wsName,
  sections,
  editable,
}: {
  slug: string;
  wsName: string;
  sections: IntelligenceSection[];
  editable: boolean;
}) {
  const router = useRouter();

  // Edit chrome is opt-in even for editors: the default is the clean read view.
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

  // Delete: two-step inline confirm per card.
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  // Optimize (the copilot): one open panel at a time, suggestion held until
  // the user explicitly accepts — never auto-saved.
  const [optimizeId, setOptimizeId] = useState<string | null>(null);
  const [instruction, setInstruction] = useState("");
  const [optimizing, setOptimizing] = useState(false);
  const [optErr, setOptErr] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ title: string; body: string } | null>(null);

  const groups = GROUPS.map((g) => ({
    ...g,
    items: sections
      .filter((s) => s.kind === g.kind)
      .sort((a, b) => a.sort - b.sort),
  })).filter((g) => g.items.length > 0);

  // Most recent updatedAt across all sections — the freshness of the brain.
  const lastUpdated = sections.reduce<string>((acc, s) => {
    const t = new Date(s.updatedAt).getTime();
    if (isNaN(t)) return acc;
    return !acc || t > new Date(acc).getTime() ? s.updatedAt : acc;
  }, "");

  function closeAllChrome() {
    setEditor(null);
    setSaveErr(null);
    setConfirmId(null);
    setDeleteErr(null);
    closeOptimize();
  }

  function toggleEditMode() {
    setEditMode((on) => {
      if (on) closeAllChrome();
      return !on;
    });
  }

  function openEditor(next: EditorState) {
    closeAllChrome();
    setEditor(next);
  }

  function closeOptimize() {
    setOptimizeId(null);
    setInstruction("");
    setOptErr(null);
    setSuggestion(null);
    setOptimizing(false);
  }

  function openOptimize(id: string) {
    setEditor(null);
    setSaveErr(null);
    setConfirmId(null);
    closeOptimize();
    setOptimizeId(id);
  }

  // New sections land at the end of their group.
  function nextSort(kind: IntelligenceKind) {
    const peers = sections.filter((s) => s.kind === kind);
    return peers.length === 0 ? 0 : Math.max(...peers.map((s) => s.sort)) + 1;
  }

  // Short concatenation of the OTHER sections — gives the optimizer the rest
  // of the brain so its rewrite stays consistent. Capped ~2500 chars.
  function brainContext(excludeId: string | null) {
    return sections
      .filter((s) => s.id !== excludeId)
      .map((s) => `${s.title}: ${s.body}`)
      .join("\n\n")
      .slice(0, 2500);
  }

  async function saveEditor() {
    if (!editor) return;
    if (!editor.title.trim() || !editor.body.trim()) {
      setSaveErr("Title and body are both required.");
      return;
    }
    setSaveErr(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        slug,
        kind: editor.kind,
        title: editor.title.trim(),
        body: editor.body.trim(),
      };
      if (editor.id) {
        payload.id = editor.id;
        const existing = sections.find((s) => s.id === editor.id);
        if (existing) {
          payload.sort = existing.sort;
          if (existing.meta) payload.meta = existing.meta;
        }
      } else {
        payload.sort = nextSort(editor.kind);
      }
      const res = await fetch("/api/intelligence/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error || !json?.ok) {
        setSaveErr(json?.error || "Could not save — try again.");
        return;
      }
      setEditor(null);
      router.refresh();
    } catch {
      setSaveErr("Could not save — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSection(id: string) {
    setDeleteErr(null);
    setDeletingId(id);
    try {
      const res = await fetch("/api/intelligence/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error || !json?.ok) {
        setDeleteErr(json?.error || "Could not delete — try again.");
        return;
      }
      setConfirmId(null);
      router.refresh();
    } catch {
      setDeleteErr("Could not delete — try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function runOptimize(s: IntelligenceSection) {
    if (!instruction.trim()) {
      setOptErr("Tell the copilot what to change first.");
      return;
    }
    setOptErr(null);
    setSuggestion(null);
    setOptimizing(true);
    try {
      const res = await fetch("/api/intelligence/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          kind: s.kind,
          title: s.title,
          body: s.body,
          instruction: instruction.trim(),
          brain_context: brainContext(s.id),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.error || !json?.ok || !json?.body) {
        setOptErr(json?.error || "Optimizer offline — try again.");
        return;
      }
      setSuggestion({ title: json.title || s.title, body: json.body });
    } catch {
      setOptErr("Optimizer offline — try again.");
    } finally {
      setOptimizing(false);
    }
  }

  // Accept → load the suggestion into the editor so the user reviews, then saves.
  function acceptSuggestion(s: IntelligenceSection) {
    if (!suggestion) return;
    const next: EditorState = { id: s.id, kind: s.kind, title: suggestion.title, body: suggestion.body };
    closeOptimize();
    openEditor(next);
  }

  // ── Shared editor form (inline in the card for edits, own panel for new) ──
  function EditorForm() {
    if (!editor) return null;
    return (
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,200px)_1fr] gap-2.5">
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Kind</span>
            <select
              value={editor.kind}
              onChange={(ev) => setEditor({ ...editor, kind: ev.target.value as IntelligenceKind })}
              className={cn(inputCls, "appearance-none bg-[#0A0E1A]")}
            >
              {KIND_OPTIONS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 min-w-0">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Title</span>
            <input
              value={editor.title}
              onChange={(ev) => setEditor({ ...editor, title: ev.target.value })}
              placeholder="Give this knowledge a name"
              className={inputCls}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Body</span>
          <textarea
            value={editor.body}
            onChange={(ev) => setEditor({ ...editor, body: ev.target.value })}
            placeholder="What should every agent know?"
            rows={Math.min(16, Math.max(5, editor.body.split("\n").length + 1))}
            className={cn(inputCls, "resize-y leading-relaxed min-h-[120px]")}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveEditor}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#26D07C] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:brightness-105 disabled:opacity-60 transition"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditor(null);
              setSaveErr(null);
            }}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-white/20 disabled:opacity-60 transition"
          >
            <X className="w-4 h-4" />
            Cancel
          </button>
          {saveErr && <span className="text-[12px] text-red-400">{saveErr}</span>}
        </div>
      </div>
    );
  }

  // ── The copilot panel that lives inside a section card ──────────────────
  function OptimizePanel({ s }: { s: IntelligenceSection }) {
    return (
      <div className="mt-1 pt-3 border-t border-[#FFD60A]/20 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[#FFD60A]">
          <Sparkles className="w-3.5 h-3.5" />
          Optimize with AI
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            value={instruction}
            onChange={(ev) => setInstruction(ev.target.value)}
            onKeyDown={(ev) => {
              if (ev.key === "Enter" && !optimizing) runOptimize(s);
            }}
            placeholder="make it punchier, add this objection, tighten the voice…"
            disabled={optimizing}
            className={cn(inputCls, "flex-1")}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => runOptimize(s)}
              disabled={optimizing}
              className="inline-flex flex-1 sm:flex-none justify-center items-center gap-2 rounded-lg bg-[#FFD60A] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:brightness-105 disabled:opacity-60 transition"
            >
              {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {optimizing ? "Thinking…" : "Optimize"}
            </button>
            <button
              type="button"
              onClick={closeOptimize}
              disabled={optimizing}
              title="Close"
              className="grid place-items-center w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-white/20 disabled:opacity-60 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        {optimizing && (
          <p className="text-[11px] text-muted-foreground">
            The copilot is rewriting this section against the rest of the brain — a few seconds.
          </p>
        )}
        {optErr && <p className="text-[12px] text-red-400">{optErr}</p>}
        {suggestion && (
          <div className="rounded-lg border border-[#26D07C]/30 bg-[#26D07C]/[0.05] p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Pill tone="green">suggested</Pill>
              <span className="text-[11px] text-muted-foreground">review before it touches the brain</span>
            </div>
            <div className="text-[14px] font-semibold text-[#26D07C] leading-snug break-words">
              {suggestion.title}
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
              {suggestion.body}
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => acceptSuggestion(s)}
                className="inline-flex items-center gap-2 rounded-lg bg-[#26D07C] px-4 py-2 text-sm font-semibold text-[#0A0E1A] hover:brightness-105 transition"
              >
                <Check className="w-4 h-4" />
                Accept
              </button>
              <button
                type="button"
                onClick={() => setSuggestion(null)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:border-white/20 transition"
              >
                <X className="w-4 h-4" />
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Library}
        title="Intelligence Library"
        desc={`The living brain behind ${wsName}. Everything we know about them — who they are, how they sell, how they sound. Every agent loads this before it writes a single word.`}
        actions={
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" /> agents reading
            </span>
            {editable && (
              <button
                type="button"
                onClick={toggleEditMode}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                  editMode
                    ? "border-[#FFD60A]/40 bg-[#FFD60A]/10 text-[#FFD60A]"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-white/20"
                )}
              >
                <Pencil className="w-3.5 h-3.5" />
                {editMode ? "Done editing" : "Edit brain"}
              </button>
            )}
          </div>
        }
      />

      {/* One brain, two readers — the client and the agents see the same thing. */}
      <Panel className="p-4 border-[#26D07C]/25 flex items-start sm:items-center gap-3">
        <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#26D07C]/10 text-[#26D07C] border border-[#26D07C]/20 shrink-0">
          <Sparkles className="w-4 h-4" />
        </span>
        <p className="text-[13px] text-muted-foreground leading-relaxed">
          This is the <span className="text-[#26D07C] font-semibold">exact context</span> the reply and
          outreach agents read before generating a single line. What you see here is what they know —
          always in sync.
        </p>
      </Panel>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatTile label="Sections" value={String(sections.length)} sub="knowledge entries" />
        <StatTile label="Areas covered" value={String(groups.length)} sub={`of ${GROUPS.length} knowledge areas`} />
        <StatTile label="Last updated" value={fmtDate(lastUpdated)} sub="most recent section" tone="good" />
      </div>

      {/* Add section — the composer for brand-new knowledge. */}
      {editMode && editor && editor.id === null && (
        <Panel className="p-5 border-[#FFD60A]/30 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <SectionLabel>New section</SectionLabel>
            <Plus className="w-3.5 h-3.5 text-[#FFD60A]" />
          </div>
          <EditorForm />
        </Panel>
      )}
      {editMode && (!editor || editor.id !== null) && (
        <div>
          <button
            type="button"
            onClick={() => openEditor({ id: null, kind: "playbook", title: "", body: "" })}
            className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#FFD60A]/40 px-4 py-2 text-sm font-medium text-[#FFD60A] hover:bg-[#FFD60A]/10 transition"
          >
            <Plus className="w-4 h-4" />
            Add section
          </button>
        </div>
      )}

      {sections.length === 0 ? (
        <Panel className="p-8 flex flex-col items-center gap-3 text-center">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20">
            <Library className="w-5 h-5" />
          </span>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md">
            This library is being assembled from the onboarding call, the website and our research.
            It&apos;ll appear here — and power every reply — as soon as it&apos;s published.
          </p>
        </Panel>
      ) : (
        groups.map((g) => {
          const Icon = g.icon;
          const isPlaybook = g.kind === "playbook";
          return (
            <div key={g.kind} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                <SectionLabel>{g.label}</SectionLabel>
                <Icon className="w-3.5 h-3.5 text-[#FFD60A]" />
                <span className="text-[11px] text-muted-foreground tabular-nums">{g.items.length}</span>
                {/* Playbook steers the agents — call it out. */}
                {isPlaybook && <Pill tone="gold">steers every agent</Pill>}
                {editMode && (
                  <button
                    type="button"
                    onClick={() => openEditor({ id: null, kind: g.kind, title: "", body: "" })}
                    title={`Add to ${g.label}`}
                    className="grid place-items-center w-5 h-5 rounded-md border border-border text-muted-foreground hover:text-[#FFD60A] hover:border-[#FFD60A]/40 transition"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {g.items.map((s) => {
                  const isEditing = editMode && editor?.id === s.id;
                  const isConfirming = editMode && confirmId === s.id;
                  const isOptimizing = editMode && optimizeId === s.id;
                  return (
                    <Panel
                      key={s.id}
                      className={cn(
                        "p-5 flex flex-col gap-3 transition-colors hover:border-white/20",
                        isPlaybook && "border-[#FFD60A]/30 bg-[#FFD60A]/[0.03] hover:border-[#FFD60A]/50",
                        (isEditing || isOptimizing) && "md:col-span-2"
                      )}
                    >
                      {isEditing ? (
                        <EditorForm />
                      ) : (
                        <>
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-[15px] font-semibold text-[#FFD60A] leading-snug break-words min-w-0">
                              {s.title}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                              {editMode && (
                                <div className="flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      openEditor({ id: s.id, kind: s.kind, title: s.title, body: s.body })
                                    }
                                    title="Edit"
                                    className="grid place-items-center w-7 h-7 rounded-lg text-muted-foreground hover:text-[#FFD60A] hover:bg-[#FFD60A]/10 transition"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => (isOptimizing ? closeOptimize() : openOptimize(s.id))}
                                    title="Optimize with AI"
                                    className={cn(
                                      "grid place-items-center w-7 h-7 rounded-lg transition",
                                      isOptimizing
                                        ? "text-[#FFD60A] bg-[#FFD60A]/10"
                                        : "text-muted-foreground hover:text-[#FFD60A] hover:bg-[#FFD60A]/10"
                                    )}
                                  >
                                    <Sparkles className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDeleteErr(null);
                                      setConfirmId(isConfirming ? null : s.id);
                                    }}
                                    title="Delete"
                                    className="grid place-items-center w-7 h-7 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                {fmtDate(s.updatedAt)}
                              </span>
                            </div>
                          </div>

                          {isConfirming && (
                            <div className="rounded-lg border border-red-500/30 bg-red-500/[0.06] px-3 py-2.5 flex flex-wrap items-center gap-2">
                              <span className="text-[12px] text-red-400 font-medium">Delete this section?</span>
                              <div className="flex items-center gap-2 ml-auto">
                                <button
                                  type="button"
                                  onClick={() => deleteSection(s.id)}
                                  disabled={deletingId === s.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-60 transition"
                                >
                                  {deletingId === s.id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setConfirmId(null);
                                    setDeleteErr(null);
                                  }}
                                  disabled={deletingId === s.id}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-60 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                              {deleteErr && (
                                <span className="w-full text-[11px] text-red-400">{deleteErr}</span>
                              )}
                            </div>
                          )}

                          <p className="text-[13px] text-muted-foreground leading-relaxed whitespace-pre-wrap break-words">
                            {s.body}
                          </p>
                          {s.meta && Object.keys(s.meta).length > 0 && (
                            <div className="mt-auto pt-3 border-t border-border">
                              <MetaPills meta={s.meta} />
                            </div>
                          )}

                          {isOptimizing && <OptimizePanel s={s} />}
                        </>
                      )}
                    </Panel>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
