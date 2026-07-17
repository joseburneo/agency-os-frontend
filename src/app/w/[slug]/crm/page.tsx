import { assertModuleVisible } from "@/lib/portal/access";
import { CrmBoard } from "@/components/crm/CrmBoard";

// The full CRM (same board the agency cockpit uses), scoped to this workspace.
// Full client actions: send, draft, copilot.
//
// Every workspace has the CRM; the hot leads in it are its own. crm_api.py filters
// engaged_prospects by the ?workspace slug CrmBoard sends and returns nothing for an
// unknown one, so a workspace can only ever reach its own book. A client with no
// replies yet sees an honest empty pipeline that fills the moment someone answers.
export default async function WorkspaceCrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "crm");
  return <CrmBoard workspace={slug} basePath={`/w/${slug}/crm`} live />;
}
