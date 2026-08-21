import { assertModuleVisible } from "@/lib/portal/access";
import { ColdPipeline } from "@/components/portal/ColdPipeline";
import { ComingSoon } from "@/components/portal/ComingSoon";
import { MagnetPipeline } from "@/components/portal/MagnetPipeline";
import { loadTargetLists, loadWorkspaceKind } from "@/lib/portal/data";

// For a MAGNET this is the module that holds the gift: the prospect's own ten,
// none of them contacted, which is what cold means. It is the same board as the
// hot pipeline minus the stage rail, because on this page every lead is in the
// same column by definition and five buttons with four zeroes beside them spend
// the widest part of the screen saying nothing.
//
// For a CLIENT it is his lists, worked one person at a time — the module that
// replaced the Coming Soon on 2026-08-21, the day Paul lost his place going down
// a 596-row list because nothing on screen said who had already accepted.
//
// Two components, one shape, on purpose: a client is working and a prospect is
// being shown. Merging them is a later job done in the cold, not one done while
// somebody is waiting to use the page.
export default async function ColdPipelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "cold");

  const kind = await loadWorkspaceKind(slug);
  // A magnet is ten leads and its card IS the copy, so it keeps the bodies. A client
  // workspace is Paul's 1,147, and shipping every rendered email to show one at a time
  // made this page 4.2 MB and five seconds; the Cold Pipeline asks for the one it opens.
  const magnet = kind === "magnet";
  const live = await loadTargetLists(slug, { unmask: true, withBodies: magnet });

  if (magnet) {
    return <MagnetPipeline leads={live?.leads ?? []} owner={live?.ws?.owner} showStages={false} />;
  }

  // A client workspace with no lists loaded yet keeps the honest empty state rather
  // than an empty board: three columns of nothing reads as broken, not as ready.
  if (!live || live.lists.length === 0) {
    return (
      <ComingSoon
        title="Cold Pipeline"
        what="Your lists, worked one person at a time — connected first, then the invitations still pending, then the people nobody has reached yet."
        missing="Your lists. Nothing has been loaded into this workspace yet."
      />
    );
  }

  return (
    <ColdPipeline
      lists={live.lists}
      leads={live.leads}
      workspace={slug}
      owner={live.ws?.owner}
    />
  );
}
