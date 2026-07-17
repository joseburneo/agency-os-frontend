import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/portal/mock";
import { assertModuleVisible } from "@/lib/portal/access";
import { loadWorkspace } from "@/lib/portal/data";
import { CADENCE_MODULE } from "@/lib/portal/modules";
import { getCadenceContent } from "./content";
import { CadenceView } from "./view";

// Sequence & Schedule: the full multi-channel journey (every email and LinkedIn
// touch with its exact copy) plus the sending windows and daily limits.
// Migrated from the original builds portal's "Sequence & channels" and
// "Schedule & limits" views so the old portal can retire without losing them.
export default async function CadencePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, CADENCE_MODULE);

  const live = await loadWorkspace(slug);
  const ws = live ?? getWorkspace(slug);
  if (!ws) notFound();
  return <CadenceView wsName={ws.name} content={getCadenceContent(slug)} />;
}
