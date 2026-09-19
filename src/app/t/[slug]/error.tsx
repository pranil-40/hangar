"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Backstop for anything a page guard throws. Production strips server error
 * messages before they reach the client, so this stays deliberately generic
 * rather than pretending to explain what went wrong.
 */
export default function TeamError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="card" style={{ padding: "2.5rem", textAlign: "center", maxWidth: 520 }}>
      <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>Something went wrong</p>
      <p className="muted" style={{ margin: "0 0 1.2rem", fontSize: "0.9rem" }}>
        That action could not be completed. If it keeps happening, tell whoever owns this team.
      </p>
      <div style={{ display: "flex", gap: "0.6rem", justifyContent: "center" }}>
        <button className="btn" onClick={reset}>
          Try again
        </button>
        <Link href="/teams" className="btn">
          Back to teams
        </Link>
      </div>
    </div>
  );
}
