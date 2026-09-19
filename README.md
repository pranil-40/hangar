# Hangar

One shared, permissioned home for your team's AI-built tools.

A small team builds two or three tools in Lovable, Replit or Bolt. They end up
as links in a Slack channel that one person maintains and nobody else can
change. Hangar gives them one place to live, with a real access model.

This is the pilot slice: the narrowest thing that a real team can use every
week, built to produce the one number a YC application asks for.

## Run it

```bash
npm install
npm run setup      # generate client, create the database, seed demo data
npm run dev
```

Then open http://localhost:3000 and sign in with a seeded account — all three
use the password `hangar123`:

| Role   | Email              | What they can do                              |
| ------ | ------------------ | --------------------------------------------- |
| Owner  | owner@demo.test    | Everything, including members and settings    |
| Editor | editor@demo.test   | Add and edit tools, but not manage people     |
| Viewer | viewer@demo.test   | Open and use tools only                       |

Sign in as each in turn to see the permission model change what is on screen.

## The design decision that shapes everything

**v1 does not execute any code.** Tools built on Lovable, Replit, Bolt and v0
already run at a hosted URL. The problem those teams actually have is not
running the code — it is that access is a link in a chat, with no roles, no
list, and no way to hand it over.

So Hangar stores the link and governs who may reach it, then renders it in a
sandboxed frame. That removes sandboxed execution (e2b, Modal) from the
critical path for the pilot entirely.

When Hangar starts holding source rather than links, implement a second
`RuntimeProvider` in `src/lib/runtime/provider.ts` that boots a sandbox and
returns its URL. Nothing above that interface needs to change.

## Permissions

The permission model is the product, so it lives in exactly one place:
[`src/lib/permissions.ts`](src/lib/permissions.ts). Every decision is
`can(role, capability)`.

If you catch yourself writing `role === "OWNER"` in a page or an action, add a
capability to the matrix instead. The rule keeps the whole model auditable in
one file, and it is covered by tests.

Two invariants worth knowing:

- **Non-members get a 404, not a 403.** Hangar never confirms that a team slug
  exists to someone who was not invited to it.
- **A team always keeps at least one owner.** Demoting or removing the last
  one is refused, so a team can never be left unmanageable.

Every check runs on the server. Hiding a button is a convenience, never the
control — visit `/t/<slug>/apps/new` as a viewer and you get a refusal, not a
form.

## The weekly number

Your plan says to track one number weekly and report it. It is recorded from
day one rather than reconstructed later, because "teams that opened a tool
this week" cannot be backfilled from a database that never logged the opens.

```bash
npm run metric
```

Run it every Monday and keep the series. A rising line between applying and
interviewing is the strongest thing you can bring into that room.

## Layout

```
prisma/schema.prisma     Data model (User, Team, Membership, App, Invite, AppView)
prisma.config.ts         Prisma 7 config — connection URL lives here, not in the schema
src/lib/permissions.ts   The role/capability matrix. Start here.
src/lib/guard.ts         requireUser / requireTeam / requireCapability
src/lib/session.ts       HMAC-signed session cookie
src/lib/metrics.ts       View logging and the weekly aggregates
src/lib/runtime/         The seam for how a tool runs
src/app/actions/         Server actions (auth, teams, apps, members)
src/app/t/[slug]/        Team dashboard, tools, members, settings
```

## Commands

| Command            | What it does                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Dev server on :3000                           |
| `npm run build`    | Production build                              |
| `npm test`         | Permission and URL-validation tests           |
| `npm run typecheck`| TypeScript, no emit                           |
| `npm run metric`   | The weekly number                             |
| `npm run db:reset` | Wipe and re-seed                              |
| `npm run db:studio`| Browse the database                           |

## Moving to Postgres

SQLite is here so the project runs with no external setup. The switch is
small and there are no model changes:

1. `provider = "postgresql"` in `prisma/schema.prisma`
2. `DATABASE_URL` to your `postgres://` URL
3. Replace `@prisma/adapter-better-sqlite3` with `@prisma/adapter-pg` in
   `src/lib/db.ts` and `prisma/seed.ts`
4. `npx prisma db push`

## Known gaps

These are deliberate omissions for the pilot, not oversights.

- **Invites are copy-paste links.** No email provider is wired up; the owner
  copies the link. Hand-onboarding your first teams does not need email, and
  adding it later is an afternoon.
- **No password reset.** Same reasoning. You are onboarding these people
  personally.
- **Sessions are not revocable.** The signed cookie is valid for 30 days and
  signing out only clears it locally. Add a session table when you have users
  you cannot phone.
- **`npm audit` reports 4 high advisories** in the `prisma` CLI (a
  devDependency), reached through drivers we do not use. They are not in the
  runtime path and npm's suggested "fix" is a downgrade that carries its own
  advisory. Recheck when Prisma 7 updates.
- **Public profiles, remix, marketplace** — all deliberately absent. Your own
  plan puts them at month six.

## What to do next

In rough order, following the Week 2-3 plan:

1. Put it somewhere your pilots can reach (Vercel + a hosted Postgres).
2. Hand-onboard 3-5 teams. Watch where the permission model surprises them.
3. Add email invites once copy-paste starts costing you onboarding calls.
4. Add OAuth import from whichever builder those teams actually use, so
   adding a tool does not mean pasting a URL.
5. Run `npm run metric` every Monday and write the number down.
