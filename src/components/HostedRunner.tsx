"use client";

import { useState } from "react";
import { TOOL_SANDBOX } from "@/lib/hosting/runtime";

/**
 * Frames a hosted tool. The sandbox attribute deliberately omits
 * allow-same-origin: the tool gets an opaque origin, so it cannot touch
 * Hangar's cookies or pages even though it is served from Hangar. The
 * server sends the same sandbox as a CSP header. "Full screen" opens the
 * framed /open view rather than the bare tool, for the reason given there.
 */
export function HostedRunner({ appId }: { appId: string }) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const src = `/run/${appId}`;
  const fullScreen = `/open/${appId}`;

  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.5rem 0.75rem",
          borderBottom: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}
      >
        <span className="badge badge-success">Private to your team</span>
        <span className="subtle" style={{ fontSize: "0.78rem", flex: 1 }}>
          Sandboxed: it cannot see your Hangar session, and it can only talk to Hangar.
        </span>

        <button
          className="btn"
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
          onClick={() => {
            setLoaded(false);
            setReloadKey((key) => key + 1);
          }}
        >
          Reload
        </button>

        <a
          className="btn"
          style={{ padding: "0.25rem 0.6rem", fontSize: "0.78rem" }}
          href={fullScreen}
          target="_blank"
          rel="noopener noreferrer"
        >
          Full screen
        </a>
      </div>

      <div style={{ position: "relative", height: "68vh", minHeight: 440 }}>
        {!loaded && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "var(--surface)",
              pointerEvents: "none",
            }}
          >
            <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
              Loading the tool…
            </p>
          </div>
        )}

        <iframe
          key={reloadKey}
          src={src}
          title="Tool"
          onLoad={() => setLoaded(true)}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          sandbox={TOOL_SANDBOX}
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
