import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/guard";
import { teamActivity } from "@/lib/metrics";
import { PLATFORM_META, isPlatform } from "@/lib/platforms";

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div style={{ padding: "0.9rem 1.1rem", flex: "1 1 0", minWidth: 120 }}>
      <div style={{ fontSize: "1.45rem", fontWeight: 680, letterSpacing: "-0.02em" }}>
        {value}
      </div>
      <div className="subtle" style={{ fontSize: "0.76rem", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </div>
    </div>
  );
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { team, can } = await requireTeam(slug);

  const [apps, activity] = await Promise.all([
    db.app.findMany({
      where: { teamId: team.id, archived: false },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        description: true,
        platform: true,
        updatedAt: true,
        createdBy: { select: { name: true } },
      },
    }),
    teamActivity(team.id),
  ]);

  return (
    <>
      <div
        className="card"
        style={{ display: "flex", flexWrap: "wrap", marginBottom: "1.5rem", padding: "0.2rem" }}
      >
        <Stat value={activity.toolCount} label="Tools" />
        <Stat value={activity.memberCount} label="Members" />
        <Stat value={activity.viewsThisWeek} label="Opens this week" />
        <Stat value={activity.activeMembersThisWeek} label="Active this week" />
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "1.05rem" }}>Tools</h2>
        {can("app:create") && (
          <Link href={`/t/${slug}/apps/new`} className="btn btn-primary">
            Add tool
          </Link>
        )}
      </div>

      {apps.length === 0 ? (
        <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>Nothing here yet</p>
          <p className="muted" style={{ margin: "0 0 1.2rem", fontSize: "0.9rem" }}>
            {can("app:create")
              ? "Add the link to a tool your team already built. Everyone you invite will be able to open it."
              : "An owner or editor hasn't added any tools yet."}
          </p>
          {can("app:create") && (
            <Link href={`/t/${slug}/apps/new`} className="btn btn-primary">
              Add your first tool
            </Link>
          )}
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))",
          }}
        >
          {apps.map((app) => {
            const platform = isPlatform(app.platform) ? app.platform : "OTHER";
            const meta = PLATFORM_META[platform];

            return (
              <Link
                key={app.id}
                href={`/t/${slug}/apps/${app.id}`}
                className="card"
                style={{ padding: "1.1rem", display: "block" }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    marginBottom: "0.55rem",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 999,
                      background: meta.accent,
                      flexShrink: 0,
                    }}
                  />
                  <strong style={{ fontSize: "0.98rem" }}>{app.name}</strong>
                </div>

                <p
                  className="muted"
                  style={{
                    margin: "0 0 0.8rem",
                    fontSize: "0.85rem",
                    minHeight: "2.4em",
                  }}
                >
                  {app.description ?? "No description."}
                </p>

                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.5rem",
                  }}
                >
                  <span className="badge">{meta.label}</span>
                  <span className="subtle" style={{ fontSize: "0.76rem" }}>
                    added by {app.createdBy.name.split(" ")[0]}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
