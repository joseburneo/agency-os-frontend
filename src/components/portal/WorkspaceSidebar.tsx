"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Target, Mail, MessageCircle,
  CalendarDays, CalendarClock, KanbanSquare, Library, ChevronsUpDown, ArrowLeft, Check,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, ShieldBan, Route, Menu, X,
  Megaphone, Flame,
} from "lucide-react";
import { cn, Linkedin } from "./ui";
import type { Workspace } from "@/lib/portal/types";
import { visibleModules } from "@/lib/portal/modules";

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  href?: string; // explicit href (e.g. a list deep-link with ?list=); default is /w/{slug}/{key}
  indent?: boolean; // a sub-item under its parent (the individual lists)
};
type NavGroup = { group: string; items: NavItem[] };
type WsLite = { slug: string; name: string; accent: string };
type ListLite = { key: string; name: string; count: number };

// "List 1 · No in-house HR" -> "No in-house HR"; "VIP" -> "VIP". The section header
// already says these are lists, so the "List N ·" prefix is noise in the menu.
function shortListLabel(name: string): string {
  return name.replace(/^list\s*\d+\s*[·:\-]\s*/i, "").trim() || name;
}

// Counts come live from the parent layout; hide a badge at 0 so an empty
// workspace (e.g. Luxvance before its leads land) reads clean, not "0".
// Layout (Jose 2026-07-16): the three "whole-workspace" views sit at the very top
// with no header (Dashboard · Intelligence Library · Client Success Roadmap), then
// the funnel sections follow: Targeted lists → Cold outreach → Ads → CRM, with the
// Blocklist as a standalone guard at the bottom. A group with group:"" renders its
// items without a section header.
function buildNav(w: Workspace | null, enabled: Set<string>, slug: string, lists: ListLite[]): NavGroup[] {
  // Each target list is its own menu item under the "Targeted lists" header, so Paul
  // reaches List 1 / List 2 / List 3 / VIP in one click. They deep-link into the one
  // target-lists page via ?list=<key>, which the table reads to preselect the tab.
  const listItems: NavItem[] = lists.map((l) => ({
    key: `list-${l.key}`,
    label: shortListLabel(l.name),
    icon: Target,
    href: `/w/${slug}/target-lists?list=${l.key}`,
    indent: true,
    badge: l.count > 0 ? l.count.toLocaleString() : undefined,
  }));
  const groups: NavGroup[] = [
    {
      group: "",
      items: [
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        { key: "library", label: "Intelligence Library", icon: Library },
        { key: "roadmap", label: "Client Success Roadmap", icon: Route },
      ],
    },
    {
      group: "Targeted lists",
      items: [
        { key: "target-lists", label: "Targeted Cold Leads", icon: Target, badge: w && w.coldLeads > 0 ? w.coldLeads.toLocaleString() : undefined },
        ...listItems,
      ],
    },
    {
      group: "Cold outreach",
      items: [
        { key: "email", label: "Email Campaigns", icon: Mail },
        { key: "linkedin", label: "LinkedIn Campaigns", icon: Linkedin },
        { key: "cadence", label: "Sequence & Schedule", icon: CalendarClock },
        { key: "whatsapp", label: "WhatsApp & Phone", icon: MessageCircle },
        { key: "content", label: "Content Calendar", icon: CalendarDays },
      ],
    },
    {
      group: "Ads",
      items: [
        { key: "linkedin-ads", label: "LinkedIn Ads", icon: Linkedin },
        { key: "meta-ads", label: "Meta Ads", icon: Megaphone },
      ],
    },
    {
      group: "CRM",
      items: [{ key: "crm", label: "Hot Leads", icon: Flame, badge: w && w.warmLeads > 0 ? String(w.warmLeads) : undefined }],
    },
    {
      group: "",
      items: [{ key: "blocklist", label: "Blocklist", icon: ShieldBan }],
    },
  ];
  // Per-workspace visibility: keep only enabled modules, drop now-empty groups.
  // The list sub-items (list-*) ride on the target-lists module being enabled.
  const ok = (key: string) => (key.startsWith("list-") ? enabled.has("target-lists") : enabled.has(key));
  return groups
    .map((g) => ({ ...g, items: g.items.filter((it) => ok(it.key)) }))
    .filter((g) => g.items.length > 0);
}

// Hover label shown only when the rail is collapsed to icons.
function Tip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-full ml-2 z-50 whitespace-nowrap rounded-md border border-border bg-popover px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
      {children}
    </span>
  );
}

