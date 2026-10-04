# The 29-day sprint: October 4 to November 2

The application gets judged on two things this package cannot supply: you, and real usage. This plan is about the second. The goal is modest and specific: **8 to 10 teams, each with at least one tool that two or more different people opened in the last week**, reported exactly as measured.

## The number

**Shared tools:** tools opened by two or more different people in the last 7 days. `npm run metric` prints it (and excludes the demo team). Report it with "teams sharing a tool" and the raw counts underneath. Run it every Monday and keep a screenshot of each run; a partner may ask to see the trend.

Why this number: one person opening their own tool proves nothing. A second person opening it is small software doing its job, which is the whole thesis.

## Week 1 (Oct 4 to 10): make it real

- [ ] **Production.** Follow [../DEPLOY.md](../DEPLOY.md): Neon + Vercel, a fresh `SESSION_SECRET`, `APP_URL` set to your domain. Buy a short domain. Confirm `https://<domain>/hangar.mjs` downloads.
- [ ] **Smoke test production** with the same steps as the local e2e: create a team, a token, deploy `examples/purchase-requests` from the CLI and via MCP in Claude Code, open it as a second account.
- [ ] **Google sign-in.** Pilots will not create passwords. Ask Claude Code to add Google OAuth (OIDC) with `email_verified` checks and optional auto-join by verified domain. Keep the permission rules in `src/lib/permissions.ts`.
- [ ] **Dogfood.** Build and deploy three tools you actually use this week. Write down every friction point; fix the top two.
- [ ] **Book 20 conversations.** Use [prospects-yc-portfolio.csv](prospects-yc-portfolio.csv) (145 active YC companies from recent batches with 8 to 250 people) plus anyone you know at a startup. Aim for the person who builds internal tools or worries about them: head of ops, CTO, first IT/security hire.

## Week 2 (Oct 11 to 17): first three pilots, by hand

- [ ] Run discovery calls (script below). Only offer a pilot to people who describe the problem before you do.
- [ ] Onboard three teams personally (checklist below). Sit with them on a call while their agent deploys the first tool.
- [ ] Target: first tool live and opened by a second person within 15 minutes of starting. Time it.
- [ ] Fix whatever broke within 24 hours and tell them you did.

## Week 3 (Oct 18 to 24): eight to ten pilots

- [ ] Onboard five to seven more teams.
- [ ] Build the single connector pilots ask for most (probably Google Sheets or a read-only Postgres). Do not build connectors nobody asked for.
- [ ] Publish the MCP server and skill where agents look (Claude Code plugin marketplace, MCP registries, Cursor's directory).
- [ ] Ask every active pilot: "Would you be upset if this went away?" Write down exact answers.

## Week 4 (Oct 25 to Nov 1): write it down

- [ ] Monday: run `npm run metric`; screenshot it.
- [ ] Fill every `[FILL]` in [02-application.md](02-application.md) with true numbers and two pilot quotes (with permission).
- [ ] Record the founder video and the demo video ([05-video-and-interview.md](05-video-and-interview.md)).
- [ ] **Submit by Thursday Oct 30.** Keep working; YC reads updates.

---

## Outreach messages

Short beats clever. Personalize the first line or do not send it.

**Email or DM to a founder/CTO**

> Subject: where do your team's Claude Code tools live?
>
> Hi [name], [one specific line about their company]. Quick question: when someone on your team builds an internal tool with Claude Code or Cursor, how does it get to the rest of the team?
>
> I'm building Hangar, which lets the agent deploy it privately behind your team's sign-in in one step, sandboxed, with no keys in the code. I'm looking for a few teams to pilot it free and would set it up with you on a 20-minute call. Worth a look?
>
> [your name]

**Follow-up (once, 4 days later)**

> Bumping this once. If internal tools aren't a thing at [company] yet, a one-word "no" helps me too.

## Discovery call (20 minutes)

Ask about the past, never about your product. Let them describe the problem first.

1. "Tell me about the last internal tool someone on your team built with an AI agent. What was it?"
2. "Where does it run now? Who can open it?"
3. "How did the people who needed it get access? What was annoying about that?"
4. "Has anyone built something that never got shared? Why not?"
5. "Who would have to say yes before a tool like that touched company data?"
6. "What do you use today to host or share them?" (Listen for Vercel, Replit, Lovable, Streamlit, "on my laptop", "we don't".)
7. Only now: "If your agent could deploy it privately behind your team's sign-in in one step, would you try it on a call this week?"

Write up every call in five lines: who, what they built, where it lives, the pain in their words, yes/no to pilot.

## Pilot onboarding checklist (on a call)

1. They sign up; create their team; invite one colleague.
2. They create a deploy token in Settings and run the two setup lines.
3. In Claude Code: `claude mcp add hangar -- node ~/.hangar/hangar.mjs mcp`, plus the skill.
4. They ask their agent to build something small they need *this week* (or deploy a tool they already built; most only need `base: "./"` and a rebuild).
5. "Deploy this to Hangar as ___." The colleague opens it. Start the clock at step 1, stop it here.
6. Show them the Activity tab, the version history and rollback.
7. Agree on a check-in in 5 days.

## What to measure and keep

- The metric output every Monday (screenshots).
- Time from signup to second-person open, per pilot.
- Every refused deploy and why (secrets, root-absolute paths, size): proof the safety rails do real work.
- Exact quotes, dated, with the person's role.
