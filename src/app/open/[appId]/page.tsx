import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { TOOL_SANDBOX } from "@/lib/hosting/runtime";
import { recordAppView } from "@/lib/metrics";
import { can, isRole } from "@/lib/permissions";

/**
 * A hosted tool, full screen. This is what a crew member's phone shows, and
 * where a direct visit to /run lands. Framing the tool here (instead of
 * serving it as the page) is deliberate: this page's frame-src 'self' is
 * what stops the tool from navigating its own frame somewhere else.
 */
export default async function OpenToolPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = await params;
  const user = await requireUser();

  const app = await db.app.findUnique({
    where: { id: appId },
    select: { id: true, name: true, kind: true, archived: true, teamId: true, activeDeploymentId: true, team: { select: { slug: true } } },
  });
  if (!app || app.kind !== "HOSTED") notFound();

  const membership = await db.membership.findUnique({
    where: { userId_teamId: { userId: user.id, teamId: app.teamId } },
    select: { role: true },
  });
  if (!membership || !isRole(membership.role) || !can(membership.role, "app:run")) notFound();

  const runnable = !app.archived && !!app.activeDeploymentId;
  if (runnable) await recordAppView({ appId: app.id, userId: user.id, teamId: app.teamId });

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.7rem",
          padding: "0.5rem 0.9rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface)",
        }}
      >
        <Link href={`/t/${app.team.slug}`} className="subtle" style={{ fontSize: "0.85rem" }}>
          ← Tools
        </Link>
        <strong style={{ fontSize: "0.95rem", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {app.name}
        </strong>
        <span className="badge badge-success">Private</span>
      </header>

      {runnable ? (
        <iframe
          src={`/run/${app.id}`}
          title={app.name}
          sandbox={TOOL_SANDBOX}
          referrerPolicy="no-referrer"
          style={{ flex: 1, width: "100%", border: "none", display: "block", background: "var(--bg)" }}
        />
      ) : (
        <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "2rem" }}>
          <p className="muted">This tool is archived or has not been deployed yet.</p>
        </div>
      )}
    </div>
  );
}
