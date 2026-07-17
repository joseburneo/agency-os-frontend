import { getWorkspace } from "@/lib/portal/mock";
import { assertModuleVisible } from "@/lib/portal/access";
import { loadWorkspace, loadRoadmap } from "@/lib/portal/data";
import { RoadmapView } from "./view";

// Client Success Roadmap: the delivery story. Everything Luxvance has shipped
// for this workspace since kickoff, plus what's in flight and what's planned.
// Its own module — separate from the Intelligence Library.
export default async function RoadmapPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "roadmap");

  const [live, items] = await Promise.all([loadWorkspace(slug), loadRoadmap(slug)]);
  const wsName = live?.name ?? getWorkspace(slug)?.name ?? slug;
  return <RoadmapView wsName={wsName} items={items} />;
}
