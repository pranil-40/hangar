# Hangar

The private cloud for the tools your team's coding agents build.

Someone on the team asks Claude Code, Cursor or Codex for a refund-approval
page, a stock checker or a standup board, and gets one in twenty minutes.
Then it sits on their laptop, because putting it in front of colleagues means
a cloud account, a login system, a database and an IT conversation. Hangar is
the deploy target that is safe to hand every employee's agent: one call, and
the tool is live behind the team's sign-in, sandboxed, with storage and the
viewer's identity built in.

## Run it

```bash
npm install
cp .env.example .env   # point DATABASE_URL at Postgres (or SQLite, see below)
npm run setup          # generate client, create tables, seed demo data
npm run dev
```

Open http://localhost:3000 and sign in with a seeded account. All three use
the password `hangar123`:

| Role   | Email              | What they can do                                       |
| ------ | ------------------ | ------------------------------------------------------ |
| Owner  | owner@demo.test    | Everything, including members, tokens and the activity log |
| Editor | editor@demo.test   | Deploy and edit tools, create their own deploy tokens  |
| Viewer | viewer@demo.test   | Open and use tools                                     |

The seed includes **Purchase requests**, a real hosted tool
([examples/purchase-requests](examples/purchase-requests)). Open it as the
viewer and as the owner: same tool, different identity and permissions, shared
data, no backend code in the tool.

## Deploying from an agent

1. In a team, go to **Settings → Deploy tokens** and create one. The page
   shows two setup lines; the CLI is served by Hangar itself
   ([public/hangar.mjs](public/hangar.mjs), one file, no dependencies).
2. Give your agent the tools:
   - **Claude Code:** `claude mcp add hangar -- node ~/.hangar/hangar.mjs mcp`
     plus the skill at `/hangar-skill.md` ([source](public/hangar-skill.md)).
   - **Any MCP client** (Cursor, Codex, Claude Desktop): a server that runs
     `node ~/.hangar/hangar.mjs mcp`.
   - **By hand:** `node ~/.hangar/hangar.mjs deploy dist --name "Tool name"`.
3. Ask: *"Deploy this to Hangar as Refund approvals."* Deploying again from the
   same project is a new version of the same tool, and any version can be made
   live again from the tool page.

A deploy is refused, with the fix spelled out for the agent, if the build
contains credentials (cloud keys, payment keys, database URLs, Supabase
service-role keys and more, see
[src/lib/hosting/secrets.ts](src/lib/hosting/secrets.ts)) or loads its assets
from root-absolute paths.

## The security model

A tool is code written by an agent for one person and run in everyone else's
browser. It must not be able to act as the person viewing it. Three layers,
all in [src/lib/hosting/runtime.ts](src/lib/hosting/runtime.ts):

- **Sandboxed origin.** Tool pages are served with a CSP `sandbox` directive
  (and framed with the matching attribute) without `allow-same-origin`, so
  the browser gives them an opaque origin. They cannot read Hangar's cookies,
  storage or DOM, and their requests to Hangar carry no session, whether the
  tool is framed or opened directly at `/run/<id>`.
- **No way out.** `connect-src 'self'` and friends keep a tool's network
  traffic on Hangar. A tool cannot post what it shows to somewhere else.
- **No credentials.** The only thing a tool holds is a ticket for its own
  data API, scoped to one tool and one viewer, expiring in hours and
  re-checked against membership on every call. Removing someone cuts them off
  immediately. Static files are served under a per-viewer ticket too, and
  only for the live version.

Tool tickets, asset tickets and session cookies are signed with separate keys
derived from `SESSION_SECRET`, so none can be replayed as another
([src/lib/secret.ts](src/lib/secret.ts), [src/lib/tickets.ts](src/lib/tickets.ts)).

Deploy tokens are stored as SHA-256 hashes, are scoped to one team, and are
only as powerful as their creator is *now*: demote or remove someone and
their tokens stop deploying.

## Permissions

