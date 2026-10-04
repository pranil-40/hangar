"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { ConnectorFormState } from "@/app/actions/connectors";

export function ConnectorForm({
  action,
}: {
  action: (prev: ConnectorFormState, formData: FormData) => Promise<ConnectorFormState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.7rem" }}>
      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 200px" }}>
          <label className="label" htmlFor="connector-name">Name</label>
          <input className="input" id="connector-name" name="name" placeholder="Inventory database" required />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label" htmlFor="connector-slug">Handle</label>
          <input className="input" id="connector-slug" name="slug" placeholder="stock-db" required />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="connector-url">Postgres connection URL</label>
        <input
          className="input"
          id="connector-url"
          name="url"
          type="password"
          autoComplete="off"
          placeholder="postgresql://readonly_user:password@host:5432/dbname"
          required
        />
        <p className="hint">
          Use a read-only database user. Hangar also runs every query in a read-only transaction,
          seals this URL, and never sends it to a tool.
        </p>
      </div>
      {state.error && <p className="alert-error" style={{ margin: 0 }}>{state.error}</p>}
      {state.notice && <p className="alert-success" style={{ margin: 0 }}>{state.notice}</p>}
      <div>
        <SubmitButton pendingLabel="Testing connection…">Test and connect</SubmitButton>
      </div>
    </form>
  );
}
