import { Panel, SectionLabel } from "./ui";

// An honest empty room.
//
// The sidebar drops modules that have nothing behind them, because a menu of
// empty tabs reads as an unfinished product. These two are the deliberate
// exception: they are next on the roadmap and Jose wants the shape visible while
// they get wired. So they say plainly what they will do and what is missing,
// which is a different thing from a page that looks finished and does nothing.
//
// They are OFF in magnet and demo workspaces. A prospect must never open one.
export function ComingSoon({
  title, what, missing,
}: { title: string; what: string; missing: string }) {
  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">{what}</p>
      <section className="mt-6">
        <SectionLabel>Not wired yet</SectionLabel>
        <Panel className="mt-2">
          <p className="text-[13.5px] leading-relaxed text-foreground/90">{missing}</p>
        </Panel>
      </section>
    </div>
  );
}
