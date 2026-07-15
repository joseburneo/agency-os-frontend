"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Megaphone } from "lucide-react";

// The mobile counterpart of the sidebar: a fixed bottom tab bar (the native-app pattern),
// shown only under md where the 256px sidebar would otherwise eat most of a phone screen.
// Same two destinations as the sidebar; respects the iPhone home-indicator safe area.
const NAV = [
  { href: "/crm", label: "CRM", icon: Users, match: (p: string | null) => p?.startsWith("/crm") },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, match: (p: string | null) => p?.startsWith("/campaigns") },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur flex"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map(({ href, label, icon: Icon, match }) => {
        const active = match(pathname);
        return (
          <Link
            key={href}
            href={href}
            className={`flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
              active ? "text-[#FFD60A]" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
