import { notFound } from "next/navigation";
import { Settings as SettingsIcon, ShieldCheck, KeyRound } from "lucide-react";
import { getWorkspace } from "@/lib/portal/mock";
import { loadWorkspaces, loadWorkspaceKind } from "@/lib/portal/data";
import { WORKSPACES } from "@/lib/portal/mock";
import { portalMode } from "@/lib/portal/access";
import { hasOwnPassword, hasUsers, MIN_PASSWORD } from "@/lib/portal/auth";
import { ModuleHeader, Panel, SectionLabel, Pill } from "@/components/portal/ui";
import { ChannelConnect } from "./channels";
import { PasswordField } from "@/components/portal/PasswordField";

const ERRORS: Record<string, string> = {
  short: `Your new password needs at least ${MIN_PASSWORD} characters.`,
  badcurrent: "Your email or current password did not match.",
  email: "Enter the email you sign in with.",
  unauthorized: "You are not signed in to this workspace.",
  save: "Could not save — the credentials column may not be migrated yet.",
};

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const { slug } = await params;
  const { ok, error } = await searchParams;

  const mode = await portalMode(slug);
  if (mode === "demo") notFound(); // prospects have no account to manage

  const all = (await loadWorkspaces()) ?? WORKSPACES;
  const ws = all.find((w) => w.slug === slug) ?? getWorkspace(slug);
  if (!ws) notFound();

  const ownPassword = await hasOwnPassword(slug);
  // Per-person login (portal_users): the password belongs to a HUMAN, so the form
  // needs to know which one. The workspace cookie only proves the scope.
  const perPerson = await hasUsers(slug);
  // Connections are for paying client workspaces only. 41 of the 46 workspaces are
  // magnets — a prospect's gift, reachable on the bare link with no password — and
  // offering one of them a "connect your LinkedIn" button would be asking a stranger
  // for their session. The backend refuses them outright; this only hides the panel.
  const canConnect = (await loadWorkspaceKind(slug)) === "client";

  return (
    <div className="flex flex-col gap-7 max-w-2xl">
      <ModuleHeader
        icon={SettingsIcon}
        title="Settings"
        desc={canConnect
          ? `Connect your accounts and manage the ${ws.name} login.`
          : `Manage the ${ws.name} workspace login.`}
      />

      {/* Signed-in state */}
      <Panel className="p-5 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-signal/10 text-signal-ink border border-signal/20">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold text-foreground">
            Signed in as {mode === "agency" ? "Agency (master)" : ws.name}
          </div>
          <div className="text-[12px] text-muted-foreground">
            {mode === "agency"
              ? "You can manage any workspace's login."
              : "This is your private workspace login."}
          </div>
        </div>
        <Pill tone={mode === "agency" ? "gold" : "green"}>{mode === "agency" ? "Agency" : "Client"}</Pill>
      </Panel>

      {/* Connections — LinkedIn, email, WhatsApp */}
      {canConnect && (
        <Panel className="p-5">
          <ChannelConnect slug={slug} />
        </Panel>
      )}

      {/* Change password */}
      <Panel className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-gold-ink" />
          <SectionLabel>Change password</SectionLabel>
        </div>

        {perPerson && mode === "agency" && (
          <div className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3.5 py-2.5 text-[12px] text-foreground">
            This workspace signs in per person. To give someone a new password, send them a
            reset link from the CRM instead of changing it here.
          </div>
        )}
        {!ownPassword && !perPerson && (
          <div className="rounded-lg border border-gold/25 bg-gold/[0.06] px-3.5 py-2.5 text-[12px] text-foreground">
            You are using a temporary password. Set your own below to secure your workspace.
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-signal/25 bg-signal/[0.06] px-3.5 py-2.5 text-[12px] text-signal-ink">
            Password updated.
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-500/25 bg-red-500/[0.06] px-3.5 py-2.5 text-[12px] text-red-400">
            {ERRORS[error] ?? "Something went wrong."}
          </div>
        )}

        <form method="post" action="/api/account/password" className="flex flex-col gap-3">
          <input type="hidden" name="slug" value={slug} />
          {perPerson && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Your email
              </span>
              <input
                type="email"
                name="email"
                required
                autoComplete="username"
                placeholder="you@company.com"
                className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground placeholder:text-subtle outline-none focus:border-gold/50"
              />
            </label>
          )}
          {(perPerson || mode !== "agency") && (
            <PasswordField
              name="current"
              label={ownPassword ? "Current password" : "Temporary password"}
              required
              autoComplete="current-password"
              invalid={error === "badcurrent"}
            />
          )}
          <PasswordField
            name="new"
            label="New password"
            required
            minLength={MIN_PASSWORD}
            autoComplete="new-password"
            invalid={error === "short"}
          />
          <button
            type="submit"
            className="mt-1 h-11 rounded-lg bg-gold text-sm font-bold text-ink-inverse transition-colors hover:bg-gold-hi self-start px-6"
          >
            Update password
          </button>
        </form>
      </Panel>
    </div>
  );
}
