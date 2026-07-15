import { Lock } from "lucide-react";

// Shared-password gate. Pure server component + HTML form (no client JS) so it
// works even before hydration. Rendered full-screen (fixed inset-0) to cover the
// app chrome from the root layout.

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next = "/", error } = await searchParams;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0A0D14] px-6 font-mono">
      {/* ambient glow */}
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
            <Lock className="h-5 w-5 text-[#FFD60A]" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#8A93A6]">
            Luxvance
          </div>
          <h1 className="mt-2 text-lg font-bold text-[#EDEFF2]">Private workspace</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A93A6]">
            This portal is invite-only. Enter your access key to continue.
          </p>
        </div>

        <form
          method="post"
          action="/api/gate"
          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <input type="hidden" name="next" value={next} />
          <label className="text-[10px] uppercase tracking-[0.16em] text-[#8A93A6]">
            Access key
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
            <p className="text-[12px] text-red-400">
              That key didn&apos;t match. Try again.
            </p>
          )}
          <button
            type="submit"
            className="mt-1 h-11 rounded-lg bg-[#FFD60A] text-sm font-bold text-[#0A0E1A] transition-colors hover:bg-[#ffdf3a]"
          >
            Enter workspace
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-[#8A93A6]/70">
          Precision Leads. Engineered by Intelligence.
        </p>
      </div>
    </div>
  );
}
