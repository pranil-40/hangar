import { z } from "zod";
import { db } from "@/lib/db";
import type { Capability } from "@/lib/permissions";
import {
  ENTRY,
  findExternalRefs,
  findRootAbsoluteRefs,
  isHtmlPath,
  parseBundle,
} from "@/lib/hosting/bundle";
import { MANIFEST_FILE, parseManifest } from "@/lib/hosting/manifest";
import { scanBundle, type SecretFinding } from "@/lib/hosting/secrets";

export const DEPLOY_SOURCES = ["CLI", "MCP", "UPLOAD", "SEED"] as const;

const inputSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(280).optional(),
  appId: z.string().trim().min(1).max(64).optional(),
  source: z.enum(DEPLOY_SOURCES).default("CLI"),
  agent: z
    .string()
    .trim()
    .max(40)
    .regex(/^[A-Za-z0-9 ._-]*$/)
    .optional(),
  files: z.unknown(),
});

export type DeployActor = {
  userId: string;
  teamId: string;
  can: (capability: Capability) => boolean;
};

export type DeploySuccess = {
  ok: true;
  app: { id: string; name: string };
  version: number;
  created: boolean;
  warnings: string[];
};

export type DeployFailure = {
  ok: false;
  status: number;
  error: string;
  findings?: SecretFinding[];
  refs?: string[];
};

/**
 * Refusals the team should know about (credentials, broken builds) are
 * written to the activity log, so an owner can see what the safety rails
 * stopped and not only what got through.
 */
async function refuse(actor: DeployActor, name: string | undefined, failure: DeployFailure, reason: string) {
  await db.auditEvent.create({
    data: {
      teamId: actor.teamId,
      actorId: actor.userId,
      action: "tool.deploy_refused",
      detail: JSON.stringify({ name: name ?? null, reason }),
    },
  });
  return failure;
}

export async function deployTool(
  actor: DeployActor,
  rawInput: unknown,
): Promise<DeploySuccess | DeployFailure> {
  const parsedInput = inputSchema.safeParse(rawInput);
  if (!parsedInput.success) {
    const issue = parsedInput.error.issues[0];
    return { ok: false, status: 400, error: `Invalid "${issue.path.join(".")}": ${issue.message}` };
  }
  const input = parsedInput.data;

  // Authorisation before any work on the payload, so a viewer's token
  // learns nothing about why a bundle would or would not have deployed.
  if (input.appId ? !actor.can("app:edit") : !actor.can("app:create")) {
    return { ok: false, status: 403, error: "Your role in this team cannot deploy tools." };
  }
  if (!input.appId && !input.name) {
    return { ok: false, status: 400, error: "A new tool needs a name." };
  }

  const bundle = parseBundle(input.files);
  if (!bundle.ok) return { ok: false, status: 422, error: bundle.error };

  const findings = scanBundle(bundle.files);
  const blocking = findings.filter((finding) => finding.severity === "block");
  if (blocking.length > 0) {
    return refuse(
      actor,
      input.name,
      {
        ok: false,
        status: 422,
        error:
          "This build contains credentials, and everyone who can open the tool could read them. Remove them and deploy again. A tool should never hold a secret; to read company data, declare a connector query in hangar.json.",
        findings: blocking,
      },
      `credentials: ${[...new Set(blocking.map((finding) => finding.kind))].join(", ")}`,
    );
  }

  const entryHtml = bundle.files.find((file) => file.path === ENTRY)!.bytes.toString("utf8");
  const rootRefs = findRootAbsoluteRefs(entryHtml);
  if (rootRefs.length > 0) {
    return refuse(
      actor,
      input.name,
      {
        ok: false,
        status: 422,
        error:
          'index.html loads files from root-absolute paths (starting with "/"), which will not resolve inside Hangar. Build with relative paths. For Vite, set base: "./" in vite.config.',
        refs: rootRefs,
      },
      "root-absolute asset paths",
    );
  }

  const externalRefs = findExternalRefs(entryHtml);
  if (externalRefs.length > 0) {
    return refuse(
      actor,
      input.name,
      {
        ok: false,
        status: 422,
        error:
          'index.html loads scripts or styles from outside Hangar, and tools can only load from Hangar, so the page would break. Bundle them into the build, or ask your AI: "Rewrite this as one self-contained HTML file with no external scripts, styles or fonts."',
        refs: externalRefs,
      },
      "external scripts or styles",
    );
  }

  const manifestFile = bundle.files.find((file) => file.path === MANIFEST_FILE);
  const manifest = parseManifest(manifestFile ? manifestFile.bytes.toString("utf8") : null);
  if (!manifest.ok) {
    return refuse(actor, input.name, { ok: false, status: 422, error: manifest.error }, "invalid hangar.json");
  }

  const warnings: string[] = findings
    .filter((finding) => finding.severity === "warn")
    .map((finding) => `${finding.kind} in ${finding.path}:${finding.line}. It is visible to everyone who can open this tool.`);
  const extraPages = bundle.files.filter((file) => isHtmlPath(file.path) && file.path !== ENTRY);
  if (extraPages.length > 0) {
    warnings.push(
      `Only ${ENTRY} is served as a page; ${extraPages.length} other HTML file(s) will not open. Use one page with in-page (hash) navigation.`,
    );
  }
  for (const slug of Object.keys(manifest.manifest.connectors)) {
    warnings.push(`This tool asks to query the "${slug}" connector. An owner must approve its queries on the tool page before they run.`);
  }

  if (input.appId) {
    const existing = await db.app.findFirst({
      where: { id: input.appId, teamId: actor.teamId },
      select: { id: true },
    });
    if (!existing) return { ok: false, status: 404, error: "No tool with that id in this team." };
  }

  const result = await db.$transaction(async (tx) => {
    const app = input.appId
      ? await tx.app.update({
          where: { id: input.appId },
          data: {
            kind: "HOSTED",
            url: null,
            platform: "HANGAR",
            archived: false,
            ...(input.name ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description || null } : {}),
          },
          select: { id: true, name: true },
        })
      : await tx.app.create({
          data: {
            teamId: actor.teamId,
            createdById: actor.userId,
            kind: "HOSTED",
            platform: "HANGAR",
            name: input.name!,
            description: input.description || null,
          },
          select: { id: true, name: true },
        });

    const last = await tx.deployment.findFirst({
      where: { appId: app.id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;

    const deployment = await tx.deployment.create({
      data: {
        appId: app.id,
        version,
        fileCount: bundle.files.length,
        totalBytes: bundle.totalBytes,
        source: input.source,
        agent: input.agent || null,
        manifest: JSON.stringify(manifest.manifest),
        createdById: actor.userId,
        files: {
          createMany: {
            data: bundle.files.map((file) => ({
              path: file.path,
              contentType: file.contentType,
              size: file.bytes.length,
              sha256: file.sha256,
              content: new Uint8Array(file.bytes),
            })),
          },
        },
      },
      select: { id: true },
    });

    await tx.app.update({ where: { id: app.id }, data: { activeDeploymentId: deployment.id } });

    await tx.auditEvent.create({
      data: {
        teamId: actor.teamId,
        actorId: actor.userId,
        action: "tool.deploy",
        targetId: app.id,
        detail: JSON.stringify({
          name: app.name,
          version,
          files: bundle.files.length,
          bytes: bundle.totalBytes,
          source: input.source,
          agent: input.agent || null,
        }),
      },
    });

    return { app, version };
  });

  return { ok: true, app: result.app, version: result.version, created: !input.appId, warnings };
}
