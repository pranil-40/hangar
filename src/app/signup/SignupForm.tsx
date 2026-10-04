"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthShell } from "@/components/AuthShell";

export function SignupForm({ google }: { google: boolean }) {
  const [state, formAction] = useActionState(signupAction, {});

  return (
    <AuthShell
      title="Create your Hangar account"
      subtitle="Then add the people who need your tools."
    >
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
          <label className="label" htmlFor="name">
            Your name
          </label>
          <input className="input" id="name" name="name" autoComplete="name" required />
        </div>

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
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="hint">At least 8 characters.</p>
        </div>

        <SubmitButton pendingLabel="Creating…">Create account</SubmitButton>
      </form>

      <p className="hint" style={{ marginTop: "1.1rem", textAlign: "center" }}>
        Already have one? <Link href="/login" style={{ color: "var(--accent)" }}>Sign in</Link>
      </p>
    </AuthShell>
  );
}
