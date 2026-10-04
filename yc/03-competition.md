# Competition (as of October 2026)

**The honest summary.** Private hosting for agent-built apps became table stakes in 2026. OpenAI, Anthropic, Retool, Netlify, Vercel, Cloudflare and several startups all ship it. Every one of them assumes the person *using* the tool has a seat or a company login: a ChatGPT or Claude seat, a Retool user, or a Google or Microsoft work account. That fits office workers. It leaves out the people who run the physical economy: about 83% of non-desk employees have no corporate email address ([Tribe, via Blink](https://www.joinblink.com/intelligence/inbox-zero-forever-the-future-of-employee-communication-without-email)).

Hangar competes on four things the others do not combine:

1. **Viewers need nothing.** Crew open a tool from a personal link on their own phone. No email, no app store, no seat. Removing them cuts access instantly.
2. **Rules the tool cannot bypass.** Who may add, change, approve or delete is declared per collection and enforced by Hangar's server, so a crew member cannot approve their own request from the browser console.
3. **Company data without credentials in the tool.** A tool runs only the read-only queries an owner approved, against a database whose credentials Hangar holds.
4. **Any builder.** Claude Code, Cursor and Codex deploy over MCP or the CLI; a manager who built in ChatGPT or Claude chat uploads the file.

## Office-worker platforms (all require a seat or work login for viewers)

| Product | What shipped | Who can open a tool |
| --- | --- | --- |
| **OpenAI Codex Sites** (June 2, 2026) | Prompt-built internal apps hosted by OpenAI, with storage; on by default in ChatGPT Business ([VentureBeat](https://venturebeat.com/orchestration/openais-codex-update-lets-agents-build-interactive-enterprise-workspaces-via-sites-and-role-specific-plugins)) | Sign in with ChatGPT (workplace accounts) |
| **Claude Code Artifacts** (June to Sept 2026) | Shared pages with storage, viewer identity, MCP connectors called at view time using *each viewer's own* connections, editor roles, public links ([Claude Code week 29](https://code.claude.com/docs/en/whats-new/2026-w29)) | Org members signed in to Claude; connector-backed artifacts cannot be public |
| **Retool CLI** (Sept 24, 2026) | Deploys agent-built React apps, including ones built in Lovable, Cursor and Replit, under Retool's governance ([Retool](https://retool.com/blog/retool-cli)) | Retool users |
| **Superblocks** ($60M raised; 3.0 on Aug 3, 2026) | Governed app generation in the customer's cloud, app imports, Builder MCP ([AI Book](https://getaibook.com/news/superblocks-30-integrates-ai-app-generation-into-aws-vpcs/)) | Seats, enterprise SSO |
| **Lovable** ($600M ARR, Sept 2026) | Workspace-only publishing, custom audiences, IdP group mapping ([docs](https://docs.lovable.dev/features/publish)) | Lovable workspace members |
| **Replit** | Private deployments down to Core/Starter plans ([docs](https://docs.replit.com/features/publishing/private-deployments)) | Replit org members |
| **VibeHost** | Remote MCP deploy from any agent, private by default, $20/month flat per workspace ([VibeHost](https://vibehost.com/pricing/)) | Google sign-in, workspace members |
| **display.dev, Stacktree, here.now** | Publish agent-made HTML behind company auth or private links ([display.dev](https://display.dev/), [Stacktree](https://stacktr.ee/agents)) | Company Google/Microsoft SSO or email one-time codes |
| **Netlify** (private by default from July 28, 2026), **Vercel** (free production protection, Sept 2026), **Cloudflare** (one-click Access for all Workers) | Developer clouds now protect internal apps by default ([Netlify](https://www.netlify.com/blog/new-netlify-projects-are-now-private-by-default/), [Vercel](https://vercel.com/changelog/password-protection-now-costs-20-per-project-per-month-on-pro), [Cloudflare](https://blog.cloudflare.com/workers-protected-by-access/)) | Team members or the company IdP |

What this means: building a "private Vercel for agent apps" in October 2026 would be a feature race against companies that already own the seat. Hangar does not try to win office workers from OpenAI or Anthropic. It serves the employees those products cannot reach, and the managers who build for them.

## Frontline software (reaches crew, but fixed-function)

| Product | What it is | Pricing |
| --- | --- | --- |
| **Connecteam** | Scheduling, time clock, chat, forms and checklists for deskless teams | From $29/month for 30 users, then per user ([Capterra](https://www.capterra.com/p/153140/Connecteam/)) |
| **SafetyCulture** | Inspections, checklists, training | $24 per seat per month; $5 "lite" seats ([pricing summary](https://blog.reportwalk.com/safetyculture-iauditor-pricing/)) |
| **Glide** | No-code apps on spreadsheets | $199/month for 30 users, then $5 per user; work-email sign-in on Business ([Jet Admin summary](https://www.jetadmin.io/blog/glide-pricing-current-plans-real-costs-and-jet-admin-alternatives-july-2026/)) |
| **AppSheet, Power Apps** | Big-suite no-code builders | Need Google Workspace or Microsoft 365 identities (Microsoft sells cheap frontline licences to large enterprises) |

These vendors already prove operators pay to get software onto the floor. Their products are templates the operator configures. The operators in our wedge now build exactly the tool they want with AI instead: Keva, an eight-unit juice chain, cut about five vendors and built its own operations app with Claude; Pincho, a 12-unit chain, built a recipe app in five hours ([Restaurant Business](https://www.restaurantbusinessonline.com/technology/vibe-coding-changing-build-or-buy-debate-restaurants)). What those operators lack is the last mile Hangar provides: crew identity, enforced rules, and governed data access.

## YC companies nearby

| Company | Batch | What it does | Relation to Hangar |
| --- | --- | --- | --- |
| [Floracene](https://www.ycombinator.com/companies/floracene) | S26 | Describe and deploy HIPAA-compliant internal tools for healthcare operators | Same last-mile pain in one regulated vertical, with its own builder. Validates the problem. |
| [Vybe](https://www.ycombinator.com/companies/vybe) | X25 | "Lovable for internal apps", integrations and SSO, repeat YC founders | Office-worker builder |
| [Specific](https://www.ycombinator.com/companies/specific) | F25 | The cloud platform built for coding agents | Production infra for developers |
| [Modelence](https://www.ycombinator.com/companies/modelence) | S25 | Production infrastructure on autopilot for agent-built apps | Production infra for developers |
| [InsForge / InstaCloud](https://www.ycombinator.com/companies/insforge-instacloud) | X26 | Agent-native serverless cloud; $8M seed Sept 2026 | Production infra for developers |
| [Floot](https://www.ycombinator.com/companies/floot) | S25 | App platform inside Claude and ChatGPT | Prosumer publishing |
| [Wato](https://www.ycombinator.com/companies/wato) | X26 | Control point for agents at work: shared memory, workflows, "living artifacts" | Office-worker agent workspace |

## What we have learned from the ones that struggled

- **Toolify (W24, inactive)** sold a dev-first starter kit and editor extension before agents could build tools alone. Hangar asks nothing of the builder.
- **Val Town** found developers already have hosting; its 2026 updates show a turn toward internal tools and team-only access ([Val Town](https://blog.val.town/2026-feb)). The lesson we take: hosting is not the product. Who can use the tool, under which rules, against which data, is.

## The risks we take seriously

- **A lab adds frontline identity.** OpenAI or Anthropic could let workspace owners invite people without accounts. Their pricing and identity model are built on knowledge-worker seats, so this cuts against how they make money, but it is possible. Our defence is depth in the frontline last mile: crew links and offboarding, enforced rules, approved data access, and the operator's admin view across locations.
- **Frontline vendors add "bring your own AI tool."** Connecteam or SafetyCulture could let customers host custom apps. They would have to give up the template model they sell. If they do, we compete on builder-neutrality and governed data access.
- **VibeHost or display.dev add crew links.** Possible and cheap for them to try. Hangar's edge then has to be the rules and data layer, which is why those shipped before anything else in round two.
