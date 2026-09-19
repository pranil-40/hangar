"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/guard";
import { detectPlatform, isPlatform, normaliseAppUrl } from "@/lib/platforms";

export type FormState = { error?: string };

const appSchema = z.object({
  name: z.string().trim().min(1, "Give the tool a name.").max(80),
  description: z.string().trim().max(280).optional(),
  url: z.string().trim().min(1, "Paste the link where the tool runs."),
  platform: z.string().optional(),
});

function parseAppForm(formData: FormData) {
  const parsed = appSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
    url: formData.get("url"),
    platform: formData.get("platform") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message } as const;
  }

  const url = normaliseAppUrl(parsed.data.url);
  if (!url) {
    return { error: "That link is not a valid http:// or https:// address." } as const;
  }

  const platform =
    parsed.data.platform && isPlatform(parsed.data.platform)
      ? parsed.data.platform
      : detectPlatform(url);

  return {
    data: {
      name: parsed.data.name,
      description: parsed.data.description || null,
      url,
      platform,
    },
  } as const;
}

export async function createAppAction(
  slug: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { team, user } = await requireCapability(slug, "app:create");

  const result = parseAppForm(formData);
  if ("error" in result) return { error: result.error };

  await db.app.create({
    data: { ...result.data, teamId: team.id, createdById: user.id },
  });

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}`);
}

export async function updateAppAction(
  slug: string,
  appId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { team } = await requireCapability(slug, "app:edit");

  const result = parseAppForm(formData);
  if ("error" in result) return { error: result.error };

  // Scope the write by teamId as well as id: an app id from another team
  // must not be editable just because the caller is an editor somewhere.
  const updated = await db.app.updateMany({
    where: { id: appId, teamId: team.id },
    data: result.data,
  });
  if (updated.count === 0) return { error: "That tool no longer exists." };

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}/apps/${appId}`);
}

export async function setAppArchivedAction(
  slug: string,
  appId: string,
  archived: boolean,
): Promise<void> {
  const { team } = await requireCapability(slug, "app:archive");

  await db.app.updateMany({
    where: { id: appId, teamId: team.id },
    data: { archived },
  });

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/apps/${appId}`);
}

export async function deleteAppAction(slug: string, appId: string): Promise<void> {
  const { team } = await requireCapability(slug, "app:delete");

  await db.app.deleteMany({ where: { id: appId, teamId: team.id } });

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}`);
}
