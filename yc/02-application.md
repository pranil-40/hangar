# Hangar: YC Winter 2027 application

On-time deadline **Sunday, November 2, 2026, 8pm PT**; decisions by December 11. Submit by **October 30** so a last-minute problem cannot cost the on-time slot.

**How to use this draft.** Every answer below is written to be pasted. Anything in `[FILL: ...]` can only come from you, because it is about your life or your real numbers. Never fill a number you cannot show on screen in the interview. YC partners read fast and skeptically: specific and modest beats impressive and vague every time.

---

## Founders

**Who writes code, or does other technical work on your product? Was any of it done by a non-founder?**

> I write all of it, working with Claude Code as my pair. Nothing was written by a non-founder. [FILL: if you have a cofounder, name who owns what.]

**Are you looking for a cofounder?**

> [FILL: Yes / No. If yes, say what kind ("a technical cofounder who has run production infrastructure") so it reads as a plan rather than a gap.]

**Please tell us in one or two sentences about the most impressive thing other than this startup that you have built or achieved.**

> [FILL. One concrete thing with a number in it. "Built X, used by N people" beats any award. If it is a non-software achievement, give the scale and what you personally did.]

**Please tell us about the time you most successfully hacked some (non-computer) system to your advantage.**

> [FILL. A real story where you found a rule or process that most people take as fixed and got around it legitimately. Four to six sentences: the system, the trick, the result.]

**Founder video (1 minute).** See [05-video-and-interview.md](05-video-and-interview.md). Unscripted, all founders on camera, no demo, no editing.

---

## Company

**Company name:** Hangar

**Describe what your company does in 50 characters or less.**

> Private hosting for the tools AI agents build

(45 characters.)

**Company URL:** [FILL: your production domain once deployed; see the sprint plan, week 1.]

**Demo video:** [FILL: link to the 2-minute demo described in 05-video-and-interview.md.]

**Please provide a link to the product, if any.** [FILL: production URL.] Demo login: `owner@demo.test` / `hangar123` (and `viewer@demo.test` to see the same tool as a viewer). [Create a separate demo team in production; never put real pilot data behind a shared password.]

**What is your company going to make? Please describe your product and what it does or will do.**

> Hangar is where the tools people build with coding agents go to be used by their team.
>
> Someone asks Claude Code, Cursor or Codex for a refund-approval page. One more sentence, "deploy this to Hangar", and it is live at a private address that only their signed-in colleagues can open. The tool gets the viewer's identity and shared team storage from Hangar, so it needs no backend, holds no credentials, and runs in a browser sandbox that cannot act as the person viewing it.
>
> For the IT or ops lead, Hangar is the first place that lists every agent-built tool in the company, who deployed it, who uses it, and every version, with one-click rollback and a deploy token per agent that stops working the moment its owner leaves.
>
> It works today: a CLI and MCP server any agent can call, versioned deploys, the sandboxed runtime, the data API, token controls and an audit log. Next: Google and Microsoft sign-in with domain auto-join, then connectors, so a tool can read the CRM or a database replica while Hangar holds the credential.

**Where do you live now, and where would the company be based after YC?**

> [FILL: City, Country now] / San Francisco, CA.

**Explain your decision regarding location.**

> Our first customers are AI-forward startups, and the densest concentration of them, and of the people building the agents we integrate with, is in San Francisco.

---

## Progress

**How far along are you?**

> [Rewrite with real numbers on Oct 30. Template:]
>
> The product works end to end and is live at [FILL: URL]. I built the first version in September (a team directory for AI-built tools with roles and invites) and found its flaw: listing a tool's link controls nothing when the link itself is public. So in October I rebuilt Hangar to host the tools itself: agents deploy through a CLI/MCP server, tools run sandboxed with identity and storage built in, and deploys containing credentials are refused.
>
> Since [FILL: date of first pilot]: [FILL: N] teams, [FILL: N] tools deployed by agents, [FILL: N] tools opened by two or more people in the last 7 days. [FILL: the single best quote from a pilot, with their role.]

**How long have each of you been working on this? How much of that has been full-time?**

> [FILL. Be exact: "Since September 12, 2026; about 25 hours a week alongside school, full-time from [date]."]

**What tech stack are you using, or planning to use, to build this product? Include AI models and AI coding tools you use.**

> Next.js 16 and React 19 on Vercel, Postgres (Neon) through Prisma 7, TypeScript throughout, Vitest and Playwright for tests. The tool runtime is plain browser security: a CSP sandbox with an opaque origin, `connect-src 'self'`, and HMAC-signed per-viewer tickets re-checked against membership on every request. The CLI and MCP server are a single zero-dependency Node file so any agent can fetch and run it. I build with Claude Code; the product's main integration targets are Claude Code, Cursor and Codex via MCP and agent skills.

