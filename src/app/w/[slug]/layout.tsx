import { notFound } from "next/navigation";
import { WorkspaceSidebar } from "@/components/portal/WorkspaceSidebar";
import { DemoBanner } from "@/components/portal/DemoBanner";
import { getWorkspace, WORKSPACES } from "@/lib/portal/mock";
import { loadWorkspaces, loadListsMeta } from "@/lib/portal/data";
import { portalMode } from "@/lib/portal/access";
import { loadWorkspaceKind } from "@/lib/portal/data";

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
      ? all.map((w) => ({ slug: w.slug, name: w.name, accent: w.accent, kind: w.kind ?? "client" }))
      : [];
  // The sidebar lists each target list as its own menu item (4 tiny rows).
  const lists = await loadListsMeta(slug);

  return (
    <div className="w-full">
      {demo && <DemoBanner name={ws.name} />}
      {/* Mobile: column (sticky top bar above content). Desktop: original row. */}
      <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
        <WorkspaceSidebar slug={slug} ws={ws} workspaces={workspaces} lists={lists} demo={demo} mode={mode} kind={kind} />
        <div className="flex-1 w-full min-w-0 overflow-x-hidden pt-4 lg:pt-0 pb-10">{children}</div>
      </div>
    </div>
  );
}
