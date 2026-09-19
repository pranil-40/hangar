"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
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
