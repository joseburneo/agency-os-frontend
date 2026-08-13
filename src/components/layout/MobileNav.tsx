"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Megaphone, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme/ThemeToggle";

// The mobile counterpart of the sidebar: a fixed bottom tab bar (the native-app pattern),
// shown only under md where the 256px sidebar would otherwise eat most of a phone screen.
// Same two destinations as the sidebar; respects the iPhone home-indicator safe area.
const NAV = [
  { href: "/w/luxvance/crm", label: "CRM", icon: Users, match: (p: string | null) => p?.includes("/crm") },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, match: (p: string | null) => p?.startsWith("/campaigns") },
];

// The three-segment control does not fit a phone tab bar beside two destinations, and it
// does not need to: one tab that cycles system -> light -> dark reaches every state in at
// most two taps, and its icon always shows where you are. The agency routes have no
// sidebar under `md`, so without this there would be no way to change the theme on a phone
// at all — the workspace routes get the full control inside their drawer.
const CYCLE = { system: "light", light: "dark", dark: "system" } as const;
const THEME_ICON = { system: Monitor, light: Sun, dark: Moon };

export function MobileNav() {
  const pathname = usePathname();
  const [pref, choose] = useTheme();
  const ThemeIcon = THEME_ICON[pref];
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
              active ? "text-gold-ink" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-5 h-5" />
            {label}
          </Link>
        );
      })}
      <button
        onClick={() => choose(CYCLE[pref])}
        aria-label={`Theme: ${pref}. Tap to switch.`}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground active:text-gold-ink transition-colors"
      >
        <ThemeIcon className="w-5 h-5" />
        Theme
      </button>
    </nav>
  );
}
