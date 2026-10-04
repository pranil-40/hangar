"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { TokenFormState } from "@/app/actions/tokens";

export function DeployTokenForm({
  action,
  appUrl,
}: {
  action: (prev: TokenFormState, formData: FormData) => Promise<TokenFormState>;
  appUrl: string;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <div style={{ display: "grid", gap: "0.9rem" }}>
      <form action={formAction} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <input
          className="input"
          name="name"
          placeholder="e.g. Priya's laptop, Claude Code"
          aria-label="Token name"
          style={{ flex: "1 1 240px" }}
          required
        />
        <SubmitButton pendingLabel="Creating…">Create token</SubmitButton>
      </form>

      {state.error && <p className="alert-error">{state.error}</p>}

      {state.token && (
        <div style={{ display: "grid", gap: "0.7rem" }}>
          <p className="alert-success" style={{ margin: 0 }}>
            Token &ldquo;{state.name}&rdquo; created. Copy it now: it is shown once and only a
            fingerprint is stored.
          </p>
          <pre className="code-block">{state.token}</pre>

          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <strong>Set up once</strong> (Node 18 or newer, no install):
          </p>
          <pre className="code-block">{`mkdir -p ~/.hangar && curl -fsSL ${appUrl}/hangar.mjs -o ~/.hangar/hangar.mjs
node ~/.hangar/hangar.mjs login ${appUrl} ${state.token}`}</pre>

          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            <strong>Let your agent deploy.</strong> Claude Code:
          </p>
          <pre className="code-block">{`claude mcp add hangar -- node ~/.hangar/hangar.mjs mcp
mkdir -p ~/.claude/skills/hangar && curl -fsSL ${appUrl}/hangar-skill.md -o ~/.claude/skills/hangar/SKILL.md`}</pre>
          <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
            Cursor, Codex, Claude Desktop or any MCP client: add a server that runs{" "}
            <code>node ~/.hangar/hangar.mjs mcp</code>. Or deploy by hand:
          </p>
          <pre className="code-block">{`node ~/.hangar/hangar.mjs deploy ./dist --name "Refund approvals"`}</pre>
        </div>
      )}
    </div>
  );
}
