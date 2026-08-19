"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, BookOpen } from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

// A slim icon rail on desktop (hidden on mobile, where MobileNav's bottom bar takes over).
// Agency-level nav only. Inside a workspace (/w/<slug>) the <WorkspaceSidebar/>
// owns the whole nav — including switcher, settings and sign out — so this rail
// hides there to avoid a confusing double nav and wasted left space.
const NAV = [
  { href: "/", label: "Overview", icon: LayoutGrid, match: (p: string | null) => p === "/" },
  { href: "/handbook", label: "Handbook", icon: BookOpen, match: (p: string | null) => Boolean(p?.startsWith("/handbook")) },
];

export function Sidebar() {
  const pathname = usePathname();
  // One nav per context: the workspace sidebar takes over inside /w/<slug>.
  if (pathname?.startsWith("/w/")) return null;
  return (
    // Same navy rail as inside a workspace. It was the last surface still on the
    // page colour, so moving between /campaigns and /w/<slug> looked like moving
    // between two products. `rail` re-points the semantic tokens inside itself, so
    // the nav below keeps using text-foreground and bg-secondary and simply lands
    // on the navy versions.
    <aside className="rail hidden md:flex w-[60px] h-screen border-r border-rail-border flex-col items-center shrink-0 py-4">
      {/* logomark */}
      <Link href="/" aria-label="Luxvance" className="mb-6 text-lg font-bold tracking-tight text-foreground">
        L<span className="text-gold-ink">V</span>
      </Link>

      <nav className="flex-1 flex flex-col items-center gap-2">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              className={`group relative grid place-items-center w-10 h-10 rounded-lg transition-colors ${
                active
                  ? "bg-gold/12 text-gold-ink"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <Icon className="w-5 h-5" />
              {/* hover label */}
              <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50">
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Theme, above the account. Compact because this rail is icon-width. */}
      <ThemeToggle compact className="mb-2 flex-col" />

      {/* account · sign out of the agency session */}
      <form action="/api/logout" method="post">
        <input type="hidden" name="scope" value="agency" />
        <button
          type="submit"
          title="Sign out"
          aria-label="Sign out"
          className="group relative w-8 h-8 rounded-full bg-secondary border border-border grid place-items-center text-xs font-semibold text-gold-ink hover:text-foreground hover:border-white/20 transition-colors"
        >
          JB
          <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-1 text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity z-50">
            Sign out
          </span>
        </button>
      </form>
    </aside>
  );
}
