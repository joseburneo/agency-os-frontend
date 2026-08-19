// Shown the instant a module link is clicked, while the server builds the page.
//
// Without this file Next renders nothing until the server is done, so a click left
// the OLD page on screen — frozen, no feedback — for as long as the data took. It
// read as a broken button rather than as loading, and the app felt slow even when it
// was working. Next swaps this in immediately on navigation, so the click always
// answers; the content arrives when it arrives.
//
// Deliberately a skeleton of the real layout rather than a spinner: the eye lands on
// the shape it expects, so the page appears to assemble instead of flashing.
export default function Loading() {
  return (
    <div className="p-6 space-y-5 animate-pulse" aria-busy="true" aria-label="Loading">
      {/* title row */}
      <div className="flex items-center gap-3">
        <div className="h-6 w-56 rounded bg-secondary" />
        <div className="h-6 w-24 rounded bg-secondary/60" />
      </div>
      {/* stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl border border-border bg-secondary/30" />
        ))}
      </div>
      {/* content body */}
      <div className="space-y-2.5">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 rounded-lg border border-border bg-secondary/20" />
        ))}
      </div>
    </div>
  );
}
