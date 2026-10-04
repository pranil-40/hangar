# Hangar: company memo

**One line.** Managers at restaurants, shops, clinics and warehouses now build their own tools with AI. Hangar puts those tools in the hands of their staff: on their own phones, without a company email or an account, with the operator's rules and data credentials enforced by Hangar instead of by the tool.

**RFS.** An answer to Pete Koomen's *A Cloud for Small Software* (YC, Fall 2026): "Agents make it easy to build personal tools for yourself or your team. But deploying, securing, and sharing that software is still far more complicated than creating it... [a cloud for small software could] make bespoke tools as easy to share with a colleague as a Google Doc." ([YC RFS](https://www.ycombinator.com/rfs)) For most of the workforce, the colleague has no Google account. Hangar makes the tool as easy to share as texting a link.

---

## 1. The problem

Keva runs eight juice bars. In 2026 it told its software vendors to lower their prices or be replaced by AI, cut about five apps, and built its own operations app with Claude: onboarding and training, daily checklists, inventory, staff communications. Pincho, a 12-unit burger chain, built a recipe app in about five hours because none of its vendors offered one. Restaurant Business reports operators doing this "range from mom-and-pops to small regional chains to global brands like Starbucks." ([Restaurant Business](https://www.restaurantbusinessonline.com/technology/vibe-coding-changing-build-or-buy-debate-restaurants))

Building is solved. The last mile is not. The tool has to reach a line cook on a personal Android phone, a cashier on a shared tablet, a new hire who started yesterday and the one who quit this morning. It has to stop a crew member from approving their own request. It has to read today's stock numbers without a database password sitting in the page source. And it has to do that for people who, 83% of the time, have no corporate email address ([Tribe, via Blink](https://www.joinblink.com/intelligence/inbox-zero-forever-the-future-of-employee-communication-without-email)).

Every platform that learned to host agent-built apps this year assumes the opposite. OpenAI's Codex Sites require Sign in with ChatGPT; Claude Artifacts require org membership; Retool requires Retool users; VibeHost, display.dev, Cloudflare Access and the developer clouds require a company Google or Microsoft login. Office workers are well served. The people who most need small bespoke tools are the ones none of them can reach.

## 2. Why now

1. **Operators build with AI.** Keva, Pincho and Starbucks are building their own tools (above). Claude Code passed a $2.5B run-rate by February 2026 ([Sacra](https://sacra.com/c/anthropic/)) and Lovable passed $600M ARR in September 2026 ([TechCrunch coverage via SaaS City](https://saascity.io/blog/lovable-600m-arr-vibe-coding-platform-economics-2026)): making software is now something non-engineers do weekly.
2. **The office-worker version just got bundled.** OpenAI, Anthropic, Retool, Netlify, Vercel and Cloudflare all shipped private internal-app hosting between June and September 2026 (see [03-competition.md](03-competition.md)). That settles the office market and makes the gap on the floor obvious.
3. **The leaks are visible.** When agent-built apps go live without a governed home, they leak: about 1 in 10 scanned Lovable apps exposed user data through misconfigured row-level security (CVE-2025-48757, [Matt Palmer's disclosure](https://mattpalmer.io/posts/2025/05/CVE-2025-48757/)). An operator's tool holds payroll hours, supplier prices and customer details.

## 3. The insight

**For frontline software, identity and rules are the product, and hosting is a commodity.**

1. **The viewer is the constraint.** A tool for 40 crew members is only useful if all 40 can open it today, without IT, and lose access the minute they leave. Seat-based platforms cannot price or provision that; Hangar gives every crew member a personal link that works on their own phone.
2. **Rules must live outside the tool.** Agent-written code will always have bugs, and anything enforced in the browser can be bypassed from the browser. So who may add, change, approve or delete is declared per collection and enforced by Hangar's server.
3. **Tools never hold credentials.** A tool runs only the read-only queries an owner approved, against a database whose credentials Hangar keeps sealed. That removes the class of breach behind CVE-2025-48757 by construction.
4. **The builder is whoever is closest to the work.** Managers build in ChatGPT, Claude, Cursor or Claude Code. Hangar takes the result from any of them: an MCP call or CLI command from an agent, or a file upload from a chat.

## 4. What Hangar is (built, tested end to end)

| Capability | How it works |
| --- | --- |
| **Crew access without accounts** | A manager adds a crew member by name and texts them a personal join link (or shows a QR code). One tap on the link signs that phone in. Link previews in messaging apps cannot consume it. Removing the person cuts access on the next request. |
| **Deploy from any builder** | Coding agents deploy over MCP or a zero-dependency CLI; managers who built in a chat upload the files or paste the HTML. Every deploy is a version; any version can be made live again. |
| **Enforced rules** | `hangar.json` declares who may read, add, change and delete each collection (`anyone`, `author`, `editor`, `owner`, `nobody`). The server enforces it and stamps every record with who wrote it. Default: only the author or a manager can change a record. |
| **Company data, no credentials in tools** | An owner connects a Postgres database once (sealed with AES-256-GCM). A tool declares named read-only queries; an owner approves them; a changed query needs re-approval. Queries run read-only with a timeout and row cap, and every call is logged. |
| **Sandboxed runtime** | Tools run with an opaque origin inside Hangar's frame. They cannot read Hangar's session, cookies or pages, cannot make network requests anywhere but Hangar, cannot open popups or navigate their frame away, and deploys containing credentials are refused. |
| **Office staff too** | Managers and head office sign in with Google; an owner can let anyone with a verified company Google account auto-join. |
| **Oversight** | Activity log of deploys, refused deploys, approvals, crew changes and data access; per-tool usage. |

The repo's real-browser test suite (`npm run e2e`) checks each row above, including the attacks: forging an approval from the console, navigating a tool away, and replaying tickets after someone is removed.

## 5. Who it is for first

**Multi-location operators with 3 to 50 locations**: restaurant groups and franchisees, specialty retail, clinics, gyms, car washes, local logistics. The builder is a general manager, area manager or ops lead who already uses ChatGPT or Claude. The users are crew on personal phones and shared tablets.

Why them: they are already building (Keva, Pincho), the pain is daily (checklists, stock counts, shift handovers, waste logs, equipment checkout, approvals), turnover makes account-based access unworkable, and a single franchisee group decides in a meeting.

Why I can reach them first: [FILL: your honest edge here, for example a job you have held on a floor, a family business, or operators you already know]. The first pilots come from people we can walk in and sit with.

## 6. Competition, briefly

Full analysis in [03-competition.md](03-competition.md). Office-worker hosting is crowded and bundled into seats; we do not compete there. Frontline vendors (Connecteam, SafetyCulture, Glide) prove operators pay to get software onto the floor, but sell configurable templates. Hangar runs whatever the operator built with AI, with the identity, rules and data access those templates bundle.

## 7. Business model

Priced per location, flat, with no charge for crew and no sign-in tax.

| Plan | Price | Includes |
| --- | --- | --- |
| Free | $0 | One location, 3 tools, up to 15 crew |
| Location | $39 per location per month | Unlimited tools and crew, enforced rules, Google sign-in, version history |
| Operator | $299 per month for up to 15 locations | Everything, plus database connectors, cross-location admin and activity export |
| Enterprise | Annual contract | Unlimited locations, SAML/SCIM, private deployment |

For comparison: SafetyCulture lists $24 per seat per month (or $5 "lite" seats), Connecteam starts at $29 for 30 users and then charges per user, Glide charges $199 for 30 users and $5 per extra user. A 10-location operator with 300 staff pays Hangar $299 a month.

## 8. How big

Bottom-up, starting from the wedge:

- **43,212** US multi-unit franchise operators control **223,213** franchised units ([FRANdata / IFA via Kickfin](https://kickfin.com/blog/multi-unit-franchises/)). At $39 per location per month that segment alone is about **$104M** a year.
- **727,892** US food-service establishments (BLS, Q1 2026, [BLS](https://www.bls.gov/iag/tgs/iag722.htm)): about **$340M** a year at the same price.
- **11.8M** US private establishments in total (BLS QCEW, 2025, [BLS](https://www.bls.gov/cew/publications/employment-and-wages-annual-averages/current/)). If one in ten adopt at $39 per location, that is about **$550M** a year in the US before connectors, enterprise plans or any other country.

## 9. Go-to-market

1. **Walk-in pilots.** Start with operators we can visit. Sit with the manager while they deploy their first tool and text the link to two crew members. Target: a crew member opens it within 15 minutes.
2. **Templates that teach the pattern.** Publish working, deployable tools for the jobs every location has (opening checklist, waste log, stock count, shift handover, equipment checkout), each one a prompt a manager can paste into ChatGPT or Claude and adapt.
3. **Operator communities.** Franchisee associations, multi-unit operator groups and the trade press already covering this shift (Restaurant Business above).
4. **Land a location, expand the operator.** One GM's tool spreads to sibling locations; the Operator plan exists for that moment.
5. **Agents as distribution.** The MCP server and skill are listed where agents look, so "deploy this to Hangar" works from any coding agent.

## 10. Risks and how we retire them

| Risk | Response |
| --- | --- |
| **A model lab adds frontline identity** | It cuts against seat pricing, which is how they make money. Our depth is the last mile: crew links and offboarding, enforced rules, approved data access, cross-location admin. |
| **Operators will not build their own tools** | Some already do (Keva, Pincho, Starbucks). Templates lower the bar to "paste this prompt"; the sprint plan tests this directly. |
| **Frontline vendors add custom apps** | They would be giving up the template model they sell. If they do, we compete on builder-neutrality and governed data. |
| **Security failure on Hangar** | No tool code runs on Hangar's servers; tools run sandboxed in the browser; credentials are sealed and never sent to tools; every ticket is re-checked against live membership; the attack cases are in the automated test suite. |
| **Small contracts** | Per-location pricing grows with the operator; the Operator plan and connectors raise ACV; acquisition is local and low-cost at first. |

## 11. Milestones

- **By Nov 2:** production deploy; 3 to 5 locations where at least two crew members (not the manager) open a tool on two or more days a week; one paid location or signed letter of intent; numbers reported exactly as measured.
- **By Demo Day:** 30 locations across at least 8 operators, first Operator-plan customer, templates library live.
- **12 months:** the default way frontline operators ship the tools they build with AI.
