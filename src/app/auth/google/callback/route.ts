import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { STATE_COOKIE, googleConfig, openPendingLogin, validateIdToken } from "@/lib/google-auth";
import { createSession } from "@/lib/session";
import { appUrl } from "@/lib/urls";

/**
 * GET /auth/google/callback: finish "Continue with Google".
 *
 * Links by Google's stable subject id first, then by verified email (so an
 * existing password account gains Google sign-in), else creates an account.
 * Then joins any team whose owner turned on auto-join for this Google
 * Workspace domain. Personal Gmail accounts carry no domain and join
 * nothing automatically.
 */

// Built by hand rather than with Response.redirect, whose headers are
// immutable, so the session cookie set below can be attached.
function redirectTo(path: string): Response {
  return new Response(null, { status: 303, headers: { Location: appUrl(path), "Cache-Control": "no-store" } });
}

function back(error: string): Response {
  return redirectTo(`/login?error=${encodeURIComponent(error)}`);
}

export async function GET(request: Request) {
  const config = googleConfig();
  if (!config) return back("Google sign-in is not configured.");

  const url = new URL(request.url);
  const store = await cookies();
  const pending = openPendingLogin(store.get(STATE_COOKIE)?.value);
  store.delete({ name: STATE_COOKIE, path: "/auth/google" });

  if (url.searchParams.get("error")) return back("Google sign-in was cancelled.");
  const code = url.searchParams.get("code");
  if (!pending || !code || url.searchParams.get("state") !== pending.state) {
    return back("That sign-in link expired. Try again.");
  }

  if (process.env.NODE_ENV === "production" && !config.tokenUrl.startsWith("https://")) {
    return back("Google sign-in is misconfigured.");
  }

  let tokens: { id_token?: unknown };
  try {
    const response = await fetch(config.tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: appUrl("/auth/google/callback"),
        grant_type: "authorization_code",
        code_verifier: pending.verifier,
      }),
    });
    if (!response.ok) return back("Google did not accept the sign-in. Try again.");
    tokens = await response.json();
  } catch {
    return back("Could not reach Google. Try again.");
  }

  const identity = validateIdToken(tokens.id_token, { clientId: config.clientId, nonce: pending.nonce });
  if ("error" in identity) return back(identity.error);

  let user = await db.user.findUnique({ where: { googleSub: identity.subject }, select: { id: true } });
  if (!user) {
    const byEmail = await db.user.findUnique({ where: { email: identity.email }, select: { id: true, googleSub: true } });
    if (byEmail?.googleSub) {
      // The address now belongs to a different Google account than the one
      // that first linked it (an admin can reassign addresses). Never let
      // the new holder inherit the old account.
      return back("This email is linked to a different Google account. Sign in with your password instead.");
    }
    // Password signups are not email-verified, so someone could have
    // registered this address first with a password they know. Google has
    // just proven who owns it: link the account and drop that password.
    user = byEmail
      ? await db.user.update({ where: { id: byEmail.id }, data: { googleSub: identity.subject, passwordHash: null }, select: { id: true } })
      : await db.user.create({
          data: { email: identity.email, name: identity.name, googleSub: identity.subject },
          select: { id: true },
        });
  }

  if (identity.hostedDomain) {
    const teams = await db.team.findMany({ where: { autoJoinDomain: identity.hostedDomain }, select: { id: true } });
    for (const team of teams) {
      const existing = await db.membership.findUnique({
        where: { userId_teamId: { userId: user.id, teamId: team.id } },
        select: { id: true },
      });
      if (existing) continue;
      await db.membership.create({ data: { userId: user.id, teamId: team.id, role: "VIEWER" } });
      await db.auditEvent.create({
        data: { teamId: team.id, actorId: user.id, action: "member.auto_join", detail: JSON.stringify({ email: identity.email }) },
      });
    }
  }

  await createSession(user.id);
  return redirectTo("/teams");
}
