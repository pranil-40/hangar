"use client";

import { useState, useTransition } from "react";
import type { CrewLinkState } from "@/app/actions/crew";
import { CrewLinkResult } from "./CrewForm";

/** For a crew member on a new phone: a fresh link to the same account. */
export function DeviceLinkButton({ action }: { action: () => Promise<CrewLinkState> }) {
  const [state, setState] = useState<CrewLinkState>({});
  const [pending, startTransition] = useTransition();

  return (
    <div style={{ display: "grid", gap: "0.5rem", flexBasis: "100%" }}>
      <div>
        <button
          type="button"
          className="btn"
          disabled={pending}
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
          onClick={() => startTransition(async () => setState(await action()))}
        >
          {pending ? "Creating…" : "New phone link"}
        </button>
      </div>
      <CrewLinkResult state={state} />
    </div>
  );
}
