import { assertModuleVisible } from "@/lib/portal/access";
import { ModuleHeader, Panel } from "@/components/portal/ui";
import { Megaphone } from "lucide-react";

export default async function MetaAdsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "meta-ads");
  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Megaphone}
        title="Meta Ads"
        desc="Facebook and Instagram demand-gen that feeds the top of the same funnel."
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD60A]" /> coming soon
          </span>
        }
      />
      <Panel className="p-8 flex flex-col items-center gap-3 text-center">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20">
          <Megaphone className="w-[22px] h-[22px]" />
        </span>
        <div className="text-[15px] font-semibold text-foreground mt-1">Meta Ads is being wired in</div>
        <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md">
          Facebook and Instagram campaigns will run from the same brief and audience as the rest of the
          system. Spend, reach and captured leads will report here.
        </p>
      </Panel>
    </div>
  );
}
