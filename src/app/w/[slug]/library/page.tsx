import { getWorkspace } from "@/lib/portal/mock";
import { assertModuleVisible, portalMode } from "@/lib/portal/access";
import { loadIntelligence, loadWorkspace } from "@/lib/portal/data";
import { IntelligenceView } from "./view";

// Intelligence Library — the Octave-style client brain. One source of truth:
// the portal renders these sections AND the reply/outreach LLM loads them as
// mandatory context before writing anything. Editable by the agency and the
// owning client (never a demo prospect). See lib/portal/types.ts.
export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "library");
  const mode = await portalMode(slug);
  const [live, sections] = await Promise.all([loadWorkspace(slug), loadIntelligence(slug)]);
  const wsName = live?.name ?? getWorkspace(slug)?.name ?? slug;
  return <IntelligenceView slug={slug} wsName={wsName} sections={sections} editable={mode !== "demo"} />;
}
