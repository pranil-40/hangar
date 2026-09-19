"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthShell } from "@/components/AuthShell";

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, {});

  return (
    <AuthShell title="Sign in to Hangar" subtitle="Your team's tools, in one place.">
      <form action={formAction} style={{ display: "grid", gap: "0.9rem" }}>
        {state.error && <p className="alert-error">{state.error}</p>}

        <div>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            className="input"
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      </form>

      <p className="hint" style={{ marginTop: "1.1rem", textAlign: "center" }}>
        No account yet? <Link href="/signup" style={{ color: "var(--accent)" }}>Create one</Link>
      </p>
    </AuthShell>
  );
}
