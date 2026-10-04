/**
 * The weekly number for the YC application.
 *
 *   npm run metric
 *
 * Prints active teams, opens and active people for the last 7 days.
 * Run it every Monday and keep the series — a rising line between applying
 * and interviewing is the strongest thing you can bring to that call.
 *
 * The headline is "shared tools": tools opened by two or more different
 * people in the window. One person opening their own tool is a demo; a
 * second person opening it is small software doing its job. The seeded
 * demo team is excluded so it can never inflate the number.
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
const DEMO_TEAM_SLUGS = ["acme-ops"];

async function windowStats(days: number) {
  const since = new Date(Date.now() - days * DAY_MS);
  const real = { team: { slug: { notIn: DEMO_TEAM_SLUGS } } };
  const viewed = { viewedAt: { gte: since }, app: real };

  const [opens, teams, people, tools, deploys, pairs] = await Promise.all([
    db.appView.count({ where: viewed }),
    db.appView.findMany({ where: viewed, select: { teamId: true }, distinct: ["teamId"] }),
    db.appView.findMany({ where: viewed, select: { userId: true }, distinct: ["userId"] }),
    db.app.count({ where: { createdAt: { gte: since }, ...real } }),
    db.deployment.count({ where: { createdAt: { gte: since }, app: real } }),
    db.appView.findMany({
      where: viewed,
      select: { appId: true, userId: true, teamId: true },
      distinct: ["appId", "userId"],
    }),
  ]);

  const viewersPerTool = new Map<string, { teamId: string; viewers: number }>();
  for (const pair of pairs) {
    const entry = viewersPerTool.get(pair.appId) ?? { teamId: pair.teamId, viewers: 0 };
    entry.viewers += 1;
    viewersPerTool.set(pair.appId, entry);
  }
  const shared = [...viewersPerTool.values()].filter((tool) => tool.viewers >= 2);

  return {
    opens,
    teams: teams.length,
    people: people.length,
    toolsAdded: tools,
    deploys,
    sharedTools: shared.length,
    sharingTeams: new Set(shared.map((tool) => tool.teamId)).size,
  };
}

async function main() {
  const [week, fortnight, allTeams, allTools] = await Promise.all([
    windowStats(7),
    windowStats(14),
    db.team.count({ where: { slug: { notIn: DEMO_TEAM_SLUGS } } }),
    db.app.count({ where: { team: { slug: { notIn: DEMO_TEAM_SLUGS } } } }),
  ]);

  const row = (label: string, value: number | string) =>
    console.log(`  ${label.padEnd(24)} ${value}`);

  console.log("\nHangar, last 7 days (demo team excluded)\n");
  row("Shared tools", week.sharedTools);
  row("Teams sharing a tool", week.sharingTeams);
  row("Active teams", week.teams);
  row("Active people", week.people);
  row("Tool opens", week.opens);
  row("Deploys", week.deploys);
  row("Tools added", week.toolsAdded);

  console.log("\nLast 14 days (for trend)\n");
  row("Shared tools", fortnight.sharedTools);
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
