import { assertModuleVisible } from "@/lib/portal/access";
import { ModuleHeader, Panel } from "@/components/portal/ui";
import { Linkedin } from "@/components/portal/ui";

export default async function LinkedInAdsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await assertModuleVisible(slug, "linkedin-ads");
  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={Linkedin}
        title="LinkedIn Ads"
        desc="Sponsored content and lead-gen forms that warm the same ICP your outbound already targets."
        actions={
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FFD60A]" /> coming soon
          </span>
        }
      />
      <Panel className="p-8 flex flex-col items-center gap-3 text-center">
        <span className="grid place-items-center w-12 h-12 rounded-xl bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20">
          <Linkedin width={22} height={22} />
        </span>
        <div className="text-[15px] font-semibold text-foreground mt-1">LinkedIn Ads is being wired in</div>
        <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md">
          Paid LinkedIn will run beside the organic campaigns and the outbound, sharing the same ICP and
          intelligence library. Campaign performance and lead capture will surface here.
        </p>
      </Panel>
    </div>
  );
}
