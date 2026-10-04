"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireCapability, requireUser } from "@/lib/guard";
import { isRole, wouldOrphanTeam, type Role } from "@/lib/permissions";
import { appUrl } from "@/lib/urls";

export type FormState = { error?: string; notice?: string };

const INVITE_TTL_DAYS = 14;

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.string().refine(isRole, "Pick a role."),
});

export async function inviteMemberAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { team, user } = await requireCapability(slug, "member:invite");

  const parsed = inviteSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, role } = parsed.data;

  const alreadyMember = await db.membership.findFirst({
    where: { teamId: team.id, user: { email } },
    select: { id: true },
  });
  if (alreadyMember) return { error: `${email} is already in this team.` };

  const token = randomBytes(24).toString("base64url");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // Replace any outstanding invite for the same address rather than
  // accumulating several valid tokens for one person.
  await db.invite.deleteMany({ where: { teamId: team.id, email, acceptedAt: null } });
  await db.invite.create({
    data: { teamId: team.id, email, role, token, expiresAt, createdById: user.id },
  });

  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "member.invite",
    detail: { email, role },
  });

  revalidatePath(`/t/${slug}/members`);

  // No email is sent yet — the owner copies the link. Wiring a mail provider
  // is a deliberate later step; hand-onboarding pilots does not need it.
  return { notice: appUrl(`/invite/${token}`) };
}

export async function revokeInviteAction(slug: string, inviteId: string): Promise<void> {
  const { team } = await requireCapability(slug, "member:invite");
  await db.invite.deleteMany({ where: { id: inviteId, teamId: team.id } });
  revalidatePath(`/t/${slug}/members`);
}

export async function changeRoleAction(
  slug: string,
  membershipId: string,
  nextRole: string,
): Promise<void> {
  const { team, user } = await requireCapability(slug, "member:change_role");
  if (!isRole(nextRole)) throw new Error("Unknown role.");

  // Crew sign in from one phone with no email or password; an owner must
  // be able to get back in, so crew top out at editor.
  if (nextRole === "OWNER") {
    const target = await db.membership.findFirst({
      where: { id: membershipId, teamId: team.id },
      select: { user: { select: { kind: true } } },
    });
    if (target?.user.kind === "CREW") throw new Error("Crew members can be editors at most. Invite them by email to make them an owner.");
  }

  const name = await applyMembershipChange(team.id, membershipId, nextRole);
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "member.role",
    detail: { name, role: nextRole },
  });
  revalidatePath(`/t/${slug}/members`);
}

export async function removeMemberAction(
  slug: string,
  membershipId: string,
): Promise<void> {
  const { team, user } = await requireCapability(slug, "member:remove");
  const name = await applyMembershipChange(team.id, membershipId, null);
  await audit({ teamId: team.id, actorId: user.id, action: "member.remove", detail: { name } });
  revalidatePath(`/t/${slug}/members`);
}

/**
 * Shared last-owner check. Demoting or removing the final owner would leave
 * the team with nobody able to manage it, so both paths run through here.
 * Returns the affected person's name for the activity log.
 */
async function applyMembershipChange(
  teamId: string,
  membershipId: string,
  nextRole: Role | null,
): Promise<string> {
  const memberships = await db.membership.findMany({
    where: { teamId },
    select: { id: true, role: true, user: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const index = memberships.findIndex((m) => m.id === membershipId);
  if (index === -1) throw new Error("That person is not in this team.");

  const roles = memberships.map((m) => (isRole(m.role) ? m.role : "VIEWER"));
  if (wouldOrphanTeam(roles, { index, next: nextRole })) {
    throw new Error("A team must keep at least one owner.");
  }

  if (nextRole === null) {
    await db.membership.delete({ where: { id: membershipId } });
  } else {
    await db.membership.update({ where: { id: membershipId }, data: { role: nextRole } });
  }
  return memberships[index].user.name;
}

export async function acceptInviteAction(token: string): Promise<void> {
  const user = await requireUser();

  const invite = await db.invite.findUnique({
    where: { token },
    select: {
      id: true,
      teamId: true,
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      team: { select: { slug: true } },
    },
  });

  if (!invite) throw new Error("That invitation link is not valid.");
  if (invite.acceptedAt) throw new Error("That invitation has already been used.");
  if (invite.expiresAt < new Date()) throw new Error("That invitation has expired.");
  if (invite.email !== user.email) {
    throw new Error(`That invitation was sent to ${invite.email}.`);
  }
  if (!isRole(invite.role)) throw new Error("That invitation is malformed.");

  await db.$transaction([
    db.membership.upsert({
      where: { userId_teamId: { userId: user.id, teamId: invite.teamId } },
      create: { userId: user.id, teamId: invite.teamId, role: invite.role },
      update: {},
    }),
    db.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);

  redirect(`/t/${invite.team.slug}`);
}
