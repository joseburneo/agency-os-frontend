// Sequence & Schedule content, per workspace. Migrated verbatim from the
// original builds portal (campaigns/arco-irish-campaignA/build_saas_portal.py:
// the "Sequence & channels" and "Schedule & limits" views). The copy below is
// client-approved campaign material — do not reword it here; change it with the
// client, then update both places.
//
// This is static, campaign-locked content (not Supabase): the sequence is part
// of the agreed campaign design, like the roadmap milestones were in the old
// portal. Workspaces without a locked sequence return null and the view shows
// an honest empty state.

export type CadenceStep = {
  day: string; // "Day 0"
  channel: "email" | "linkedin";
  title: string; // "Email 1", "LinkedIn connect", ...
  tag: string; // "Automated · no link", "Request", ...
  subject?: string;
  body: string;
};

export type CadenceContent = {
  sequence: {
    // Heading split so the view can render the accent span: pre + accent + post.
    heading: { pre: string; accent: string; post: string };
    intro: string;
    steps: CadenceStep[];
    note: string;
  };
  schedule: {
    heading: { pre: string; accent: string; post: string };
    intro: string;
    inboxes: number;
    timing: { title: string; rows: { setting: string; plan: string; why: string }[] };
    ramp: { title: string; rows: { phase: string; perInbox: string; network: string; split: string }[] };
    note: string;
  };
};

// ── Arco Irish — message templates (exact copy from the old portal) ─────────

// Grant-led copy, locked with Paul on the 2026-07-22 launch review call (call +
// email confirmation). Universal message — it no longer varies by HR status; the
// only per-lead part is the P.S. 'why now' signal. Sign-off is "Thanks,". Keep this
// byte-identical to build_saas_portal.py (render_e1 / E2 / E3).
const SIGN = `Paul Herrick
Managing Partner
Arco Irish Executive Search
+353 (087) 0937606
pherrick@arcoirish.com
www.arcoirish.com`;

const E1 = `Hi [First name],

I hope you are well.

After 25 years as a Global Head of Talent and Chief People Officer for both blue-chip and scaling businesses, I founded Arco Irish Executive Search to help CEOs make leadership appointments with confidence. I also advise Enterprise Ireland on People and Management. Did you know that Enterprise Ireland offers a Key Hires Grant of €150k for fast-scaling Irish businesses?

To be eligible for the grant the candidate must bring new skills to the leadership team. I have a track record of helping organisations make this Key hire. With agentic AI increasingly on the agenda, leaders now more than ever require technical know-how, the judgement to make better decisions, the ability to embrace change, and the gravitas to bring their people with them.

We combine executive search, business psychology, and rigorous assessment to find leaders with the capability and cultural fit to lead transformation and accelerate growth. Getting these hires wrong causes severe disruption; getting them right is critical for scaling businesses like [Company].

If strengthening your leadership team is on your agenda, I would welcome a conversation about how we can support your goals.

Would you be open to a 20-minute conversation?

P.S. [Personalised 'why now' line for this company]

Thanks,

${SIGN}`;

const E2 = `Hi [First name],

A brief follow-up to my last email.

The difference between an appointment that accelerates a business and one that sets it back is rarely decided by the CV. It comes down to judgement under pressure, the character to carry people through change, and a genuine fit with how [Company] works.

That is what we measure. Alongside the search, and for the appointments that truly matter, I can put a shortlist through the leading psychometric assessments, so fit is tested rather than guessed. As Greg Hayden, CEO of Ethos Engineering, put it after our first Director-level review, "Paul's expertise transformed how we attract and develop talent."

I would be glad to show you how it would apply to a role you are weighing.

Would you be open to a short conversation in the coming days?

Thanks,

${SIGN}`;

