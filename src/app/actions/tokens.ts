"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { generateDeployToken } from "@/lib/token-format";
import { requireCapability, requireTeam } from "@/lib/guard";

export type TokenFormState = { error?: string; token?: string; name?: string };

const nameSchema = z.string().trim().min(1, "Name the token after where it will live.").max(60);

export async function createDeployTokenAction(
  slug: string,
  _prev: TokenFormState,
  formData: FormData,
): Promise<TokenFormState> {
  const { team, user } = await requireCapability(slug, "token:create");

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { token, prefix, tokenHash } = generateDeployToken();
  const record = await db.deployToken.create({
    data: { teamId: team.id, userId: user.id, name: parsed.data, prefix, tokenHash },
    select: { id: true },
  });
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "token.create",
    targetId: record.id,
    detail: { name: parsed.data, prefix },
  });

  revalidatePath(`/t/${slug}/settings`);
  // The only time the token itself leaves the server.
  return { token, name: parsed.data };
}

export async function revokeDeployTokenAction(slug: string, tokenId: string): Promise<void> {
  const { team, user, can } = await requireTeam(slug);

  const token = await db.deployToken.findFirst({
    where: { id: tokenId, teamId: team.id, revokedAt: null },
    select: { id: true, userId: true, name: true },
  });
  if (!token) return;

  // Anyone may revoke their own; only owners may revoke someone else's.
  if (token.userId !== user.id && !can("token:revoke_any")) {
    throw new Error("Forbidden: only owners can revoke other people's tokens");
  }

  await db.deployToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "token.revoke",
    targetId: token.id,
    detail: { name: token.name },
  });

  revalidatePath(`/t/${slug}/settings`);
}