The permission model lives in exactly one place:
[`src/lib/permissions.ts`](src/lib/permissions.ts). Every decision is
`can(role, capability)`. If you catch yourself writing `role === "OWNER"` in a
page or an action, add a capability to the matrix instead.

- **Non-members get a 404, not a 403**, on team pages and on tool URLs alike.
- **A team always keeps at least one owner.**
- Every check runs on the server. Hiding a button is a convenience, never the
  control.

## The tool runtime

Every hosted tool gets `window.hangar` before its own scripts run:

```js
hangar.user                      // { id, name, email } of the viewer
hangar.role                      // "OWNER" | "EDITOR" | "VIEWER"
hangar.collection("requests")    // shared team storage: list / add / update / remove
```

The full contract an agent is given is in
[public/hangar-skill.md](public/hangar-skill.md).

## Link tools

Tools that already run on Lovable, Replit or Bolt can still be added as links,
so a team has one list. Hangar cannot control who opens a URL it does not
serve, so link tools carry a "link only" badge and the tool page says plainly
that anyone with the original address can open it.

## The weekly number

Tool opens are recorded from day one, because "teams that opened a tool this
week" cannot be backfilled from a database that never logged the opens.

```bash
npm run metric
```

## Layout

```
prisma/schema.prisma            Data model (+ Deployment, DeploymentFile, DeployToken, ToolRecord, AuditEvent)
src/lib/permissions.ts          The role/capability matrix. Start here.
src/lib/hosting/runtime.ts      Sandbox, CSP and the window.hangar client
src/lib/hosting/deploy.ts       Validate, scan and store a deploy
src/lib/hosting/bundle.ts       Paths, sizes, content types
src/lib/hosting/secrets.ts      Credential scanner
src/lib/tickets.ts              Short-lived signed tool/asset tickets
src/app/api/v1/deploy           The endpoint agents call
src/app/run/[appId]             A hosted tool's page (members only)
src/app/a/[ticket]/[...path]    A hosted tool's static files
src/app/api/tool/v1             The tool data API (identity + records)
public/hangar.mjs               CLI and MCP server, served by Hangar
public/hangar-skill.md          Claude Code skill
examples/purchase-requests      A complete tool with no backend
```

## Commands

| Command             | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Dev server on :3000                           |
| `npm run build`     | Production build                              |
| `npm test`          | Unit tests (permissions, bundles, secrets, tickets, sandbox policy) |
| `npm run typecheck` | TypeScript, no emit                           |
| `npm run metric`    | The weekly number                             |
| `npm run db:reset`  | Wipe and re-seed                              |

## Known gaps

Deliberate for the pilot, and listed so nobody discovers them in a demo.

- **Front-end tools only.** A hosted tool is static files plus Hangar's data
  API. Tools that need their own server code, scheduled jobs, or a connection
  to a company system (a CRM, a warehouse database) need **connectors**: Hangar
  holds the credential and the tool calls through it. That is the next build.
- **Email and password sign-in.** Google Workspace and Microsoft sign-in, with
  auto-join by verified domain, come next. Until then invites are copy-paste
  links and there is no password reset.
- **Files live in Postgres.** Fine at small-software sizes (3 MB per tool);
  moves to object storage when a team has hundreds of tools.
- **Sessions are not revocable** before their 30-day expiry. Tool and asset
  tickets are (membership is re-checked on every request).
- **No rate limiting** on the deploy or data APIs yet.
- **Record-level permissions** do not exist: everyone who can open a tool can
  read and write all of its records. Tools that need private rows wait for
  per-record visibility.
- **`npm audit`** reports advisories in the `prisma` CLI (a devDependency) via
  drivers that are not used at runtime.

## Moving between Postgres and SQLite

The driver is chosen from `DATABASE_URL`
([src/lib/prisma-client.ts](src/lib/prisma-client.ts)); switch `provider` in
`prisma/schema.prisma` to match. See [DEPLOY.md](DEPLOY.md) for Neon + Vercel.
