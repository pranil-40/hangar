import { db } from "@/lib/db";
import { AUDIT_ACTIONS, type AuditAction } from "@/lib/audit";
import { requireTeam } from "@/lib/guard";
import { NoAccess } from "@/components/NoAccess";

function when(date: Date): string {
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function describe(action: string, detail: Record<string, unknown>): string {
  const verb = AUDIT_ACTIONS[action as AuditAction] ?? action;
  switch (action) {
    case "tool.deploy":
      return `${verb} ${detail.name ?? "a tool"} v${detail.version}${detail.agent ? ` via ${detail.agent}` : ""}`;
    case "tool.rollback":
      return `${verb} a tool to v${detail.version}`;
    case "tool.delete":
      return `${verb} ${detail.name ?? "a tool"}`;
    case "token.create":
    case "token.revoke":
      return `${verb} "${detail.name}"`;
    case "member.invite":
      return `${verb} ${detail.email} as ${String(detail.role).toLowerCase()}`;
    case "member.role":
      return `${verb} ${detail.name} to ${String(detail.role).toLowerCase()}`;
    case "member.remove":
      return `${verb} ${detail.name}`;
    default:
      return `${verb}`;
  }
}

export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { team, can } = await requireTeam(slug);

  if (!can("audit:view")) {
    return <NoAccess slug={slug} message="Only owners can see the activity log." />;
  }

  const events = await db.auditEvent.findMany({
    where: { teamId: team.id },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const actorIds = [...new Set(events.map((event) => event.actorId).filter((id): id is string => !!id))];
  const actors = await db.user.findMany({
    where: { id: { in: actorIds } },
    select: { id: true, name: true },
  });
  const names = new Map(actors.map((actor) => [actor.id, actor.name]));

  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.05rem" }}>Activity</h2>
      <p className="muted" style={{ margin: "0 0 0.9rem", fontSize: "0.88rem" }}>
        Every deploy, rollback, token and membership change in {team.name}, newest first. This
        log is append-only.
      </p>

      {events.length === 0 ? (
        <div className="card" style={{ padding: "2rem", textAlign: "center" }}>
          <p className="muted" style={{ margin: 0 }}>Nothing has happened yet.</p>
        </div>
      ) : (
        <div className="card">
          {events.map((event, index) => {
            const detail = event.detail ? (JSON.parse(event.detail) as Record<string, unknown>) : {};
            return (
              <div
                key={event.id}
                style={{
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "space-between",
                  padding: "0.6rem 1rem",
                  borderTop: index === 0 ? "none" : "1px solid var(--border)",
                  fontSize: "0.86rem",
                }}
              >
                <span>
                  <strong>{event.actorId ? names.get(event.actorId) ?? "Former member" : "Hangar"}</strong>{" "}
                  {describe(event.action, detail)}
                </span>
                <span className="subtle" style={{ whiteSpace: "nowrap", fontSize: "0.78rem" }}>
                  {when(event.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
