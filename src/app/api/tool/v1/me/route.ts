import { authenticateToolCall, toolJson, toolPreflight } from "@/lib/hosting/tool-api";

/** GET /api/tool/v1/me: who is using this tool, and with what role. */
export async function GET(request: Request) {
  const caller = await authenticateToolCall(request);
  if (caller instanceof Response) return caller;
  return toolJson({
    user: caller.user,
    role: caller.role,
    app: { id: caller.app.id, name: caller.app.name },
  });
}

export function OPTIONS() {
  return toolPreflight();
}
