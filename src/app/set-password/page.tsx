import { KeyRound } from "lucide-react";
import { MIN_PASSWORD } from "@/lib/portal/auth";

// Where an invite / reset link lands. The token stays in the URL only long enough
// to be posted back with the new password; nothing about the account is revealed
// here, so a stale or guessed link shows the same page and fails on submit.

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; error?: string; done?: string }>;
}) {
  const { t = "", error, done } = await searchParams;

  if (done) {
    return (
      <Shell title="Password saved" blurb="You can sign in with your email and your new password.">
        <a href="/gate"
          className="mt-1 grid h-11 place-items-center rounded-lg bg-[#FFD60A] text-sm font-bold text-[#0A0E1A] transition-colors hover:bg-[#ffdf3a]">
          Go to sign in
        </a>
      </Shell>
    );
  }

  return (
    <Shell
      title="Set your password"
      blurb="Choose a password for your Luxvance account. Your username is the email this link was sent to."
    >
      <form method="post" action="/api/portal-users/set-password" className="flex flex-col gap-3">
        <input type="hidden" name="token" value={t} />
        <label className="text-[10px] uppercase tracking-[0.16em] text-[#8A93A6]">New password</label>
        <input
          type="password" name="password" autoFocus required minLength={MIN_PASSWORD}
          autoComplete="new-password" placeholder="••••••••"
          className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-[#EDEFF2] placeholder:text-[#8A93A6]/60 outline-none focus:border-[#FFD60A]/50 focus:ring-1 focus:ring-[#FFD60A]/40"
        />
        <label className="text-[10px] uppercase tracking-[0.16em] text-[#8A93A6]">Repeat it</label>
        <input
          type="password" name="confirm" required minLength={MIN_PASSWORD}
          autoComplete="new-password" placeholder="••••••••"
          className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-[#EDEFF2] placeholder:text-[#8A93A6]/60 outline-none focus:border-[#FFD60A]/50 focus:ring-1 focus:ring-[#FFD60A]/40"
        />
        <p className="text-[11px] text-[#8A93A6]/80">At least {MIN_PASSWORD} characters.</p>
        {error && <p className="text-[12px] text-red-400">{decodeURIComponent(error)}</p>}
        <button type="submit"
          className="mt-1 h-11 rounded-lg bg-[#FFD60A] text-sm font-bold text-[#0A0E1A] transition-colors hover:bg-[#ffdf3a]">
          Save password
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[#0A0D14] px-6 font-mono">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 50% at 50% 30%, rgba(255,214,10,0.08), transparent 70%)" }} />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-[#FFD60A]/25 bg-[#FFD60A]/10">
            <KeyRound className="h-5 w-5 text-[#FFD60A]" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-[#8A93A6]">Luxvance</div>
          <h1 className="mt-2 text-lg font-bold text-[#EDEFF2]">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#8A93A6]">{blurb}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">{children}</div>
        <p className="mt-6 text-center text-[11px] text-[#8A93A6]/70">
          Precision Leads. Engineered by Intelligence.
        </p>
      </div>
    </div>
  );
}
