import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAppAction, rollbackAction, setAppArchivedAction } from "@/app/actions/apps";
import { approveConnectorAction, revokeConnectorGrantAction } from "@/app/actions/connectors";
import { queriesHash } from "@/lib/connectors";
import { readStoredManifest } from "@/lib/hosting/manifest";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/guard";
import { recordAppView } from "@/lib/metrics";
import { PLATFORM_META, isPlatform } from "@/lib/platforms";
import { runtimeProvider } from "@/lib/runtime/provider";
import { AppRunner } from "@/components/AppRunner";
import { ConfirmButton } from "@/components/ConfirmButton";
import { HostedRunner } from "@/components/HostedRunner";

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function when(date: Date): string {
  return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function AppPage({
  params,
}: {
  params: Promise<{ slug: string; appId: string }>;
}) {
  const { slug, appId } = await params;
  const { team, user, can } = await requireTeam(slug);

  const app = await db.app.findFirst({
    where: { id: appId, teamId: team.id },
    select: {
      id: true,
      name: true,
      description: true,
      kind: true,
      url: true,
      platform: true,
      archived: true,
      activeDeploymentId: true,
      activeDeployment: { select: { manifest: true } },
      createdBy: { select: { name: true } },
      deployments: {
        orderBy: { version: "desc" },
        take: 10,
        select: {
          id: true,
          version: true,
          fileCount: true,
          totalBytes: true,
          source: true,
          agent: true,
          createdAt: true,
          createdBy: { select: { name: true } },
        },
      },
    },
  });
  if (!app) notFound();

  // Viewers may open tools; this is what the weekly number is counted from.
  if (can("app:run") && !app.archived) {
    await recordAppView({ appId: app.id, userId: user.id, teamId: team.id });
  }

  const hosted = app.kind === "HOSTED";
  const platform = isPlatform(app.platform) ? app.platform : "OTHER";
  const target =
    !hosted && app.url ? await runtimeProvider().resolve({ url: app.url, platform }) : null;
  const live = app.deployments.find((deployment) => deployment.id === app.activeDeploymentId);

  // What the live version asks to query, and whether an owner approved it.
  const requested = Object.entries(readStoredManifest(app.activeDeployment?.manifest).connectors);
  const [connectors, grants, usage] = await Promise.all([
    requested.length
      ? db.connector.findMany({ where: { teamId: team.id, slug: { in: requested.map(([slug]) => slug) } }, select: { id: true, slug: true } })
      : Promise.resolve([]),
    requested.length
      ? db.connectorGrant.findMany({ where: { appId: app.id }, select: { connectorId: true, queriesHash: true, approvedAt: true } })
      : Promise.resolve([]),
    can("app:edit")
      ? db.appView.findMany({
          where: { appId: app.id, viewedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
          select: { userId: true },
          distinct: ["userId"],
        })
      : Promise.resolve([]),
  ]);

  return (
    <>
      <Link href={`/t/${slug}`} className="subtle" style={{ fontSize: "0.85rem" }}>
        ← Back to tools
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          margin: "0.8rem 0 1.2rem",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <h2 style={{ margin: 0, fontSize: "1.3rem", letterSpacing: "-0.02em" }}>
              {app.name}
            </h2>
            {hosted ? (
              <span className="badge badge-success">Hosted</span>
            ) : (
              <span className="badge">{PLATFORM_META[platform].label} link</span>
            )}
            {app.archived && <span className="badge">Archived</span>}
          </div>
          <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.9rem" }}>
            {app.description ?? "No description."}
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          {can("app:edit") && (
            <Link href={`/t/${slug}/apps/${appId}/edit`} className="btn">
              Edit
            </Link>
          )}

          {can("app:archive") && (
            <form action={setAppArchivedAction.bind(null, slug, appId, !app.archived)}>
              <button className="btn" type="submit">
                {app.archived ? "Restore" : "Archive"}
              </button>
            </form>
          )}

          {can("app:delete") && (
            <form action={deleteAppAction.bind(null, slug, appId)}>
              <ConfirmButton message={`Delete "${app.name}"? This cannot be undone.`}>
                Delete
              </ConfirmButton>
            </form>
          )}
        </div>
      </div>

      {app.archived ? (
        <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
          <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>This tool is archived</p>
          <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
            Nobody can open it until an owner or editor restores it.
          </p>
        </div>
      ) : hosted ? (
        live ? (
          <HostedRunner appId={app.id} />
        ) : (
          <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
            <p className="muted" style={{ margin: 0 }}>This tool has not been deployed yet.</p>
          </div>
        )
      ) : (
        <>
          <p className="alert-warn" style={{ marginBottom: "0.8rem" }}>
            <strong>Link only.</strong> This tool runs on {PLATFORM_META[platform].label} at its
            own address, so anyone who has that address can open it without Hangar. Deploy it
            to Hangar to put it behind your team&rsquo;s sign-in.
          </p>
          {target && (
            <AppRunner url={target.url} embeddable={target.embeddable} reason={target.reason} />
          )}
        </>
      )}

      {hosted && live && (
        <p className="subtle" style={{ marginTop: "0.8rem", fontSize: "0.78rem" }}>
          Version {live.version}, deployed {when(live.createdAt)} by {live.createdBy.name}
          {live.agent ? ` via ${live.agent}` : ""}. Everyone in {team.name} can open this.
        </p>
      )}
      {!hosted && (
        <p className="subtle" style={{ marginTop: "0.8rem", fontSize: "0.78rem" }}>
          Added by {app.createdBy.name}. Everyone in {team.name} can find it here.
        </p>
      )}

      {hosted && can("app:edit") && (
        <p className="subtle" style={{ margin: "0.3rem 0 0", fontSize: "0.78rem" }}>
          Opened by {usage.length} {usage.length === 1 ? "person" : "people"} in the last 7 days.
        </p>
      )}

      {hosted && requested.length > 0 && (
        <section style={{ marginTop: "1.8rem" }}>
          <h3 style={{ margin: "0 0 0.3rem", fontSize: "1rem" }}>Data access</h3>
          <p className="muted" style={{ margin: "0 0 0.7rem", fontSize: "0.86rem" }}>
            This tool asks to run these read-only queries. It never sees the database password, and
            it cannot run anything else. A deploy that changes a query needs approval again.
          </p>
          <div style={{ display: "grid", gap: "0.8rem" }}>
            {requested.map(([connectorSlug, spec]) => {
              const connector = connectors.find((c) => c.slug === connectorSlug);
              const grant = connector && grants.find((g) => g.connectorId === connector.id);
              const approved = !!grant && grant.queriesHash === queriesHash(spec.queries);
              return (
                <div key={connectorSlug} className="card" style={{ padding: "1rem", display: "grid", gap: "0.6rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                    <code style={{ fontWeight: 600 }}>{connectorSlug}</code>
                    {!connector ? (
                      <span className="badge badge-warn">Not connected</span>
                    ) : approved ? (
                      <span className="badge badge-success">Approved</span>
                    ) : grant ? (
                      <span className="badge badge-warn">Queries changed, needs approval</span>
                    ) : (
                      <span className="badge badge-warn">Needs approval</span>
                    )}
                    <span style={{ flex: 1 }} />
                    {can("connector:manage") && connector && !approved && (
                      <form action={approveConnectorAction.bind(null, slug, app.id, connectorSlug)}>
                        <button className="btn btn-primary" type="submit">Approve these queries</button>
                      </form>
                    )}
                    {can("connector:manage") && approved && (
                      <form action={revokeConnectorGrantAction.bind(null, slug, app.id, connectorSlug)}>
                        <button className="btn" type="submit">Revoke</button>
                      </form>
                    )}
                  </div>
                  {!connector && can("connector:manage") && (
                    <p className="subtle" style={{ margin: 0, fontSize: "0.8rem" }}>
                      Add a database called <code>{connectorSlug}</code> under Settings → Database connections.
                    </p>
                  )}
                  {Object.entries(spec.queries).map(([name, sql]) => (
                    <div key={name}>
                      <div className="subtle" style={{ fontSize: "0.76rem", marginBottom: "0.2rem" }}>{name}</div>
                      <pre className="code-block" style={{ whiteSpace: "pre-wrap" }}>{sql}</pre>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {hosted && app.deployments.length > 0 && can("app:edit") && (
        <section style={{ marginTop: "1.8rem" }}>
          <h3 style={{ margin: "0 0 0.7rem", fontSize: "1rem" }}>Versions</h3>
          <div className="card" style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.84rem" }}>
              <tbody>
                {app.deployments.map((deployment) => {
                  const isLive = deployment.id === app.activeDeploymentId;
                  return (
                    <tr key={deployment.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td style={{ padding: "0.55rem 1rem", fontWeight: 600 }}>v{deployment.version}</td>
                      <td style={{ padding: "0.55rem 0.6rem" }} className="muted">
                        {when(deployment.createdAt)} · {deployment.createdBy.name}
                        {deployment.agent ? ` via ${deployment.agent}` : ""}
                      </td>
                      <td style={{ padding: "0.55rem 0.6rem" }} className="subtle">
                        {deployment.fileCount} files · {formatBytes(deployment.totalBytes)}
                      </td>
                      <td style={{ padding: "0.55rem 1rem", textAlign: "right" }}>
                        {isLive ? (
                          <span className="badge badge-success">Live</span>
                        ) : (
                          <form action={rollbackAction.bind(null, slug, appId, deployment.id)}>
                            <button className="btn" style={{ padding: "0.2rem 0.6rem", fontSize: "0.78rem" }} type="submit">
                              Make live
                            </button>
                          </form>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
