import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteAppAction, setAppArchivedAction } from "@/app/actions/apps";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/guard";
import { recordAppView } from "@/lib/metrics";
import { PLATFORM_META, isPlatform } from "@/lib/platforms";
import { runtimeProvider } from "@/lib/runtime/provider";
import { AppRunner } from "@/components/AppRunner";
import { ConfirmButton } from "@/components/ConfirmButton";

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
      url: true,
      platform: true,
      archived: true,
      createdBy: { select: { name: true } },
    },
  });
  if (!app) notFound();

  // Viewers may open tools; this is what the weekly number is counted from.
  if (can("app:run")) {
    await recordAppView({ appId: app.id, userId: user.id, teamId: team.id });
  }

  const platform = isPlatform(app.platform) ? app.platform : "OTHER";
  const target = await runtimeProvider().resolve({ url: app.url, platform });

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
            <span className="badge">{PLATFORM_META[platform].label}</span>
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

      <AppRunner url={target.url} embeddable={target.embeddable} reason={target.reason} />

      <p className="subtle" style={{ marginTop: "0.8rem", fontSize: "0.78rem" }}>
        Added by {app.createdBy.name}. Everyone in {team.name} can open this.
      </p>
    </>
  );
}
