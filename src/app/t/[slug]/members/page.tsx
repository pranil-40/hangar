import {
  changeRoleAction,
  inviteMemberAction,
  removeMemberAction,
  revokeInviteAction,
} from "@/app/actions/members";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/guard";
import { ROLE_LABELS, isRole } from "@/lib/permissions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { InviteForm } from "./InviteForm";
import { MemberRow } from "./MemberRow";

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { team, user, can } = await requireTeam(slug);
  const canManage = can("member:change_role");

  const [memberships, invites] = await Promise.all([
    db.membership.findMany({
      where: { teamId: team.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        role: true,
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    can("member:invite")
      ? db.invite.findMany({
          where: { teamId: team.id, acceptedAt: null },
          orderBy: { createdAt: "desc" },
          select: { id: true, email: true, role: true, expiresAt: true },
        })
      : Promise.resolve([]),
  ]);

  return (
    <div style={{ maxWidth: 720 }}>
      {can("member:invite") && (
        <section style={{ marginBottom: "1.8rem" }}>
          <h2 style={{ margin: "0 0 0.8rem", fontSize: "1.05rem" }}>Invite someone</h2>
          <div className="card" style={{ padding: "1.2rem" }}>
            <InviteForm action={inviteMemberAction.bind(null, slug)} />
          </div>
        </section>
      )}

      <section style={{ marginBottom: "1.8rem" }}>
        <h2 style={{ margin: "0 0 0.8rem", fontSize: "1.05rem" }}>
          People ({memberships.length})
        </h2>

        <div className="card" style={{ overflow: "hidden" }}>
          {memberships.map((membership, index) => (
            <div key={membership.id} style={index === 0 ? { marginTop: -1 } : undefined}>
              <MemberRow
                name={membership.user.name}
                email={membership.user.email}
                role={isRole(membership.role) ? membership.role : "VIEWER"}
                isYou={membership.user.id === user.id}
                canManage={canManage}
                onChangeRole={changeRoleAction.bind(null, slug, membership.id)}
                onRemove={removeMemberAction.bind(null, slug, membership.id)}
              />
            </div>
          ))}
        </div>

        {canManage && (
          <p className="hint">
            A team always keeps at least one owner — the last one cannot be demoted or removed.
          </p>
        )}
      </section>

      {can("member:invite") && invites.length > 0 && (
        <section>
          <h2 style={{ margin: "0 0 0.8rem", fontSize: "1.05rem" }}>
            Pending invites ({invites.length})
          </h2>

          <div className="card" style={{ overflow: "hidden" }}>
            {invites.map((invite, index) => (
              <div
                key={invite.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.8rem",
                  padding: "0.8rem 1rem",
                  borderTop: index === 0 ? "none" : "1px solid var(--border)",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 200px" }}>
                  <div style={{ fontWeight: 560, fontSize: "0.9rem" }}>{invite.email}</div>
                  <div className="subtle" style={{ fontSize: "0.78rem" }}>
                    expires {invite.expiresAt.toLocaleDateString()}
                  </div>
                </div>

                <span className="badge">
                  {isRole(invite.role) ? ROLE_LABELS[invite.role] : invite.role}
                </span>

                <form action={revokeInviteAction.bind(null, slug, invite.id)}>
                  <ConfirmButton message={`Revoke the invite for ${invite.email}?`}>
                    Revoke
                  </ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
