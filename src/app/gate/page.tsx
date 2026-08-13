import { Lock, ShieldCheck } from "lucide-react";
import { prettySlug } from "@/lib/portal/gate";
import { hasUsers } from "@/lib/portal/auth";

// Scope-aware access gate. Pure server component + HTML form (no client JS).
// scope="agency" → Jose's command centre; scope=<slug> → that client's portal.

export default async function GatePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; scope?: string }>;
}) {
  const { next = "/", error, scope = "agency" } = await searchParams;
  const isAgency = scope === "agency";
  // A client workspace with real people on it signs in with email + password.
  // One still on the shared bootstrap key keeps the single-field form.
  // The agency gate always offers the email field: named superadmin accounts sign
  // in there, and PORTAL_AGENCY_PASSWORD stays as break-glass — which is why the
  // field is optional rather than required for that scope.
  const withEmail = isAgency || (await hasUsers(scope));
  const name = isAgency ? "Luxvance" : prettySlug(scope);
  const eyebrow = isAgency ? "Luxvance · Agency" : name;
  const title = isAgency ? "Agency access" : withEmail ? "Sign in" : "Private workspace";
  const blurb = isAgency
    ? "Your command centre across every workspace. Enter your agency key to continue."
    : withEmail
      ? "Sign in with the email we set up for you."
      : "This portal is invite-only. Enter your access key to continue.";
  const Icon = isAgency ? ShieldCheck : Lock;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-background px-6 font-mono">
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
          <div className="mx-auto mb-5 grid h-12 w-12 place-items-center rounded-xl border border-gold/25 bg-gold/10">
            <Icon className="h-5 w-5 text-gold-ink" />
          </div>
          <div className="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</div>
          <h1 className="mt-2 text-lg font-bold text-foreground">{title}</h1>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">{blurb}</p>
        </div>

        <form
          method="post"
          action="/api/gate"
          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-5"
        >
          <input type="hidden" name="next" value={next} />
          <input type="hidden" name="scope" value={scope} />
          {withEmail && (
            <>
              <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Email{isAgency ? " (or leave blank for the shared key)" : ""}
              </label>
              <input
                type="email"
                name="email"
                autoFocus
                required={!isAgency}
                autoComplete="username"
                placeholder="you@company.com"
                aria-invalid={error ? true : undefined}
                className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/40"
              />
            </>
          )}
          <label className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {isAgency ? "Password or agency key" : withEmail ? "Password" : "Access key"}
          </label>
          <input
            type="password"
            name="password"
            autoFocus={!withEmail}
            required
            autoComplete={withEmail ? "current-password" : "off"}
            placeholder="••••••••••••"
            aria-invalid={error ? true : undefined}
            className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/40"
          />
          {error === "rate" ? (
            <p className="text-[12px] text-red-400">Too many attempts. Wait a few minutes.</p>
          ) : error ? (
            <p className="text-[12px] text-red-400">
              {withEmail ? "That email and password didn't match." : "That key didn't match. Try again."}
            </p>
          ) : null}
          <button
            type="submit"
            className="mt-1 h-11 rounded-lg bg-gold text-sm font-bold text-ink-inverse transition-colors hover:bg-gold-hi"
          >
            {isAgency ? "Enter command centre" : withEmail ? "Sign in" : "Enter workspace"}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-muted-foreground/70">
          Precision Leads. Engineered by Intelligence.
        </p>
      </div>
    </div>
  );
}
