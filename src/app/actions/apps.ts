"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/guard";
import { LINK_PLATFORMS, detectPlatform, normaliseAppUrl, type Platform } from "@/lib/platforms";

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

  const chosen = parsed.data.platform;
  const platform: Platform =
    chosen && (LINK_PLATFORMS as readonly string[]).includes(chosen)
      ? (chosen as Platform)
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
    data: { ...result.data, kind: "LINK", teamId: team.id, createdById: user.id },
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
    where: { id: appId, teamId: team.id, kind: "LINK" },
    data: result.data,
  });
  if (updated.count === 0) return { error: "That tool no longer exists." };

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}/apps/${appId}`);
}

const hostedSchema = z.object({
  name: z.string().trim().min(1, "Give the tool a name.").max(80),
  description: z.string().trim().max(280).optional(),
});

/** A hosted tool's code only changes by deploying; this edits its label. */
export async function updateHostedAppAction(
  slug: string,
  appId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const { team } = await requireCapability(slug, "app:edit");

  const parsed = hostedSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const updated = await db.app.updateMany({
    where: { id: appId, teamId: team.id, kind: "HOSTED" },
    data: { name: parsed.data.name, description: parsed.data.description || null },
  });
  if (updated.count === 0) return { error: "That tool no longer exists." };

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}/apps/${appId}`);
}

/**
 * Makes an earlier deployment live again. Deployments are immutable, so
 * this is a pointer move, and rolling forward is the same operation.
 */
export async function rollbackAction(
  slug: string,
  appId: string,
  deploymentId: string,
): Promise<void> {
  const { team, user } = await requireCapability(slug, "app:edit");

  const deployment = await db.deployment.findFirst({
    where: { id: deploymentId, appId, app: { teamId: team.id } },
    select: { id: true, version: true },
  });
  if (!deployment) throw new Error("That version no longer exists.");

  await db.app.update({ where: { id: appId }, data: { activeDeploymentId: deployment.id } });
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "tool.rollback",
    targetId: appId,
    detail: { version: deployment.version },
  });

  revalidatePath(`/t/${slug}/apps/${appId}`);
}

export async function setAppArchivedAction(
  slug: string,
  appId: string,
  archived: boolean,
): Promise<void> {
  const { team, user } = await requireCapability(slug, "app:archive");

  const updated = await db.app.updateMany({
    where: { id: appId, teamId: team.id },
    data: { archived },
  });
  if (updated.count > 0) {
    await audit({
      teamId: team.id,
      actorId: user.id,
      action: archived ? "tool.archive" : "tool.restore",
      targetId: appId,
    });
  }

  revalidatePath(`/t/${slug}`);
  revalidatePath(`/t/${slug}/apps/${appId}`);
}

export async function deleteAppAction(slug: string, appId: string): Promise<void> {
  const { team, user } = await requireCapability(slug, "app:delete");

  const app = await db.app.findFirst({
    where: { id: appId, teamId: team.id },
    select: { id: true, name: true },
  });
  if (app) {
    // Clear the live pointer first so the cascade to deployments does not
    // have to update the row it is deleting.
    await db.app.update({ where: { id: app.id }, data: { activeDeploymentId: null } });
    await db.app.delete({ where: { id: app.id } });
    await audit({
      teamId: team.id,
      actorId: user.id,
      action: "tool.delete",
      targetId: app.id,
      detail: { name: app.name },
    });
  }

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}`);
}
