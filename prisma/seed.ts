import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../src/lib/password";
import { createPrismaClient } from "../src/lib/prisma-client";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Fall back to the ambient environment.
}

const db = createPrismaClient();

const PASSWORD = "hangar123";

const PEOPLE = [
  { name: "Priya Raman", email: "owner@demo.test", role: "OWNER" },
  { name: "Sam Okonkwo", email: "editor@demo.test", role: "EDITOR" },
  { name: "Jo Whitfield", email: "viewer@demo.test", role: "VIEWER" },
];

const TOOLS = [
  {
    name: "Invoice chaser",
    description: "Flags invoices more than 30 days overdue and drafts the follow-up.",
    url: "https://invoice-chaser.lovable.app",
    platform: "LOVABLE",
  },
  {
    name: "Standup digest",
    description: "Collects yesterday's updates into one summary for the 9am call.",
    url: "https://standup-digest.lovable.app",
    platform: "LOVABLE",
  },
  {
    name: "Warehouse stock check",
    description: "Scans the shelf count sheet and highlights anything below reorder level.",
    url: "https://stock-check.replit.app",
    platform: "REPLIT",
  },
  {
    name: "Client onboarding form",
    description: "Collects new client details and files them in the right folder.",
    url: "https://onboarding.bolt.new",
    platform: "BOLT",
  },
  {
    // The four above are placeholder domains that will not load — they exist
    // to fill the grid. This one points at a real page so the embedded
    // runner can be demonstrated without registering a tool first.
    name: "Embed check",
    description: "A real page, to show the runner actually embedding something.",
    url: "https://example.com",
    platform: "OTHER",
  },
];

async function main() {
  console.log("Seeding demo data…");

  // Idempotent: wipe the demo team only, leaving any real data alone.
  const existing = await db.team.findUnique({ where: { slug: "acme-ops" } });
  if (existing) {
    await db.team.delete({ where: { id: existing.id } });
  }

  const passwordHash = await hashPassword(PASSWORD);

  const users = await Promise.all(
    PEOPLE.map((person) =>
      db.user.upsert({
        where: { email: person.email },
        create: { email: person.email, name: person.name, passwordHash },
        update: { name: person.name, passwordHash },
        select: { id: true, email: true },
      }),
    ),
  );

  const team = await db.team.create({
    data: {
      name: "Acme Ops",
      slug: "acme-ops",
      memberships: {
        create: users.map((user, index) => ({
          userId: user.id,
          role: PEOPLE[index].role,
        })),
      },
    },
    select: { id: true },
  });

  const owner = users[0];

  const apps = await Promise.all(
    TOOLS.map((tool) =>
      db.app.create({
        data: { ...tool, teamId: team.id, createdById: owner.id },
        select: { id: true },
      }),
    ),
  );

  // A week of opens so the activity numbers are not all zero on first run.
  const views = [];
  for (let day = 0; day < 7; day++) {
    for (const user of users) {
      const app = apps[(day + users.indexOf(user)) % apps.length];
      views.push({
        appId: app.id,
        userId: user.id,
        teamId: team.id,
        viewedAt: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
      });
    }
  }
  await db.appView.createMany({ data: views });

  await seedHostedTool(team.id, users);

  console.log("\nDemo team ready: Acme Ops (/t/acme-ops)");
  console.log("Sign in with any of these — password is the same for all:\n");
  for (const person of PEOPLE) {
    console.log(`  ${person.role.padEnd(6)}  ${person.email}   ${PASSWORD}`);
  }
  console.log("");
}

/**
 * One real hosted tool, deployed through the same code path an agent's
 * deploy takes, so the demo shows the sandboxed runner with live storage.
 * Imported lazily: those modules open their own database client, which
 * needs the .env loaded above.
 */
async function seedHostedTool(teamId: string, users: { id: string; email: string | null }[]) {
  const { deployTool } = await import("../src/lib/hosting/deploy");
  const { can } = await import("../src/lib/permissions");
  const { db: appDb } = await import("../src/lib/db");

  const dir = path.join(process.cwd(), "examples", "purchase-requests");
  const files = await Promise.all(
    (await readdir(dir)).map(async (name) => ({
      path: name,
      data: (await readFile(path.join(dir, name))).toString("base64"),
    })),
  );

  const [owner, editor, viewer] = users;
  const result = await deployTool(
    { userId: editor.id, teamId, can: (capability) => can("EDITOR", capability) },
    {
      name: "Purchase requests",
      description: "Ask for something you need; an owner or editor approves it.",
      files,
      source: "SEED",
      agent: "claude-code",
    },
  );
  if (!result.ok) throw new Error(`Seeding the hosted tool failed: ${result.error}`);

  const requests = [
    { by: viewer, title: "Second monitor", amount: 240, approvedBy: null },
    { by: editor, title: "Figma seat for the new designer", amount: 180, approvedBy: "Priya Raman" },
    { by: owner, title: "Offsite venue deposit", amount: 1500, approvedBy: "Priya Raman" },
  ];
  const names: Record<string, string> = Object.fromEntries(PEOPLE.map((p) => [p.email, p.name]));
  const nameOf = (user: { email: string | null }) => names[user.email ?? ""];
  for (const request of requests) {
    await appDb.toolRecord.create({
      data: {
        appId: result.app.id,
        collection: "requests",
        data: JSON.stringify({
          title: request.title,
          amount: request.amount,
          requestedBy: nameOf(request.by),
          ...(request.approvedBy ? { approvedBy: request.approvedBy } : {}),
        }),
        createdById: request.by.id,
        updatedById: request.by.id,
      },
    });
  }
  await appDb.$disconnect();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
