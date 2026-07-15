"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Megaphone, LayoutGrid } from "lucide-react";

// A slim icon rail on desktop (hidden on mobile, where MobileNav's bottom bar takes over).
// Agency-level nav: the platform home (all workspaces), the internal CRM, and the
// campaign monitor. Per-workspace module nav lives in <WorkspaceSidebar/>.
const NAV = [
  { href: "/", label: "Workspaces", icon: LayoutGrid, match: (p: string | null) => p === "/" || p?.startsWith("/w") },
  { href: "/crm", label: "CRM", icon: Users, match: (p: string | null) => p?.startsWith("/crm") },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, match: (p: string | null) => p?.startsWith("/campaigns") },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden md:flex w-[60px] h-screen border-r border-border bg-card flex-col items-center shrink-0 py-4">
      {/* logomark */}
      <Link href="/" aria-label="Luxvance" className="mb-6 text-lg font-bold tracking-tight text-foreground">
        L<span className="text-[#FFD60A]">V</span>
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
                  ? "bg-[#FFD60A]/12 text-[#FFD60A]"
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

      {/* account */}
      <div className="w-8 h-8 rounded-full bg-secondary border border-border grid place-items-center text-xs font-semibold text-[#FFD60A]">
        JB
      </div>
    </aside>
  );
}
