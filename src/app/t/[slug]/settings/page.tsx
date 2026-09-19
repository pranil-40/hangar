import { renameTeamAction } from "@/app/actions/teams";
import { requireTeam } from "@/lib/guard";
import {
  CAPABILITIES,
  ROLES,
  ROLE_LABELS,
  can as roleCan,
} from "@/lib/permissions";
import { RenameTeamForm } from "./RenameTeamForm";

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { team, role, can } = await requireTeam(slug);

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
                  <td
                    style={{
                      padding: "0.5rem 1rem",
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.78rem",
                    }}
                  >
                    {capability}
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
