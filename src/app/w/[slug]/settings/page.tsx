import { notFound } from "next/navigation";
import { Settings as SettingsIcon, ShieldCheck, KeyRound } from "lucide-react";
import { getWorkspace } from "@/lib/portal/mock";
import { loadWorkspaces } from "@/lib/portal/data";
import { WORKSPACES } from "@/lib/portal/mock";
import { portalMode } from "@/lib/portal/access";
import { hasOwnPassword } from "@/lib/portal/auth";
import { ModuleHeader, Panel, SectionLabel, Pill } from "@/components/portal/ui";

const ERRORS: Record<string, string> = {
  short: "Your new password needs at least 6 characters.",
  badcurrent: "Your current password did not match.",
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

  return (
    <div className="flex flex-col gap-7 max-w-2xl">
      <ModuleHeader
        icon={SettingsIcon}
        title="Settings"
        desc={`Manage the ${ws.name} workspace login.`}
      />

      {/* Signed-in state */}
      <Panel className="p-5 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#26D07C]/10 text-[#26D07C] border border-[#26D07C]/20">
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

      {/* Change password */}
      <Panel className="p-5 flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[#FFD60A]" />
          <SectionLabel>Change password</SectionLabel>
        </div>

        {!ownPassword && (
          <div className="rounded-lg border border-[#FFD60A]/25 bg-[#FFD60A]/[0.06] px-3.5 py-2.5 text-[12px] text-foreground">
            You are using a temporary password. Set your own below to secure your workspace.
          </div>
        )}
        {ok && (
          <div className="rounded-lg border border-[#26D07C]/25 bg-[#26D07C]/[0.06] px-3.5 py-2.5 text-[12px] text-[#26D07C]">
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
          {mode !== "agency" && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                {ownPassword ? "Current password" : "Temporary password"}
              </span>
              <input
                type="password"
                name="current"
                required
                autoComplete="current-password"
                className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground outline-none focus:border-[#FFD60A]/50"
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">New password</span>
            <input
              type="password"
              name="new"
              required
              minLength={6}
              autoComplete="new-password"
              className="h-11 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-sm text-foreground outline-none focus:border-[#FFD60A]/50"
            />
          </label>
          <button
            type="submit"
            className="mt-1 h-11 rounded-lg bg-[#FFD60A] text-sm font-bold text-[#0A0E1A] transition-colors hover:bg-[#ffdf3a] self-start px-6"
          >
            Update password
          </button>
        </form>
      </Panel>
    </div>
  );
}
