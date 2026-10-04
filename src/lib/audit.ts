import { db } from "@/lib/db";

export const AUDIT_ACTIONS = {
  "tool.deploy": "deployed",
  "tool.rollback": "rolled back",
  "tool.archive": "archived",
  "tool.restore": "restored",
  "tool.delete": "deleted",
  "token.create": "created a deploy token",
  "token.revoke": "revoked a deploy token",
  "member.invite": "invited",
  "member.role": "changed the role of",
  "member.remove": "removed",
  "crew.link": "created a join link for",
  "crew.join": "joined from a link:",
  "tool.deploy_refused": "had a deploy refused:",
  "connector.create": "connected the database",
  "connector.delete": "disconnected the database",
  "connector.approve": "approved data access for",
  "team.auto_join": "set Google auto-join to",
  "member.auto_join": "joined with Google:",
} as const;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

/**
 * Recording is best-effort by design: a failed audit write is logged, not
 * thrown, so it can never block the action it describes. The actions that
 * matter most (deploys) write their event inside the same transaction.
 */
export async function audit(event: {
  teamId: string;
  actorId: string | null;
  action: AuditAction;
  targetId?: string | null;
  detail?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.auditEvent.create({
      data: {
        teamId: event.teamId,
        actorId: event.actorId,
        action: event.action,
        targetId: event.targetId ?? null,
        detail: event.detail ? JSON.stringify(event.detail) : null,
      },
    });
  } catch (error) {
    console.error("audit write failed", event.action, error);
  }
}
