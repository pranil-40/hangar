import { db } from "@/lib/db";
import { DEPLOY_TOKEN_PREFIX, bearerToken, hashDeployToken } from "@/lib/token-format";
import { can, isRole, type Capability, type Role } from "@/lib/permissions";

/**
 * Deploy tokens are what a coding agent holds. The design goal is that an
 * IT lead can be comfortable with every employee's agent having one:
 *
 * - it can only create and update tools inside one team,
 * - it can never do more than its creator can do *now* (role is re-read on
 *   every use, so demoting or removing someone disarms their tokens),
 * - only its SHA-256 is stored, and it can be revoked from the UI.
 */

export type DeployAuth = {
  tokenId: string;
  user: { id: string; name: string; email: string | null };
  team: { id: string; slug: string; name: string };
  role: Role;
  can: (capability: Capability) => boolean;
};

export async function authenticateDeployToken(header: string | null): Promise<DeployAuth | null> {
  const token = bearerToken(header);
  if (!token || !token.startsWith(DEPLOY_TOKEN_PREFIX)) return null;

  const record = await db.deployToken.findUnique({
    where: { tokenHash: hashDeployToken(token) },
    select: {
      id: true,
      revokedAt: true,
      teamId: true,
      user: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, slug: true, name: true } },
    },
  });
  if (!record || record.revokedAt) return null;

  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId: record.user.id, teamId: record.teamId } },
    select: { role: true },
  });
  if (!membership || !isRole(membership.role)) return null;

  await db.deployToken.update({ where: { id: record.id }, data: { lastUsedAt: new Date() } });

  const role = membership.role;
  return {
    tokenId: record.id,
    user: record.user,
    team: record.team,
    role,
    can: (capability) => can(role, capability),
  };
}
