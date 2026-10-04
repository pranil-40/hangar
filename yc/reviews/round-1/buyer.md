# Round 1 review: target buyer plus GTM operator ("buyer")

Reviewer persona: Head of IT and Security at a 220-person AI-forward Series B (about 40 non-engineers with Claude Code or Cursor seats, some internal tools already leaked onto public URLs), and a former YC founder who ran go-to-market for a devtools company from zero to $5M ARR.

Reviewed 2026-10-04 against the package in `yc/`, the repo README, `public/hangar-skill.md`, `public/hangar.mjs`, `examples/purchase-requests`, and a hands-on run of the product at http://localhost:3000.

## Score

**6.2 / 10**

## Secondary odds

**About 3%** if submitted today as-is, with zero users and an unknown solo founder. That is above the base rate because of the RFS fit, an unusually honest and specific package, and a product that actually works. It is not higher because there is no customer pull yet, at least two direct competitors the package never mentions sell the same pitch today, and a lot of W27 applicants will answer this same RFS.

## Verdict

I would not let Hangar near company data today. In 3 months, if the roadmap ships as described, I would run a paid pilot for one department. The insight is right and I have felt this problem myself: the hard part of agent-built tools is permissions, not hosting, and tools that never hold a credential remove a whole class of breach by construction. The product is real, and the deploy loop took me under two minutes. But the package oversells exactly the property it is selling, which is security. A viewer can forge an approval in the flagship approvals demo with one line in devtools, and the "cannot send data outside Hangar" banner is false: I got viewer identity and records out through a popup and through the frame navigating itself. The competition doc says "nobody else is building that", but VibeHost (deploy from any agent via CLI or MCP, private behind Google sign-in, $20 a month flat per workspace) and display.dev already are, and it misses that Claude Code Artifacts gained shared storage, public links and MCP connectors in July 2026. The GTM aims at a 20 to 300 person ICP, yet the prospect list it ships has a median of 10 people. Interview-worthy only if the founder turns the sprint into real pilots with an IT approver in the loop.

## What is strong

- **RFS fit is exact.** Koomen's RFS names the hard parts: "auth & permissions are hard, and allowing nontechnical users to share arbitrary code is tricky to do securely." Hangar goes straight at both. Few applicants will have a working answer to the second part.
- **The core insight is a real buyer insight.** "Running is a permissions problem rather than a hosting problem" is exactly how I think about it as an IT lead. "Tools never hold credentials" is the right architectural answer to the Lovable and Supabase RLS leak pattern. I would repeat that sentence to my CISO.
- **Deploy rights follow the person's live role.** When a member is demoted or removed, their tokens and tickets stop working. That is the offboarding property I care about most, and the e2e suite verifies it.
- **The safety rails do real work.** In my run, OpenAI, Anthropic, Supabase service-role and Postgres-with-password secrets were all refused, each with the file and line. Root-absolute asset paths were refused with the Vite fix spelled out. Dotfiles never ship.
- **The loop is fast.** From creating a token to having a live, versioned, private tool took me under two minutes. Redeploying from MCP picked up the same tool as v2. Rollback exists. Activity attributes each deploy to the person and the agent.
- **The writing is honest and specific.** The repo README has a "Known gaps" section, and the application says plainly that it has no users. The package never inflates numbers, and it tells the founder not to. Partners notice that.
- **Viewers are free.** That is the right pricing instinct. Free viewers are what make a tool's reach the outcome, and they are a sharp contrast with Claude Artifacts, where every viewer needs a seat.

## Hands-on product notes

What I did: signed in as editor, created a deploy token in Settings, ran the setup lines with an isolated HOME, ran `claude mcp add` (health check: connected), and built and deployed my own "Access review" tool from the CLI (v1) and then over MCP (v2). I opened it as the viewer and submitted a record. I deployed edge-case builds (CDN script, Google Font, external fetch, several secret types, root-absolute paths, a 4 MB bundle) and a sandbox probe. As owner I reviewed Activity, Members, Settings and the tool page. I signed up a fresh account and created an empty team. I created and revoked an invite.

Severity scale: **Blocker** (I cannot adopt), **High**, **Medium**, **Low**.

