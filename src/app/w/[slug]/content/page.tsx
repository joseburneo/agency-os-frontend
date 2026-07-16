import { notFound } from "next/navigation";
import { CalendarDays } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { isModuleEnabled } from "@/lib/portal/modules";
import { loadPortal } from "@/lib/portal/data";
import { ModuleHeader, Panel, Pill, SectionLabel, cn } from "@/components/portal/ui";
import type { ContentPost, ContentStatus } from "@/lib/portal/types";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "2026-07-16" → "Jul 16" — manual parse, no Date() (keeps server render deterministic).
function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-");
  const month = MONTHS[Number(m) - 1] ?? "";
  return `${month} ${Number(d)}`;
}

const COLUMNS: { key: ContentStatus; label: string; dot: string }[] = [
  { key: "idea", label: "Idea", dot: "#8A93A6" },
  { key: "draft", label: "Draft", dot: "#60A5FA" },
  { key: "scheduled", label: "Scheduled", dot: "#FFD60A" },
  { key: "published", label: "Published", dot: "#26D07C" },
];

const FORMAT_TONE: Record<ContentPost["format"], "muted" | "gold" | "green" | "blue"> = {
  text: "muted",
  carousel: "gold",
  video: "blue",
  poll: "green",
};

// Left accent per column — published green, scheduled gold, rest neutral.
const CARD_ACCENT: Record<ContentStatus, string> = {
  idea: "border-l-white/10",
  draft: "border-l-white/10",
  scheduled: "border-l-[#FFD60A]/70",
  published: "border-l-[#26D07C]/70",
};

function PostCard({ post }: { post: ContentPost }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border border-l-2 bg-white/[0.03] p-3.5 flex flex-col gap-2 transition-colors hover:bg-white/[0.06]",
        CARD_ACCENT[post.status]
      )}
    >
      <div>
        <Pill tone={FORMAT_TONE[post.format]}>{post.format}</Pill>
      </div>
      <div className="text-[13px] font-medium text-foreground leading-snug">{post.title}</div>
      {post.hook && (
        <div className="text-[11px] text-muted-foreground leading-snug">{post.hook}</div>
      )}
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground tabular-nums pt-0.5">
        <CalendarDays className="w-3 h-3 opacity-60" />
        {fmtDate(post.date)}
      </div>
    </div>
  );
}

export default async function ContentPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isModuleEnabled(slug, "content")) notFound();
  const live = await loadPortal(slug);
  const ws = live?.ws ?? getWorkspace(slug);
  const data = live?.data ?? getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const posts = data.content;
  const scheduled = posts.filter((p) => p.status === "scheduled").length;
  const published = posts.filter((p) => p.status === "published").length;

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={CalendarDays}
        title="LinkedIn Content Calendar"
        desc="Organic LinkedIn content that builds the founder's authority while the cold engine runs underneath."
        meta={
          <div className="flex items-center gap-2">
            <Pill tone="muted">
              <span className="tabular-nums">{posts.length}</span>&nbsp;posts in flight
            </Pill>
            <Pill tone="gold">
              <span className="tabular-nums">{scheduled}</span>&nbsp;scheduled
            </Pill>
            <Pill tone="green">
              <span className="tabular-nums">{published}</span>&nbsp;published
            </Pill>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const items = posts.filter((p) => p.status === col.key);
          return (
            <Panel key={col.key} className="p-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: col.dot, boxShadow: `0 0 6px ${col.dot}` }}
                  />
                  <SectionLabel>{col.label}</SectionLabel>
                </div>
                <Pill tone="muted" className="tabular-nums">
                  {items.length}
                </Pill>
              </div>
              <div className="flex flex-col gap-2.5">
                {items.length > 0 ? (
                  items.map((post) => <PostCard key={post.id} post={post} />)
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[11px] text-muted-foreground">
                    Nothing here yet
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
