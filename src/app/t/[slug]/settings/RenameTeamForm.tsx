"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";

type State = { error?: string };

export function RenameTeamForm({
  action,
  defaultName,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  defaultName: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form
      action={formAction}
      style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}
    >
      <div style={{ flex: "1 1 240px" }}>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input className="input" id="name" name="name" defaultValue={defaultName} required />
      </div>

      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>

      {state.error && (
        <p className="alert-error" style={{ flexBasis: "100%" }}>
          {state.error}
        </p>
      )}
    </form>
  );
}
