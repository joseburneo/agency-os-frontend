import { notFound } from "next/navigation";
import { WorkspaceSidebar } from "@/components/portal/WorkspaceSidebar";
import { getWorkspace, WORKSPACES } from "@/lib/portal/mock";
import { loadWorkspaces } from "@/lib/portal/data";

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

  const workspaces = all.map((w) => ({ slug: w.slug, name: w.name, accent: w.accent }));

  return (
    <div className="flex gap-6 items-start max-w-[1500px] mx-auto">
      <WorkspaceSidebar slug={slug} ws={ws} workspaces={workspaces} />
      <div className="flex-1 min-w-0 pb-10">{children}</div>
    </div>
  );
}
