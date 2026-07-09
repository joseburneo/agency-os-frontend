"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Megaphone } from "lucide-react";

const NAV = [
  { href: "/crm", label: "CRM", icon: Users, match: (p: string | null) => p?.startsWith("/crm") },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, match: (p: string | null) => p?.startsWith("/campaigns") },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 h-screen border-r border-border bg-card flex flex-col shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-border">
        <span className="text-lg font-bold tracking-tight text-foreground">
          LUX<span className="text-[#FFD60A]">V</span>ANCE
        </span>
      </div>
      <div className="px-4 pt-5 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Cockpit</span>
      </div>
      <nav className="flex-1 px-4 space-y-1">
        {NAV.map(({ href, label, icon: Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                active
                  ? "bg-[#FFD60A]/10 text-[#FFD60A]"
                  : "text-muted-foreground hover:bg-secondary hover:text-secondary-foreground"
              }`}
            >
              <Icon className="w-4 h-4 mr-3" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Prospects who replied · live follow-up cadence. Sends are approved in Slack.
        </p>
      </div>
    </aside>
  );
}
