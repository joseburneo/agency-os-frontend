import { assertModuleVisible, portalMode } from "@/lib/portal/access";
import { loadWorkspaceKind } from "@/lib/portal/data";
import { ProspectingView } from "./view";

// Find Prospects: describe a market in words, correct the filters, see real rows.
//
// canExport is computed here for the CHROME only (which button to draw). The
// control that matters is on the backend, which reads workspaces.kind and
// refuses to spend a credit for a magnet no matter what the browser sends. A
// demo that finds the disabled button and calls the API directly still gets a
// 403, which is the whole reason the check lives there and not here.
export default async function ProspectingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "prospecting");
  const [mode, kind] = await Promise.all([portalMode(slug), loadWorkspaceKind(slug)]);
  const canExport = kind !== "magnet" && mode !== "demo";
  return <ProspectingView slug={slug} canExport={canExport} />;
}
