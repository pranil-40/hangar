"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";
import { AuthShell } from "@/components/AuthShell";

export default function SignupPage() {
  const [state, formAction] = useActionState(signupAction, {});

  return (
    <AuthShell
      title="Create your Hangar account"
      subtitle="Then invite the people who need your tools."
    >
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
