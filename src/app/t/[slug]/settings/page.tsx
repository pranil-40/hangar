import { createConnectorAction, deleteConnectorAction } from "@/app/actions/connectors";
import { renameTeamAction, setAutoJoinAction } from "@/app/actions/teams";
import { createDeployTokenAction, revokeDeployTokenAction } from "@/app/actions/tokens";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/guard";
import { appUrl } from "@/lib/urls";
import { googleConfig, isClaimableDomain } from "@/lib/google-auth";
import {
  CAPABILITIES,
  CAPABILITY_LABELS,
  ROLES,
  ROLE_LABELS,
  can as roleCan,
} from "@/lib/permissions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { ConnectorForm } from "./ConnectorForm";
import { DeployTokenForm } from "./DeployTokenForm";
import { RenameTeamForm } from "./RenameTeamForm";

function when(date: Date | null): string {
  return date
    ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "never";
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { team, user, role, can } = await requireTeam(slug);

  // Owners see every token in the team so they can revoke any of them;
  // editors see only their own.
  const tokens = can("token:create")
    ? await db.deployToken.findMany({
        where: {
          teamId: team.id,
          revokedAt: null,
          ...(can("token:revoke_any") ? {} : { userId: user.id }),
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          prefix: true,
          lastUsedAt: true,
          createdAt: true,
          user: { select: { name: true } },
        },
      })
    : [];

  const connectors = can("connector:manage")
    ? await db.connector.findMany({
        where: { teamId: team.id },
        orderBy: { createdAt: "asc" },
        select: { id: true, name: true, slug: true, createdAt: true, _count: { select: { grants: true } } },
      })
    : [];

  const [teamRow, account] = await Promise.all([
    db.team.findUnique({ where: { id: team.id }, select: { autoJoinDomain: true } }),
    db.user.findUnique({ where: { id: user.id }, select: { email: true, googleSub: true } }),
  ]);
  const myDomain = account?.email?.split("@")[1]?.toLowerCase() ?? "";
  const canClaimDomain = Boolean(account?.googleSub) && isClaimableDomain(myDomain);

  return (
    <div style={{ maxWidth: 720 }}>
      {can("team:rename") && (
        <section style={{ marginBottom: "1.8rem" }}>
          <h2 style={{ margin: "0 0 0.8rem", fontSize: "1.05rem" }}>Team name</h2>
          <div className="card" style={{ padding: "1.2rem" }}>
            <RenameTeamForm
              action={renameTeamAction.bind(null, slug)}
              defaultName={team.name}
            />
          </div>
        </section>
      )}

      {can("token:create") && (
        <section style={{ marginBottom: "1.8rem" }}>
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.05rem" }}>Deploy tokens</h2>
          <p className="muted" style={{ margin: "0 0 0.8rem", fontSize: "0.88rem" }}>
            A deploy token lets your coding agent publish tools into {team.name}, and nothing
            else. It can never do more than you can: if your role changes or you leave the
            team, your tokens stop working.
          </p>
          <div className="card" style={{ padding: "1.2rem", display: "grid", gap: "1rem" }}>
            <DeployTokenForm
              action={createDeployTokenAction.bind(null, slug)}
              appUrl={appUrl("").replace(/\/$/, "")}
            />

            {tokens.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <tbody>
                  {tokens.map((token) => (
                    <tr key={token.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.55rem 0" }}>
                        <div style={{ fontWeight: 600 }}>{token.name}</div>
                        <div className="subtle" style={{ fontSize: "0.76rem" }}>
                          <code>{token.prefix}…</code> · {token.user.name} · created{" "}
                          {when(token.createdAt)} · last used {when(token.lastUsedAt)}
                        </div>
                      </td>
                      <td style={{ padding: "0.55rem 0", textAlign: "right" }}>
                        <form action={revokeDeployTokenAction.bind(null, slug, token.id)}>
                          <ConfirmButton message={`Revoke "${token.name}"? Agents using it will stop being able to deploy.`}>
                            Revoke
                          </ConfirmButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {can("connector:manage") && (
        <section style={{ marginBottom: "1.8rem" }}>
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.05rem" }}>Database connections</h2>
          <p className="muted" style={{ margin: "0 0 0.8rem", fontSize: "0.88rem" }}>
            Let tools read company data without holding the password. A tool can only run the
            read-only queries it declares, after you approve them on the tool&rsquo;s page.
          </p>
          <div className="card" style={{ padding: "1.2rem", display: "grid", gap: "1rem" }}>
            <ConnectorForm action={createConnectorAction.bind(null, slug)} />
            {connectors.length > 0 && (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
                <tbody>
                  {connectors.map((connector) => (
                    <tr key={connector.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.55rem 0" }}>
                        <div style={{ fontWeight: 600 }}>{connector.name}</div>
                        <div className="subtle" style={{ fontSize: "0.76rem" }}>
                          <code>{connector.slug}</code> · Postgres · {connector._count.grants} tool(s) approved
                        </div>
                      </td>
                      <td style={{ padding: "0.55rem 0", textAlign: "right" }}>
                        <form action={deleteConnectorAction.bind(null, slug, connector.id)}>
                          <ConfirmButton message={`Disconnect "${connector.slug}"? Tools using it will stop getting data.`}>
                            Disconnect
                          </ConfirmButton>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {can("team:rename") && googleConfig() && (
        <section style={{ marginBottom: "1.8rem" }}>
          <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.05rem" }}>Google sign-in</h2>
          <div className="card" style={{ padding: "1.2rem", display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
            <p className="muted" style={{ margin: 0, fontSize: "0.88rem", flex: "1 1 280px" }}>
              {teamRow?.autoJoinDomain
                ? `Anyone who signs in with a verified Google Workspace account on ${teamRow.autoJoinDomain} joins ${team.name} as a viewer.`
                : canClaimDomain
                  ? `Let anyone with a verified Google Workspace account on ${myDomain} join as a viewer.`
                  : "Sign in with a Google Workspace account on your company domain to let colleagues join automatically."}
            </p>
            {(teamRow?.autoJoinDomain || canClaimDomain) && (
              <form action={setAutoJoinAction.bind(null, slug, !teamRow?.autoJoinDomain)}>
                <button className="btn" type="submit">
                  {teamRow?.autoJoinDomain ? "Turn off" : "Turn on"}
                </button>
              </form>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 style={{ margin: "0 0 0.3rem", fontSize: "1.05rem" }}>Who can do what</h2>
        <p className="muted" style={{ margin: "0 0 0.8rem", fontSize: "0.88rem" }}>
          You are {ROLE_LABELS[role].toLowerCase()} in this team. Every action below is
          checked on the server.
        </p>

        <div className="card" style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "0.6rem 1rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                  }}
                >
                  Action
                </th>
                {ROLES.map((value) => (
                  <th
                    key={value}
                    style={{
                      padding: "0.6rem 0.8rem",
                      fontWeight: 600,
                      color: value === role ? "var(--accent)" : "var(--text-muted)",
                      textAlign: "center",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {ROLE_LABELS[value]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CAPABILITIES.map((capability) => (
                <tr key={capability} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "0.5rem 1rem", fontSize: "0.84rem" }}>
                    {CAPABILITY_LABELS[capability]}
                  </td>
                  {ROLES.map((value) => (
                    <td key={value} style={{ padding: "0.5rem 0.8rem", textAlign: "center" }}>
                      {roleCan(value, capability) ? (
                        <span style={{ color: "var(--success)" }}>&#10003;</span>
                      ) : (
                        <span className="subtle">&mdash;</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
