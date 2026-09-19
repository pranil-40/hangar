import Link from "next/link";
import { createAppAction } from "@/app/actions/apps";
import { requireTeam } from "@/lib/guard";
import { AppForm } from "@/components/AppForm";
import { NoAccess } from "@/components/NoAccess";

export default async function NewAppPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { can } = await requireTeam(slug);

  // The server action enforces this too — this is only so someone who opens
  // the URL directly gets a sentence rather than a crash.
  if (!can("app:create")) {
    return (
      <NoAccess slug={slug} message="Only owners and editors can add tools to this team." />
    );
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <Link href={`/t/${slug}`} className="subtle" style={{ fontSize: "0.85rem" }}>
        ← Back to tools
      </Link>

      <h2 style={{ margin: "0.8rem 0 1.2rem", fontSize: "1.25rem", letterSpacing: "-0.02em" }}>
        Add a tool
      </h2>

      <div className="card" style={{ padding: "1.4rem" }}>
        <AppForm action={createAppAction.bind(null, slug)} submitLabel="Add tool" />
      </div>
    </div>
  );
}