**Are people using your product?** [FILL: Yes/No.] **How many active users or customers do you have? How many are paying? Who is paying you the most, and how much do they pay you?**

> [FILL with exact numbers. Define "active" the way the sprint plan does: a team with a tool opened by two or more different people in the last 7 days.]

**Do you have revenue?** [FILL. If not, say so plainly; at this stage that is fine.]

**If you are applying with the same idea as a previous batch, did anything change? If you applied with a different idea, why did you pivot and what did you learn?**

> [FILL: only if you applied before.]

**If you have already participated or committed to participate in an incubator, "accelerator" or "pre-accelerator" program, please tell us about it.**

> [FILL or "No."]

---

## Idea

**Why did you pick this idea to work on? Do you have domain expertise in this area? How do you know people need what you're making?**

> [FILL: open with your own moment, two or three sentences. The strongest true version is a specific day: who built what with an agent, and why it never reached the people it was for.]
>
> The pattern is everywhere once you look. Retool's 2026 survey found 60% of builders made something outside IT oversight last year. YC funded the healthcare-only version of this problem in S26 (Floracene), whose first customer had several employees with useful tools that "died locally" because IT would not let them deploy. And when these tools do go up without a governed home, they leak: about 1 in 10 scanned Lovable apps exposed user data (CVE-2025-48757).
>
> The insight that shaped the product: the leaks are architectural. The tool holds a credential every viewer can read. So Hangar's tools never hold one: identity and storage come from the platform, and the tool runs in a browser sandbox. That makes it something an IT lead can approve once for every agent in the company.
>
> [FILL: what your pilots told you. Quote two people by role.]

**Who are your competitors? What do you understand about your business that they don't?**

> Builder platforms (Lovable, Replit, Microsoft App Builder, Claude Code Artifacts) now all share apps privately, but each hosts only what was built inside it, and Artifacts viewers need Claude seats. Developer clouds (Vercel, Cloudflare) host anything but are public by default and cannot safely be handed to every employee's agent. Governed builders (Retool, Superblocks) make you build inside their runtime.
>
> What we understand: (1) control lives at the deploy target, not the builder. Most engineers use two to four AI coding tools at once, so a company can standardize where tools run long before it can standardize how they are built, and builder platforms cannot be neutral about builders. (2) Vibe-code breaches come from tools holding credentials; removing credentials from tools by construction beats scanning code forever. (3) The deploy step now happens inside the agent, so the winner is the default answer to "share this with my team", which is a distribution channel none of the incumbents is optimizing for.

**How do or will you make money? How much could you make?**

> Builder-based subscriptions: free for one team and three tools, $20 per builder per month for teams, $40 with SSO, connectors and audit export, and annual enterprise contracts. Viewers are always free. A 200-person company with 15 builders on Business pays $7,200 a year, and the share of employees who build grows every quarter.
>
> Anthropic alone reported more than 300,000 business customers by late 2025, all already paying for an AI that writes software. If 10% of a base that size paid Hangar about $6,000 a year, that is $180M ARR. The longer-term prize is the internal-software budget that today goes to low-code platforms (about $44.5B in 2026, per Gartner): as agents take over building, the money moves to wherever the result runs and is governed.

**Which category best applies to your company?** Developer Tools (secondary: B2B / Security).

**If you had any other ideas you considered applying with, please list them.**

> - **Connectors for agent-built software:** a credential broker that lets any agent-built tool read a company system with scoped, logged, revocable access, sold on its own to companies whose tools live elsewhere.
> - **Multiplayer agent sessions** (YC Fall 2026 RFS, Aaron Epstein): a shared, live agent workspace a team can watch, redirect and hand off.
> - [FILL: one idea of your own that you have real insight into.]

---

## Equity

**Have you formed ANY legal entity yet?** [FILL.] **Have you taken any investment yet?** [FILL.] **Are you currently fundraising?** [FILL.]

---

## Curious

**What convinced you to apply to Y Combinator? Did someone encourage you to apply? Have you been to any YC events?**

> Pete Koomen's "A Cloud for Small Software" request describes the exact product I had already started building, and YC's own internal agent tooling (350+ tools, per the Lightcone episode) is the clearest public example of the future Hangar is for. The YC network is also the best first market for it. [FILL: anyone who encouraged you; any events.]

**How did you hear about Y Combinator?** [FILL.]

---

## Before you submit

- [ ] Every `[FILL]` replaced with something true you can show on screen.
- [ ] Every number re-checked on submission day; nothing rounded up.
- [ ] Product link works in a private window; demo login works; no pilot data in the demo team.
- [ ] The 50-character line still describes the product in plain words.
- [ ] Read the whole application aloud once. Cut every sentence that would survive in any other company's application.
- [ ] Founder video recorded per 05 (unscripted, under a minute).
