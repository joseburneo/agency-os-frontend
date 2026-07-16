import { assertModuleVisible } from "@/lib/portal/access";
import { CrmBoard } from "@/components/crm/CrmBoard";

// The full CRM (same board the agency cockpit uses), scoped to this workspace.
// Full client actions: send, draft, copilot. Workspace filtering rides the
// ?workspace param CrmBoard sends; live per-client once engaged_prospects has a
// workspace column.
export default async function WorkspaceCrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "crm");
  // Only Luxvance's engaged_prospects book is real today; a client shows an honest
  // empty pipeline until engaged_prospects carries a per-client column + the API
  // filters on it. Then flip this to always-live.
  const live = slug === "luxvance";
  return <CrmBoard workspace={slug} basePath={`/w/${slug}/crm`} live={live} />;
}
