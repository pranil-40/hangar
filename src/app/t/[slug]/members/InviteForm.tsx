"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { ROLES, ROLE_DESCRIPTIONS, ROLE_LABELS } from "@/lib/permissions";

type State = { error?: string; notice?: string };

export function InviteForm({
  action,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <div>
      <form
        action={formAction}
        style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}
      >
        <div style={{ flex: "2 1 220px" }}>
          <label className="label" htmlFor="email">
            Email
          </label>
          <input
            className="input"
            id="email"
            name="email"
            type="email"
            placeholder="teammate@company.com"
            required
          />
        </div>

        <div style={{ flex: "1 1 140px" }}>
          <label className="label" htmlFor="role">
            Role
          </label>
          <select className="select" id="role" name="role" defaultValue="VIEWER">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </select>
        </div>

        <SubmitButton pendingLabel="Creating…">Create invite</SubmitButton>
      </form>

      <p className="hint" style={{ marginTop: "0.6rem" }}>
        {ROLES.map((role) => `${ROLE_LABELS[role]}: ${ROLE_DESCRIPTIONS[role]}`).join(" ")}
      </p>

      {state.error && (
        <p className="alert-error" style={{ marginTop: "0.8rem" }}>
          {state.error}
        </p>
      )}

      {state.notice && (
        <div className="alert-success" style={{ marginTop: "0.8rem" }}>
          <strong>Invite created.</strong> Send them this link — no email is sent yet:
          <code
            style={{
              display: "block",
              marginTop: "0.45rem",
              padding: "0.45rem 0.6rem",
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: "0.78rem",
              wordBreak: "break-all",
              color: "var(--text)",
            }}
          >
            {state.notice}
          </code>
        </div>
      )}
    </div>
  );
}
