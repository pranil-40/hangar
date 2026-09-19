import Link from "next/link";
import { requireTeam } from "@/lib/guard";
import { ROLE_LABELS } from "@/lib/permissions";
import { TopBar } from "@/components/TopBar";
import { TeamTabs } from "@/components/TeamTabs";

export default async function TeamLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { user, team, role, can } = await requireTeam(slug);

  return (
    <>
      <TopBar user={user} />

      <div style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.1rem 1.25rem 0" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.7rem",
              marginBottom: "0.2rem",
            }}
          >
            <Link href="/teams" className="subtle" style={{ fontSize: "0.85rem" }}>
              Teams
            </Link>
            <span className="subtle">/</span>
            <h1 style={{ margin: 0, fontSize: "1.15rem", letterSpacing: "-0.01em" }}>
              {team.name}
            </h1>
            <span className="badge badge-accent">{ROLE_LABELS[role]}</span>
          </div>

          <TeamTabs slug={slug} canManageMembers={can("member:invite")} />
        </div>
      </div>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.8rem 1.25rem" }}>
        {children}
      </main>
    </>
  );
}
