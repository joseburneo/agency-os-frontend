import { assertModuleVisible, isAgency } from "@/lib/portal/access";
import { CrmBoard } from "@/components/crm/CrmBoard";

// The full CRM (same board the agency cockpit uses), scoped to this workspace.
// Full client actions: send, draft, copilot.
//
// Every workspace has the CRM; the hot leads in it are its own. crm_api.py filters
// engaged_prospects by the ?workspace slug CrmBoard sends and returns nothing for an
// unknown one, so a workspace can only ever reach its own book. A client with no
// replies yet sees an honest empty pipeline that fills the moment someone answers.
// The Build (personalized lead magnet) is AGENCY ONLY and rides on the session,
// not on the slug: Jose opens /w/arco-irish/crm with the agency cookie and still
// needs it, while Paul opens the same URL with the client cookie and must not see
// it. The backend enforces the same rule on POST /prospect/{id}/build — this only
// decides whether the buttons are drawn.
export default async function WorkspaceCrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "crm");
  const agency = await isAgency();
  return <CrmBoard workspace={slug} basePath={`/w/${slug}/crm`} live canBuild={agency} />;
}
