import { db } from "@/lib/db";
import { allows, policyFor, readScope } from "@/lib/hosting/manifest";
import {
  FORBIDDEN,
  RECORD_LIMITS,
  authenticateToolCall,
  isCollectionName,
  presentRecords,
  readRecordBody,
  toolJson,
  toolPreflight,
} from "@/lib/hosting/tool-api";

/**
 * A tool's shared state. Who may read and add is decided by the tool's
 * hangar.json rules, enforced here; every write is stamped with who made it.
 */

type Context = { params: Promise<{ collection: string }> };

const BAD_NAME = () =>
  toolJson({ error: "Collection names are letters, numbers, - and _, up to 40 characters." }, 400);

export async function GET(request: Request, { params }: Context) {
  const caller = await authenticateToolCall(request);
  if (caller instanceof Response) return caller;

  const { collection } = await params;
  if (!isCollectionName(collection)) return BAD_NAME();
  const policy = policyFor(caller.manifest, collection);
  if (!policy) return FORBIDDEN(`This tool does not declare a "${collection}" collection.`);

  const scope = readScope(policy.read, caller.role, caller.user.id);
  if (!scope) return FORBIDDEN(`Your role cannot read "${collection}".`);

  const rows = await db.toolRecord.findMany({
    where: { appId: caller.app.id, collection, ...scope },
    orderBy: { createdAt: "desc" },
    take: RECORD_LIMITS.listLimit + 1,
  });
  const truncated = rows.length > RECORD_LIMITS.listLimit;
  return toolJson({
    records: await presentRecords(truncated ? rows.slice(0, RECORD_LIMITS.listLimit) : rows),
    truncated,
  });
}

export async function POST(request: Request, { params }: Context) {
  const caller = await authenticateToolCall(request);
  if (caller instanceof Response) return caller;

  const { collection } = await params;
  if (!isCollectionName(collection)) return BAD_NAME();
  const policy = policyFor(caller.manifest, collection);
  if (!policy) return FORBIDDEN(`This tool does not declare a "${collection}" collection.`);
  if (!allows(policy.create, caller.role, false)) return FORBIDDEN(`Your role cannot add to "${collection}".`);

  const body = await readRecordBody(request);
  if (!body.ok) return body.response;

  const count = await db.toolRecord.count({ where: { appId: caller.app.id } });
  if (count >= RECORD_LIMITS.maxPerTool) {
    return toolJson({ error: `This tool has reached ${RECORD_LIMITS.maxPerTool} records.` }, 409);
  }

  const row = await db.toolRecord.create({
    data: {
      appId: caller.app.id,
      collection,
      data: body.json,
      createdById: caller.user.id,
      updatedById: caller.user.id,
    },
  });
  const [record] = await presentRecords([row]);
  return toolJson({ record }, 201);
}

export function OPTIONS() {
  return toolPreflight();
}
