"use client";

import Link from "next/link";
import { RailConstellation } from "@/components/portal/RailConstellation";
import { usePathname, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard, Target, Mail, ChevronsUpDown, ArrowLeft, Check,
  Settings, LogOut, PanelLeftClose, PanelLeftOpen, ShieldBan, Route, Menu, X,
  FileText,
} from "lucide-react";
import { BrainMark, ColdMark, HotMark, cn, Linkedin, LinkedInMark } from "./ui";
import { CompanyMark } from "./CompanyMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import type { Workspace } from "@/lib/portal/types";
import { visibleModules } from "@/lib/portal/modules";

type NavItem = {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  href?: string; // explicit href (e.g. a list deep-link with ?list=); default is /w/{slug}/{key}
  indent?: boolean; // a sub-item under its parent (the individual lists)
  tone?: "hot" | "cold"; // tints the icon; everything else stays monochrome
};
type NavGroup = { group: string; items: NavItem[] };

// Brand marks for the two sourcing routes. LinkedIn is where people come from,
// Google Maps is where local businesses do, and the logo says which faster than
// any generic radar glyph. They take className so they drop into NavItem.icon
// beside the lucide icons without special-casing the renderer.
function MapsMark({ className }: { className?: string }) {
  return (
    <img
      src="https://www.google.com/s2/favicons?domain=maps.google.com&sz=64"
      alt=""
      width={15}
      height={15}
      className={cn("rounded-[3px]", className)}
    />
  );
}

type WsLite = { slug: string; name: string; accent: string; kind?: string; domain?: string; isAgency?: boolean };
type ListLite = { key: string; name: string; count: number };

// "List 1 · No in-house HR" -> "No in-house HR"; "VIP" -> "VIP". The section header
// already says these are lists, so the "List N ·" prefix is noise in the menu.
function shortListLabel(name: string): string {
  return name.replace(/^list\s*\d+\s*[·:\-]\s*/i, "").trim() || name;
}

