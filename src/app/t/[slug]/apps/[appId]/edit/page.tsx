import Link from "next/link";
import { notFound } from "next/navigation";
import { updateAppAction } from "@/app/actions/apps";
import { db } from "@/lib/db";
import { requireTeam } from "@/lib/guard";
import { AppForm } from "@/components/AppForm";
import { NoAccess } from "@/components/NoAccess";

export default async function EditAppPage({
  params,
}: {
  params: Promise<{ slug: string; appId: string }>;
}) {
  const { slug, appId } = await params;
  const { team, can } = await requireTeam(slug);

  // The server action enforces this too — this is only so someone who opens
  // the URL directly gets a sentence rather than a crash.
  if (!can("app:edit")) {
    return <NoAccess slug={slug} message="Only owners and editors can change tools." />;
  }

  const app = await db.app.findFirst({
    where: { id: appId, teamId: team.id },
    select: { name: true, description: true, url: true, platform: true },
  });
  if (!app) notFound();

  return (
    <div style={{ maxWidth: 520 }}>
      <Link href={`/t/${slug}/apps/${appId}`} className="subtle" style={{ fontSize: "0.85rem" }}>
        ← Back to tool
      </Link>

      <h2 style={{ margin: "0.8rem 0 1.2rem", fontSize: "1.25rem", letterSpacing: "-0.02em" }}>
        Edit tool
      </h2>

      <div className="card" style={{ padding: "1.4rem" }}>
        <AppForm
          action={updateAppAction.bind(null, slug, appId)}
          defaults={app}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
