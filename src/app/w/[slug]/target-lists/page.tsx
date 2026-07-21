import { notFound } from "next/navigation";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { assertModuleVisible, portalMode } from "@/lib/portal/access";
import { loadTargetLists } from "@/lib/portal/data";
import { TargetListsView } from "./view";

export default async function TargetListsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "target-lists");
  const mode = await portalMode(slug);

  // Prefer live Supabase (service key present); fall back to mock otherwise.
  // Everyone reads the real addresses, including a magnet prospect on a demo link:
  // the list IS the lead magnet, and a masked list demos nothing. What a demo
  // prospect cannot do is walk off with the file — see canExport below.
  const live = await loadTargetLists(slug, { unmask: true });
  const canExport = mode !== "demo";
  if (live) {
    const base = getWorkspaceData(slug); // other modules' mock slices, unused here
    const data = { ...(base ?? EMPTY_DATA), lists: live.lists, leads: live.leads };
    return <TargetListsView ws={live.ws} data={data} canExport={canExport} />;
  }

  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();
  return <TargetListsView ws={ws} data={data} canExport={canExport} />;
}

const EMPTY_DATA = {
  kpis: [], activity: [], lists: [], leads: [], emailCampaigns: [],
  linkedinCampaigns: [], phoneTouches: [], content: [], crm: [], library: [], journey: [],
};
