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
export function SectionLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-[11px] uppercase tracking-[0.2em] text-muted-foreground", className)}>
      <span className="opacity-40">// </span>
      {children}
    </div>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card", className)}>{children}</div>
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
    tone === "good" ? "text-[#26D07C]" : tone === "warn" ? "text-[#FFD60A]" : "text-foreground";
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
    gold: "bg-[#FFD60A]/10 text-[#FFD60A] border-[#FFD60A]/25",
    green: "bg-[#26D07C]/10 text-[#26D07C] border-[#26D07C]/25",
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
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20 shrink-0">
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
