import { notFound } from "next/navigation";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { TargetListsView } from "./view";

export default async function TargetListsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();

  return <TargetListsView ws={ws} data={data} />;
}
