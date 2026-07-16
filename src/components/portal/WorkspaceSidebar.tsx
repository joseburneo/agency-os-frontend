"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Target, Mail, MessageCircle,
  CalendarDays, KanbanSquare, Library, ChevronsUpDown, ArrowLeft, Check,
} from "lucide-react";
import { cn, Linkedin } from "./ui";
import type { Workspace } from "@/lib/portal/types";
import { enabledModules } from "@/lib/portal/modules";

type NavItem = { key: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: string };
type NavGroup = { group: string; items: NavItem[] };
type WsLite = { slug: string; name: string; accent: string };

// Counts come live from the parent layout; hide a badge at 0 so an empty
// workspace (e.g. Luxvance before its leads land) reads clean, not "0".
function buildNav(w: Workspace | null, enabled: Set<string>): NavGroup[] {
  const groups: NavGroup[] = [
    { group: "Overview", items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard }] },
    {
      group: "Cold · outreach",
      items: [
        { key: "target-lists", label: "Target Lists", icon: Target, badge: w && w.coldLeads > 0 ? w.coldLeads.toLocaleString() : undefined },
        { key: "email", label: "Email Campaigns", icon: Mail },
        { key: "linkedin", label: "LinkedIn Campaigns", icon: Linkedin },
        { key: "whatsapp", label: "WhatsApp & Phone", icon: MessageCircle },
        { key: "content", label: "Content Calendar", icon: CalendarDays },
      ],
    },
    {
      group: "Warm · pipeline",
      items: [{ key: "crm", label: "Sales CRM", icon: KanbanSquare, badge: w && w.warmLeads > 0 ? String(w.warmLeads) : undefined }],
    },
    { group: "Intelligence", items: [{ key: "library", label: "Intelligence Library", icon: Library }] },
  ];
  // Per-workspace visibility: keep only enabled modules, drop now-empty groups.
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => enabled.has(it.key)) }))
    .filter((g) => g.items.length > 0);
}

export function WorkspaceSidebar({ slug, ws, workspaces }: { slug: string; ws: Workspace | null; workspaces: WsLite[] }) {
  const pathname = usePathname();
  const w = ws;
  const nav = buildNav(w, new Set(enabledModules(slug)));
  const [open, setOpen] = useState(false);
  const initials = (w?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <aside className="w-[236px] shrink-0 self-start sticky top-0 flex flex-col gap-4">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All workspaces
      </Link>

      {/* Workspace chip + switcher */}
      <div className="relative">
        <button
          onClick={() => setOpen((o) => !o)}
          className="w-full flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5 text-left hover:border-white/20 transition-colors"
        >
          <span
            className="grid place-items-center w-9 h-9 rounded-lg text-xs font-bold shrink-0"
            style={{ background: `${w?.accent ?? "#FFD60A"}1a`, color: w?.accent ?? "#FFD60A" }}
          >
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground truncate">{w?.name ?? slug}</span>
            <span className="block text-[11px] text-muted-foreground truncate">{w?.owner} · workspace</span>
          </span>
          <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
            <div className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
              {workspaces.map((ws) => (
                <Link
                  key={ws.slug}
                  href={`/w/${ws.slug}/dashboard`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors"
                >
                  <span
                    className="grid place-items-center w-6 h-6 rounded-md text-[10px] font-bold shrink-0"
                    style={{ background: `${ws.accent}1a`, color: ws.accent }}
                  >
                    {ws.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                  </span>
                  <span className="text-sm text-foreground flex-1 truncate">{ws.name}</span>
                  {ws.slug === slug && <Check className="w-3.5 h-3.5 text-[#FFD60A]" />}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Module nav */}
      <nav className="flex flex-col gap-4">
        {nav.map((grp) => (
          <div key={grp.group} className="flex flex-col gap-0.5">
            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{grp.group}</div>
            {grp.items.map(({ key, label, icon: Icon, badge }) => {
              const href = `/w/${slug}/${key}`;
              const active = pathname === href || pathname?.startsWith(href + "/");
              return (
                <Link
                  key={key}
                  href={href}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                    active
                      ? "bg-[#FFD60A]/10 text-[#FFD60A]"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="w-[17px] h-[17px] shrink-0" />
                  <span className="flex-1 truncate">{label}</span>
                  {badge && (
                    <span
                      className={cn(
                        "text-[10px] tabular-nums rounded-md px-1.5 py-0.5",
                        active ? "bg-[#FFD60A]/15 text-[#FFD60A]" : "bg-white/5 text-muted-foreground"
                      )}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4 flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" />
        Living workspace · updates in real time
      </div>
    </aside>
  );
}
