# Hangar: YC Winter 2027 package

Everything needed to apply to YC's Winter 2027 batch with Hangar, built against Pete Koomen's **A Cloud for Small Software** request (YC Fall 2026 RFS). On-time deadline: **Sunday, November 2, 2026, 8pm PT**.

| File | What it is |
| --- | --- |
| [01-company-memo.md](01-company-memo.md) | The thinking: problem, insight, product, market, model, GTM, risks |
| [02-application.md](02-application.md) | Every application question, answered, with `[FILL]` only where the answer must come from you |
| [03-competition.md](03-competition.md) | Lovable, Replit, Anthropic, Microsoft, Vercel, Retool/Superblocks, YC neighbors, and the graveyard |
| [04-traction-sprint.md](04-traction-sprint.md) | The 29 days to the deadline: the metric, week-by-week plan, outreach, discovery script, onboarding checklist |
| [05-video-and-interview.md](05-video-and-interview.md) | Founder video, demo video storyboard, interview answers |
| [prospects-yc-portfolio.csv](prospects-yc-portfolio.csv) | 145 active YC companies (recent batches, 8 to 250 people) to start outreach |
| [screenshots/](screenshots/) | The product as it runs today |
| [reviews/](reviews/) | The four expert reviews and scores, round by round |

## What is real today

The product in this repository works end to end, verified locally against Postgres:

- `npm test`: 48 unit tests (permissions, bundle validation, secret scanning, sandbox policy, ticket signing).
- `npm run e2e`: a real-browser suite that checks every security and product claim in the memo, including CSRF-style attacks from inside a tool.
- `npm run build`: clean production build.

What is **not** real yet and only you can make real: users, the founder answers, a production domain. The sprint plan exists for exactly that.

## How the facts were gathered

The environment this was built in blocks most websites (including ycombinator.com), so research came through web search results rather than reading pages directly, plus the open YC company dataset on GitHub. Every fact in the memo carries its source link. **Before submitting, click through the links you quote in the application** and confirm each number still says what we say it says.
