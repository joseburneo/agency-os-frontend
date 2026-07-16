import { assertModuleVisible } from "@/lib/portal/access";
import { CrmBoard } from "@/components/crm/CrmBoard";

// The full CRM (same board the agency cockpit uses), scoped to this workspace.
// Full client actions: send, draft, copilot. Workspace filtering rides the
// ?workspace param CrmBoard sends; live per-client once engaged_prospects has a
// workspace column.
export default async function WorkspaceCrmPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "crm");
  return <CrmBoard workspace={slug} basePath={`/w/${slug}/crm`} />;
}
