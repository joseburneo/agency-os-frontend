import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/portal/mock";
import { assertModuleVisible } from "@/lib/portal/access";
import { loadWorkspace, loadBlocklist } from "@/lib/portal/data";
import { BlocklistView } from "./view";

// Do-not-contact book for this workspace. Lives hand-in-hand with the
// Intelligence Library: the LLM must never reach anyone here.
export default async function BlocklistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "blocklist");

  const [live, entries] = await Promise.all([loadWorkspace(slug), loadBlocklist(slug)]);
  const ws = live ?? getWorkspace(slug);
  if (!ws) notFound();
  return <BlocklistView slug={slug} wsName={ws.name} entries={entries} />;
}
