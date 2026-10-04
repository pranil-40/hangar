import { authenticateDeployToken } from "@/lib/deploy-tokens";
import { deployTool } from "@/lib/hosting/deploy";
import { readJsonLimited } from "@/lib/http";
import { LIMITS, rateLimit } from "@/lib/rate-limit";
import { appUrl } from "@/lib/urls";

/**
 * POST /api/v1/deploy: the one endpoint a coding agent needs.
 *
 *   Authorization: Bearer hgr_...
 *   { "name": "Refund approvals", "appId"?: "...", "files": [{ "path", "data" (base64) }] }
 *
 * public/hangar.mjs wraps this as both a CLI and an MCP server. Errors are written for the agent to act on: each one says what to
 * change, not just what went wrong.
 */

// Base64 inflates the 3 MB bundle cap by a third, plus JSON overhead.
const MAX_BODY_BYTES = 4_400_000;

export async function POST(request: Request) {
  const auth = await authenticateDeployToken(request.headers.get("authorization"));
  if (!auth) {
    return Response.json(
      { error: "Missing, revoked or unknown deploy token. Create one under Settings → Deploy tokens." },
      { status: 401 },
    );
  }

  const limited = rateLimit(`deploy:${auth.tokenId}`, LIMITS.deploy);
  if (!limited.ok) {
    return Response.json(
      { error: `Too many deploys from this token. Try again in ${limited.retryAfterSeconds} seconds.` },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } },
    );
  }

  // Enforced on the bytes actually read, not on the Content-Length header.
  const parsed = await readJsonLimited(request, MAX_BODY_BYTES);
  if (!parsed.ok) {
    return Response.json(
      { error: parsed.status === 413 ? "Upload is too large. A tool can be at most 3 MB." : parsed.error },
      { status: parsed.status },
    );
  }
  const body = parsed.value;

  let result;
  try {
    result = await deployTool(
      { userId: auth.user.id, teamId: auth.team.id, can: auth.can },
      body,
    );
  } catch (error) {
    // Two deploys of one tool racing for the same version number.
    if ((error as { code?: string }).code === "P2002") {
      return Response.json(
        { error: "Another deploy of this tool finished at the same moment. Deploy again." },
        { status: 409 },
      );
    }
    throw error;
  }

  if (!result.ok) {
    const { status, ...rest } = result;
    return Response.json(rest, { status });
  }

  return Response.json(
    {
      app: result.app,
      version: result.version,
      created: result.created,
      team: auth.team.slug,
      url: appUrl(`/t/${auth.team.slug}/apps/${result.app.id}`),
      warnings: result.warnings,
    },
    { status: result.created ? 201 : 200 },
  );
}
