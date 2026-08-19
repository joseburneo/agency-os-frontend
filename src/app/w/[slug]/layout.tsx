import { notFound } from "next/navigation";
import { WorkspaceSidebar } from "@/components/portal/WorkspaceSidebar";
import { DemoBanner } from "@/components/portal/DemoBanner";
import { VisitBeacon } from "@/components/portal/VisitBeacon";
import { getWorkspace, WORKSPACES } from "@/lib/portal/mock";
import { loadWorkspaces, loadListsMeta } from "@/lib/portal/data";
import { portalMode } from "@/lib/portal/access";
import { loadWorkspaceKind } from "@/lib/portal/data";

// The tab belongs to the client: their favicon and their name, not ours (Jose,
// 30 jul — "esto es TU workspace"). Same logo source CompanyMark already uses;
// workspaces without a domain keep the LV icon.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const all = (await loadWorkspaces()) ?? WORKSPACES;
  const ws = all.find((w) => w.slug === slug) ?? getWorkspace(slug) ?? null;
  if (!ws) return {};
  // The agency's own workspaces (and anything on our domain) keep the LV icon;
  // only prospect/client workspaces wear their company's favicon.
  const ownBrand = ws.isAgency || !ws.domain || /luxvance\.com$/i.test(ws.domain);
  return {
    title: ws.name,
    ...(ownBrand
      ? {}
      : { icons: { icon: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(ws.domain!)}&sz=64` } }),
  };
}

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  // Live workspaces (real cold counts) with a mock fallback for local dev.
  const all = (await loadWorkspaces()) ?? WORKSPACES;
  const ws = all.find((w) => w.slug === slug) ?? getWorkspace(slug) ?? null;
  if (!ws) notFound();

  const mode = await portalMode(slug);
  const kind = await loadWorkspaceKind(slug);
  const demo = mode === "demo";
  // ONLY the agency gets the roster. A client must never learn who the other
  // clients are: the switcher used to be hidden from demo alone, so a paying
  // client was served every workspace name in their page payload.
  const workspaces =
    mode === "agency"
      ? all.map((w) => ({ slug: w.slug, name: w.name, accent: w.accent, kind: w.kind ?? "client", domain: w.domain, isAgency: w.isAgency }))
      : [];
  // The sidebar lists each target list as its own menu item (4 tiny rows).
  const lists = await loadListsMeta(slug);

  return (
    <div className="w-full">
      {/* Open tracking, magnets only. The beacon fires client-side (past any ISR
          cache) and the route ATTRIBUTES the visit rather than dropping it: our
          own previews are recorded as agency, the delivered link's token marks
          the prospect, anything else is unknown. It renders for agency sessions
          too now, because "Jose looked at it" is worth knowing and is only
          misleading when it is silently filed as the prospect. */}
      {kind === "magnet" && <VisitBeacon slug={slug} />}
      {demo && <DemoBanner name={ws.name} />}
      {/* Mobile: column (sticky top bar above content). Desktop: original row. */}
      <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
        <WorkspaceSidebar slug={slug} ws={ws} workspaces={workspaces} lists={lists} demo={demo} mode={mode} kind={kind} />
        <div className="flex-1 w-full min-w-0 overflow-x-hidden pt-4 lg:pt-0 pb-10">{children}</div>
      </div>
    </div>
  );
}
