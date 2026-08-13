"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

// Three states, not two. "System" is the honest default: someone who has their laptop on
// auto sunset expects an app to follow it, and a two-way switch quietly overrides that
// forever the first time it is touched.
export type ThemePref = "system" | "light" | "dark";

export const THEME_KEY = "lv-theme";

/**
 * What someone who has never chosen gets.
 *
 * "system" is the better answer and where this should land. It ships as "dark" because
 * light mode has not been looked at by a human on every page yet, and "system" would have
 * flipped every client whose laptop is on light — Paul opening his portal to a theme
 * nobody had reviewed. Opt-in first, default second. Change this one word to "system"
 * once light has been walked through, and everyone who never touched the toggle follows
 * their OS from then on.
 */
export const DEFAULT_THEME: ThemePref = "dark";

/** Runs before first paint, inlined in <head>. See the note in layout.tsx for why. */
export const THEME_BOOT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}')||'${DEFAULT_THEME}';var d=p==='dark'||(p==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var e=document.documentElement;e.classList.toggle('dark',d);e.style.colorScheme=d?'dark':'light';}catch(e){}})();`;

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
    ?.setAttribute("content", dark ? "#0A0D14" : "#F6F4EF");
}

/** Read the stored preference, apply it, and keep following the OS while on "system". */
export function useTheme(): [ThemePref, (p: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(DEFAULT_THEME);

  useEffect(() => {
    const stored = (localStorage.getItem(THEME_KEY) as ThemePref) || DEFAULT_THEME;
    setPref(stored);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onOs = () => {
      if (((localStorage.getItem(THEME_KEY) as ThemePref) || DEFAULT_THEME) === "system") {
        paint("system");
      }
    };
    mq.addEventListener("change", onOs);
    // Another tab changed the preference: follow it rather than drifting apart.
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) { const v = (e.newValue as ThemePref) || DEFAULT_THEME; setPref(v); paint(v); }
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
 * Rendering note: before the effect has read localStorage the component only knows
 * DEFAULT_THEME. Showing a highlight then would flash the wrong segment on every load for
 * anyone who has chosen otherwise, so nothing is marked active until `ready`.
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
