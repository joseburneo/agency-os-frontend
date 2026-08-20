import { KeyRound } from "lucide-react";
import { MIN_PASSWORD } from "@/lib/portal/auth";

// Where an invite / reset link lands. The token stays in the URL only long enough
// to be posted back with the new password; nothing about the account is revealed
// here, so a stale or guessed link shows the same page and fails on submit.

export default async function SetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string; error?: string; done?: string; slug?: string }>;
}) {
  const { t = "", error, done, slug } = await searchParams;

  if (done) {
    // Straight to their OWN workspace gate. Bare /gate is the agency gate, where a
    // client's credentials cannot match by design.
    const signIn = slug
      ? `/gate?scope=${encodeURIComponent(slug)}&next=${encodeURIComponent(`/w/${slug}`)}`
      : "/gate";
    return (
      <Shell title="Password saved" blurb="You can sign in with your email and your new password.">
        <a href={signIn}
          className="mt-1 grid h-11 place-items-center rounded-lg bg-gold text-sm font-bold text-ink-inverse transition-colors hover:bg-gold-hi">
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
        <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">New password</label>
        <input
          type="password" name="password" autoFocus required minLength={MIN_PASSWORD}
          autoComplete="new-password" placeholder="••••••••"
          className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-subtle outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/40"
        />
        <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Repeat it</label>
        <input
          type="password" name="confirm" required minLength={MIN_PASSWORD}
          autoComplete="new-password" placeholder="••••••••"
          className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-subtle outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/40"
        />
        <p className="text-[11px] text-subtle">At least {MIN_PASSWORD} characters.</p>
        {error && <p className="text-[12px] text-red-400">{decodeURIComponent(error)}</p>}
        <button type="submit"
          className="mt-1 h-11 rounded-lg bg-gold text-sm font-bold text-ink-inverse transition-colors hover:bg-gold-hi">
          Save password
        </button>
      </form>
    </Shell>
  );
}

function Shell({ title, blurb, children }: { title: string; blurb: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background px-6 font-mono">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60"
        style={{ background: "radial-gradient(60% 50% at 50% 30%, rgba(255,214,10,0.08), transparent 70%)" }} />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-gold/25 bg-gold/10">
            <KeyRound className="h-5 w-5 text-gold-ink" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Luxvance</div>
          <h1 className="mt-2 text-lg font-bold text-foreground">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{blurb}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">{children}</div>
        <p className="mt-6 text-center text-[11px] text-subtle">
          Precision Leads. Engineered by Intelligence.
        </p>
      </div>
    </div>
  );
}
