"use client";

import { useState } from "react";

/**
 * Third-party pages cannot be inspected cross-origin, so we cannot reliably
 * detect a refused frame from JavaScript. Instead of guessing, the "open in
 * a new tab" escape hatch is always visible — the failure mode we care about
 * is a non-technical user staring at a blank rectangle with no way out.
 */
export function AppRunner({
  url,
  embeddable,
  reason,
}: {
  url: string;
  embeddable: boolean;
  reason?: string;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [loaded, setLoaded] = useState(false);

  if (!embeddable) {
    return (
      <div className="card" style={{ padding: "2.5rem", textAlign: "center" }}>
        <p style={{ margin: "0 0 0.4rem", fontWeight: 600 }}>Opens in a new tab</p>
        <p className="muted" style={{ margin: "0 0 1.2rem", fontSize: "0.9rem" }}>
          {reason ?? "This tool cannot be displayed inside Hangar."}
        </p>
        <a className="btn btn-primary" href={url} target="_blank" rel="noopener noreferrer">
          Open tool
        </a>
      </div>
    );
  }

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
        <span
          className="subtle"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: "0.75rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {url}
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
          href={url}
          target="_blank"
          rel="noopener noreferrer"
        >
          New tab
        </a>
      </div>

      {/* A hosted tool can take several seconds to wake. Without this the
          user is left looking at an empty rectangle wondering if it broke. */}
      <div style={{ position: "relative", height: "62vh", minHeight: 420 }}>
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
            <div style={{ textAlign: "center" }}>
              <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
                Starting the tool…
              </p>
              <p className="subtle" style={{ margin: "0.2rem 0 0", fontSize: "0.78rem" }}>
                If nothing appears, open it in a new tab.
              </p>
            </div>
          </div>
        )}

        <iframe
          key={reloadKey}
          src={url}
          title="Tool"
          onLoad={() => setLoaded(true)}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          sandbox="allow-scripts allow-forms allow-popups allow-modals allow-same-origin allow-downloads"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
