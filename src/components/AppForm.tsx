"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import { PLATFORMS, PLATFORM_META, detectPlatform } from "@/lib/platforms";

type State = { error?: string };

export function AppForm({
  action,
  defaults,
  submitLabel,
}: {
  action: (prev: State, formData: FormData) => Promise<State>;
  defaults?: { name: string; description: string | null; url: string; platform: string };
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const [url, setUrl] = useState(defaults?.url ?? "");
  const [platform, setPlatform] = useState(defaults?.platform ?? "OTHER");
  const [platformTouched, setPlatformTouched] = useState(Boolean(defaults));

  // Guess the platform as they paste, but stop guessing once they choose.
  function onUrlChange(next: string) {
    setUrl(next);
    if (!platformTouched && next.trim()) {
      setPlatform(detectPlatform(next.trim()));
    }
  }

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.9rem" }}>
      {state.error && <p className="alert-error">{state.error}</p>}

      <div>
        <label className="label" htmlFor="url">
          Link to the tool
        </label>
        <input
          className="input"
          id="url"
          name="url"
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://my-tool.lovable.app"
          required
        />
        <p className="hint">
          Wherever it already runs — Lovable, Replit, Bolt, v0 or your own domain.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="name">
          Name
        </label>
        <input
          className="input"
          id="name"
          name="name"
          defaultValue={defaults?.name}
          placeholder="Invoice chaser"
          required
        />
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
          defaultValue={defaults?.description ?? ""}
          placeholder="Flags invoices that are more than 30 days overdue."
        />
      </div>

      <div>
        <label className="label" htmlFor="platform">
          Built with
        </label>
        <select
          className="select"
          id="platform"
          name="platform"
          value={platform}
          onChange={(event) => {
            setPlatform(event.target.value);
            setPlatformTouched(true);
          }}
        >
          {PLATFORMS.map((value) => (
            <option key={value} value={value}>
              {PLATFORM_META[value].label}
            </option>
          ))}
        </select>
      </div>

      <SubmitButton pendingLabel="Saving…">{submitLabel}</SubmitButton>
    </form>
  );
}
