import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/guard";
import { ROLE_LABELS, isRole } from "@/lib/permissions";
import { TopBar } from "@/components/TopBar";

export default async function TeamsPage() {
  const user = await requireUser();

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      team: {
        select: {
          name: true,
          slug: true,
          _count: { select: { apps: true, memberships: true } },
        },
      },
    },
  });

  return (
    <>
      <TopBar user={user} />

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.25rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.5rem", letterSpacing: "-0.02em" }}>
              Your teams
            </h1>
            <p className="muted" style={{ margin: "0.2rem 0 0", fontSize: "0.9rem" }}>
              Each team has its own shelf of tools and its own access list.
            </p>
          </div>

          <Link href="/teams/new" className="btn btn-primary">
            New team
          </Link>
        </div>

        {memberships.length === 0 ? (
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>No teams yet</p>
            <p className="muted" style={{ margin: "0 0 1.2rem", fontSize: "0.9rem" }}>
              Create one, add the tools your team already uses, then invite people.
            </p>
            <Link href="/teams/new" className="btn btn-primary">
              Create your first team
            </Link>
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "0.9rem",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            }}
          >
            {memberships.map(({ team, role }) => (
              <Link key={team.slug} href={`/t/${team.slug}`} className="card" style={{ padding: "1.1rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.6rem",
                    marginBottom: "0.5rem",
                  }}
                >
                  <strong style={{ fontSize: "1rem" }}>{team.name}</strong>
                  <span className="badge">{isRole(role) ? ROLE_LABELS[role] : role}</span>
                </div>
                <p className="subtle" style={{ margin: 0, fontSize: "0.82rem" }}>
                  {team._count.apps} {team._count.apps === 1 ? "tool" : "tools"} ·{" "}
                  {team._count.memberships}{" "}
                  {team._count.memberships === 1 ? "member" : "members"}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
