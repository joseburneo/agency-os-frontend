import { assertModuleVisible } from "@/lib/portal/access";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function ColdPipelinePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "cold");
  return (
    <ComingSoon
      title="Cold Pipeline"
      what="The contacts you open the conversation with, one at a time. Not the campaign lists: these are the ones worth a hand-written first message, worked from the same card as the hot pipeline, with the dossier, the enrichments and all three channels."
      missing="The list view and the promotion of VIP contacts into it. A contact here must also be excluded from every Instantly campaign, so the machine and a person can never write to the same prospect in the same week."
    />
  );
}
