import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { getWorkspace, getWorkspaceData } from "@/lib/portal/mock";
import { ModuleHeader, Panel, SectionLabel, StatTile, Pill } from "@/components/portal/ui";
import type { PhoneTouch, TouchOutcome } from "@/lib/portal/types";

const OUTCOME_TONE: Record<TouchOutcome, "green" | "blue" | "muted" | "gold"> = {
  replied: "green",
  connected: "green",
  delivered: "blue",
  voicemail: "muted",
  "no-answer": "muted",
  queued: "gold",
};

const OUTCOME_LABEL: Record<TouchOutcome, string> = {
  replied: "Replied",
  connected: "Connected",
  delivered: "Delivered",
  voicemail: "Voicemail",
  "no-answer": "No answer",
  queued: "Queued",
};

function TouchIcon({ touch }: { touch: PhoneTouch }) {
  if (touch.channel === "whatsapp") {
    return (
      <span className="grid place-items-center w-8 h-8 rounded-lg bg-[#26D07C]/10 border border-[#26D07C]/20 shrink-0">
        <MessageCircle className="w-4 h-4" style={{ color: "#26D07C" }} />
      </span>
    );
  }
  return (
    <span className="grid place-items-center w-8 h-8 rounded-lg bg-white/5 border border-border shrink-0">
      <Phone className="w-4 h-4" style={{ color: "#F5F5F0" }} />
    </span>
  );
}

export default async function WhatsappPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ws = getWorkspace(slug);
  const data = getWorkspaceData(slug);
  if (!ws || !data) notFound();

  const touches = data.phoneTouches;
  const total = touches.length;
  const replied = touches.filter((t) => t.outcome === "replied").length;
  const connected = touches.filter((t) => t.outcome === "connected").length;
  const inFlight = touches.filter((t) => t.outcome === "delivered" || t.outcome === "queued").length;
  const whatsappCount = touches.filter((t) => t.channel === "whatsapp").length;
  const callCount = touches.filter((t) => t.channel === "call").length;

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={MessageCircle}
        title="WhatsApp & Phone"
        desc="The human-feel channel — WhatsApp messages and calls that reinforce email and LinkedIn on warm accounts."
        meta={
          <div className="flex items-center gap-2">
            <Pill tone="green">
              <MessageCircle className="w-3 h-3" /> {whatsappCount} WhatsApp
            </Pill>
            <Pill tone="muted">
              <Phone className="w-3 h-3" /> {callCount} calls
            </Pill>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="Total touches" value={String(total)} sub="WhatsApp + calls" />
        <StatTile label="Replied" value={String(replied)} sub="WhatsApp replies" tone="good" />
        <StatTile label="Connected" value={String(connected)} sub="live conversations" tone="good" />
        <StatTile label="Delivered / Queued" value={String(inFlight)} sub="in flight" />
      </div>

      <Panel className="p-5">
        <div className="flex items-center justify-between">
          <SectionLabel>Touch feed</SectionLabel>
          <span className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="w-1.5 h-1.5 rounded-full bg-[#26D07C] shadow-[0_0_6px_#26D07C]" /> live
          </span>
        </div>
        <div className="mt-3 flex flex-col">
          {touches.map((t, i) => (
            <div
              key={t.id}
              className={`flex items-center gap-4 py-3 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <TouchIcon touch={t} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-foreground truncate">{t.name}</div>
                <div className="text-[11px] text-muted-foreground truncate">{t.company}</div>
              </div>
              <div className="hidden sm:block font-mono text-[12px] tabular-nums text-muted-foreground shrink-0">
                {t.phoneMasked}
              </div>
              <div className="shrink-0">
                <Pill tone={OUTCOME_TONE[t.outcome]}>{OUTCOME_LABEL[t.outcome]}</Pill>
              </div>
              <div className="w-16 text-right text-[11px] text-muted-foreground shrink-0">{t.when}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
