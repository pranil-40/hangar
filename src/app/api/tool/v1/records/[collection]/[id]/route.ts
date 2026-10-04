import { db } from "@/lib/db";
import { allows, policyFor, type RecordAction } from "@/lib/hosting/manifest";
import {
  FORBIDDEN,
  authenticateToolCall,
  isCollectionName,
  presentRecords,
  readRecordBody,
  toolJson,
  toolPreflight,
  type ToolCaller,
} from "@/lib/hosting/tool-api";

type Context = { params: Promise<{ collection: string; id: string }> };

// Every lookup is scoped by appId and collection as well as id, so a record
// id from another tool, or another team, matches nothing.

async function authorise(caller: ToolCaller, collection: string, id: string, action: RecordAction) {
  if (!isCollectionName(collection)) return { response: toolJson({ error: "Unknown collection." }, 400) };
  const policy = policyFor(caller.manifest, collection);
  if (!policy) return { response: FORBIDDEN(`This tool does not declare a "${collection}" collection.`) };

  const record = await db.toolRecord.findFirst({
    where: { id, appId: caller.app.id, collection },
    select: { id: true, createdById: true },
  });
  if (!record) return { response: toolJson({ error: "No such record." }, 404) };

  const isAuthor = record.createdById === caller.user.id;
  if (!allows(policy[action], caller.role, isAuthor)) {
    const verb = action === "update" ? "change" : "remove";
    return { response: FORBIDDEN(`Your role cannot ${verb} this record in "${collection}".`) };
  }
  return { record };
}

export async function PUT(request: Request, { params }: Context) {
  const caller = await authenticateToolCall(request);
  if (caller instanceof Response) return caller;

  const { collection, id } = await params;
  const check = await authorise(caller, collection, id, "update");
  if ("response" in check) return check.response;

  const body = await readRecordBody(request);
  if (!body.ok) return body.response;

  const row = await db.toolRecord.update({
    where: { id: check.record!.id },
    data: { data: body.json, updatedById: caller.user.id },
  });
  const [record] = await presentRecords([row]);
  return toolJson({ record });
}

export async function DELETE(request: Request, { params }: Context) {
  const caller = await authenticateToolCall(request);
  if (caller instanceof Response) return caller;

  const { collection, id } = await params;
  const check = await authorise(caller, collection, id, "delete");
  if ("response" in check) return check.response;

  await db.toolRecord.delete({ where: { id: check.record!.id } });
  return toolJson({ ok: true });
}

export function OPTIONS() {
  return toolPreflight();
}
