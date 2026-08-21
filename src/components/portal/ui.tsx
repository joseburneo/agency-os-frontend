// Server-safe shared UI primitives for the portal. NO "use client" here — every
// export is a pure component or utility, so both server pages (which import
// values like CHANNEL_META / usd / cn) and client views can use them. The one
// stateful primitive, CompanyMark, lives in its own "use client" module and is
// re-exported below.
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Mail, MessageCircle, Phone, Radio, LayoutGrid } from "lucide-react";
import type { OutreachChannel, CampaignStatus } from "@/lib/portal/types";

export { CompanyMark } from "./CompanyMark";

export function cn(...i: ClassValue[]) {
  return twMerge(clsx(i));
}

// This project's lucide-react build drops brand glyphs (no `Linkedin`), so we
// ship our own. It mirrors the lucide prop surface (className/style/size), so it
// drops into ChannelDots, ModuleHeader, and nav exactly like a lucide icon.
export function Linkedin({ width = 24, height = 24, ...props }: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={width}
      height={height}
      fill="currentColor"
      aria-hidden="true"
      {...props}
    >
      <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.45c0-1.3-.02-2.97-1.8-2.97-1.8 0-2.08 1.4-2.08 2.87V21H9z" />
    </svg>
  );
}

// `// LABEL` — the dim terminal section marker used across the CRM.
// The LinkedIn mark in LinkedIn's blue, wherever the source matters (Find
// Prospects, LinkedIn Campaigns). It reads the --li-blue token rather than
// hardcoding, because #0A66C2 is tuned for a white page and goes muddy on the
// navy rail: globals.css lightens it inside .rail.
export function LinkedInMark({ className }: { className?: string }) {
  return <Linkedin className={className} width={16} height={16} style={{ color: "var(--li-blue)" }} />;
}

// The Brain, drawn as a MARK rather than an outline icon.
//
// It sits directly under LinkedIn's blue "in" in the rail, and a hairline lucide
// glyph beside a filled brand mark reads as a placeholder next to the real thing
// (Jose, 2026-08-21). So: a filled, lumpy brain in the brand gold with a Signal
// Green spark, which is the palette doing what it always does here — yellow
// leads, green means live. Built from overlapping circles instead of one clever
// path because this renders at 16px in a sidebar, where a detailed silhouette
// turns to mush and a lumpy blob with a split down the middle still reads as a
// brain.
export function BrainMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} className={className}
         aria-hidden="true" focusable="false">
      <g fill="var(--gold)">
        <circle cx="8.6" cy="8.4" r="3.5" />
        <circle cx="15.4" cy="8.4" r="3.5" />
        <circle cx="7.7" cy="12.8" r="3.4" />
        <circle cx="16.3" cy="12.8" r="3.4" />
        <circle cx="12" cy="10.4" r="4.1" />
        <circle cx="12" cy="14.6" r="3.1" />
      </g>
      {/* The fissure. Painted in the page ground so the two halves read apart at
          any size, and it follows the surface rather than the icon's own colour. */}
      <path d="M12 6.4v11.6" stroke="var(--background)" strokeWidth="1.25"
            strokeLinecap="round" fill="none" />
      {/* The spark: energy, and the only green on the icon. */}
      <path d="M19.4 2.6l.72 1.78 1.78.72-1.78.72-.72 1.78-.72-1.78L16.9 5.1l1.78-.72z"
            fill="var(--signal)" />
    </svg>
  );
}

export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] uppercase tracking-[0.2em] text-muted-foreground", className)}>
      {children}
    </div>
  );
}

// A panel is a piece of paper, and paper has margins. This had none, so every
// caller that did not think to add padding rendered text flush against the
// border: the magnet dashboard shipped that way and read as broken rather than
// plain. Padding belongs to the primitive, not to the memory of 68 call sites.
//
// twMerge resolves the override, so a panel that must be full-bleed (a table, a
// list that draws its own rows) passes p-0 and wins.
export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-5", className)}>{children}</div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "good" | "warn";
}) {
  const toneCls =
    tone === "good" ? "text-signal-ink" : tone === "warn" ? "text-gold-ink" : "text-foreground";
  return (
    <Panel className="p-4 flex flex-col gap-1">
      <div className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div>
      <div className={cn("text-2xl font-extrabold tabular-nums leading-none mt-1", toneCls)}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>}
    </Panel>
  );
}

export function Pill({
  children,
  tone = "muted",
  className,
}: {
  children: React.ReactNode;
  tone?: "muted" | "gold" | "green" | "red" | "blue";
  className?: string;
}) {
  const map: Record<string, string> = {
    muted: "bg-white/5 text-muted-foreground border-white/10",
    gold: "bg-gold/10 text-gold-ink border-gold/25",
    green: "bg-signal/10 text-signal-ink border-signal/25",
    red: "bg-red-500/10 text-red-400 border-red-500/25",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/25",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        map[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<CampaignStatus, "green" | "gold" | "muted" | "blue"> = {
  active: "green",
  paused: "gold",
  draft: "muted",
  completed: "blue",
};
export function StatusPill({ status }: { status: CampaignStatus }) {
  return <Pill tone={STATUS_TONE[status]}>{status}</Pill>;
}

const CHANNEL_META: Record<
  OutreachChannel,
  { icon: React.ComponentType<React.SVGProps<SVGSVGElement>>; label: string; color: string }
> = {
  email: { icon: Mail, label: "Email", color: "#FFD60A" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "#60A5FA" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp", color: "#26D07C" },
  call: { icon: Phone, label: "Call", color: "#F5F5F0" },
  ads: { icon: Radio, label: "LinkedIn Ads", color: "#A78BFA" },
};

export function ChannelDots({ channels, size = 13 }: { channels: OutreachChannel[]; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {channels.map((c) => {
        const m = CHANNEL_META[c];
        const Icon = m.icon;
        return <Icon key={c} style={{ width: size, height: size, color: m.color }} aria-label={m.label} />;
      })}
    </span>
  );
}

export { CHANNEL_META, LayoutGrid };

export function ModuleHeader({
  icon: Icon,
  title,
  desc,
  meta,
  actions,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc?: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="flex items-start gap-3 min-w-0">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-gold/10 text-gold-ink border border-gold/20 shrink-0">
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground leading-tight">{title}</h1>
          {desc && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{desc}</p>}
          {meta && <div className="mt-2">{meta}</div>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function HeatDot({ value }: { value: number }) {
  const color = value >= 70 ? "#26D07C" : value >= 45 ? "#FFD60A" : "#8A93A6";
  return (
    <span className="inline-flex items-center gap-1 text-[11px] tabular-nums" style={{ color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      {value}
    </span>
  );
}

export function usd(n: number) {
  return "$" + n.toLocaleString();
}
