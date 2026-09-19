import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";
import { can, isRole, type Capability, type Role } from "@/lib/permissions";

export type SessionUser = { id: string; email: string; name: string };

export type TeamContext = {
  user: SessionUser;
  team: { id: string; name: string; slug: string };
  role: Role;
  can: (capability: Capability) => boolean;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  return user ?? null;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Resolves the caller's membership of a team.
 *
 * A non-member gets notFound() rather than a 403, so Hangar never confirms
 * that a given team slug exists to someone who was not invited to it.
 */
export async function requireTeam(slug: string): Promise<TeamContext> {
  const user = await requireUser();

  const membership = await db.membership.findFirst({
    where: { userId: user.id, team: { slug } },
    select: { role: true, team: { select: { id: true, name: true, slug: true } } },
  });

  if (!membership || !isRole(membership.role)) notFound();

  const role = membership.role;
  return {
    user,
    team: membership.team,
    role,
    can: (capability: Capability) => can(role, capability),
  };
}

/**
 * Use at the top of any page or server action that performs a privileged
 * operation. Throws past the render rather than returning a flag, so a
 * forgotten check cannot silently fall through to the happy path.
 */
export async function requireCapability(
  slug: string,
  capability: Capability,
): Promise<TeamContext> {
  const context = await requireTeam(slug);
  if (!context.can(capability)) {
    throw new Error(`Forbidden: ${context.role} cannot ${capability}`);
  }
  return context;
}