// Counts come live from the parent layout; hide a badge at 0 so an empty
// workspace (e.g. Luxvance before its leads land) reads clean, not "0".
//
// Layout (Jose, 2026-08-13): Opportunities is the star of the product, so it sits
// second, right under Dashboard, instead of near the bottom under a "CRM" header
// where the empty tabs had pushed it. It was called "Hot Leads"; a lead that
// answered and is being worked is an opportunity, and that is the word a client
// uses when they talk about their own pipeline.
//
// Then the rest: the whole-workspace views (Brain · Roadmap · Proposal), Targeted
// lists, Cold outreach, and the Blocklist as a standalone guard at the bottom. The
// Ads section and the empty outreach tabs are gone — see RETIRED in modules.ts.
// A group with group:"" renders its items without a section header.
function buildNav(w: Workspace | null, enabled: Set<string>, slug: string, lists: ListLite[]): NavGroup[] {
  // Each target list is its own menu item under the "Targeted lists" header, so Paul
  // reaches List 1 / List 2 / List 3 / VIP in one click. They deep-link into the one
  // target-lists page via ?list=<key>, which the table reads to preselect the tab.
  // Sub-items only when there is more than one list. With a single list the
  // parent already IS that list, so the child just repeats it — and repeats its
  // name, which is how "Find Prospects" ended up in the menu twice: a list built
  // from Find Prospects is named after it.
  const listItems: NavItem[] = (lists.length > 1 ? lists : []).map((l) => ({
    key: `list-${l.key}`,
    label: shortListLabel(l.name),
    icon: Target,
    href: `/w/${slug}/target-lists?list=${l.key}`,
    indent: true,
    badge: l.count > 0 ? l.count.toLocaleString() : undefined,
  }));
  const groups: NavGroup[] = [
    {
      // Where you land and what the agents know. Both are read constantly and
      // belong to no pipeline, so they lead without a header (Jose, 2026-08-19).
      group: "",
      items: [
        { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
        // "<Client> Brain" — the client's name owns the module (Jose, 2026-07-25):
        // Arco Irish Brain, Kcal Brain. The agent's editable memory, not a "library".
        { key: "library", label: w?.name ? `${w.name} Brain` : "Brain", icon: BrainMark },
      ],
    },
    {
      // Two pipelines, one CRM. The split is not temperature, it is who opens the
      // conversation: hot is reactive (they wrote, you answer), cold is proactive
      // (you write first, by hand). A cold contact crosses into hot on its first
      // reply, which is why they are siblings and not separate products.
      group: "CRM",
      items: [
        // The icons carry the temperature. Yellow is the brand's own heat, and
        // cyan is the coldest tone already in the token set — Signal Green would
        // have been the obvious second pick and it is spoken for: green means
        // live and positive everywhere else in this product, so a green
        // snowflake would fight a meaning we rely on.
        { key: "crm", label: "Hot Pipeline", icon: HotMark,
          badge: w && w.warmLeads > 0 ? String(w.warmLeads) : undefined },
        // The count rides on Cold, which is where every sourced lead actually is.
        // It used to sit on Target Lists, and that module is gone for a magnet.
        { key: "cold", label: "Cold Pipeline", icon: ColdMark,
          badge: w && w.coldLeads > 0 ? w.coldLeads.toLocaleString() : undefined },
      ],
    },
    {
      // A list is what sourcing PRODUCES, so it lives beside the tools that make
      // it rather than with the campaigns that consume it. One list can feed
      // several campaigns, and it exists before any of them do.
      group: "Prospecting",
      items: [
        { key: "prospecting", label: "Find Prospects", icon: LinkedInMark },
        { key: "local", label: "Find Local Businesses", icon: MapsMark },
        { key: "target-lists", label: "Target Lists", icon: Target, badge: w && w.coldLeads > 0 ? w.coldLeads.toLocaleString() : undefined },
        ...listItems,
      ],
    },
    {
      group: "Campaigns",
      items: [
        { key: "email", label: "Email Campaigns", icon: Mail },
        { key: "linkedin", label: "LinkedIn Campaigns", icon: LinkedInMark },
      ],
    },
    {
      // Reference and guardrails. Consulted, not worked, so they sit below the
      // daily surfaces and above Settings, which is where you change things.
      group: "",
      items: [
        { key: "roadmap", label: "Client Success Roadmap", icon: Route },
        { key: "proposal", label: "Commercial Proposal", icon: FileText },
        { key: "blocklist", label: "Blocklist", icon: ShieldBan },
      ],
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

  const closeMobile = () => setMobileOpen(false);

  // Hopping between workspaces, and the agency index behind "All workspaces", are
  // AGENCY-only. A client sees their own workspace and nothing else — not the
  // other clients' names, not a door to try. Gate on this, never on `!demo`.
  const isAgency = mode === "agency";

  /* ---- Shared pieces (desktop aside + mobile drawer) ---------------- */

  // Workspace chip + switcher dropdown. `isCollapsed` is always false in the drawer.
  const renderSwitcher = (isCollapsed: boolean) => (
    <div className="relative">
      <button
        onClick={() => {
          if (!isAgency) return;
          if (isCollapsed) toggle();
          else setOpen((o) => !o);
        }}
        disabled={!isAgency}
        title={isCollapsed ? w?.name ?? slug : undefined}
        className={cn(
          "w-full flex items-center rounded-xl border border-border bg-card transition-colors",
          isCollapsed ? "justify-center p-2" : "gap-3 px-3 py-2.5 text-left",
          isAgency && "hover:border-white/20"
        )}
      >
        <CompanyMark name={w?.name ?? slug} domain={w?.domain} size={36} />
        {!isCollapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground truncate">{w?.name ?? slug}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {demo ? "preview" : `${w?.owner} · workspace`}
              </span>
            </span>
            {isAgency && <ChevronsUpDown className="w-4 h-4 text-muted-foreground shrink-0" />}
          </>
        )}
      </button>

      {open && isAgency && !isCollapsed && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute z-40 mt-1 w-full rounded-xl border border-border bg-popover shadow-xl overflow-hidden">
            {/* Two lists, never one. A client is an account we run; a magnet is
                sales material built for a single prospect, and there will be far
                more of the second. Mixed together, the accounts that matter get
                lost among the demos. */}
            {(() => {
              // Three tiers, never mixed: the agency runs the show, clients pay
              // for it, demos sell it. Luxvance among the clients read as if the
              // agency were its own account.
              const agency = workspaces.filter((w) => w.isAgency);
              const clients = workspaces.filter((w) => !w.isAgency && w.kind !== "magnet");
              const magnets = workspaces.filter((w) => !w.isAgency && w.kind === "magnet");
              const row = (wsl: WsLite) => (
                <Link
                  key={wsl.slug}
                  href={`/w/${wsl.slug}/dashboard`}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-secondary transition-colors"
                >
                  <CompanyMark name={wsl.name} domain={wsl.domain} size={24} />
                  <span className="text-sm text-foreground flex-1 truncate">{wsl.name}</span>
                  {wsl.slug === slug && <Check className="w-3.5 h-3.5 text-gold-ink" />}
                </Link>
              );
              const heading = (t: string, n: number) => (
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                  <span className="text-[10px] uppercase tracking-[0.16em] text-subtle font-semibold">{t}</span>
                  <span className="text-[10px] text-subtle tabular-nums">{n}</span>
                </div>
              );
              return (
                <div className="max-h-[70vh] overflow-y-auto">
                  {agency.length > 0 && (
                    <>
                      {heading("Agency", agency.length)}
                      {agency.map(row)}
                    </>
                  )}
                  {clients.length > 0 && (
                    <div className={cn(agency.length > 0 && "border-t border-border mt-1")}>
                      {heading("Clients", clients.length)}
                      {clients.map(row)}
                    </div>
                  )}
                  {magnets.length > 0 && (
                    <div className="border-t border-border mt-1">
                      {heading("Demo accounts", magnets.length)}
                      {magnets.map(row)}
                    </div>
                  )}
                </div>
              );
            })()}
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
            // Signal Green, not yellow. Yellow already means "you are here" in
            // this rail (the active item's fill and ink), so a yellow heading
            // would put two different meanings on one colour and every section
            // would read as selected. Green is unused here, which gives the
            // sidebar a clean second channel: green names the structure, yellow
            // marks your position in it.
            <div className="px-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-signal-ink font-semibold">{grp.group}</div>
          )}
          {grp.items.map(({ key, label, icon: Icon, badge, href: explicitHref, indent, tone }) => {
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
                    ? "bg-gold/10 text-gold-ink"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {indent ? (
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", active ? "bg-gold" : "bg-muted-foreground/40")} />
                ) : (
                  <Icon
                    className={cn(
                      "w-[17px] h-[17px] shrink-0",
                      // The tint is for a STROKED icon. The two pipelines and the
                      // Brain carry emoji now, which bring their own colour and
                      // ignore a text class, so the tone is left for whatever
                      // stroked icon needs it next.
                      tone === "hot" && "text-[var(--gold)]",
                      tone === "cold" && "text-cyan"
                    )}
                  />
                )}
                {!isCollapsed && <span className="flex-1 truncate">{label}</span>}
                {!isCollapsed && badge && (
                  <span
                    className={cn(
                      "text-[10px] tabular-nums rounded-md px-1.5 py-0.5",
                      active ? "bg-gold/15 text-gold-ink" : "bg-white/5 text-muted-foreground"
                    )}
                  >
                    {badge}
                  </span>
                )}
                {isCollapsed && badge && (
                  <span className="absolute top-1.5 right-2 w-1.5 h-1.5 rounded-full bg-gold" />
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
              ? "bg-gold/10 text-gold-ink"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
        >
          <Settings className="w-[17px] h-[17px] shrink-0" />
          {!isCollapsed && <span className="flex-1 truncate">Settings</span>}
          {!isCollapsed && (
            <span className="text-[10px] uppercase tracking-wider text-subtle">
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

  // Theme sits outside the account block on purpose: that block is hidden for demo
  // prospects, and a prospect reading their Build on a bright screen should still be able
  // to switch. `mt-auto` when there is no account block keeps it pinned to the bottom.
  const renderTheme = (isCollapsed: boolean) => (
    <div className={cn("flex", isCollapsed ? "justify-center" : "px-0.5", demo ? "mt-auto pt-4" : "pt-3")}>
      <ThemeToggle compact={isCollapsed} className={cn(isCollapsed && "flex-col", !isCollapsed && "w-full justify-between")} />
    </div>
  );

  const liveFooter = (
    <div className={cn("flex items-center gap-2 text-[11px] text-muted-foreground", "pt-3")}>
      <span className="w-1.5 h-1.5 rounded-full bg-signal shadow-[0_0_6px_var(--glow-signal)]" />
      Living workspace · updates in real time
    </div>
  );

  return (
    <>
      {/* ---- Mobile top bar (below lg). Negative margins bleed over the
           scroll container's padding so the bar runs edge-to-edge. ---- */}
      <div className="lg:hidden sticky top-0 z-30 -mx-4 -mt-4 md:-mx-6 md:-mt-6 flex items-center gap-3 border-b border-border bg-background/95 backdrop-blur px-4 py-3">
        <CompanyMark name={w?.name ?? slug} domain={w?.domain} size={32} />
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
          "lg:hidden fixed inset-0 z-50 bg-overlay transition-opacity duration-200",
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
          "rail lg:hidden fixed inset-y-0 left-0 z-50 w-[280px] max-w-[85vw] flex flex-col gap-4 overflow-y-auto overscroll-contain border-r border-border p-4 transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <RailConstellation />
        <div className="flex items-center justify-between">
          {isAgency ? (
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
        {renderTheme(false)}
        {liveFooter}
      </aside>

      {/* ---- Desktop rail (lg and up): the original sticky collapsible aside ---- */}
      {/* Holds the space the fixed rail occupies, so the board still lays out as a
          row instead of sliding under the navy. */}
      <div
        aria-hidden
        className={cn(
          "hidden lg:block shrink-0 transition-[width] duration-200",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      />
      <aside
        className={cn(
          // FIXED, not pulled up with negative margins. The rail sits inside
          // <main>, which is the scroll container, and a scroll container does not
          // expose overflow above its block-start edge: -mt-8 was applied and then
          // clipped, which is why a 32px cream band (exactly main's lg:p-8) stayed
          // across the top while -ml-8 reached the left edge fine.
          //
          // Taking it out of flow ends the argument. The spacer below holds the
          // row's geometry, and both read the same `collapsed` state, so the width
          // can never drift between them.
          "rail hidden lg:flex flex-col gap-4 px-3 py-6",
          "fixed left-0 top-0 z-30 h-screen overflow-y-auto overscroll-contain",
          "border-r border-rail-border transition-[width] duration-200",
          collapsed ? "w-[76px]" : "w-[264px]"
        )}
      >
        {/* Top row: back to agency (expanded) + collapse toggle */}
        <RailConstellation />
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {isAgency && !collapsed && (
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
        {renderTheme(collapsed)}

        {!collapsed && liveFooter}
      </aside>
    </>
  );
}
