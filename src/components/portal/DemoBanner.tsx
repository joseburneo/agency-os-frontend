import Link from "next/link";
import { Sparkles, ArrowRight } from "lucide-react";

// Shown at the top of a workspace when the visitor is in demo mode (a prospect
// opened it from a signed magnet link). Makes it unmistakable this is a live
// preview of their own pipeline, and points to the one action: book a call.
export function DemoBanner({ name }: { name: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-[#FFD60A]/25 bg-gradient-to-r from-[#FFD60A]/[0.08] to-transparent px-4 py-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#FFD60A]/15 text-[#FFD60A]">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-foreground">
          Live preview of your Pipeline Engine
        </div>
        <div className="text-[12px] text-muted-foreground">
          These are your real prospects and the exact outreach we would run for {name}. Preview
          access expires in 14 days.
        </div>
      </div>
      <Link
        href="https://www.luxvance.com/book"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-[#FFD60A] px-3.5 py-2 text-[12px] font-bold text-[#0A0E1A] transition-colors hover:bg-[#ffdf3a]"
      >
        Book a call to go live <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
