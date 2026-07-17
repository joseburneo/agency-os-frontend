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

const E1 = `Hi [First name],

I hope you are well.

Like many business leaders, I assume you are currently integrating Agentic AI into your business operations. You are probably realising that the most important competitive advantage for [Company] won't be Generative AI. It will, in fact, be your leadership team.

As AI reshapes how businesses operate, the organisations that outperform won't simply adopt the best technology. They will have leaders with the judgement to make better decisions, embrace change, and bring their people with them. Right now, few decisions matter more than senior leadership appointments to your team.

After 25 years as a Global Head of Talent, VP HR and Chief People Officer for global businesses, I founded Arco Irish Executive Search to help [CEOs / Founders] make those decisions with confidence. We combine executive search, business psychology and rigorous leadership assessment to identify leaders with the capability, motivation and cultural fit to accelerate growth and lead transformation.

Having partnered with CEOs of global organisations and scaling businesses throughout my career, I understand that leadership appointments must align with business strategy. This alignment is critical at a time of rapid and systemic change.

If strengthening your leadership team is on your agenda this year, I would welcome the opportunity to discuss how we can help [Company] build the leadership needed for the challenges ahead.

Would you be open to a 20-minute conversation?

Kind regards,
Paul Herrick
Managing Partner, Arco Irish Executive Search

P.S. [Personalised 'why now' line for this company]`;

const E2 = `Hi [First name],

A quick thought on my last note.

What usually goes wrong with a senior hire isn't the CV. It's fit: how someone makes decisions under pressure, how they lead people through change, and whether they match how [Company] actually works.

That is the part we measure. Alongside the search itself, we use business psychology and structured leadership assessment, so you choose on evidence, not on a good interview.

If it's useful, I'm happy to show how that works.

Would 20 minutes suit you in the coming days?

Kind regards,
Paul Herrick`;

const E3 = `Hi [First name],

I don't want to crowd your inbox, so this is my last note for now.

If strengthening the leadership team moves up the agenda at [Company], I would welcome the conversation. You can reach me here any time.

Wishing you and the team continued success.

Kind regards,
Paul Herrick`;

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
