"use client";

import { useTransition } from "react";
import { ROLES, ROLE_LABELS, type Role } from "@/lib/permissions";

export function MemberRow({
  name,
  email,
  isCrew,
  role,
  isYou,
  canManage,
  onChangeRole,
  onRemove,
  extra,
}: {
  name: string;
  email: string | null;
  isCrew: boolean;
  role: Role;
  isYou: boolean;
  canManage: boolean;
  onChangeRole: (nextRole: string) => Promise<void>;
  onRemove: () => Promise<void>;
  extra?: React.ReactNode;
}) {
  const [pending, startTransition] = useTransition();

  // Server actions throw on the last-owner guard; surface that rather than
  // letting the rejection disappear into the console.
  function run(work: () => Promise<void>) {
    startTransition(async () => {
      try {
        await work();
      } catch (error) {
        window.alert(error instanceof Error ? error.message : "That change was not allowed.");
      }
    });
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.8rem",
        padding: "0.8rem 1rem",
        borderTop: "1px solid var(--border)",
        opacity: pending ? 0.55 : 1,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontWeight: 580, fontSize: "0.92rem" }}>
          {name}
          {isYou && (
            <span className="subtle" style={{ fontWeight: 400 }}>
              {" "}
              (you)
            </span>
          )}
        </div>
        <div className="subtle" style={{ fontSize: "0.8rem" }}>
          {isCrew ? "Crew · signs in from a join link, no email" : email}
        </div>
      </div>

      {canManage ? (
        <>
          <select
            className="select"
            style={{ width: "auto" }}
            value={role}
            disabled={pending}
            onChange={(event) => {
              const next = event.target.value;
              run(() => onChangeRole(next));
            }}
          >
            {ROLES.filter((value) => !isCrew || value !== "OWNER").map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </select>

          <button
            className="btn btn-danger"
            disabled={pending}
            onClick={() => {
              if (window.confirm(`Remove ${name} from this team?`)) run(onRemove);
            }}
          >
            Remove
          </button>
        </>
      ) : (
        <span className="badge">{ROLE_LABELS[role]}</span>
      )}
      {extra}
    </div>
  );
}
