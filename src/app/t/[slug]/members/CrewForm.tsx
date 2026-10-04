"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { CopyButton } from "@/components/CopyButton";
import type { CrewLinkState } from "@/app/actions/crew";

export function CrewLinkResult({ state }: { state: CrewLinkState }) {
  if (state.error) return <p className="alert-error" style={{ margin: 0 }}>{state.error}</p>;
  if (!state.url || !state.qr) return null;
  return (
    <div className="alert-success" style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state.qr} alt={`QR code to join as ${state.name}`} width={132} height={132} style={{ background: "#fff", borderRadius: 6 }} />
      <div style={{ flex: "1 1 240px", minWidth: 0, color: "var(--text)" }}>
        <strong>Link for {state.name} is ready.</strong> Text it to them, or let them scan the code
        with their phone camera. It works once and expires in 7 days.
        <code
          style={{
            display: "block",
            margin: "0.5rem 0",
            padding: "0.45rem 0.6rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            fontSize: "0.78rem",
            wordBreak: "break-all",
          }}
        >
          {state.url}
        </code>
        <CopyButton text={state.url} label="Copy link" />
      </div>
    </div>
  );
}

export function CrewForm({
  action,
}: {
  action: (prev: CrewLinkState, formData: FormData) => Promise<CrewLinkState>;
}) {
  const [state, formAction] = useActionState(action, {});

  return (
    <div style={{ display: "grid", gap: "0.8rem" }}>
      <form action={formAction} style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: "2 1 200px" }}>
          <label className="label" htmlFor="crew-name">
            Name
          </label>
          <input className="input" id="crew-name" name="name" placeholder="Maria (morning shift)" required />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label" htmlFor="crew-role">
            Role
          </label>
          <select className="select" id="crew-role" name="role" defaultValue="VIEWER">
            <option value="VIEWER">Crew (uses tools)</option>
            <option value="EDITOR">Lead (can approve)</option>
          </select>
        </div>
        <SubmitButton pendingLabel="Creating…">Create join link</SubmitButton>
      </form>
      <CrewLinkResult state={state} />
    </div>
  );
}
