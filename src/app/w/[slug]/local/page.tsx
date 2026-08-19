import { assertModuleVisible } from "@/lib/portal/access";
import { ComingSoon } from "@/components/portal/ComingSoon";

export default async function FindLocalBusinessesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "local");
  return (
    <ComingSoon
      title="Find Local Businesses"
      what="Restaurants, spas, gyms and every other buyer who lives on Google Maps instead of LinkedIn. Different source, different avatar, which is why it is its own entry and not a mode of Find Prospects."
      missing="The Apify wiring. The Google Maps actor is already used from the command line; this is where it gets a search surface, the same way Find Prospects wraps Clay."
    />
  );
}
