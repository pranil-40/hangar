"use client";

import { useActionState, useState } from "react";
import { SubmitButton } from "@/components/SubmitButton";
import type { UploadState } from "@/app/actions/upload";
import { UPLOAD_BUILDERS } from "@/lib/hosting/builders";

export function UploadForm({ action }: { action: (prev: UploadState, formData: FormData) => Promise<UploadState> }) {
  const [state, formAction] = useActionState(action, {});
  const [mode, setMode] = useState<"paste" | "files">("paste");

  return (
    <form action={formAction} style={{ display: "grid", gap: "0.9rem" }}>
      {state.error && (
        <div className="alert-error">
          {state.error}
          {state.details && state.details.length > 0 && (
            <ul style={{ margin: "0.4rem 0 0", paddingLeft: "1.1rem" }}>
              {state.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
        <div style={{ flex: "2 1 220px" }}>
          <label className="label" htmlFor="upload-name">Name</label>
          <input className="input" id="upload-name" name="name" placeholder="Opening checklist" required />
        </div>
        <div style={{ flex: "1 1 140px" }}>
          <label className="label" htmlFor="upload-builder">Built with</label>
          <select className="select" id="upload-builder" name="builder" defaultValue="ChatGPT">
            {UPLOAD_BUILDERS.map((builder) => (
              <option key={builder} value={builder}>{builder}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="label" htmlFor="upload-description">What is it for?</label>
        <input className="input" id="upload-description" name="description" placeholder="Morning crew ticks off each step before doors open." />
      </div>

      <div style={{ display: "flex", gap: "0.4rem" }}>
        <button type="button" className={mode === "paste" ? "btn btn-primary" : "btn"} onClick={() => setMode("paste")}>
          Paste HTML
        </button>
        <button type="button" className={mode === "files" ? "btn btn-primary" : "btn"} onClick={() => setMode("files")}>
          Upload files
        </button>
      </div>

      {mode === "paste" ? (
        <div>
          <textarea
            className="textarea"
            name="html"
            rows={8}
            placeholder="<!doctype html>…  (the whole page your AI gave you)"
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}
          />
          <p className="hint">
            Ask your AI for &ldquo;one self-contained HTML file with no external scripts, styles or
            fonts&rdquo;. To save data or know who is using it, tell it to use <code>window.hangar</code>{" "}
            (see the guide below).
          </p>
        </div>
      ) : (
        <div>
          <input className="input" type="file" name="files" multiple accept=".html,.htm,.js,.mjs,.css,.json,.svg,.png,.jpg,.jpeg,.gif,.webp,.ico,.woff,.woff2" />
          <p className="hint">Choose index.html and every file it loads, all from the same folder.</p>
        </div>
      )}

      <div>
        <SubmitButton pendingLabel="Deploying…">Deploy to the team</SubmitButton>
      </div>
    </form>
  );
}
