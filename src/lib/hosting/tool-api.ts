import { db } from "@/lib/db";
import { readJsonLimited } from "@/lib/http";
import { can, isRole, type Role } from "@/lib/permissions";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { readTicket } from "@/lib/tickets";
import { bearerToken } from "@/lib/token-format";
import { readStoredManifest, type ToolManifest } from "@/lib/hosting/manifest";

/**
 * Shared plumbing for /api/tool/v1/*.
 *
 * Calls come from a sandboxed page with an opaque origin, so they are
 * cross-origin by definition and the browser sends no cookies. That is the
 * point: this API ignores cookies entirely and authenticates only the
 * bearer ticket, which makes `Access-Control-Allow-Origin: *` safe: there
 * is no ambient credential for another site to ride on.
 */

export const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Max-Age": "600",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

export function toolJson(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...CORS_HEADERS, ...extra } });
}

export function toolPreflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export type ToolCaller = {
  app: { id: string; name: string; teamId: string };
  user: { id: string; name: string; email: string | null };
  role: Role;
  manifest: ToolManifest;
};

/**
 * Valid only while all of these still hold: the ticket is unexpired, the
 * viewer is still a member who may run tools, and the tool is still a live
 * hosted tool. Any of them failing reads as the same 401. The manifest is
 * the live version's, so a rollback rolls the rules back with the code.
 */
export async function authenticateToolCall(request: Request): Promise<ToolCaller | Response> {
  const token = bearerToken(request.headers.get("authorization"));
  const claims = token ? readTicket("tool", token) : null;
  if (!claims) return UNAUTHORISED();

  const app = await db.app.findUnique({
    where: { id: claims.appId },
    select: {
      id: true,
      name: true,
      teamId: true,
      kind: true,
      archived: true,
      activeDeployment: { select: { manifest: true } },
    },
  });
  if (!app || app.kind !== "HOSTED" || app.archived) return UNAUTHORISED();

  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId: claims.userId, teamId: app.teamId } },
    select: { role: true, user: { select: { id: true, name: true, email: true } } },
  });
  if (!membership || !isRole(membership.role) || !can(membership.role, "app:run")) return UNAUTHORISED();

  const limited = rateLimit(`tool:${app.id}:${membership.user.id}`, LIMITS.toolApi);
  if (!limited.ok) {
    return toolJson({ error: "Too many requests. Slow down and try again." }, 429, {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }

  return {
    app: { id: app.id, name: app.name, teamId: app.teamId },
    user: membership.user,
    role: membership.role,
    manifest: readStoredManifest(app.activeDeployment?.manifest),
  };
}

export const UNAUTHORISED = () =>
  toolJson({ error: "This tool's session has ended. Reload the page to continue." }, 401);

export const FORBIDDEN = (message: string) => toolJson({ error: message }, 403);

const COLLECTION = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

export function isCollectionName(value: string): boolean {
  return COLLECTION.test(value);
}

export const RECORD_LIMITS = { maxBytes: 64 * 1024, maxPerTool: 5000, listLimit: 500 };

type Person = { id: string; name: string };

export type RecordView = {
  id: string;
  data: unknown;
  createdBy: Person;
  updatedBy: Person;
  createdAt: string;
  updatedAt: string;
};

type RecordRow = {
  id: string;
  data: string;
  createdById: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Who wrote a record comes from the server, never from the tool, so a name
 * on an approval is the name of the person whose ticket made the call.
 */
export async function presentRecords(rows: RecordRow[]): Promise<RecordView[]> {
  const ids = [...new Set(rows.flatMap((row) => [row.createdById, row.updatedById]))];
  const people = ids.length
    ? await db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } })
    : [];
  const byId = new Map(people.map((person) => [person.id, person]));
  const person = (id: string): Person => byId.get(id) ?? { id, name: "Former member" };
  return rows.map((row) => ({
    id: row.id,
    data: JSON.parse(row.data),
    createdBy: person(row.createdById),
    updatedBy: person(row.updatedById),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Parses `{ data }`, enforcing the cap on the bytes read and on the stored form. */
export async function readRecordBody(
  request: Request,
): Promise<{ ok: true; json: string } | { ok: false; response: Response }> {
  const parsed = await readJsonLimited(request, RECORD_LIMITS.maxBytes + 1024);
  if (!parsed.ok) {
    return {
      ok: false,
      response: toolJson(
        { error: parsed.status === 413 ? `A record can be at most ${RECORD_LIMITS.maxBytes / 1024} KB.` : 'Send a JSON body like { "data": ... }.' },
        parsed.status,
      ),
    };
  }
  const body = parsed.value;
  if (!body || typeof body !== "object" || !("data" in body)) {
    return { ok: false, response: toolJson({ error: 'Send a JSON body like { "data": ... }.' }, 400) };
  }
  const json = JSON.stringify((body as { data: unknown }).data ?? null);
  if (Buffer.byteLength(json) > RECORD_LIMITS.maxBytes) {
    return {
      ok: false,
      response: toolJson({ error: `A record can be at most ${RECORD_LIMITS.maxBytes / 1024} KB.` }, 413),
    };
  }
  return { ok: true, json };
}
