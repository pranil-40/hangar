import {
  ConnectorError,
  QUERY_LIMITS,
  openSecret,
  parsePostgresUrl,
  queriesHash,
  runReadOnlyQuery,
} from "@/lib/connectors";
import { db } from "@/lib/db";
import { readJsonLimited } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { FORBIDDEN, authenticateToolCall, toolJson, toolPreflight } from "@/lib/hosting/tool-api";

/**
 * POST /api/tool/v1/connectors/<slug>/query  { "query": "lowStock", "params": [5] }
 *
 * Runs one of the tool's declared queries. All of these must hold: the
 * live version of the tool declares the query, the team has a connector
 * with that slug, an owner approved this tool's queries on it, and the SQL
 * is byte-for-byte what they approved. The tool sends a query name and
 * parameters; it never sends SQL and never sees the credentials.
 */

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  const caller = await authenticateToolCall(request);
  if (caller instanceof Response) return caller;
  const { slug } = await params;

  const limited = rateLimit(`connector:${caller.app.id}:${caller.user.id}`, LIMITS.connectorQuery);
  if (!limited.ok) {
    return toolJson({ error: "Too many queries. Try again shortly." }, 429, { "Retry-After": String(limited.retryAfterSeconds) });
  }

  const body = await readJsonLimited(request, 16 * 1024);
  if (!body.ok) return toolJson({ error: body.error }, body.status);
  const { query, params: values = [] } = (body.value ?? {}) as { query?: unknown; params?: unknown };
  if (typeof query !== "string") return toolJson({ error: 'Send { "query": "<name>", "params": [...] }.' }, 400);
  if (!Array.isArray(values) || values.length > QUERY_LIMITS.maxParams || values.some((v) => v !== null && typeof v === "object")) {
    return toolJson({ error: `params must be a list of up to ${QUERY_LIMITS.maxParams} strings, numbers, booleans or nulls.` }, 400);
  }

  const declared = caller.manifest.connectors[slug];
  const sql = declared?.queries[query];
  if (!declared || !sql) return FORBIDDEN(`This tool does not declare a "${query}" query on "${slug}".`);

  const connector = await db.connector.findUnique({
    where: { teamId_slug: { teamId: caller.app.teamId, slug } },
    select: { id: true, secret: true, grants: { where: { appId: caller.app.id }, select: { queriesHash: true } } },
  });
  if (!connector) return FORBIDDEN(`This team has no "${slug}" connector yet. An owner can add one in Settings.`);
  if (connector.grants[0]?.queriesHash !== queriesHash(declared.queries)) {
    return FORBIDDEN(`An owner needs to approve this tool's "${slug}" queries on the tool page.`);
  }

  const target = parsePostgresUrl(openSecret(connector.secret));
  if ("error" in target) return toolJson({ error: "This connector's settings are invalid." }, 500);

  const started = Date.now();
  const log = (ok: boolean, rows: number) =>
    db.connectorCall.create({
      data: { connectorId: connector.id, appId: caller.app.id, userId: caller.user.id, query, ok, rows, ms: Date.now() - started },
    });

  try {
    const result = await runReadOnlyQuery(target, sql, values);
    await log(true, result.rows.length);
    return toolJson(result);
  } catch (error) {
    await log(false, 0);
    if (error instanceof ConnectorError) return toolJson({ error: error.message }, error.status);
    return toolJson({ error: "The database could not be reached." }, 502);
  }
}

export function OPTIONS() {
  return toolPreflight();
}
