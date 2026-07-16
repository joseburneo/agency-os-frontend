import { notFound } from "next/navigation";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { assertModuleVisible } from "@/lib/portal/access";
import { loadTargetLists } from "@/lib/portal/data";
import { TargetListsView } from "./view";

export default async function TargetListsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "target-lists");

  // Prefer live Supabase (service key present); fall back to mock otherwise.
  const live = await loadTargetLists(slug);
  if (live) {
    const base = getWorkspaceData(slug); // other modules' mock slices, unused here
    const data = { ...(base ?? EMPTY_DATA), lists: live.lists, leads: live.leads };
    return <TargetListsView ws={live.ws} data={data} />;
  }

  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();
  return <TargetListsView ws={ws} data={data} />;
}

const EMPTY_DATA = {
  kpis: [], activity: [], lists: [], leads: [], emailCampaigns: [],
  linkedinCampaigns: [], phoneTouches: [], content: [], crm: [], library: [], journey: [],
};
