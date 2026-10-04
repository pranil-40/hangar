"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { CREW_LINK_TTL_MS, CREW_ROLES, crewLinkView, generateCrewToken, hashCrewToken } from "@/lib/crew";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/guard";
import { createSession } from "@/lib/session";

export type CrewLinkState = { error?: string; name?: string; url?: string; qr?: string };

const crewSchema = z.object({
  name: z.string().trim().min(1, "Enter their name as the team knows them.").max(60),
  role: z.enum(CREW_ROLES).default("VIEWER"),
});

export async function addCrewMemberAction(
  slug: string,
  _prev: CrewLinkState,
  formData: FormData,
): Promise<CrewLinkState> {
  const { team, user } = await requireCapability(slug, "member:invite");

  const parsed = crewSchema.safeParse({ name: formData.get("name"), role: formData.get("role") ?? undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { token, tokenHash } = generateCrewToken();
  await db.crewLink.create({
    data: {
      teamId: team.id,
      name: parsed.data.name,
      role: parsed.data.role,
      tokenHash,
      expiresAt: new Date(Date.now() + CREW_LINK_TTL_MS),
      createdById: user.id,
    },
  });
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "crew.link",
    detail: { name: parsed.data.name, role: parsed.data.role },
  });

  revalidatePath(`/t/${slug}/members`);
  return { name: parsed.data.name, ...(await crewLinkView(token)) };
}

/** A fresh link for a crew member who changed phones; their history stays theirs. */
export async function newDeviceLinkAction(slug: string, userId: string): Promise<CrewLinkState> {
  const { team, user } = await requireCapability(slug, "member:invite");

  const membership = await db.membership.findFirst({
    where: { teamId: team.id, userId, user: { kind: "CREW" } },
    select: { role: true, user: { select: { name: true } } },
  });
  if (!membership) return { error: "That person is not a crew member of this team." };

  const { token, tokenHash } = generateCrewToken();
  await db.crewLink.create({
    data: {
      teamId: team.id,
      userId,
      name: membership.user.name,
      role: membership.role,
      tokenHash,
      expiresAt: new Date(Date.now() + CREW_LINK_TTL_MS),
      createdById: user.id,
    },
  });
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "crew.link",
    targetId: userId,
    detail: { name: membership.user.name, role: membership.role, newDevice: true },
  });
  return { name: membership.user.name, ...(await crewLinkView(token)) };
}

/**
 * Spends a link and signs this device in. The update is conditional on the
 * link still being unused, so two taps racing on two phones cannot both win.
 */
export async function redeemCrewLinkAction(token: string): Promise<void> {
  const link = await db.crewLink.findUnique({
    where: { tokenHash: hashCrewToken(token) },
    select: { id: true, teamId: true, name: true, role: true, userId: true, expiresAt: true, usedAt: true, team: { select: { slug: true } } },
  });
  if (!link || link.usedAt || link.expiresAt < new Date()) {
    redirect(`/join/${encodeURIComponent(token)}`);
  }

  const userId = await db.$transaction(async (tx) => {
    const claimed = await tx.crewLink.updateMany({
      where: { id: link.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (claimed.count === 0) return null;

    let id = link.userId;
    if (id) {
      // A new-device link: only valid while they are still on the team.
      const stillMember = await tx.membership.findUnique({
        where: { userId_teamId: { userId: id, teamId: link.teamId } },
        select: { id: true },
      });
      if (!stillMember) return null;
    } else {
      const created = await tx.user.create({
        data: { name: link.name, kind: "CREW" },
        select: { id: true },
      });
      id = created.id;
      await tx.membership.create({ data: { userId: id, teamId: link.teamId, role: link.role } });
      await tx.crewLink.update({ where: { id: link.id }, data: { userId: id } });
    }

    await tx.auditEvent.create({
      data: {
        teamId: link.teamId,
        actorId: id,
        action: "crew.join",
        detail: JSON.stringify({ name: link.name, newDevice: Boolean(link.userId) }),
      },
    });
    return id;
  });

  if (!userId) redirect(`/join/${encodeURIComponent(token)}`);

  await createSession(userId);
  redirect(`/t/${link.team.slug}`);
}
