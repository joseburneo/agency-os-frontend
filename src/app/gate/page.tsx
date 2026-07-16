import { Lock, ShieldCheck } from "lucide-react";
import { prettySlug } from "@/lib/portal/gate";

// Scope-aware access gate. Pure server component + HTML form (no client JS).
// scope="agency" → Jose's command centre; scope=<slug> → that client's portal.

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; scope?: string }>;
}) {
  const { next = "/", error, scope = "agency" } = await searchParams;
  const isAgency = scope === "agency";
  const name = isAgency ? "Luxvance" : prettySlug(scope);
  const eyebrow = isAgency ? "Luxvance · Agency" : name;
  const title = isAgency ? "Agency access" : "Private workspace";
  const blurb = isAgency
    ? "Your command centre across every workspace. Enter your agency key to continue."
    : "This portal is invite-only. Enter your access key to continue.";
  const Icon = isAgency ? ShieldCheck : Lock;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0A0D14] px-6 font-mono">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 30%, rgba(255,214,10,0.08), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-[#FFD60A]/25 bg-[#FFD60A]/10">
            <Icon className="h-5 w-5 text-[#FFD60A]" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#8A93A6]">{eyebrow}</div>
          <h1 className="mt-2 text-lg font-bold text-[#EDEFF2]">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A93A6]">{blurb}</p>
        </div>

        <form
          method="post"
          action="/api/gate"
          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="scope" value={scope} />
          <label className="text-[10px] uppercase tracking-[0.16em] text-[#8A93A6]">
            {isAgency ? "Agency key" : "Access key"}
          </label>
          <input
            type="password"
            name="password"
            autoFocus
            required
            placeholder="••••••••••••"
            aria-invalid={error ? true : undefined}
            className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-[#EDEFF2] placeholder:text-[#8A93A6]/60 outline-none focus:border-[#FFD60A]/50 focus:ring-1 focus:ring-[#FFD60A]/40"
          />
          {error && (
            <p className="text-[12px] text-red-400">That key didn&apos;t match. Try again.</p>
          )}
          <button
            type="submit"
            className="mt-1 h-11 rounded-lg bg-[#FFD60A] text-sm font-bold text-[#0A0E1A] transition-colors hover:bg-[#ffdf3a]"
          >
            {isAgency ? "Enter command centre" : "Enter workspace"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#8A93A6]/70">
          Precision Leads. Engineered by Intelligence.
        </p>
      </div>
    </div>
  );
}
