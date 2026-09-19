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

  console.log("\nDemo team ready: Acme Ops (/t/acme-ops)");
  console.log("Sign in with any of these — password is the same for all:\n");
  for (const person of PEOPLE) {
    console.log(`  ${person.role.padEnd(6)}  ${person.email}   ${PASSWORD}`);
  }
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
