"use client";

import { useState, useEffect, useMemo } from "react";
import { AlertCircle, Search, Edit2, Loader2, RefreshCw, X, Check, Sparkles, ChevronUp, ChevronDown, Mail, MessageSquare, Zap, ArrowUpDown, ChevronRight, Filter, Users, Eye, Code2, Copy, CheckCircle2, ShieldAlert, ShieldCheck, Pencil, Save, RotateCcw, CalendarDays } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/lib/supabase";

const API_BASE = "https://agency-os-api.onrender.com";

// ---- Active Workspaces ----
// The Luxvance App is a per-workspace platform. It shows ONLY the workspaces we
// actively run: Luxvance's own outbound + each live client. Archived clients
// (Kcal, GFV, CAMB.AI, CapQuest, Connect Resources, Remly, ...) are hidden.
// Match is case-insensitive + substring, so "Arco Irish" / "Arco" both resolve.
// To add a workspace later, append its client-name fragment here.
const ACTIVE_WORKSPACES = ["luxvance", "arco"];
const isActiveWorkspace = (clientName: string) =>
  ACTIVE_WORKSPACES.some(w => (clientName || "").toLowerCase().includes(w));

// ---- Tier Helpers ----
type TierLabel = "Excellent" | "Good" | "Average" | "Below Avg" | "Critical" | "Evaluating";

interface TierInfo {
  label: TierLabel;
  colBg: string;
  textCol: string;
  emoji: string;
  order: number;
  color: string; // hex for pill bg
}

function computeTier(sent: number, opportunities: number): TierInfo {
  if (opportunities > 0) {
    const r = sent / opportunities;
    if (r <= 300) return { label: "Excellent", colBg: "bg-emerald-500/10", textCol: "text-emerald-500", emoji: "🤩", order: 4, color: "#10b981" };
    if (r <= 600) return { label: "Good", colBg: "bg-blue-500/10", textCol: "text-blue-500", emoji: "🙂", order: 3, color: "#3b82f6" };
    if (r <= 900) return { label: "Average", colBg: "bg-amber-500/10", textCol: "text-amber-500", emoji: "😐", order: 2, color: "#f59e0b" };
    if (r <= 1200) return { label: "Below Avg", colBg: "bg-orange-500/10", textCol: "text-orange-500", emoji: "📉", order: 1, color: "#f97316" };
    return { label: "Critical", colBg: "bg-red-500/10", textCol: "text-red-500", emoji: "🚨", order: 0, color: "#ef4444" };
  }
  if (sent > 600) return { label: "Critical", colBg: "bg-red-500/10", textCol: "text-red-500", emoji: "🚨", order: 0, color: "#ef4444" };
  return { label: "Evaluating", colBg: "bg-secondary", textCol: "text-muted-foreground", emoji: "⏳", order: 5, color: "#6b7280" };
}

const TIER_CONFIG: { label: TierLabel; emoji: string; color: string; borderColor: string }[] = [
  { label: "Critical", emoji: "🚨", color: "bg-red-500/10 text-red-400", borderColor: "border-red-500/30" },
  { label: "Below Avg", emoji: "📉", color: "bg-orange-500/10 text-orange-400", borderColor: "border-orange-500/30" },
  { label: "Average", emoji: "😐", color: "bg-amber-500/10 text-amber-400", borderColor: "border-amber-500/30" },
  { label: "Good", emoji: "🙂", color: "bg-blue-500/10 text-blue-400", borderColor: "border-blue-500/30" },
  { label: "Excellent", emoji: "🤩", color: "bg-emerald-500/10 text-emerald-400", borderColor: "border-emerald-500/30" },
  { label: "Evaluating", emoji: "⏳", color: "bg-secondary text-muted-foreground", borderColor: "border-border" },
];

// ---- Smart Name Parser ----
function parseCurrentName(name: string, clientName: string) {
  let rest = name;
  if (rest.toLowerCase().startsWith(clientName.toLowerCase())) rest = rest.slice(clientName.length).replace(/^\s*[–\-]\s*/, "");
  const parts = rest.split(/\s*[–\-]\s*/).map(s => s.trim()).filter(Boolean);
  let week = "";
  const weekIdx = parts.findIndex(p => /^W\d+$/i.test(p.trim()));
  if (weekIdx !== -1) week = parts.splice(weekIdx, 1)[0].trim();
  const locationTokens = ["uk","usa","uae","europe","germany","kenya","belgium","france","spain","italy","netherlands","canada","australia","india","singapore","saudi arabia","ksa","qatar","oman","bahrain","kuwait","jordan","south africa","nigeria","egypt","mexico","brazil","mena","gcc","apac","latam","emea","nordics","dach","lithuania"];
  let persona = "", location = "", offer = "";
  const locIdx = parts.findIndex(p => locationTokens.includes(p.toLowerCase()));
  if (locIdx !== -1) location = parts.splice(locIdx, 1)[0];
  if (parts.length >= 2) { persona = parts[0]; offer = parts.slice(1).join(" – "); }
  else if (parts.length === 1) { offer = parts[0]; }
  return { persona, location, offer, week };
}
function buildPreviewName(client: string, persona: string, location: string, offer: string, week: string) {
  return [client, persona, location, offer, week].filter(Boolean).join(" – ");
}

