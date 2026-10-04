"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { ConnectorError, parsePostgresUrl, queriesHash, runReadOnlyQuery, sealSecret } from "@/lib/connectors";
import { db } from "@/lib/db";
import { requireCapability } from "@/lib/guard";
import { readStoredManifest } from "@/lib/hosting/manifest";

export type ConnectorFormState = { error?: string; notice?: string };

const schema = z.object({
  name: z.string().trim().min(1, "Name the database.").max(60),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "The handle is lowercase letters, numbers and dashes, like stock-db."),
  url: z.string().trim().min(1, "Paste a postgres:// connection URL."),
});

/**
 * Saves a connection only after a live read-only test through the same
 * code path tools use, so a typo or an unreachable host is caught here and
 * not by a crew member mid-shift.
 */
export async function createConnectorAction(
  slug: string,
  _prev: ConnectorFormState,
  formData: FormData,
): Promise<ConnectorFormState> {
  const { team, user } = await requireCapability(slug, "connector:manage");

  const parsed = schema.safeParse({ name: formData.get("name"), slug: formData.get("slug"), url: formData.get("url") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const target = parsePostgresUrl(parsed.data.url);
  if ("error" in target) return { error: target.error };

  const taken = await db.connector.findUnique({
    where: { teamId_slug: { teamId: team.id, slug: parsed.data.slug } },
    select: { id: true },
  });
  if (taken) return { error: `This team already has a connector called "${parsed.data.slug}".` };

  try {
    await runReadOnlyQuery(target, "select 1 as ok", []);
  } catch (error) {
    return { error: error instanceof ConnectorError ? error.message : "Could not connect to that database." };
  }

  await db.connector.create({
    data: {
      teamId: team.id,
      name: parsed.data.name,
      slug: parsed.data.slug,
      secret: sealSecret(parsed.data.url),
      createdById: user.id,
    },
  });
  await audit({ teamId: team.id, actorId: user.id, action: "connector.create", detail: { name: parsed.data.name, slug: parsed.data.slug } });

  revalidatePath(`/t/${slug}/settings`);
  return { notice: `Connected "${parsed.data.slug}". Tools can use it once you approve their queries on each tool's page.` };
}

export async function deleteConnectorAction(slug: string, connectorId: string): Promise<void> {
  const { team, user } = await requireCapability(slug, "connector:manage");
  const connector = await db.connector.findFirst({ where: { id: connectorId, teamId: team.id }, select: { id: true, slug: true } });
  if (!connector) return;
  await db.connector.delete({ where: { id: connector.id } });
  await audit({ teamId: team.id, actorId: user.id, action: "connector.delete", detail: { slug: connector.slug } });
  revalidatePath(`/t/${slug}/settings`);
}

/**
 * Approves exactly the queries the tool's live version declares for one
 * connector. The approval stores their fingerprint, so if a later deploy
 * changes any query, the tool is refused until an owner looks again.
 */
export async function approveConnectorAction(slug: string, appId: string, connectorSlug: string): Promise<void> {
  const { team, user } = await requireCapability(slug, "connector:manage");

  const app = await db.app.findFirst({
    where: { id: appId, teamId: team.id },
    select: { id: true, name: true, activeDeployment: { select: { manifest: true } } },
  });
  if (!app) throw new Error("That tool no longer exists.");

  const queries = readStoredManifest(app.activeDeployment?.manifest).connectors[connectorSlug]?.queries;
  if (!queries) throw new Error("The live version of this tool does not ask for that connector.");

  const connector = await db.connector.findUnique({
    where: { teamId_slug: { teamId: team.id, slug: connectorSlug } },
    select: { id: true },
  });
  if (!connector) throw new Error(`Add a "${connectorSlug}" connector in Settings first.`);

  const hash = queriesHash(queries);
  await db.connectorGrant.upsert({
    where: { connectorId_appId: { connectorId: connector.id, appId: app.id } },
    create: { connectorId: connector.id, appId: app.id, queriesHash: hash, approvedById: user.id },
    update: { queriesHash: hash, approvedById: user.id, approvedAt: new Date() },
  });
  await audit({
    teamId: team.id,
    actorId: user.id,
    action: "connector.approve",
    targetId: app.id,
    detail: { tool: app.name, connector: connectorSlug, queries: Object.keys(queries) },
  });

  revalidatePath(`/t/${slug}/apps/${appId}`);
}

export async function revokeConnectorGrantAction(slug: string, appId: string, connectorSlug: string): Promise<void> {
  const { team } = await requireCapability(slug, "connector:manage");
  await db.connectorGrant.deleteMany({
    where: { appId, app: { teamId: team.id }, connector: { teamId: team.id, slug: connectorSlug } },
  });
  revalidatePath(`/t/${slug}/apps/${appId}`);
}
