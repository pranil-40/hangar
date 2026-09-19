"use client";

import { useActionState } from "react";
import { createTeamAction } from "@/app/actions/teams";
import { SubmitButton } from "@/components/SubmitButton";

export function NewTeamForm() {
  const [state, formAction] = useActionState(createTeamAction, {});

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.9rem" }}>
      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label className="label" htmlFor="name">
          Team name
        </label>
        <input
          className="input"
          id="name"
          name="name"
          placeholder="Acme Ops"
          autoFocus
          required
        />
        <p className="hint">You'll be the owner and can invite others straight away.</p>
      </div>

      <SubmitButton pendingLabel="Creating…">Create team</SubmitButton>
    </form>
  );
}
