"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

type State = { error?: string };

/** A hosted tool's code changes by deploying; this only edits its label. */
export function HostedAppForm({
  action,
  defaults,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  defaults: { name: string; description: string | null };
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.9rem" }}>
      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input className="input" id="name" name="name" defaultValue={defaults.name} required />
      </div>

      <div>
        <label className="label" htmlFor="description">
          What is it for?
        </label>
        <textarea
          className="textarea"
          id="description"
          name="description"
          rows={2}
          maxLength={280}
          defaultValue={defaults.description ?? ""}
        />
        <p className="hint">To change what the tool does, ask your agent to deploy it again.</p>
      </div>

      <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    </form>
  );
}
