# Videos and the interview

## Founder video (one minute)

YC asks for a one-minute video of the founders, unscripted. They are checking that you are real, that you can explain the company plainly, and how you talk. Do not read a script, do not show the product, do not edit it.

**Talking points to know cold** (say them in your own words, in any order):

- Who you are, in one sentence, and the single most impressive thing you have done.
- What Hangar does: "When someone builds a tool with a coding agent, Hangar is where it goes to be used by their team. One command and it's live behind the team's sign-in, sandboxed, with no keys in the code."
- Why you: the moment you saw the problem yourself.
- Where it is: what works today, how many teams use it, the shared-tools number.

Record it three times, keep the most natural take, and stop at 60 seconds.

## Demo video (about two minutes, optional but worth it)

Screen recording with your voice. No music, no slides.

1. **(0:00 to 0:15)** Claude Code in a terminal: "Build a page where people request equipment and managers approve it. Use window.hangar for the user and storage." Fast-forward the build.
2. **(0:15 to 0:30)** "Deploy this to Hangar as Purchase requests." Show the MCP call and the URL it returns.
3. **(0:30 to 0:55)** A second browser signed in as a colleague: open the tool, submit a request. Back as the manager: approve it. Same data, different identity, no backend code.
4. **(0:55 to 1:20)** The safety rails: deploy a build with a fake `sk_live_` key and show the refusal with the file and line. Open devtools inside the tool and show `document.cookie` throwing.
5. **(1:20 to 1:45)** The owner view: Activity log, versions, rollback, revoking a deploy token.
6. **(1:45 to 2:00)** One sentence on traction and what is next.

## The 10-minute interview

Partners interrupt. Answer the question in the first sentence, then stop. Have the product open and logged in before the call.

| Likely question | Answer in one or two sentences |
| --- | --- |
| What does Hangar do? | When someone builds a tool with a coding agent, Hangar is where it goes to be used by their team: one command and it's live behind the team's sign-in, sandboxed, with storage built in and no credentials in the code. |
| Who is using it? How often? | [Exact number of teams, shared tools this week, and one story about a specific pilot's tool.] |
| Lovable and Replit already do private publishing. Why you? | They host only what was built inside them. Teams use several agents, and IT needs one place that is safe to hand to all of them. |
| What if Anthropic just ships this? | Their artifacts are single pages for Claude seat holders. A neutral host across agents is the opposite of what a lab's hosting is for. And we make their agents deploy to us more easily, so their progress helps us. |
| Why won't you end up like Toolify? | Toolify asked developers to adopt its kit before agents could build tools on their own. We ask nothing of the builder; the agent people already use deploys with one call. |
| What is the hardest technical problem? | Running code an agent wrote for one person in everyone else's browser without it being able to act as them. Opaque-origin sandbox, no credentials in the tool, and per-viewer tickets re-checked on every call. Tested in a real browser, including CSRF-style attacks. |
| Tools are static only? | Today, yes, plus identity and shared storage, which covers forms, approvals, trackers and dashboards. Connectors come next, in the order pilots ask, with Hangar holding the credentials. |
| Who pays, and how much? | The team lead or IT, per builder: $20 or $40 a month; viewers free. A 200-person company with 15 builders is about $7,200 a year. |
| How big can this get? | Every company paying for coding agents (Anthropic alone reported 300,000+ business customers) needs a governed place for what they build. 10% of a base that size at $6,000 a year is $180M ARR. |
| Why now? | The building moved into agents that can also take actions, so the deploy step now happens inside the agent. Whoever is its default target gets the tool. |
| What did you learn from users that surprised you? | [Fill from pilots. Have one real, specific surprise.] |
| What will you do in the batch? | Get to 50 teams with shared tools, ship connectors and Google sign-in, and become the default "share with my team" action in the major agents. |
| Why are you the right person? | [Your answer: what you have built, how fast you ship, why you care about this problem.] |

**Practice** with a friend who interrupts. Ten minutes, timed, three times.
