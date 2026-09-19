"use client";

import { useFormStatus } from "react-dom";

/**
 * Destructive actions confirm before submitting. The check runs on the
 * button rather than the form so a keyboard submit cannot skip it.
 */
export function ConfirmButton({
  children,
  message,
  className = "btn btn-danger",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={className}
      disabled={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}
