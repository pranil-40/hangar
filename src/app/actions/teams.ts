"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { isClaimableDomain } from "@/lib/google-auth";
import { requireCapability, requireUser } from "@/lib/guard";
import { uniqueTeamSlug } from "@/lib/slug";

export type FormState = { error?: string };

const nameSchema = z.string().trim().min(1, "Give the team a name.").max(60);

export async function createTeamAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const slug = await uniqueTeamSlug(parsed.data);

  // The creator is the first owner; a team is never created ownerless.
  await db.team.create({
    data: {
      name: parsed.data,
      slug,
      memberships: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  redirect(`/t/${slug}`);
}

export async function renameTeamAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { team } = await requireCapability(slug, "team:rename");

  const parsed = nameSchema.safeParse(formData.get("name"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  await db.team.update({ where: { id: team.id }, data: { name: parsed.data } });
  revalidatePath(`/t/${slug}`);
  return {};
}

/**
 * Lets anyone with a verified Google Workspace account on the owner's own
 * domain join as a viewer. Only an owner who signed in with Google on that
 * domain can turn it on, so nobody can claim a domain they do not belong to.
 */
export async function setAutoJoinAction(slug: string, enabled: boolean): Promise<void> {
  const { team, user } = await requireCapability(slug, "team:rename");

  let domain: string | null = null;
  if (enabled) {
    const account = await db.user.findUnique({ where: { id: user.id }, select: { email: true, googleSub: true } });
    const candidate = account?.email?.split("@")[1]?.toLowerCase() ?? "";
    if (!account?.googleSub || !isClaimableDomain(candidate)) {
      throw new Error("Sign in with a Google Workspace account on your company domain to turn this on.");
    }
    domain = candidate;
  }

  await db.team.update({ where: { id: team.id }, data: { autoJoinDomain: domain } });
  await audit({ teamId: team.id, actorId: user.id, action: "team.auto_join", detail: { domain } });
  revalidatePath(`/t/${slug}/settings`);
}
