import { CalendarClock, Mail } from "lucide-react";
import { ModuleHeader, Panel, Pill, SectionLabel, StatTile, Linkedin } from "@/components/portal/ui";
import type { CadenceContent, CadenceStep } from "./content";

// Channel accents — same family the rest of the portal uses (ui CHANNEL_META):
// email is Signal Yellow, LinkedIn is the app's LinkedIn blue.
const CHANNEL_C: Record<CadenceStep["channel"], string> = {
  email: "#FFD60A",
  linkedin: "#60A5FA",
};

function dayNum(day: string): number {
  const n = parseInt(day.replace(/\D/g, ""), 10);
  return isNaN(n) ? 0 : n;
}

// Section heading with the accent span, e.g. "The full journey, [every touch]."
function Heading({ h }: { h: { pre: string; accent: string; post: string } }) {
  return (
    <h2 className="text-lg md:text-xl font-bold tracking-tight text-foreground">
      {h.pre}
      <span className="text-[#FFD60A]">{h.accent}</span>
      {h.post}
    </h2>
  );
}

// Gold-tinted footnote box, used for the closing rationale of each section.
function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#FFD60A]/25 bg-[#FFD60A]/[0.06] p-4 text-[13px] leading-relaxed text-foreground/90">
      {children}
    </div>
  );
}

// One touch on the vertical timeline: channel marker, day + tag meta, then the
// full message (subject header + body) in an email-preview style box.
function Step({ step, last }: { step: CadenceStep; last: boolean }) {
  const c = CHANNEL_C[step.channel];
  const Icon = step.channel === "email" ? Mail : Linkedin;
  return (
    <li className="relative pl-9">
      {!last && <span className="absolute left-[10px] top-7 -bottom-7 w-px bg-border" />}
      <span
        className="absolute left-0 top-0.5 grid place-items-center w-[21px] h-[21px] rounded-full border bg-background"
        style={{ borderColor: `${c}66`, color: c }}
      >
        <Icon className="w-3 h-3" />
      </span>
      <div className="flex items-center gap-2.5 flex-wrap">
        <span className="text-[11px] font-semibold tabular-nums" style={{ color: c }}>
          {step.day}
        </span>
        <span className="text-[14px] font-semibold text-foreground">{step.title}</span>
        <Pill tone="muted">{step.tag}</Pill>
      </div>
      <div className="mt-2.5 max-w-3xl rounded-lg border border-border bg-input overflow-hidden">
        {step.subject && (
          <div className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground shrink-0">
              Subject
            </span>
            <span className="text-[13px] font-semibold text-foreground">{step.subject}</span>
          </div>
        )}
        <div className="p-4 text-[13px] leading-relaxed text-foreground whitespace-pre-wrap break-words">
          {step.body}
        </div>
      </div>
    </li>
  );
}

export function CadenceView({ wsName, content }: { wsName: string; content: CadenceContent | null }) {
  if (!content) {
    return (
      <div className="flex flex-col gap-7">
        <ModuleHeader
          icon={CalendarClock}
          title="Sequence & Schedule"
          desc={`The full journey for every ${wsName} prospect, and exactly when and how much we send.`}
        />
        <Panel className="p-8 flex flex-col items-center gap-2 text-center">
          <span className="grid place-items-center w-10 h-10 rounded-lg bg-[#FFD60A]/10 text-[#FFD60A] border border-[#FFD60A]/20">
            <CalendarClock className="w-5 h-5" />
          </span>
          <div className="text-[14px] font-semibold text-foreground mt-1">Nothing here yet</div>
          <p className="text-[13px] text-muted-foreground leading-relaxed max-w-md">
            The sequence and sending schedule appear here once the campaign cadence is locked.
          </p>
        </Panel>
      </div>
    );
  }

  const { sequence, schedule } = content;
  const emails = sequence.steps.filter((s) => s.channel === "email").length;
  const linkedins = sequence.steps.length - emails;
  const days = sequence.steps.map((s) => dayNum(s.day));
  const span = Math.max(...days) - Math.min(...days) + 1;
  const firstDay = sequence.steps[0]?.day ?? "";
  const lastDay = sequence.steps[sequence.steps.length - 1]?.day ?? "";

  return (
    <div className="flex flex-col gap-7">
      <ModuleHeader
        icon={CalendarClock}
        title="Sequence & Schedule"
        desc={`The full journey for every ${wsName} prospect: each email and LinkedIn touch with its exact copy, plus when we send and how much.`}
      />

      {/* Shape of the campaign at a glance — all derived from the data below. */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        <StatTile
          label="Touches"
          value={String(sequence.steps.length)}
          tone="warn"
          sub={`${emails} emails · ${linkedins} LinkedIn`}
        />
        <StatTile label="Journey" value={`${span} days`} sub={`${firstDay} to ${lastDay}`} />
        <StatTile label="Inboxes" value={String(schedule.inboxes)} tone="good" sub="warmed senders" />
      </div>

      {/* ── Sequence & channels ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <SectionLabel>Sequence &amp; channels</SectionLabel>
        <Panel className="p-5 md:p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Heading h={sequence.heading} />
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-3xl">
              {sequence.intro}
            </p>
          </div>
          <ol className="relative flex flex-col gap-7">
            {sequence.steps.map((step, i) => (
              <Step key={step.day + step.title} step={step} last={i === sequence.steps.length - 1} />
            ))}
          </ol>
          <Note>{sequence.note}</Note>
        </Panel>
      </div>

      {/* ── Schedule & limits ───────────────────────────────────────────── */}
      <div className="flex flex-col gap-4">
        <SectionLabel>Schedule &amp; limits</SectionLabel>
        <Panel className="p-5 md:p-6 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Heading h={schedule.heading} />
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-3xl">
              {schedule.intro}
            </p>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold text-foreground">{schedule.timing.title}</div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Setting</th>
                    <th className="px-4 py-3 font-medium">Plan</th>
                    <th className="px-4 py-3 font-medium">Why</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schedule.timing.rows.map((r) => (
                    <tr key={r.setting}>
                      <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap align-top">
                        {r.setting}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-foreground align-top min-w-[200px]">{r.plan}</td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground align-top min-w-[220px]">{r.why}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            <div className="text-[13px] font-semibold text-foreground">{schedule.ramp.title}</div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm text-left">
                <thead className="bg-secondary/50 text-muted-foreground text-xs uppercase border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Phase</th>
                    <th className="px-4 py-3 font-medium">Per inbox / day</th>
                    <th className="px-4 py-3 font-medium">Network / day</th>
                    <th className="px-4 py-3 font-medium">Split across campaigns</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {schedule.ramp.rows.map((r) => (
                    <tr key={r.phase}>
                      <td className="px-4 py-3 text-[13px] font-semibold text-foreground whitespace-nowrap align-top">
                        {r.phase}
                      </td>
                      <td className="px-4 py-3 text-[13px] font-bold tabular-nums text-foreground align-top">
                        {r.perInbox}
                      </td>
                      <td className="px-4 py-3 text-[13px] tabular-nums text-muted-foreground align-top">
                        {r.network}
                      </td>
                      <td className="px-4 py-3 text-[13px] text-muted-foreground align-top min-w-[220px]">
                        {r.split}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <Note>{schedule.note}</Note>
        </Panel>
      </div>
    </div>
  );
}
