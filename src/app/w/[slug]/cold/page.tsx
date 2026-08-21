import { assertModuleVisible } from "@/lib/portal/access";
import { ComingSoon } from "@/components/portal/ComingSoon";
import { MagnetPipeline } from "@/components/portal/MagnetPipeline";
import { loadTargetLists, loadWorkspaceKind } from "@/lib/portal/data";

// For a MAGNET this is the module that holds the gift: the prospect's own ten,
// none of them contacted, which is what cold means. It is the same board as the
// hot pipeline minus the stage rail, because on this page every lead is in the
// same column by definition and five buttons with four zeroes beside them spend
// the widest part of the screen saying nothing.
//
// For a client workspace it is still unbuilt, and says so.
export default async function ColdPipelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "cold");

  const kind = await loadWorkspaceKind(slug);
  if (kind === "magnet") {
    const live = await loadTargetLists(slug, { unmask: true });
    return <MagnetPipeline leads={live?.leads ?? []} owner={live?.ws?.owner} showStages={false} />;
  }

  return (
    <ComingSoon
      title="Cold Pipeline"
      what="The contacts you open the conversation with, one at a time. Not the campaign lists: these are the ones worth a hand-written first message, worked from the same card as the hot pipeline, with the dossier, the enrichments and all three channels."
      missing="The list view and the promotion of VIP contacts into it. A contact here must also be excluded from every Instantly campaign, so the machine and a person can never write to the same prospect in the same week."
    />
  );
}