1. **Blocker for any approvals use case: a viewer can forge approvals.** In Purchase requests, logged in as viewer (Jo), I ran `hangar.collection("requests").update(id, {...data, approvedBy: "Morgan Reyes (owner)"})` from the tool frame, and my own $240 request then showed "Approved by Morgan Reyes (owner)" to everyone. (I restored the record afterwards.) Every member can write every record, and the approver's name is a client-supplied string. The README lists "record-level permissions do not exist" as a known gap, but the memo sells this exact tool as "A full approvals tool needs zero backend code", and step 3 of the demo video storyboard is "Back as the manager: approve it." A security person in a pilot will find this in ten minutes. The server does stamp `updatedBy`, so the forensic trail exists, but the UI shows the forged name.
2. **High: the sandbox banner overclaims.** Every tool page says "This tool cannot see your Hangar session or send data outside Hangar." `fetch` and `img` to outside hosts were blocked as claimed. But my probe tool sent the viewer's name, email and the collection's records to an outside host in two ways: `window.open(url)` (the CSP sandbox includes `allow-popups`) and the frame navigating itself (`location.href = url`). CSP does not govern navigation. The memo and the README repeat "cannot send data off Hangar", and the e2e check of that name only tests `fetch`. The fix is cheap (drop `allow-popups` and say "network requests stay on Hangar"), but I would lose trust in the vendor if I found this myself.
3. **Blocker for IT: there is no SSO.** Sign-in is email and password only, with no MFA, no password reset and no rate limiting. Invites are copy-paste links, and no email is sent. There is no domain auto-join, so giving 220 people viewer access means pasting 220 links. The package knows this (Google sign-in is week 1 of the sprint), but until it ships I cannot even start a pilot.
4. **Blocker for IT: there is no org layer.** Anyone can sign up and create a team. Owners can invite any email address, including personal or contractor addresses. Nothing gives me one admin view across teams. The application promises "the first place that lists every agent-built tool in the company", but the data model is a set of separate teams.
5. **High: the MCP setup line installs at the wrong scope.** `claude mcp add hangar -- node ~/.hangar/hangar.mjs mcp` registers the server at local (project) scope. The CLI told me "to local config [project: /tmp/hangar-buyer-review]". A builder who pastes it in their home folder and then opens Claude Code in a project has no Hangar tool. It should be `claude mcp add --scope user ...`, or better, a Claude Code plugin that bundles the MCP server and the skill.
6. **Medium: onboarding is engineer-shaped.** It needs Node 18+ (many ops people with Claude Code's native installer or Cursor will not have it) and a terminal. The "Add tool" page says "two setup lines", but Claude Code needs four. The code blocks have no copy buttons, and the long lines are clipped. The token is passed as a command argument, so it lands in shell history. Cursor, Codex and Claude Desktop users get a prose sentence instead of a config snippet, and a JSON MCP config will not expand `~`, so the line as written fails there.
7. **Medium: deploys that will break pass silently.** Builds loading a CDN script (Chart.js), a Google Font, or calling an external API deployed with no warning, then failed at runtime with CSP errors visible only in devtools. Agents add CDN Tailwind and Chart.js all the time. The deploy endpoint already returns `warnings`, so it should scan for external URLs and warn with the fix.
8. **Medium: the Activity log is thin for an IT buyer.** It has no filters, no export (CSV or webhook to a SIEM), and no view of tool opens or who uses each tool, even though opens are recorded (`AppView`) and the application claims "who uses it". Reads and writes of tool data are not logged.
9. **Medium: static-only blocks my real migrations.** The tools that leaked at my company run on Lovable plus Supabase and call Sheets, HubSpot or Slack. On Hangar they need a rewrite of the data layer, not "`base: "./"` and a rebuild" as the onboarding checklist suggests. There is no migration path or skill yet.
10. **Low-medium: `createdBy` and `updatedBy` are raw user ids.** There is no API to resolve names or list team members. My tool showed `"cmut1n86v..."` in its "Who" column, so tools end up storing spoofable names in `data`, as the example does (`requestedBy: hangar.user.name`). The skill does not document what `createdBy` contains. `list()` silently caps at 500 records.
11. **Low: polish.**
    - The nav says "People" for editor and viewer but "Members" for owner.
    - The permission matrix shows raw ids (`team:view`, `app:run`) to non-engineers.
    - The CLI prints "Only members of acme-ops" (the slug, not the team name).
    - An Anthropic key is reported twice, as both Anthropic and OpenAI.
    - The new-user empty state still says "add the tools your team already uses", which is copy left over from the directory version.
12. **Low: demo hygiene.**
    - The seeded team has five link-only tools and one hosted tool, so the demo mostly shows what Hangar cannot control.
    - Package screenshot 7 shows a broken embed (sad-face icon) for the Lovable link.
    - The screenshots show the Next.js dev badge.

## Buyer objections and whether the package answers them

| Objection (in the order I would raise it) | Answered? | Notes |
| --- | --- | --- |
| SSO / Google Workspace, offboarding through the IdP | Partly | It is on the roadmap and in sprint week 1. Business tier ($40) bundles "SSO and domain auto-join", but the memo criticizes Vercel for charging for SSO. Basic Google or Microsoft sign-in with domain restriction must be free on every plan, or the free-viewer loop never starts. SAML and SCIM can be the paid tier. |
| SOC 2 / security review | Mostly no | The memo asserts the beachhead "does not require SOC 2 from a pilot vendor." That holds at 30 people. At 220, I need a security page, a subprocessor list (Vercel, Neon), a DPA, a pen test plan and a SOC 2 Type I timeline (Vanta or Drata, about $25k to $50k in year one). None of these appear. |
| Data residency | No | Neon plus Vercel means US by default. The topic is never mentioned below Enterprise. That is fine for the US beachhead, but say so. |
| Static-only tools | Partly | Honest about it, and connectors come next. But Anthropic has already shipped MCP connectors inside Claude Code artifacts (July 2026), so "connectors as the moat" needs a sharper story. |
| Connectors | Not yet | The plan to "build the one pilots ask for" is right. |
| Audit export | Not yet | Business tier promises it. The log exists but cannot be exported or filtered. |
| Offboarding | Yes for tokens and tickets | It is not account-wide: an ex-employee's account survives, and so do their sessions (sessions are not revocable for 30 days). Without SSO, removal is a manual step per team. |
| Record-level permissions | Acknowledged in the README only | The memo's approvals pitch contradicts it. Fix it, or stop calling the example an approvals tool. |
| Pricing | Partly | $20 or $40 per builder with free viewers is sane against Retool ($10 to $50 per builder plus $5 to $15 per user). VibeHost charges $20 a month flat per workspace with unlimited members, and display.dev charges EUR 49 a month flat. For my 40 builders, Hangar Business is about $19k a year, which I would pay only for governance (SSO, SCIM, audit export, connectors), not for hosting. Per-builder pricing also taxes the "hand every employee's agent a deploy target" story. Meter active builders (deployed in the last 30 days) instead. |
| Vendor risk of a solo founder | No | Not addressed. A self-host or single-tenant option (the app is already one Next.js service plus Postgres) or an escrow commitment would defuse it. Data export of tool records also matters. |
| Lock-in, getting my data out | No | No export of records or bundles. |
| Exfiltration by a malicious or prompt-injected tool | Overclaimed | See product note 2. |

## GTM and sprint critique

**The wedge is about right but drawn too wide, and the list does not match it.** The real ICP is a company of 80 to 300 people with non-engineer builders (ops, RevOps, finance, support) plus one person who owns security. Below about 50 people, the CTO either sees no problem or sends engineers to Vercel with a password. The shipped `prospects-yc-portfolio.csv` is described as "8 to 250 people", but it actually runs from 8 to 55 people, with a median of 10. Only 23 of the 145 rows meet the memo's own floor of 20, and 114 have 15 people or fewer. It is also a list of companies, not of buyers: no names, roles, or signs that they build internal tools.

**"The YC network first" is not available yet.** An unaffiliated founder cannot post on Bookface, so cold-emailing small YC companies is no warmer than any cold email. Better sources:
- YC companies from 2018 to 2023 batches that are now 80 to 500 people, reached through the founder's own network.
- AI-forward companies that have publicly announced Claude or Cursor for all staff.
- Security and IT communities (an IT leaders Slack, CISO newsletters).

**There are two buyers, and the package treats it as bottom-up.** The memo's premise is that IT "correctly will not let a tool touching company data go live without real authentication." The same IT gate applies to Hangar itself. At any company with an IT function, the builder cannot put company data into an unvetted vendor. So the sale has two sides from day one: the ops builder is the champion and the IT or security lead approves. The pilot ask should be to the approver: "move your three riskiest public tools in here."

**Would I reply to the outreach email?** Probably not. It is clean and short, but it looks like the other 30 vendor emails I get a week. I would reply within the hour to this: "We found four tools on lovable.app and vercel.app that appear to belong to Acme; one ships a Supabase anon key against a table with RLS off. Want the list?" A free, passive public-exposure scan is the strongest hook available for this buyer. It would use certificate-transparency and DNS discovery of company-named subdomains on builder platforms, never touch data, and disclose responsibly. It also seeds the migration story.

**Is the 29-day sprint realistic for one person?** Weeks 1 and 2 are realistic. Booking 20 calls from cold outreach to small startups needs roughly 150 to 300 personalized sends. Converting to 8 to 10 teams with a second-person open is a stretch. My honest forecast is 3 to 6 pilot teams, 1 to 3 still active in their second week. Building a connector in week 3 while onboarding 5 to 7 teams and publishing to registries is too much for one person. I would cut it and spend the time on pilots and the exposure-scan hook. Five deep pilots with week-two usage and one priced commitment beat ten shallow ones.

**Is the north-star metric right?** "Shared tools: opened by 2+ people in 7 days" is the right instinct, because it measures the thesis, but as implemented it can be gamed without anyone meaning to:
- It counts link-only tools, so a Lovable URL listed in Hangar counts as a "shared tool" even though Hangar does not host it.
- It counts the deployer and the founder. Only the demo team slug is excluded, and onboarding has the founder sitting in on calls.
- Onboarding step 5 ("the colleague opens it") produces two opens on day one by design. Every pilot therefore shows as "sharing" for a week whether or not anyone comes back.

Redefine it as hosted tools opened by 2 or more people other than the deployer, on 2 or more distinct days in the trailing 7. Exclude founder accounts. Report week-2 retention and records written by non-builders next to it.

**Distribution through agents is the right long-term bet.** But the install path today is a token copy-paste plus `curl` plus a local Node file. Device-code login (like `gh auth login`), a Claude Code plugin, and a remote HTTP MCP server with OAuth would let Claude Desktop, claude.ai and Cursor users deploy with no Node and no token handling. Without those, the agent channel is not the "new SEO" yet.

## Top changes ranked by score impact

1. **Turn the sprint into real pull, with the IT approver in the room (+1.0 to +1.5).** Get 5 or more pilot teams at companies of 50 to 300 people, at least two of them with a named IT or security approver who said yes. Get one paid pilot or signed LOI with a price on it (even $200 a month). Show week-two usage. Quote the approver, not just the builder.
2. **Rewrite the competition section to match reality (+0.4).**
   - Add VibeHost (any agent, CLI and MCP, private behind Google sign-in, $20 a month flat per workspace, Next.js support) and display.dev (agent output behind company SSO, CLI and MCP). Mention Stacktree and ShareMyPage.
   - Update Claude Code Artifacts: public links, persistent shared and personal storage, and MCP connectors at view time all shipped in July 2026.
   - Delete "Nobody else is building that."
   - Then state the differentiation that survives: a credential-free data API with server-enforced permissions, governance across every agent, free viewers without AI seats, and multi-file builds. Explain why a $20-flat host loses the IT buyer.
3. **Close the two security gaps that contradict the pitch, and test them (+0.4).** Add server-enforced write rules: role-gated collections or fields declared in a small manifest, server-stamped actor names, and an approve action only an EDITOR or above can perform. Drop `allow-popups`. Change the banner and memo to an accurate claim ("network requests stay on Hangar"). Add e2e checks for forged approvals and navigation exfiltration.
4. **Ship Google and Microsoft sign-in with domain restriction, free on every plan, plus an org layer (+0.3).** The org layer needs one admin view across teams, a block on external-email invites by default, and account-wide deprovisioning. Keep SAML, SCIM and audit export for Business.
5. **Fix the GTM inputs (+0.3).** Rebuild the prospect list around 80 to 300 person companies with named BizOps or IT and security contacts, and correct the "8 to 250" description. Lead outreach with a free passive public-exposure scan. Add a migration skill that rewrites a Lovable or Supabase app's data calls to `hangar.collection` and imports its rows.
6. **Make onboarding one step for non-engineers (+0.2).** Add device-code login, change the setup line to `claude mcp add --scope user`, and package a Claude Code plugin with the MCP server and skill. Offer a remote HTTP MCP endpoint with OAuth so Desktop, claude.ai and Cursor work without Node. Add copy buttons and paste-ready JSON or TOML snippets for Cursor, Codex and Claude Desktop with absolute paths.
7. **Add a trust page and an answer to solo-founder risk (+0.2).** Cover data handling, subprocessors and region, a pen test plan, and a SOC 2 Type I date. Offer record and bundle export, plus a self-host or single-tenant option for security-sensitive buyers.
8. **Fix the metric and the pricing (+0.15).** Redefine "shared tools" as above (hosted only, deployer and founder excluded, 2 or more distinct days). Move pricing to a workspace platform fee plus active builders. Explain the price gap against VibeHost's $20 flat, and price governance rather than hosting.

## What would make this a 9.5+

- **Customer pull a partner can check:**
  - 20 or more teams with hosted tools reused week over week, and the redefined shared-tools number growing 15 to 20% weekly for a month.
  - Three or more paying companies where IT signed off.
  - One public story of a company moving its leaked public tools into Hangar.
- **A product that holds up under a security lead's first hour:**
  - Server-enforced record and field permissions.
  - A sandbox claim that survives a hostile tool.
  - Google or Microsoft sign-in with domain control.
  - An org admin view.
  - Exportable audit.
- **A defensible answer to Anthropic and to VibeHost.** Show evidence that multi-agent companies choose Hangar over Claude Artifacts even when everyone already has a Claude seat, and over cheaper flat-rate hosts. The answer should be data, connectors with brokered credentials, and governance, backed by usage numbers rather than argument.
- **Distribution that compounds:** a listed Claude Code plugin and remote MCP with a visible install count, and viewers converting to builders inside pilot accounts.
- **A founder story that explains the insight.** Ideally that is someone who has run IT, security or infra, or a cofounder who has. That falls outside what this package controls, but it is what would make a partner fight for it.
