import { notFound } from "next/navigation";
import { WorkspaceSidebar } from "@/components/portal/WorkspaceSidebar";
import { DemoBanner } from "@/components/portal/DemoBanner";
import { getWorkspace, WORKSPACES } from "@/lib/portal/mock";
import { loadWorkspaces } from "@/lib/portal/data";
import { portalMode } from "@/lib/portal/access";

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
  const demo = mode === "demo";
  // In demo the prospect can't hop to other workspaces; the switcher is hidden.
  const workspaces = demo ? [] : all.map((w) => ({ slug: w.slug, name: w.name, accent: w.accent }));

  return (
    <div className="w-full">
      {demo && <DemoBanner name={ws.name} />}
      {/* Mobile: column (sticky top bar above content). Desktop: original row. */}
      <div className="flex flex-col lg:flex-row lg:gap-6 lg:items-start">
        <WorkspaceSidebar slug={slug} ws={ws} workspaces={workspaces} demo={demo} mode={mode} />
        <div className="flex-1 w-full min-w-0 overflow-x-hidden pt-4 lg:pt-0 pb-10">{children}</div>
      </div>
    </div>
  );
}
