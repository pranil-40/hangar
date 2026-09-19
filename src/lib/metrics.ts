import { db } from "@/lib/db";

/**
 * The number the application asks for.
 *
 * Your Week 3-4 note says to track one number weekly — active teams — and
 * report it. It is recorded from the first day rather than reconstructed
 * later, because "teams that opened a tool this week" cannot be backfilled
 * from a database that never logged the opens.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export async function recordAppView(params: {
  appId: string;
  userId: string;
  teamId: string;
}): Promise<void> {
  await db.appView.create({ data: params });
}

export async function activeTeamsSince(days: number): Promise<number> {
  const since = new Date(Date.now() - days * DAY_MS);
  const rows = await db.appView.findMany({
    where: { viewedAt: { gte: since } },
    select: { teamId: true },
    distinct: ["teamId"],
  });
  return rows.length;
}

export type TeamActivity = {
  viewsThisWeek: number;
  activeMembersThisWeek: number;
  toolCount: number;
  memberCount: number;
};

export async function teamActivity(teamId: string): Promise<TeamActivity> {
  const since = new Date(Date.now() - 7 * DAY_MS);

  const [viewsThisWeek, activeMembers, toolCount, memberCount] = await Promise.all([
    db.appView.count({ where: { teamId, viewedAt: { gte: since } } }),
    db.appView.findMany({
      where: { teamId, viewedAt: { gte: since } },
      select: { userId: true },
      distinct: ["userId"],
    }),
    db.app.count({ where: { teamId, archived: false } }),
    db.membership.count({ where: { teamId } }),
  ]);

  return {
    viewsThisWeek,
    activeMembersThisWeek: activeMembers.length,
    toolCount,
    memberCount,
  };
}