export function WorkspaceSidebar({ slug, ws, workspaces, lists = [], demo = false, mode = "client", kind = "client" }: { slug: string; ws: Workspace | null; workspaces: WsLite[]; lists?: ListLite[]; demo?: boolean; mode?: "agency" | "client" | "demo"; kind?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentList = searchParams.get("list");
  const w = ws;
  const nav = buildNav(w, new Set(visibleModules(slug, demo, kind)), slug, lists);
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Remember the collapsed state across navigations / sessions.
  useEffect(() => {
    if (localStorage.getItem("lxv_sidebar_collapsed") === "1") setCollapsed(true);
  }, []);
  const toggle = () =>
    setCollapsed((c) => {
      localStorage.setItem("lxv_sidebar_collapsed", c ? "0" : "1");
      return !c;
    });

  // Route change closes any floating chrome (drawer + switcher dropdown).
  useEffect(() => {
    setMobileOpen(false);
    setOpen(false);
  }, [pathname]);

  // Escape closes the mobile drawer.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const initials = (w?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  const closeMobile = () => setMobileOpen(false);

  /* ---- Shared pieces (desktop aside + mobile drawer) ---------------- */

  // Workspace chip + switcher dropdown. `isCollapsed` is always false in the drawer.
  const renderSwitcher = (isCollapsed: boolean) => (
    <div className="relative">
      <button
        onClick={() => {
          if (demo) return;
          if (isCollapsed) toggle();
          else setOpen((o) => !o);
        }}
        disabled={demo}
        title={isCollapsed ? w?.name ?? slug : undefined}
        className={cn(
          "w-full flex items-center rounded-xl border border-border bg-card transition-colors",
          isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5 text-left",
          !demo && "hover:border-white/20"
        )}
      >
        <span
          className="grid place-items-center w-9 h-9 rounded-lg text-xs font-bold shrink-0"
          style={{ background: `${w?.accent ?? "#FFD60A"}1a`, color: w?.accent ?? "#FFD60A" }}
        >
          {initials}
        </span>
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground truncate">{w?.name ?? slug}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {demo ? "preview" : `${w?.owner} · workspace`}
              </span>
            </span>
            {!demo && <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          </>
        )}
      </button>

      {open && !demo && !isCollapsed && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            {workspaces.map((wsl) => (
              <Link
                key={wsl.slug}
                href={`/w/${wsl.slug}/dashboard`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors"
              >
                <span
                  className="grid place-items-center w-6 h-6 rounded-md text-[10px] font-bold shrink-0"
                  style={{ background: `${wsl.accent}1a`, color: wsl.accent }}
                >
                  {wsl.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                </span>
                <span className="text-sm text-foreground flex-1 truncate">{wsl.name}</span>
                {wsl.slug === slug && <Check className="w-3.5 h-3.5 text-[#FFD60A]" />}
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Grouped module nav. Drawer passes isCollapsed=false + onNavigate to close itself.
  const renderNav = (isCollapsed: boolean, onNavigate?: () => void) => (
    <nav className="flex flex-col gap-4">
      {nav.map((grp, gi) => (
        <div key={gi} className="flex flex-col gap-0.5">
          {!isCollapsed && grp.group && (
            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">{grp.group}</div>
          )}
          {grp.items.map(({ key, label, icon: Icon, badge, href: explicitHref, indent }) => {
            // Collapsed rail shows icons only; the list sub-items fold into their parent.
            if (isCollapsed && indent) return null;
            const href = explicitHref ?? `/w/${slug}/${key}`;
            const onTargetLists = pathname === `/w/${slug}/target-lists`;
            const listItemKey = key.startsWith("list-") ? key.slice("list-".length) : null;
            let active: boolean;
            if (listItemKey) {
              // A list sub-item is active only when we're on target-lists AND its key
              // is the selected one (the first list is the default when none is set).
              active = onTargetLists && (currentList === listItemKey || (!currentList && grp.items.findIndex((i) => i.key === key) === 1));
            } else if (key === "target-lists") {
              // The parent stays lit whenever we're on the page, so the section reads
              // as one place; the specific sub-item shows which list.
              active = onTargetLists;
            } else {
              active = pathname === href || (pathname?.startsWith(href + "/") ?? false);
            }
            return (
              <Link
                key={key}
                href={href}
                onClick={onNavigate}
                title={isCollapsed ? label : undefined}
                className={cn(
                  "group relative flex items-center rounded-lg text-sm transition-colors",
                  isCollapsed ? "justify-center py-2.5" : "gap-2.5 px-2.5 py-2",
                  !isCollapsed && indent && "ml-3.5 pl-2 border-l border-border",
                  active
                    ? "bg-[#FFD60A]/10 text-[#FFD60A]"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {indent ? (
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", active ? "bg-[#FFD60A]" : "bg-muted-foreground/40")} />
                ) : (
                  <Icon className="w-[17px] h-[17px] shrink-0" />
                )}
                {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
                {!isCollapsed && badge && (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums rounded-md px-1.5 py-0.5",
                      active ? "bg-[#FFD60A]/15 text-[#FFD60A]" : "bg-white/5 text-muted-foreground"
                    )}
                  >
                    {badge}
                  </span>
                )}
                {isCollapsed && badge && (
                  <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-[#FFD60A]" />
                )}
                {isCollapsed && <Tip>{label}</Tip>}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  // Account: settings + sign out. Hidden for demo prospects.
  const renderAccount = (isCollapsed: boolean, onNavigate?: () => void) =>
    demo ? null : (
      <div className="mt-auto flex flex-col gap-1 pt-4 border-t border-border">
        <Link
          href={`/w/${slug}/settings`}
          onClick={onNavigate}
          title={isCollapsed ? "Settings" : undefined}
          className={cn(
            "group relative flex items-center rounded-lg text-sm transition-colors",
            isCollapsed ? "justify-center py-2.5" : "gap-2.5 px-2.5 py-2",
            pathname === `/w/${slug}/settings`
              ? "bg-[#FFD60A]/10 text-[#FFD60A]"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings className="w-[17px] h-[17px] shrink-0" />
          {!isCollapsed && <span className="flex-1 truncate">Settings</span>}
          {!isCollapsed && (
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
              {mode === "agency" ? "agency" : "client"}
            </span>
          )}
          {isCollapsed && <Tip>Settings</Tip>}
        </Link>
        <form method="post" action="/api/logout">
          <input type="hidden" name="scope" value={mode === "agency" ? "agency" : slug} />
          <button
            type="submit"
            title={isCollapsed ? "Sign out" : undefined}
            className={cn(
              "group relative w-full flex items-center rounded-lg text-sm text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors",
              isCollapsed ? "justify-center py-2.5" : "gap-2.5 px-2.5 py-2"
            )}
          >
            <LogOut className="w-[17px] h-[17px] shrink-0" />
            {!isCollapsed && <span className="flex-1 truncate text-left">Sign out</span>}
            {isCollapsed && <Tip>Sign out</Tip>}
          </button>
        </form>
      </div>
    );

  const liveFooter = (
    <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", demo ? "mt-auto pt-4" : "pt-1")}>
      <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" />
      Living workspace · updates in real time
    </div>
  );

  return (
    <>
      {/* ---- Mobile top bar (below lg). Negative margins bleed over the
           scroll container's padding so the bar runs edge-to-edge. ---- */}
      <div className="lg:hidden sticky top-0 z-30 -mx-4 -mt-4 md:-mx-6 md:-mt-6 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <span
          className="grid place-items-center w-8 h-8 rounded-lg text-xs font-bold shrink-0"
          style={{ background: `${w?.accent ?? "#FFD60A"}1a`, color: w?.accent ?? "#FFD60A" }}
        >
          {initials}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground truncate">{w?.name ?? slug}</span>
          <span className="block text-[10px] text-muted-foreground truncate">
            {demo ? "preview" : "workspace"}
          </span>
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          aria-expanded={mobileOpen}
          className="grid place-items-center w-9 h-9 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* ---- Mobile drawer + backdrop (below lg) ---- */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-50 bg-black/60 transition-opacity duration-200",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Workspace menu"
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] flex flex-col gap-4 overflow-y-auto overscroll-contain border-r border-border bg-background p-4 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between">
          {!demo ? (
            <Link
              href="/"
              onClick={closeMobile}
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All workspaces
            </Link>
          ) : (
            <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Menu</span>
          )}
          <button
            onClick={closeMobile}
            aria-label="Close menu"
            className="grid place-items-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {renderSwitcher(false)}
        {renderNav(false, closeMobile)}
        {renderAccount(false, closeMobile)}
        {liveFooter}
      </aside>

      {/* ---- Desktop rail (lg and up): the original sticky collapsible aside ---- */}
      <aside
        className={cn(
          "shrink-0 self-start sticky top-0 hidden lg:flex flex-col gap-4 transition-[width] duration-200",
          collapsed ? "w-16" : "w-[236px]"
        )}
      >
        {/* Top row: back to agency (expanded) + collapse toggle */}
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!demo && !collapsed && (
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> All workspaces
            </Link>
          )}
          <button
            onClick={toggle}
            title={collapsed ? "Expand" : "Collapse"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="grid place-items-center w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        {/* Workspace chip. Collapsed → avatar only (click expands). */}
        {renderSwitcher(collapsed)}

        {/* Module nav */}
        {renderNav(collapsed)}

        {renderAccount(collapsed)}

        {!collapsed && liveFooter}
      </aside>
    </>
  );
}
