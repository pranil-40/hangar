import { db } from "@/lib/db";
import { can, isRole } from "@/lib/permissions";
import { isHtmlPath, normaliseBundlePath } from "@/lib/hosting/bundle";
import { MANIFEST_FILE } from "@/lib/hosting/manifest";
import { ASSET_CSP } from "@/lib/hosting/runtime";
import { readTicket } from "@/lib/tickets";

/**
 * GET /a/<ticket>/<path>: a hosted tool's static files.
 *
 * The tool page runs with an opaque origin and sends no cookies, so assets
 * are authorised by the ticket in the path instead: issued to one viewer for
 * one deployment, valid for hours, and re-checked against membership here.
 * Module scripts and fonts are fetched in CORS mode from that opaque origin,
 * hence the wildcard; there is no cookie-based authority for it to expose.
 */

const NOT_FOUND = () =>
  new Response("Not found", {
    status: 404,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "no-store",
    },
  });

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticket: string; path: string[] }> },
) {
  const { ticket, path: segments } = await params;

  const claims = readTicket("asset", ticket);
  if (!claims) return NOT_FOUND();

  const path = normaliseBundlePath(segments.map(safeDecode).join("/"));
  // Pages are only ever served through /run, where the viewer is checked
  // and the runtime is injected.
  // hangar.json is configuration for Hangar, not part of the page.
  if (!path || isHtmlPath(path) || path === MANIFEST_FILE) return NOT_FOUND();

  const deployment = await db.deployment.findUnique({
    where: { id: claims.deploymentId },
    select: {
      activeFor: { select: { teamId: true, archived: true } },
    },
  });
  // Only the deployment that is live right now: a redeploy or rollback
  // retires the previous one's tickets along with it.
  const app = deployment?.activeFor;
  if (!app || app.archived) return NOT_FOUND();

  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId: claims.userId, teamId: app.teamId } },
    select: { role: true },
  });
  if (!membership || !isRole(membership.role) || !can(membership.role, "app:run")) {
    return NOT_FOUND();
  }

  const file = await db.deploymentFile.findUnique({
    where: { deploymentId_path: { deploymentId: claims.deploymentId, path } },
    select: { content: true, contentType: true, sha256: true },
  });
  if (!file) return NOT_FOUND();

  return new Response(Buffer.from(file.content), {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Security-Policy": ASSET_CSP,
      "X-Content-Type-Options": "nosniff",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "private, max-age=300",
      ETag: `"${file.sha256}"`,
    },
  });
}
