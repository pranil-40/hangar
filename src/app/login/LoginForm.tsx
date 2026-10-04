"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthShell } from "@/components/AuthShell";

export function LoginForm({ google, error }: { google: boolean; error?: string }) {
  const [state, formAction] = useActionState(loginAction, {});

  return (
    <AuthShell title="Sign in to Hangar" subtitle="Your team's tools, in one place.">
      {error && <p className="alert-error" style={{ marginTop: 0 }}>{error}</p>}
      {google && (
        <>
          <a className="btn" href="/auth/google" style={{ width: "100%", marginBottom: "0.9rem" }}>
            Continue with Google
          </a>
          <div className="subtle" style={{ textAlign: "center", fontSize: "0.78rem", marginBottom: "0.9rem" }}>
            or use email
          </div>
        </>
      )}
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
      <p className="hint" style={{ marginTop: "0.4rem", textAlign: "center" }}>
        On a team&rsquo;s crew? You don&rsquo;t need a password. Ask your manager for a new join link.
      </p>
    </AuthShell>
  );
}
