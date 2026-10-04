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
    <div style={{ maxWidth: 620 }}>
      <Link href={`/t/${slug}`} className="subtle" style={{ fontSize: "0.85rem" }}>
        ← Back to tools
      </Link>

      <h2 style={{ margin: "0.8rem 0 0.4rem", fontSize: "1.25rem", letterSpacing: "-0.02em" }}>
        Add a tool
      </h2>

      <section className="card" style={{ padding: "1.4rem", marginTop: "1rem" }}>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>Deploy from your coding agent</h3>
        <p className="muted" style={{ margin: "0 0 0.9rem", fontSize: "0.88rem" }}>
          Build the tool with Claude Code, Cursor, Codex or any agent, then ask it to share the
          tool with the team. It lands here behind your team&rsquo;s sign-in, sandboxed, with
          its own storage, and nobody has to touch a cloud account.
        </p>
        <ol style={{ margin: "0 0 1rem", paddingLeft: "1.2rem", fontSize: "0.88rem", lineHeight: 1.7 }}>
          <li>
            Create a deploy token in{" "}
            <Link href={`/t/${slug}/settings`} style={{ color: "var(--accent)" }}>
              Settings
            </Link>{" "}
            and run the two setup lines it shows you.
          </li>
          <li>
            Tell your agent: <em>&ldquo;Deploy this to Hangar as Refund approvals.&rdquo;</em>
          </li>
          <li>It appears on the Tools page, and every deploy after that is a new version you can roll back.</li>
        </ol>
      </section>

      <section className="card" style={{ padding: "1.4rem", marginTop: "1rem" }}>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem" }}>Or add a link</h3>
        <p className="muted" style={{ margin: "0 0 0.9rem", fontSize: "0.88rem" }}>
          For a tool that already runs on Lovable, Replit or elsewhere. Hangar lists it for the
          team, but cannot stop someone who has the original address from opening it.
        </p>
        <AppForm action={createAppAction.bind(null, slug)} submitLabel="Add link" />
      </section>
    </div>
  );
}
