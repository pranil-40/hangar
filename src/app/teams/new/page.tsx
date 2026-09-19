import Link from "next/link";
import { requireUser } from "@/lib/guard";
import { TopBar } from "@/components/TopBar";
import { NewTeamForm } from "./NewTeamForm";

export default async function NewTeamPage() {
  const user = await requireUser();

  return (
    <>
      <TopBar user={user} />

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "2rem 1.25rem" }}>
        <Link href="/teams" className="subtle" style={{ fontSize: "0.85rem" }}>
          ← Back to teams
        </Link>

        <h1 style={{ margin: "0.8rem 0 1.2rem", fontSize: "1.4rem", letterSpacing: "-0.02em" }}>
          New team
        </h1>

        <div className="card" style={{ padding: "1.4rem" }}>
          <NewTeamForm />
        </div>
      </main>
    </>
  );
}
