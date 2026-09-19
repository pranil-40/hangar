/**
 * The weekly number for the YC application.
 *
 *   npm run metric
 *
 * Prints active teams, opens and active people for the last 7 days.
 * Run it every Monday and keep the series — a rising line between applying
 * and interviewing is the strongest thing you can bring to that call.
 */
import path from "node:path";
import { createPrismaClient } from "../src/lib/prisma-client";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env"));
} catch {
  // Fall back to the ambient environment.
}

const db = createPrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

async function windowStats(days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const [opens, teams, people, tools] = await Promise.all([
    db.appView.count({ where: { viewedAt: { gte: since } } }),
    db.appView.findMany({
      where: { viewedAt: { gte: since } },
      select: { teamId: true },
      distinct: ["teamId"],
    }),
    db.appView.findMany({
      where: { viewedAt: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.app.count({ where: { createdAt: { gte: since } } }),
  ]);
  return { opens, teams: teams.length, people: people.length, toolsAdded: tools };
}

async function main() {
  const [week, fortnight, allTeams, allTools] = await Promise.all([
    windowStats(7),
    windowStats(14),
    db.team.count(),
    db.app.count(),
  ]);

  const row = (label: string, value: number | string) =>
    console.log(`  ${label.padEnd(24)} ${value}`);

  console.log("\nHangar — last 7 days\n");
  row("Active teams", week.teams);
  row("Active people", week.people);
  row("Tool opens", week.opens);
  row("Tools added", week.toolsAdded);

  console.log("\nPrevious 14 days (for trend)\n");
  row("Active teams", fortnight.teams);
  row("Tool opens", fortnight.opens);

  console.log("\nTotals\n");
  row("Teams", allTeams);
  row("Tools", allTools);
  console.log("");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