// ---- Reply Category Badge ----
function ReplyCategoryBadge({ category }: { category: string }) {
  const cat = category.toLowerCase();
  let color = "bg-secondary text-muted-foreground border-border";
  if (cat.includes("positive") || cat.includes("sql")) color = "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
  else if (cat.includes("mql")) color = "bg-amber-500/10 text-amber-500 border-amber-500/20";
  else if (cat.includes("negative") || cat.includes("not interested")) color = "bg-red-500/10 text-red-500 border-red-500/20";
  else if (cat.includes("out of office") || cat.includes("ooo")) color = "bg-gray-500/10 text-gray-400 border-gray-500/20";
  else if (cat.includes("bounce")) color = "bg-orange-500/10 text-orange-500 border-orange-500/20";
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${color} uppercase tracking-wider`}>{category}</span>;
}

// ---- Types ----
interface CampaignItem { id: string; name: string; client: string; sent: number; open: string; reply: string; opportunities: number; replies: number; copyErrors: string[]; isCompliant: boolean; status: string; }
interface ReplyItem { category: string; first_name: string; last_name: string; email: string; job_title: string; company_name: string; outbound_email: string; inbound_email: string; reply_date: string; campaign_name: string; personalized_line?: string; }
interface SequenceStep { step: number; delay: number; variants: { subject: string; body: string; body_raw?: string; is_active?: boolean }[]; }
interface CopyIssue { severity: string; type: string; message: string; variable?: string; }
interface CopyAuditVariant { variant: string; is_active: boolean; issues: CopyIssue[]; issue_count: number; }
interface CopyAuditStep { step: number; delay: number; variants: CopyAuditVariant[]; }
interface CopyAudit { total_issues: number; critical: number; warnings: number; info: number; steps: CopyAuditStep[]; }
interface DailyAnalytics { day_number: number; date: string; sent: number; opened: number; replies: number; opportunities: number; }
interface CampaignDetail { sequences: SequenceStep[]; replies: ReplyItem[]; reply_summary: { total: number; positive: number; mql: number; negative: number; ooo: number; bounced: number; other: number }; copy_audit?: CopyAudit | null; daily_analytics?: DailyAnalytics[]; }
type ReplyCategoryFilter = "all" | "positive" | "mql" | "negative" | "ooo" | "other";

type SortKey = "tier" | "sent" | "reply" | "name";
type SortDir = "asc" | "desc";
type StatusFilter = "all" | "active" | "paused" | "completed" | "violations" | "copyQA";

export default function CampaignsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [selectedTiers, setSelectedTiers] = useState<Set<TierLabel>>(new Set());
  const [clientDropdownOpen, setClientDropdownOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>("tier");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Fix Naming Modal
  const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
  const [namingCampaign, setNamingCampaign] = useState<CampaignItem | null>(null);
  const [namingFields, setNamingFields] = useState({ persona: "", location: "", offer: "", week: "" });
  const [namingLoading, setNamingLoading] = useState(false);
  const [namingResult, setNamingResult] = useState<{ success: boolean; message: string } | null>(null);

  // Campaign Detail Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerCampaign, setDrawerCampaign] = useState<CampaignItem | null>(null);
  const [drawerTab, setDrawerTab] = useState<"daily" | "copy" | "replies" | "optimize">("daily");
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerData, setDrawerData] = useState<CampaignDetail | null>(null);
  const [drawerOptResult, setDrawerOptResult] = useState<string | null>(null);
  const [drawerOptLoading, setDrawerOptLoading] = useState(false);
  const [replyCategoryFilter, setReplyCategoryFilter] = useState<ReplyCategoryFilter>("all");
  const [showRawCopy, setShowRawCopy] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<string | null>(null);

  // Copy editing state
  const [editingVariant, setEditingVariant] = useState<string | null>(null); // "stepIdx-varIdx"
  const [editSubject, setEditSubject] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editResult, setEditResult] = useState<{ success: boolean; message: string } | null>(null);

  // Copy QA Intelligence Cache
  const [copyQACache, setCopyQACache] = useState<Map<string, CopyAudit>>(new Map());
  const [copyQAScanning, setCopyQAScanning] = useState(false);
  const [copyQAScanProgress, setCopyQAScanProgress] = useState({ done: 0, total: 0 });

  // Filtered replies based on selected category
  const filteredReplies = useMemo(() => {
    if (!drawerData?.replies) return [];
    if (replyCategoryFilter === "all") return drawerData.replies;
    return drawerData.replies.filter(r => {
      const cat = r.category.toLowerCase();
      if (replyCategoryFilter === "positive") return cat.includes("positive") || cat.includes("sql");
      if (replyCategoryFilter === "mql") return cat.includes("mql");
      if (replyCategoryFilter === "negative") return cat.includes("negative") || cat.includes("not interested");
      if (replyCategoryFilter === "ooo") return cat.includes("out of office") || cat.includes("ooo") || cat.includes("bounce");
      return true;
    });
  }, [drawerData?.replies, replyCategoryFilter]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(id);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const startEditing = (stepIdx: number, varIdx: number, subject: string, body: string) => {
    setEditingVariant(`${stepIdx}-${varIdx}`);
    setEditSubject(subject);
    setEditBody(body);
    setEditResult(null);
  };

  const cancelEditing = () => { setEditingVariant(null); setEditResult(null); };

  const saveVariant = async (stepIdx: number, varIdx: number) => {
    if (!drawerCampaign) return;
    setEditSaving(true);
    setEditResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/update-variant`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: drawerCampaign.id,
          client_name: drawerCampaign.client,
          step_index: stepIdx,
          variant_index: varIdx,
          new_subject: editSubject,
          new_body: editBody,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEditResult({ success: true, message: "✅ Copy updated in Instantly!" });
        // Refresh drawer data
        setTimeout(() => { setEditingVariant(null); openDrawer(drawerCampaign); }, 1500);
      } else {
        setEditResult({ success: false, message: data.message || "Failed to update" });
      }
    } catch (err: any) {
      setEditResult({ success: false, message: `❌ Error: ${err.message}` });
    } finally { setEditSaving(false); }
  };

  const namingPreview = useMemo(() => {
    if (!namingCampaign) return "";
    return buildPreviewName(namingCampaign.client, namingFields.persona, namingFields.location, namingFields.offer, namingFields.week);
  }, [namingCampaign, namingFields]);

  // Extract unique clients
  const uniqueClients = useMemo(() => {
    const clients = [...new Set(campaigns.map(c => c.client))].sort();
    return clients;
  }, [campaigns]);

  // ---- Handlers ----
  const openNamingModal = (campaign: CampaignItem) => {
    const parsed = parseCurrentName(campaign.name, campaign.client);
    setNamingFields(parsed);
    setNamingCampaign(campaign);
    setNamingResult(null);
    setIsNamingModalOpen(true);
  };

  const handleFixNaming = async () => {
    if (!namingCampaign || !namingPreview) return;
    setNamingLoading(true);
    setNamingResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/fix-naming`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign_id: namingCampaign.id, new_name: namingPreview, client_name: namingCampaign.client }) });
      const data = await res.json();
      if (data.success) {
        setNamingResult({ success: true, message: "✅ Campaign renamed across Instantly, Supabase & Notion!" });
        setTimeout(() => { setIsNamingModalOpen(false); fetchCampaigns(); }, 1500);
      } else {
        const errors = [!data.instantly?.success && `Instantly: ${data.instantly?.error}`, !data.supabase?.success && `Supabase: ${data.supabase?.error}`, !data.notion?.success && `Notion: ${data.notion?.error}`].filter(Boolean).join(" | ");
        setNamingResult({ success: false, message: `⚠️ Partial failure: ${errors}` });
      }
    } catch (err: any) {
      setNamingResult({ success: false, message: `❌ Network error: ${err.message}` });
    } finally { setNamingLoading(false); }
  };

  const openDrawer = async (campaign: CampaignItem) => {
    setDrawerCampaign(campaign);
    setDrawerTab("daily");
    setDrawerData(null);
    setDrawerOptResult(null);
    setReplyCategoryFilter("all");
    setShowRawCopy(false);
    setDrawerOpen(true);
    setDrawerLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/campaigns/detail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign_id: campaign.id, client_name: campaign.client, campaign_name: campaign.name }) });
      const data = await res.json();
      setDrawerData(data);
      // Cache the copy audit result for the Action Center badge
      if (data.copy_audit) {
        setCopyQACache(prev => {
          const next = new Map(prev);
          next.set(campaign.id, data.copy_audit);
          return next;
        });
      }
    } catch (err) { console.error("Failed to load campaign detail", err); }
    finally { setDrawerLoading(false); }
  };

  // Batch scan all active campaigns for Copy QA issues
  const scanActiveCopyQA = async () => {
    const activeCampaigns = campaigns.filter(c => c.status.toLowerCase() === 'active');
    setCopyQAScanning(true);
    setCopyQAScanProgress({ done: 0, total: activeCampaigns.length });
    for (let i = 0; i < activeCampaigns.length; i++) {
      const c = activeCampaigns[i];
      if (copyQACache.has(c.id)) {
        setCopyQAScanProgress(p => ({ ...p, done: p.done + 1 }));
        continue; // Already cached
      }
      try {
        const res = await fetch(`${API_BASE}/api/campaigns/detail`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaign_id: c.id, client_name: c.client, campaign_name: c.name }) });
        const data = await res.json();
        if (data.copy_audit) {
          setCopyQACache(prev => {
            const next = new Map(prev);
            next.set(c.id, data.copy_audit);
            return next;
          });
        }
      } catch (err) { console.error(`Copy QA scan failed for ${c.name}`, err); }
      setCopyQAScanProgress(p => ({ ...p, done: p.done + 1 }));
    }
    setCopyQAScanning(false);
  };

  const handleDrawerOptimize = async () => {
    if (!drawerCampaign) return;
    setDrawerOptLoading(true);
    setDrawerOptResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/copilot/optimize`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_name: drawerCampaign.client.trim(), campaign_name: drawerCampaign.name.trim(), campaign_id: drawerCampaign.id }) });
      const data = await res.json();
      setDrawerOptResult(data.markdown || `❌ Error: ${JSON.stringify(data)}`);
    } catch (err: any) { setDrawerOptResult(`❌ Failed: ${err.message}`); }
    finally { setDrawerOptLoading(false); }
  };

  const fetchCampaigns = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("campaigns").select(`id, campaign_name, emails_sent, open_rate, reply_rate, opportunities, replies, copy_errors, is_compliant, status, clients(name)`).order('last_updated', { ascending: false });
    if (error) console.error("Error fetching campaigns:", error);
    else if (data) {
      setCampaigns(data
        .map((c: any) => ({
          id: c.id, name: c.campaign_name, client: c.clients?.name || "Unknown",
          sent: c.emails_sent, open: c.open_rate, reply: c.reply_rate,
          opportunities: c.opportunities || 0, replies: c.replies || 0,
          copyErrors: Array.isArray(c.copy_errors) ? c.copy_errors : [],
          isCompliant: c.is_compliant, status: c.status || 'Active'
        }))
        .filter((c) => isActiveWorkspace(c.client)));
    }
    setLoading(false);
  };

  useEffect(() => { fetchCampaigns(); }, []);

  // Close client dropdown on outside click
  useEffect(() => {
    if (!clientDropdownOpen) return;
    const handler = () => setClientDropdownOpen(false);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [clientDropdownOpen]);

  // ---- Sort helpers ----
  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(key === "tier" ? "asc" : "desc"); }
  };
  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="w-3 h-3 ml-1" /> : <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const toggleTier = (tier: TierLabel) => {
    setSelectedTiers(prev => {
      const next = new Set(prev);
      if (next.has(tier)) next.delete(tier);
      else next.add(tier);
      return next;
    });
  };

  // ---- Filtering + Sorting ----
  const filtered = useMemo(() => {
    // Compute campaigns with copy QA issues (from cache)
    const copyQAIssueCampaignIds = new Set(
      Array.from(copyQACache.entries())
        .filter(([_, audit]) => audit.critical > 0 || audit.warnings > 0)
        .map(([id]) => id)
    );

    let list = campaigns.filter(c => {
      // Status filter
      if (statusFilter === "violations") return !c.isCompliant && c.status.toLowerCase() === 'active';
      if (statusFilter === "copyQA") return copyQAIssueCampaignIds.has(c.id);
      if (statusFilter !== "all" && c.status.toLowerCase() !== statusFilter) return false;
      return true;
    });
    // Client filter
    if (selectedClient !== "all") list = list.filter(c => c.client === selectedClient);
    // Tier filter
    if (selectedTiers.size > 0) list = list.filter(c => selectedTiers.has(computeTier(c.sent, c.opportunities).label));
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.client.toLowerCase().includes(q));
    }
    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "tier") { cmp = computeTier(a.sent, a.opportunities).order - computeTier(b.sent, b.opportunities).order; }
      else if (sortKey === "sent") { cmp = a.sent - b.sent; }
      else if (sortKey === "reply") { cmp = parseFloat(a.reply) - parseFloat(b.reply); }
      else if (sortKey === "name") { cmp = a.name.localeCompare(b.name); }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [campaigns, statusFilter, selectedClient, selectedTiers, searchQuery, sortKey, sortDir, copyQACache]);

  // Tier counts for filter pills
  const tierCounts = useMemo(() => {
    const counts: Record<TierLabel, number> = { Critical: 0, "Below Avg": 0, Average: 0, Good: 0, Excellent: 0, Evaluating: 0 };
    let base = campaigns.filter(c => {
      if (statusFilter === "violations") return !c.isCompliant && c.status.toLowerCase() === 'active';
      if (statusFilter === "copyQA") return copyQACache.has(c.id);
      if (statusFilter !== "all" && c.status.toLowerCase() !== statusFilter) return false;
      if (selectedClient !== "all" && c.client !== selectedClient) return false;
      return true;
    });
    base.forEach(c => { counts[computeTier(c.sent, c.opportunities).label]++; });
    return counts;
  }, [campaigns, statusFilter, selectedClient, copyQACache]);

  const activeFilterCount = (selectedClient !== "all" ? 1 : 0) + selectedTiers.size;

  return (
    <div className="space-y-5 max-w-7xl mx-auto h-full flex flex-col">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campaign Monitor</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{filtered.length} of {campaigns.length} campaigns</p>
        </div>
        <div className="flex space-x-2 items-center">
          <button onClick={fetchCampaigns} className="px-3 py-2 text-sm font-medium rounded-md transition-colors bg-secondary border border-border text-foreground hover:bg-secondary/70 flex items-center" title="Refresh">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex bg-card border border-border rounded-md p-1">
            {(["active", "paused", "all"] as const).map(f => (
              <button key={f} onClick={() => setStatusFilter(f)} className={`px-4 py-1.5 text-sm font-medium rounded-sm transition-colors capitalize ${statusFilter === f ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}>{f}</button>
            ))}
          </div>
          {/* Naming Violations Badge — active campaigns only */}
          {(() => {
            const activeViolations = campaigns.filter(c => !c.isCompliant && c.status.toLowerCase() === 'active').length;
            return activeViolations > 0 ? (
              <button onClick={() => setStatusFilter(statusFilter === "violations" ? "active" : "violations")} className={`px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${statusFilter === "violations" ? "bg-destructive text-destructive-foreground shadow-sm ring-2 ring-destructive/30" : "bg-card border border-border text-foreground hover:bg-destructive/10 hover:border-destructive/30"}`}>
                <AlertCircle className="w-4 h-4" />
                <span>Naming</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${statusFilter === "violations" ? "bg-white/20" : "bg-destructive/10 text-destructive"}`}>{activeViolations}</span>
              </button>
            ) : null;
          })()}
          {/* Copy QA — Unified Smart Button */}
          {(() => {
            const issueCount = Array.from(copyQACache.entries()).filter(([id, audit]) => {
              const camp = campaigns.find(c => c.id === id);
              return camp && camp.status.toLowerCase() === 'active' && (audit.critical > 0 || audit.warnings > 0);
            }).length;
            const scannedCount = Array.from(copyQACache.keys()).filter(id => {
              const camp = campaigns.find(c => c.id === id);
              return camp && camp.status.toLowerCase() === 'active';
            }).length;
            const totalActive = campaigns.filter(c => c.status.toLowerCase() === 'active').length;
            const isFullyScanned = scannedCount >= totalActive && totalActive > 0;

            // State: SCANNING
            if (copyQAScanning) return (
              <div className="px-3 py-2 flex items-center gap-2 text-xs text-primary bg-primary/5 border border-primary/20 rounded-md animate-pulse">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="font-medium">Scanning {copyQAScanProgress.done}/{copyQAScanProgress.total}</span>
                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${copyQAScanProgress.total > 0 ? (copyQAScanProgress.done / copyQAScanProgress.total) * 100 : 0}%` }} />
                </div>
              </div>
            );

            // State: SCANNED — has issues
            if (isFullyScanned && issueCount > 0) return (
              <button onClick={() => setStatusFilter(statusFilter === "copyQA" ? "active" : "copyQA")} className={`px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 ${statusFilter === "copyQA" ? "bg-amber-500 text-white shadow-md ring-2 ring-amber-500/30" : "bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500/20 hover:shadow-md hover:shadow-amber-500/10"}`}>
                <ShieldAlert className="w-4 h-4" />
                <span>Copy QA</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${statusFilter === "copyQA" ? "bg-white/20" : "bg-amber-500/20"}`}>{issueCount} {issueCount === 1 ? 'issue' : 'issues'}</span>
              </button>
            );

            // State: SCANNED — all clean
            if (isFullyScanned && issueCount === 0) return (
              <button onClick={scanActiveCopyQA} className="px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20" title="Re-scan all active campaigns">
                <ShieldCheck className="w-4 h-4" />
                <span>Copy QA</span>
                <span className="text-[10px]">✓ All Clean</span>
              </button>
            );

            // State: NOT SCANNED or partially scanned
            return (
              <button onClick={scanActiveCopyQA} className="px-3 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 hover:border-primary/50 hover:shadow-md hover:shadow-primary/10">
                <ShieldAlert className="w-4 h-4" />
                <span>Copy QA</span>
                {scannedCount > 0 ? (
                  <span className="text-[9px] text-primary/60">{scannedCount}/{totalActive}</span>
                ) : (
                  <span className="text-[10px] font-normal text-primary/60">Scan</span>
                )}
              </button>
            );
          })()}
        </div>
      </div>

      {/* ====== SMART FILTER BAR ====== */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search campaigns..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 focus:ring-offset-background transition-all"
          />
        </div>

        {/* Client Dropdown */}
        <div className="relative" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setClientDropdownOpen(!clientDropdownOpen)}
            className={`h-9 inline-flex items-center gap-2 px-3 text-sm font-medium rounded-lg border transition-all ${
              selectedClient !== "all"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            {selectedClient !== "all" ? selectedClient : "All Clients"}
            <ChevronDown className={`w-3 h-3 transition-transform ${clientDropdownOpen ? "rotate-180" : ""}`} />
          </button>
          {clientDropdownOpen && (
            <div className="absolute top-11 left-0 z-30 w-56 bg-card border border-border rounded-lg shadow-xl py-1 animate-in fade-in-0 zoom-in-95 duration-150">
              <button
                onClick={() => { setSelectedClient("all"); setClientDropdownOpen(false); }}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between ${selectedClient === "all" ? "text-primary font-medium" : "text-foreground"}`}
              >
                All Clients
                {selectedClient === "all" && <Check className="w-3.5 h-3.5 text-primary" />}
              </button>
              <div className="border-t border-border my-1" />
              {uniqueClients.map(client => (
                <button
                  key={client}
                  onClick={() => { setSelectedClient(client); setClientDropdownOpen(false); }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-secondary transition-colors flex items-center justify-between ${selectedClient === client ? "text-primary font-medium" : "text-foreground"}`}
                >
                  {client}
                  {selectedClient === client && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="w-px h-6 bg-border" />

        {/* Tier Filter Pills */}
        {TIER_CONFIG.map(tier => {
          const count = tierCounts[tier.label];
          const isActive = selectedTiers.has(tier.label);
          return (
            <button
              key={tier.label}
              onClick={() => toggleTier(tier.label)}
              className={`h-9 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${
                isActive
                  ? `${tier.color} ${tier.borderColor} ring-1 ring-offset-1 ring-offset-background`
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
              }`}
              title={`${tier.label}: ${count} campaigns`}
            >
              <span>{tier.emoji}</span>
              <span>{tier.label}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/10" : "bg-secondary"}`}>{count}</span>
            </button>
          );
        })}

        {/* Clear Filters */}
        {activeFilterCount > 0 && (
          <button
            onClick={() => { setSelectedClient("all"); setSelectedTiers(new Set()); setSearchQuery(""); }}
            className="h-9 inline-flex items-center gap-1 px-3 text-xs font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-transparent hover:border-border transition-all"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* ====== TABLE ====== */}
      <div className="rounded-lg border border-border shrink-0 overflow-hidden relative min-h-[400px]">
        {loading && campaigns.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-card"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-medium border-b border-border">
              <tr>
                <th className="px-4 py-3 w-[42%] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("name")}>
                  <span className="inline-flex items-center">Campaign <SortIcon col="name" /></span>
                </th>
                <th className="px-4 py-3 w-[12%]">Client</th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("sent")}>
                  <span className="inline-flex items-center">Outreach <SortIcon col="sent" /></span>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("reply")}>
                  <span className="inline-flex items-center">Engagement <SortIcon col="reply" /></span>
                </th>
                <th className="px-4 py-3 cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("tier")}>
                  <span className="inline-flex items-center">Tier <SortIcon col="tier" /></span>
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {filtered.map(campaign => {
                const replyRateFloat = parseFloat(campaign.reply);
                const isReplyLow = !isNaN(replyRateFloat) && replyRateFloat < 0.5 && campaign.sent > 100;
                const tier = computeTier(campaign.sent, campaign.opportunities);
                const repliedCountApprox = campaign.replies > 0 ? campaign.replies : Math.floor(campaign.sent * (replyRateFloat / 100));
                let posRate = 0;
                if (repliedCountApprox > 0) posRate = (campaign.opportunities / repliedCountApprox) * 100;

                return (
                  <tr key={campaign.id} className="hover:bg-secondary/30 transition-colors cursor-pointer group" onClick={() => openDrawer(campaign)}>
                    <td className={`px-4 py-3.5 font-medium ${!campaign.isCompliant ? 'text-destructive' : 'text-foreground'}`}>
                      <div className="flex items-center space-x-2">
                        <span className="truncate">{campaign.name}</span>
                        {!campaign.isCompliant && <span title="Non-standard naming" className="text-destructive/70 shrink-0">⚠️</span>}
                        {campaign.copyErrors.length > 0 && (
                          <div title={campaign.copyErrors.join('\n')} className="bg-amber-500/10 text-amber-500 border border-amber-500/20 p-1 rounded-full shrink-0"><AlertCircle className="w-3.5 h-3.5" /></div>
                        )}
                        {/* Copy QA indicator from cache */}
                        {(() => {
                          const audit = copyQACache.get(campaign.id);
                          if (!audit) return null;
                          const hasIssues = audit.critical > 0 || audit.warnings > 0;
                          return hasIssues ? (
                            <span title={`${audit.critical} critical · ${audit.warnings} warnings`} className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0">
                              <ShieldAlert className="w-2.5 h-2.5" />{audit.critical + audit.warnings}
                            </span>
                          ) : (
                            <span title="Copy QA passed" className="inline-flex items-center text-[9px] text-emerald-500/70 shrink-0">
                              <ShieldCheck className="w-3 h-3" />
                            </span>
                          );
                        })()}
                        {campaign.status !== 'Active' && (
                          <span className="text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 border border-border">{campaign.status}</span>
                        )}
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-auto" />
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground text-xs">{campaign.client}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold">{campaign.sent.toLocaleString()}</span>
                        <span className="text-[11px] text-muted-foreground font-medium mt-0.5">{campaign.open} Open</span>
                      </div>
                    </td>
                    <td className={`px-4 py-3.5 ${isReplyLow ? 'text-destructive font-semibold' : ''}`}>
                      <div className="flex space-x-5 items-center">
                        <div className="flex flex-col items-center">
                          <span className="text-sm font-bold flex items-center"><span className="text-xs mr-1 opacity-70">💬</span> {campaign.replies}</span>
                          <div className="flex items-center space-x-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-medium bg-secondary/50 px-1 rounded">{campaign.reply} Rate</span>
                            {isReplyLow && <AlertCircle className="w-3 h-3 text-destructive" />}
                          </div>
                        </div>
                        <div className={`flex flex-col items-center ${campaign.opportunities > 0 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          <span className="text-sm font-bold flex items-center"><span className="text-xs mr-1 opacity-70">💼</span> {campaign.opportunities}</span>
                          <span className={`text-[10px] font-medium mt-0.5 px-1 rounded ${campaign.opportunities > 0 ? 'bg-amber-500/10' : 'bg-secondary/50'}`}>
                            {campaign.opportunities > 0 ? `${posRate.toFixed(1)}%` : '0%'}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded-md border ${tier.colBg.replace('/10', '/20')} ${tier.colBg} ${tier.textCol}`}>
                        <span>{tier.label}</span> <span>{tier.emoji}</span>
                      </span>
                      {campaign.opportunities > 0 && (
                        <p className="text-[10px] text-muted-foreground mt-1 font-medium">1:{Math.round(campaign.sent / campaign.opportunities)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right space-x-1.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => { openDrawer(campaign); setTimeout(() => setDrawerTab("optimize"), 100); }}
                        className="inline-flex items-center text-xs bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2.5 py-1.5 rounded-md hover:bg-amber-500/20 transition-colors font-medium">
                        ✨ Optimize
                      </button>
                      {!campaign.isCompliant ? (
                        <button onClick={() => openNamingModal(campaign)}
                          className="inline-flex items-center text-xs bg-primary text-primary-foreground px-2.5 py-1.5 rounded-md hover:bg-primary/90 transition-colors font-medium">
                          <Edit2 className="w-3 h-3 mr-1" /> Fix
                        </button>
                      ) : (
                        <button onClick={() => openDrawer(campaign)} className="text-xs text-muted-foreground hover:text-foreground px-1.5">Detail</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-16 text-muted-foreground">
                  <Filter className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No campaigns match your filters</p>
                  <p className="text-xs mt-1 text-muted-foreground">Try adjusting client, tier, or search criteria</p>
                </td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ==================== CAMPAIGN DETAIL DRAWER ==================== */}
      {drawerOpen && drawerCampaign && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <div className="fixed top-0 right-0 z-50 h-full w-full max-w-2xl bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border bg-secondary/30 flex items-start justify-between shrink-0">
              <div className="flex-1 min-w-0 mr-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">{drawerCampaign.client}</p>
                <h3 className="font-semibold text-base text-foreground truncate">{drawerCampaign.name}</h3>
                <div className="flex items-center space-x-3 mt-2">
                  <span className="text-xs text-muted-foreground">{drawerCampaign.sent.toLocaleString()} sent</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-muted-foreground">{drawerCampaign.reply} reply rate</span>
                  <span className="text-xs text-muted-foreground">·</span>
                  <span className="text-xs text-amber-500 font-medium">{drawerCampaign.opportunities} opps</span>
                </div>
              </div>
              <button onClick={() => setDrawerOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-md hover:bg-secondary shrink-0"><X className="w-5 h-5" /></button>
            </div>
            {/* Tabs */}
            <div className="flex border-b border-border shrink-0">
              {([
                { key: "daily" as const, icon: <CalendarDays className="w-4 h-4 mr-1.5" />, label: "Daily Analytics" },
                { key: "copy" as const, icon: <Mail className="w-4 h-4 mr-1.5" />, label: "Current Copy" },
                { key: "replies" as const, icon: <MessageSquare className="w-4 h-4 mr-1.5" />, label: `Replies${drawerData?.reply_summary?.total ? ` (${drawerData.reply_summary.total})` : ''}` },
                { key: "optimize" as const, icon: <Zap className="w-4 h-4 mr-1.5" />, label: "Optimize" },
              ]).map(tab => (
                <button key={tab.key} onClick={() => setDrawerTab(tab.key)}
                  className={`flex-1 flex items-center justify-center px-4 py-3 text-sm font-medium transition-colors ${drawerTab === tab.key ? "text-primary border-b-2 border-primary bg-primary/5" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`}
                >{tab.icon}{tab.label}</button>
              ))}
            </div>
            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {drawerLoading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" /><p className="animate-pulse font-medium">Loading campaign intelligence...</p>
                </div>
              ) : (
                <>
                  {/* TAB: Daily Breakdown */}
                  {drawerTab === "daily" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center"><CalendarDays className="w-4 h-4 mr-2 text-primary" />Daily Analytics</h4>
                        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">from Instantly</span>
                      </div>
                      
                      {!drawerData?.daily_analytics || drawerData.daily_analytics.length === 0 ? (
                        <div className="bg-secondary/30 rounded-lg border border-border p-8 text-center">
                          <p className="text-sm font-medium text-muted-foreground">No daily analytics available for this campaign.</p>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-border overflow-hidden">
                          <table className="w-full text-sm text-left">
                            <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase font-medium border-b border-border">
                              <tr>
                                <th className="px-4 py-3">Day</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3">Sent</th>
                                <th className="px-4 py-3">Replies</th>
                                <th className="px-4 py-3">Opportunities</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border bg-card">
                              {drawerData.daily_analytics.map((day, idx) => (
                                <tr key={idx} className="hover:bg-secondary/30 transition-colors">
                                  <td className="px-4 py-3 font-medium text-foreground">Day {day.day_number}</td>
                                  <td className="px-4 py-3 text-muted-foreground">{new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                                  <td className="px-4 py-3">{day.sent.toLocaleString()}</td>
                                  <td className="px-4 py-3 font-semibold">{day.replies}</td>
                                  <td className="px-4 py-3">
                                    {day.opportunities > 0 ? (
                                      <span className="inline-flex items-center text-amber-500 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full text-xs">
                                        💼 {day.opportunities}
                                      </span>
                                    ) : (
                                      <span className="text-muted-foreground">0</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB: Copy */}
                  {drawerTab === "copy" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center"><Mail className="w-4 h-4 mr-2 text-primary" />Current Copy</h4>
                        <div className="flex items-center gap-2">
                          <div className="flex bg-secondary border border-border rounded-md p-0.5">
                            <button onClick={() => setShowRawCopy(false)} className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-sm transition-colors ${!showRawCopy ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                              <Eye className="w-3 h-3" /> Preview
                            </button>
                            <button onClick={() => setShowRawCopy(true)} className={`flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-sm transition-colors ${showRawCopy ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                              <Code2 className="w-3 h-3" /> Source
                            </button>
                          </div>
                          <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">from Instantly</span>
                        </div>
                      </div>

                      {/* Copy QA Audit Summary */}
                      {drawerData?.copy_audit && drawerData.copy_audit.total_issues > 0 && (
                        <div className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border ${
                          drawerData.copy_audit.critical > 0
                            ? "bg-red-500/5 border-red-500/20"
                            : drawerData.copy_audit.warnings > 0
                            ? "bg-amber-500/5 border-amber-500/20"
                            : "bg-blue-500/5 border-blue-500/20"
                        }`}>
                          <ShieldAlert className={`w-4 h-4 shrink-0 ${drawerData.copy_audit.critical > 0 ? "text-red-500" : "text-amber-500"}`} />
                          <span className="text-xs font-semibold text-foreground">Copy QA:</span>
                          {drawerData.copy_audit.critical > 0 && <span className="text-xs text-red-500 font-semibold">{drawerData.copy_audit.critical} critical</span>}
                          {drawerData.copy_audit.warnings > 0 && <span className="text-xs text-amber-500 font-medium">{drawerData.copy_audit.warnings} warnings</span>}
                          {drawerData.copy_audit.info > 0 && <span className="text-xs text-muted-foreground">{drawerData.copy_audit.info} info</span>}
                        </div>
                      )}
                      {drawerData?.copy_audit && drawerData.copy_audit.total_issues === 0 && (
                        <div className="flex items-center gap-2 rounded-lg px-4 py-2 border border-emerald-500/20 bg-emerald-500/5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <span className="text-xs font-semibold text-emerald-500">Copy QA: All checks passed — no issues found</span>
                        </div>
                      )}

                      {!drawerData?.sequences?.length ? (
                        <div className="text-center py-16 text-muted-foreground"><Mail className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-medium">No sequence data available</p><p className="text-xs mt-1">This campaign might not have an active sequence.</p></div>
                      ) : drawerData.sequences.map((step, i) => {
                        const activeCount = step.variants.filter(v => v.is_active !== false).length;
                        const disabledCount = step.variants.length - activeCount;
                        const auditStep = drawerData.copy_audit?.steps?.[i];

                        return (
                        <div key={i} className="border border-border rounded-lg overflow-hidden">
                          <div className="px-4 py-2 bg-secondary/50 border-b border-border flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                              Step {i + 1} {step.delay > 0 && <span className="text-muted-foreground font-normal ml-1">(Day {step.delay})</span>}
                            </span>
                            <div className="flex items-center gap-2">
                              {step.variants.length > 1 && (
                                <span className="text-[10px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-medium">
                                  {activeCount} active{disabledCount > 0 && ` · ${disabledCount} off`}
                                </span>
                              )}
                            </div>
                          </div>
                          {step.variants.map((variant, vi) => {
                            const isActive = variant.is_active !== false;
                            const copyId = `${i}-${vi}`;
                            const isEditing = editingVariant === copyId;
                            const auditVariant = auditStep?.variants?.[vi];
                            const issues = auditVariant?.issues || [];
                            const criticalIssues = issues.filter(iss => iss.severity === "critical");
                            const warningIssues = issues.filter(iss => iss.severity === "warning");

                            return (
                            <div key={vi} className={`px-4 py-3 ${vi > 0 ? 'border-t border-border/50' : ''} ${!isActive ? 'opacity-50 bg-secondary/10' : ''}`}>
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  {step.variants.length > 1 && (
                                    <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Variant {String.fromCharCode(65 + vi)}</span>
                                  )}
                                  {isActive ? (
                                    <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                                  ) : (
                                    <span className="text-[9px] font-bold bg-secondary text-muted-foreground border border-border px-1.5 py-0.5 rounded-full uppercase tracking-wider">Disabled</span>
                                  )}
                                  {issues.length > 0 && (
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider border ${
                                      criticalIssues.length > 0
                                        ? "bg-red-500/10 text-red-500 border-red-500/20"
                                        : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    }`}>
                                      {issues.length} {issues.length === 1 ? 'issue' : 'issues'}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  {!isEditing ? (
                                    <>
                                      <button
                                        onClick={() => startEditing(i, vi, variant.subject, variant.body_raw || variant.body)}
                                        className="text-muted-foreground hover:text-primary transition-colors p-1 rounded-md hover:bg-primary/10"
                                        title="Edit variant"
                                      >
                                        <Pencil className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => copyToClipboard(variant.body, copyId)}
                                        className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary"
                                        title="Copy to clipboard"
                                      >
                                        {copiedIdx === copyId ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button onClick={cancelEditing} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-secondary" title="Cancel">
                                        <RotateCcw className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => saveVariant(i, vi)}
                                        disabled={editSaving}
                                        className="text-emerald-500 hover:text-emerald-400 transition-colors p-1 rounded-md hover:bg-emerald-500/10 disabled:opacity-50"
                                        title="Save to Instantly"
                                      >
                                        {editSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Issue Warnings */}
                              {issues.length > 0 && !isEditing && (
                                <div className="space-y-1 mb-3">
                                  {criticalIssues.map((issue, ii) => (
                                    <div key={`c-${ii}`} className="flex items-start gap-2 text-[11px] text-red-500 bg-red-500/5 rounded-md px-2.5 py-1.5 border border-red-500/10">
                                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                      <span>{issue.message}</span>
                                    </div>
                                  ))}
                                  {warningIssues.map((issue, ii) => (
                                    <div key={`w-${ii}`} className="flex items-start gap-2 text-[11px] text-amber-500 bg-amber-500/5 rounded-md px-2.5 py-1.5 border border-amber-500/10">
                                      <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
                                      <span>{issue.message}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Edit Mode */}
                              {isEditing ? (
                                <div className="space-y-3">
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Subject</label>
                                    <input
                                      type="text" value={editSubject} onChange={e => setEditSubject(e.target.value)}
                                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground font-medium focus:outline-none focus:border-primary transition-all"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Body (Raw HTML)</label>
                                    <textarea
                                      value={editBody} onChange={e => setEditBody(e.target.value)}
                                      rows={12}
                                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground font-mono leading-relaxed focus:outline-none focus:border-primary transition-all resize-y"
                                    />
                                  </div>
                                  {editResult && (
                                    <div className={`text-xs px-3 py-2 rounded-md border ${editResult.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>
                                      {editResult.message}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <>
                                  {variant.subject && (
                                    <p className="text-xs mb-2">
                                      <span className="text-muted-foreground font-semibold mr-1">Subject:</span>
                                      <span className="text-foreground font-medium">{variant.subject}</span>
                                    </p>
                                  )}
                                  {showRawCopy ? (
                                    <div className="text-xs text-foreground whitespace-pre-wrap leading-relaxed font-mono bg-background rounded-md p-3 border border-border overflow-x-auto">
                                      <code>{variant.body_raw || variant.body}</code>
                                    </div>
                                  ) : variant.body_raw ? (
                                    <div className="text-sm text-black bg-white rounded-md p-4 border border-border/50 overflow-x-auto prose prose-sm max-w-none [&_a]:text-blue-600 [&_a]:underline" dangerouslySetInnerHTML={{ __html: variant.body_raw }} />
                                  ) : (
                                    <div className="text-sm text-black bg-white rounded-md p-4 border border-border/50 overflow-x-auto whitespace-pre-wrap">
                                      {variant.body}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            );
                          })}
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* TAB: Replies */}
                  {drawerTab === "replies" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center"><MessageSquare className="w-4 h-4 mr-2 text-primary" />Lead Replies</h4>
                        <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">from Supabase</span>
                      </div>

                      {/* Clickable Category Filter Bar */}
                      {drawerData?.reply_summary && drawerData.reply_summary.total > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={() => setReplyCategoryFilter("all")}
                            className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${replyCategoryFilter === "all" ? "bg-primary/10 border-primary/30 text-primary" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"}`}>
                            All <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary">{drawerData.reply_summary.total}</span>
                          </button>
                          {drawerData.reply_summary.positive > 0 && (
                            <button onClick={() => setReplyCategoryFilter(replyCategoryFilter === "positive" ? "all" : "positive")}
                              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${replyCategoryFilter === "positive" ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500 ring-1 ring-emerald-500/20" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-emerald-500/30"}`}>
                              🟢 Positive <span className="text-[10px]">{drawerData.reply_summary.positive}</span>
                            </button>
                          )}
                          {drawerData.reply_summary.mql > 0 && (
                            <button onClick={() => setReplyCategoryFilter(replyCategoryFilter === "mql" ? "all" : "mql")}
                              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${replyCategoryFilter === "mql" ? "bg-amber-500/10 border-amber-500/30 text-amber-500 ring-1 ring-amber-500/20" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-amber-500/30"}`}>
                              🟡 MQL <span className="text-[10px]">{drawerData.reply_summary.mql}</span>
                            </button>
                          )}
                          {drawerData.reply_summary.negative > 0 && (
                            <button onClick={() => setReplyCategoryFilter(replyCategoryFilter === "negative" ? "all" : "negative")}
                              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${replyCategoryFilter === "negative" ? "bg-red-500/10 border-red-500/30 text-red-500 ring-1 ring-red-500/20" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-red-500/30"}`}>
                              🔴 Negative <span className="text-[10px]">{drawerData.reply_summary.negative}</span>
                            </button>
                          )}
                          {(drawerData.reply_summary.ooo + (drawerData.reply_summary.bounced || 0)) > 0 && (
                            <button onClick={() => setReplyCategoryFilter(replyCategoryFilter === "ooo" ? "all" : "ooo")}
                              className={`h-8 inline-flex items-center gap-1.5 px-3 text-xs font-semibold rounded-lg border transition-all ${replyCategoryFilter === "ooo" ? "bg-gray-500/10 border-gray-500/30 text-gray-400 ring-1 ring-gray-500/20" : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-gray-500/30"}`}>
                              ⚪ OOO/Bounce <span className="text-[10px]">{drawerData.reply_summary.ooo + (drawerData.reply_summary.bounced || 0)}</span>
                            </button>
                          )}
                        </div>
                      )}

                      {/* Results count when filtering */}
                      {replyCategoryFilter !== "all" && (
                        <p className="text-xs text-muted-foreground">Showing {filteredReplies.length} of {drawerData?.reply_summary?.total || 0} replies</p>
                      )}

                      {!drawerData?.replies?.length ? (
                        <div className="text-center py-16 text-muted-foreground"><MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="font-medium">No replies found</p><p className="text-xs mt-1">No lead replies matched this campaign.</p></div>
                      ) : filteredReplies.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground"><p className="font-medium">No {replyCategoryFilter} replies</p><button onClick={() => setReplyCategoryFilter("all")} className="text-xs text-primary hover:underline mt-1">Show all replies</button></div>
                      ) : filteredReplies.map((reply, i) => (
                        <div key={i} className="border border-border rounded-lg overflow-hidden">
                          <div className="px-4 py-2.5 bg-secondary/30 border-b border-border flex items-center justify-between">
                            <div className="flex items-center space-x-2 min-w-0">
                              <span className="text-sm font-semibold text-foreground truncate">{reply.first_name} {reply.last_name}</span>
                              {reply.job_title && <span className="text-xs text-muted-foreground hidden sm:inline">· {reply.job_title}</span>}
                              {reply.company_name && <span className="text-xs text-muted-foreground hidden sm:inline">@ {reply.company_name}</span>}
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <ReplyCategoryBadge category={reply.category} />
                              {reply.reply_date && <span className="text-[10px] text-muted-foreground">{new Date(reply.reply_date).toLocaleDateString()}</span>}
                            </div>
                          </div>
                          <div className="p-4 space-y-3">
                            {reply.outbound_email && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">📤 What We Sent</p>
                                  <button onClick={() => copyToClipboard(reply.outbound_email, `oe-${i}`)} className="text-muted-foreground hover:text-foreground p-0.5" title="Copy">
                                    {copiedIdx === `oe-${i}` ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <div className="text-xs text-foreground/60 whitespace-pre-wrap bg-secondary/20 rounded-md p-3 border border-border/30 max-h-32 overflow-y-auto leading-relaxed">{reply.outbound_email.slice(0, 600)}{reply.outbound_email.length > 600 && '...'}</div>
                              </div>
                            )}
                            {reply.inbound_email && (
                              <div>
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">💬 Their Reply</p>
                                  <button onClick={() => copyToClipboard(reply.inbound_email, `lr-${i}`)} className="text-muted-foreground hover:text-foreground p-0.5" title="Copy">
                                    {copiedIdx === `lr-${i}` ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                                  </button>
                                </div>
                                <div className="text-sm text-foreground whitespace-pre-wrap bg-primary/5 rounded-md p-3 border border-primary/10 leading-relaxed">{reply.inbound_email}</div>
                              </div>
                            )}
                            {!reply.outbound_email && !reply.inbound_email && (
                              <p className="text-xs text-muted-foreground italic">No email content available for this reply.</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB: Optimize */}
                  {drawerTab === "optimize" && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center"><Zap className="w-4 h-4 mr-2 text-amber-500" />AI Copywriting Copilot</h4>
                      </div>
                      {!drawerOptResult && !drawerOptLoading && (
                        <div className="text-center py-16 space-y-4">
                          <div className="w-16 h-16 mx-auto rounded-full bg-amber-500/10 flex items-center justify-center"><Sparkles className="w-8 h-8 text-amber-500" /></div>
                          <p className="text-foreground font-semibold">Ready to Optimize</p>
                          <p className="text-sm text-muted-foreground max-w-md mx-auto">Analyze copy, replies, and intelligence brief to generate optimization recommendations.</p>
                          <button onClick={handleDrawerOptimize} className="inline-flex items-center px-6 py-3 text-sm font-semibold rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all shadow-sm">
                            <Sparkles className="w-4 h-4 mr-2" /> Run AI Analysis
                          </button>
                        </div>
                      )}
                      {drawerOptLoading && (
                        <div className="flex flex-col items-center justify-center py-20 space-y-4 text-muted-foreground">
                          <Loader2 className="w-10 h-10 animate-spin text-amber-500" /><p className="animate-pulse font-medium">Cross-referencing Intelligence Briefs & Lead Replies...</p>
                        </div>
                      )}
                      {drawerOptResult && <div className="prose prose-invert max-w-none prose-sm"><ReactMarkdown>{drawerOptResult}</ReactMarkdown></div>}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ==================== FIX NAMING MODAL ==================== */}
      {isNamingModalOpen && namingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-card w-full max-w-xl rounded-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-secondary/30">
              <h3 className="font-semibold text-lg flex items-center text-foreground"><Edit2 className="w-5 h-5 mr-2 text-primary" />Fix Campaign Naming</h3>
              <button onClick={() => setIsNamingModalOpen(false)} className="text-muted-foreground hover:text-foreground p-1.5 rounded-md hover:bg-secondary"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Current Name</label>
                <p className="mt-1 text-sm text-destructive line-through opacity-70 font-mono bg-destructive/5 px-3 py-2 rounded-md border border-destructive/10">{namingCampaign.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Client</label><input type="text" value={namingCampaign.client} readOnly className="mt-1 w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed" /></div>
                <div><label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Persona</label><input type="text" value={namingFields.persona} onChange={e => setNamingFields(f => ({ ...f, persona: e.target.value }))} placeholder="e.g. F&B Executives" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all" /></div>
                <div><label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Location</label><input type="text" value={namingFields.location} onChange={e => setNamingFields(f => ({ ...f, location: e.target.value }))} placeholder="e.g. UK, UAE" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all" /></div>
                <div><label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Offer / Segment</label><input type="text" value={namingFields.offer} onChange={e => setNamingFields(f => ({ ...f, offer: e.target.value }))} placeholder="e.g. Virtual Brands" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all" /></div>
                <div><label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Week</label><input type="text" value={namingFields.week} onChange={e => setNamingFields(f => ({ ...f, week: e.target.value }))} placeholder="e.g. W14" className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all" /></div>
              </div>
              <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3">
                <label className="text-xs text-primary uppercase tracking-wider font-semibold flex items-center"><Sparkles className="w-3 h-3 mr-1.5" />Preview</label>
                <p className="mt-1.5 text-sm font-semibold text-foreground font-mono">{namingPreview || <span className="text-muted-foreground italic">Fill in the fields above...</span>}</p>
              </div>
              {namingResult && (
                <div className={`text-sm px-4 py-3 rounded-lg border ${namingResult.success ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-destructive/10 border-destructive/20 text-destructive"}`}>{namingResult.message}</div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between">
              <button onClick={() => setIsNamingModalOpen(false)} className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleFixNaming} disabled={namingLoading || !namingPreview || namingResult?.success} className="inline-flex items-center px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm">
                {namingLoading ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Renaming...</>) : namingResult?.success ? (<><Check className="w-4 h-4 mr-2" /> Done!</>) : (<><Check className="w-4 h-4 mr-2" /> Apply Fix</>)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
