import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/guard";
import { DEFAULT_COLLECTION_POLICY, readStoredManifest } from "@/lib/hosting/manifest";
import { can, isRole } from "@/lib/permissions";
import {
  TOOL_API_BASE,
  TOOL_CSP,
  injectRuntime,
  type Bootstrap,
} from "@/lib/hosting/runtime";
import { issueTicket } from "@/lib/tickets";

/**
 * GET /run/<appId>: a hosted tool's page, for a signed-in member only.
 *
 * This is the only place a tool's HTML is ever served. It is rendered per
 * viewer (the tickets inside are theirs), never cached, and sandboxed by
 * response header.
 *
 * It is only ever served into a frame. A direct visit is sent to /open,
 * which frames it, because the framing page's frame-src is what stops a
 * tool from navigating its own frame to an outside address.
 */

function notFound(): Response {
  // Same response for "no such tool" and "not your team": a non-member
  // must not be able to tell which tool ids exist.
  return new Response("Not found", {
    status: 404,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;

  if (request.headers.get("sec-fetch-dest") === "document") {
    return Response.redirect(new URL(`/open/${encodeURIComponent(appId)}`, request.url), 303);
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.redirect(new URL("/login", request.url), 303);
  }

  const app = await db.app.findUnique({
    where: { id: appId },
    select: {
      id: true,
      name: true,
      teamId: true,
      kind: true,
      archived: true,
      activeDeployment: {
        select: {
          id: true,
          entry: true,
          manifest: true,
          files: { where: { path: "index.html" }, select: { content: true } },
        },
      },
    },
  });
  if (!app || app.kind !== "HOSTED") return notFound();

  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: app.teamId } },
    select: { role: true },
  });
  if (!membership || !isRole(membership.role)) return notFound();
  if (!can(membership.role, "app:run")) return notFound();

  const entry = app.activeDeployment?.files[0];
  if (app.archived || !app.activeDeployment || !entry) {
    return new Response("This tool is archived or has not been deployed yet.", {
      status: 410,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const manifest = readStoredManifest(app.activeDeployment.manifest);
  const bootstrap: Bootstrap = {
    api: TOOL_API_BASE,
    token: issueTicket("tool", { appId: app.id, userId: user.id }),
    user: { id: user.id, name: user.name, email: user.email },
    role: membership.role,
    app: { id: app.id, name: app.name },
    rules: { collections: manifest.collections, strict: manifest.strict, defaults: DEFAULT_COLLECTION_POLICY },
  };
  const assetTicket = issueTicket("asset", {
    deploymentId: app.activeDeployment.id,
    userId: user.id,
  });

  const html = injectRuntime(
    Buffer.from(entry.content).toString("utf8"),
    `/a/${assetTicket}/`,
    bootstrap,
  );

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": TOOL_CSP,
      "X-Frame-Options": "SAMEORIGIN",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-DNS-Prefetch-Control": "off",
      "Cache-Control": "private, no-store",
    },
  });
}
