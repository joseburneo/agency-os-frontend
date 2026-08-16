import { getWorkspace } from "@/lib/portal/mock";
import { assertModuleVisible, portalMode } from "@/lib/portal/access";
import { loadBrainOps, loadIntelligence, loadWorkspace } from "@/lib/portal/data";
import { IntelligenceView } from "./view";

// The client's Brain ("<Client> Brain" in the UI). One source of truth: the
// portal renders these sections AND the reply/outreach LLM loads them as
// mandatory context before writing anything. The operational fields (booking
// link, signature, language, rules) ride on the workspace row and are edited
// here too. Editable by the agency and the owning client (never a demo
// prospect). See lib/portal/types.ts.
export default async function LibraryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "library");
  const mode = await portalMode(slug);
  const [live, sections, ops] = await Promise.all([
    loadWorkspace(slug), loadIntelligence(slug), loadBrainOps(slug),
  ]);
  const wsName = live?.name ?? getWorkspace(slug)?.name ?? slug;
  // The domain feeds "Write it from their website": the client's own site is
  // the one place their real register is already written down.
  return <IntelligenceView slug={slug} wsName={wsName} domain={live?.domain ?? ""}
                          sections={sections} ops={ops} editable={mode !== "demo"} />;
}
