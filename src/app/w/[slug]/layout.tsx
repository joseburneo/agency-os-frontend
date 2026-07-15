import { notFound } from "next/navigation";
import { WorkspaceSidebar } from "@/components/portal/WorkspaceSidebar";
import { getWorkspace } from "@/lib/portal/mock";

export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!getWorkspace(slug)) notFound();

  return (
    <div className="flex gap-6 items-start max-w-[1500px] mx-auto">
      <WorkspaceSidebar slug={slug} />
      <div className="flex-1 min-w-0 pb-10">{children}</div>
    </div>
  );
}
