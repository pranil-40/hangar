import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import type { SessionUser } from "@/lib/guard";

export function TopBar({ user }: { user: SessionUser }) {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--surface)",
      }}
    >
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "0.75rem 1.25rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        <Link href="/teams">
          <Logo size={18} />
        </Link>

        <div style={{ flex: 1 }} />

        <span className="subtle" style={{ fontSize: "0.82rem" }}>
          {user.email}
        </span>

        <form action={logoutAction}>
          <button className="btn" type="submit" style={{ padding: "0.35rem 0.7rem" }}>
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
