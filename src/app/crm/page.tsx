import { redirect } from "next/navigation";

// The old standalone cockpit is gone — the CRM now lives inside each workspace.
// Luxvance is the agency's own workspace, so /crm forwards there, preserving the
// Slack alert deep-link (?lead=<id>).
export default async function CrmRedirect({
  searchParams,
}: {
  searchParams: Promise<{ lead?: string }>;
}) {
  const { lead } = await searchParams;
  redirect(`/w/luxvance/crm${lead ? `?lead=${lead}` : ""}`);
}
