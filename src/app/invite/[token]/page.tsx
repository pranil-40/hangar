import Link from "next/link";
import { acceptInviteAction } from "@/app/actions/members";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/guard";
import { ROLE_LABELS, isRole } from "@/lib/permissions";
import { AuthShell } from "@/components/AuthShell";
import { SubmitButton } from "@/components/SubmitButton";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const invite = await db.invite.findUnique({
    where: { token },
    select: {
      email: true,
      role: true,
      expiresAt: true,
      acceptedAt: true,
      team: { select: { name: true } },
    },
  });

  if (!invite) {
    return (
      <AuthShell title="Invitation not found" subtitle="This link is not valid.">
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Ask whoever invited you to send a new one.
        </p>
      </AuthShell>
    );
  }

  const expired = invite.expiresAt < new Date();
  const used = Boolean(invite.acceptedAt);

  if (expired || used) {
    return (
      <AuthShell
        title={used ? "Already accepted" : "Invitation expired"}
        subtitle={`For ${invite.team.name}.`}
      >
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
          {used
            ? "This invitation has already been used."
            : "This invitation is no longer valid. Ask for a fresh link."}
        </p>
        <Link href="/login" className="btn btn-primary">
          Go to sign in
        </Link>
      </AuthShell>
    );
  }

  const user = await getCurrentUser();
  const role = isRole(invite.role) ? ROLE_LABELS[invite.role] : invite.role;

  if (!user) {
    return (
      <AuthShell
        title={`Join ${invite.team.name}`}
        subtitle={`You've been invited as ${role.toLowerCase()}.`}
      >
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
          Sign in as <strong>{invite.email}</strong> to accept, then open this link again.
        </p>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <Link href="/signup" className="btn btn-primary" style={{ flex: 1 }}>
            Create account
          </Link>
          <Link href="/login" className="btn" style={{ flex: 1 }}>
            Sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (user.email !== invite.email) {
    return (
      <AuthShell title="Wrong account" subtitle={`For ${invite.team.name}.`}>
        <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
          This invitation was sent to <strong>{invite.email}</strong>, but you are signed in
          as <strong>{user.email}</strong>.
        </p>
        <Link href="/login" className="btn">
          Sign in as someone else
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Join ${invite.team.name}`}
      subtitle={`You've been invited as ${role.toLowerCase()}.`}
    >
      <form action={acceptInviteAction.bind(null, token)}>
        <SubmitButton pendingLabel="Joining…" className="btn btn-primary">
          Accept invitation
        </SubmitButton>
      </form>
    </AuthShell>
  );
}