const E3 = `Hi [First name],

I will leave it here for now, so as not to take up more of your time.

Should strengthening the leadership team move up the agenda at [Company], I would welcome the conversation; and where the timing fits, I can point you to the Enterprise Ireland Key Hires Grant, which is designed for precisely this kind of appointment.

My door is open whenever it suits you. I wish you and the team continued success.

Thanks,

${SIGN}`;

const LN1 = `Hi [First name], I work with Irish CEOs and founders on getting their most senior hires right, through executive search and real leadership assessment. Would be glad to connect.`;

const LN2 = `Thanks for connecting, [First name]. I help Irish companies at your stage get their most important leadership hires right, pairing search with proper assessment so it isn't a gamble. No pitch here, but if it's ever relevant I'm happy to share how. How's the year going at [Company]?`;

const ARCO: CadenceContent = {
  sequence: {
    heading: { pre: "The full journey, ", accent: "every touch", post: "." },
    intro:
      "Because the list is deliberately small and high-quality, we work each prospect across email and LinkedIn rather than blasting. Emails send automatically as Paul from your domains; LinkedIn runs in parallel. VIPs come out of this and are done by hand.",
    steps: [
      {
        day: "Day 0",
        channel: "email",
        title: "Email 1",
        tag: "Automated · no link",
        // Fixed subject (Paul, 2026-07-16): rotation disabled, one subject for all.
        subject: "Introduction: Paul Herrick",
        body: E1,
      },
      {
        day: "Day 2",
        channel: "linkedin",
        title: "LinkedIn · connect",
        tag: "Request",
        body: LN1,
      },
      {
        day: "Day 3",
        channel: "email",
        title: "Email 2",
        tag: "Automated",
        subject: "How we strengthen a senior appointment",
        body: E2,
      },
      {
        day: "Day 5",
        channel: "linkedin",
        title: "LinkedIn · message",
        tag: "After they accept",
        body: LN2,
      },
      {
        day: "Day 6",
        channel: "email",
        title: "Email 3",
        tag: "Automated · breakup",
        subject: "Closing the loop",
        body: E3,
      },
    ],
    note: "This is a draft you can shape. Reply with how you'd write Email 2, Email 3 or the LinkedIn notes and we update it here. Gaps between steps are never less than 2 days.",
  },
  schedule: {
    heading: { pre: "When we send, and ", accent: "how much", post: "." },
    intro:
      "Every prospect is Irish (one timezone), so timing is simple. We send low and steady from 9 warmed inboxes to protect deliverability and keep every email feeling one-to-one.",
    inboxes: 9,
    timing: {
      title: "Best days & times to land a reply",
      rows: [
        {
          setting: "Days",
          plan: "Tue–Thu (primary) + Mon light, no Friday, no weekends",
          why: "Monday inboxes are noisy, Friday people are checked out. Tue–Thu reply best.",
        },
        {
          setting: "Times",
          plan: "08:00–11:00 IST (main) + 16:00–17:30",
          why: "CEOs read email early, before the meetings start. You land at the top of the inbox.",
        },
        {
          setting: "Window",
          plan: "08:00–16:00 Europe/Dublin, weighted to mornings",
          why: "Single Irish timezone keeps it clean.",
        },
      ],
    },
    ramp: {
      title: "Daily limits & ramp (9 inboxes)",
      rows: [
        { phase: "Week 1", perInbox: "10", network: "~90", split: "No-HR 45 · Has-HR 30 · Company-Direct 15" },
        { phase: "Week 2", perInbox: "15", network: "~135", split: "proportional" },
        { phase: "Week 3+", perInbox: "20–25", network: "~180", split: "proportional" },
      ],
    },
    note: "Low volume is deliberate. With a small, curated list, going slow means the list lasts longer, deliverability stays strong, and each email feels personal. Per-campaign daily limits are set so the three campaigns together never exceed the pool.",
  },
};

const CONTENT: Record<string, CadenceContent> = {
  "arco-irish": ARCO,
};

export function getCadenceContent(slug: string): CadenceContent | null {
  return CONTENT[slug] ?? null;
}
