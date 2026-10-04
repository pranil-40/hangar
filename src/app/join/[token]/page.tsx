import { redeemCrewLinkAction } from "@/app/actions/crew";
import { AuthShell } from "@/components/AuthShell";
import { SubmitButton } from "@/components/SubmitButton";
import { hashCrewToken } from "@/lib/crew";
import { db } from "@/lib/db";

/**
 * Where a crew member lands from their personal link. Viewing this page
 * spends nothing; the button does. See src/lib/crew.ts for why.
 */
export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const link = await db.crewLink.findUnique({
    where: { tokenHash: hashCrewToken(token) },
    select: { name: true, usedAt: true, expiresAt: true, team: { select: { name: true } } },
  });

  if (!link || link.usedAt || link.expiresAt < new Date()) {
    return (
      <AuthShell title="This link has already been used" subtitle="Each join link works once, on one phone.">
        <p className="muted" style={{ margin: 0, fontSize: "0.9rem" }}>
          Ask your manager for a new link. If you have used it before on this phone, open Hangar
          from your home screen or bookmarks instead.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={`Hi ${link.name}`} subtitle={`This link signs this phone in to ${link.team.name} on Hangar.`}>
      <form action={redeemCrewLinkAction.bind(null, token)} style={{ display: "grid", gap: "0.9rem" }}>
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          You will not need an email or a password. The link works once, so do not forward it.
          If this is not you, close this page.
        </p>
        <SubmitButton pendingLabel="Signing in…">Open {link.team.name}&rsquo;s tools</SubmitButton>
      </form>
    </AuthShell>
  );
}
