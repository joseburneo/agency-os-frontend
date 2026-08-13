"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

// Three states, not two. "System" is the honest default: someone who has their laptop on
// auto sunset expects an app to follow it, and a two-way switch quietly overrides that
// forever the first time it is touched.
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "lv-theme";

/** Runs before first paint, inlined in <head>. See the note in layout.tsx for why. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'system';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

function resolve(pref: ThemePref): boolean {
  if (pref === "dark") return true;
  if (pref === "light") return false;
  return typeof window !== "undefined"
    && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function paint(pref: ThemePref) {
  const dark = resolve(pref);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
  // Keep the mobile browser chrome in step. Without this the iOS status bar stays black
  // behind a white page, which reads as a rendering bug on a phone.
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0A0D14" : "#FFFFFF");
}

/** Read the stored preference, apply it, and keep following the OS while on "system". */
export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>("system");

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as ThemePref) || "system";
    setPref(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => {
      if (((localStorage.getItem(THEME_KEY) as ThemePref) || "system") === "system") {
        paint("system");
      }
    };
    mq.addEventListener("change", onOs);
    // Another tab changed the preference: follow it rather than drifting apart.
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) { const v = (e.newValue as ThemePref) || "system"; setPref(v); paint(v); }
    };
    window.addEventListener("storage", onStorage);
    return () => { mq.removeEventListener("change", onOs); window.removeEventListener("storage", onStorage); };
  }, []);

  const choose = (p: ThemePref) => {
    setPref(p);
    localStorage.setItem(THEME_KEY, p);
    paint(p);
  };

  return [pref, choose];
}

const OPTIONS: { key: ThemePref; icon: typeof Sun; label: string }[] = [
  { key: "light", icon: Sun, label: "Light" },
  { key: "system", icon: Monitor, label: "System" },
  { key: "dark", icon: Moon, label: "Dark" },
];

/**
 * The segmented control. `compact` drops the labels for a collapsed sidebar rail.
 *
 * Rendering note: before the effect has read localStorage the component believes the
 * preference is "system". Showing a highlight then would flash the wrong segment on
 * every load, so nothing is marked active until `ready`.
 */
export function ThemeToggle({ compact = false, className = "" }: { compact?: boolean; className?: string }) {
  const [pref, choose] = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={`inline-flex items-center gap-0.5 rounded-lg border border-border bg-secondary/40 p-0.5 ${className}`}
    >
      {OPTIONS.map(({ key, icon: Icon, label }) => {
        const active = ready && pref === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => choose(key)}
            // min-h-8 keeps every segment a comfortable tap target on a phone.
            className={`inline-flex items-center justify-center gap-1.5 rounded-md px-2 min-h-8 text-[11px] transition-colors ${
              active
                ? "bg-gold/15 text-gold-ink"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
