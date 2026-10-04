import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { derivedKey } from "@/lib/secret";

/**
 * Sign in with Google (OpenID Connect, authorization code flow with PKCE).
 *
 * The ID token is received directly from Google's token endpoint over TLS
 * in exchange for our client secret, so per OpenID Connect Core 3.1.3.7 the
 * TLS server validation stands in for checking its signature. Every claim
 * that matters is still checked: issuer, audience, expiry, nonce, and that
 * Google has verified the email address.
 *
 * Endpoints are overridable so the flow can be exercised end to end against
 * a local stand-in (see e2e/), never in production.
 */

export const STATE_COOKIE = "hangar_oauth";
const STATE_TTL_MS = 10 * 60 * 1000;
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    authorizeUrl: process.env.GOOGLE_AUTHORIZE_URL ?? "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token",
  };
}

type PendingLogin = { state: string; nonce: string; verifier: string; exp: number };

function sign(payload: string): string {
  return createHmac("sha256", derivedKey("oauth-state")).update(payload).digest("base64url");
}

export function sealPendingLogin(pending: PendingLogin): string {
  const payload = Buffer.from(JSON.stringify(pending)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function openPendingLogin(sealed: string | undefined, now = Date.now()): PendingLogin | null {
  if (!sealed) return null;
  const [payload, signature] = sealed.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as PendingLogin;
    if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function beginLogin(redirectUri: string, now = Date.now()) {
  const config = googleConfig();
  if (!config) throw new Error("Google sign-in is not configured.");

  const pending: PendingLogin = {
    state: randomBytes(16).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    exp: now + STATE_TTL_MS,
  };
  const url = new URL(config.authorizeUrl);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", pending.state);
  url.searchParams.set("nonce", pending.nonce);
  url.searchParams.set("code_challenge", createHash("sha256").update(pending.verifier).digest("base64url"));
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return { url: url.toString(), cookie: sealPendingLogin(pending) };
}

export type GoogleIdentity = {
  subject: string;
  email: string;
  name: string;
  /** Google Workspace domain; absent for personal Gmail accounts. */
  hostedDomain: string | null;
};

export function validateIdToken(
  idToken: unknown,
  expected: { clientId: string; nonce: string },
  now = Date.now(),
): GoogleIdentity | { error: string } {
  if (typeof idToken !== "string" || idToken.split(".").length !== 3) {
    return { error: "Google did not return an ID token." };
  }
  let claims: Record<string, unknown>;
  try {
    claims = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString());
  } catch {
    return { error: "Google returned an unreadable ID token." };
  }

  if (!ISSUERS.has(String(claims.iss))) return { error: "ID token has the wrong issuer." };
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!audience.includes(expected.clientId)) return { error: "ID token is for a different app." };
  if (typeof claims.exp !== "number" || claims.exp * 1000 < now) return { error: "ID token has expired." };
  if (claims.nonce !== expected.nonce) return { error: "Sign-in could not be verified. Try again." };
  if (claims.email_verified !== true || typeof claims.email !== "string") {
    return { error: "Google has not verified that email address." };
  }
  if (typeof claims.sub !== "string") return { error: "ID token has no subject." };

  const email = claims.email.trim().toLowerCase();
  return {
    subject: claims.sub,
    email,
    name: typeof claims.name === "string" && claims.name.trim() ? claims.name.trim().slice(0, 80) : email.split("@")[0],
    hostedDomain: typeof claims.hd === "string" ? claims.hd.toLowerCase() : null,
  };
}

/**
 * Personal-mail domains can never be claimed for auto-join: "anyone with a
 * gmail.com address" is not a team.
 */
const PUBLIC_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com",
  "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com", "gmx.com", "yandex.com",
]);

export function isClaimableDomain(domain: string): boolean {
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(domain) && !PUBLIC_DOMAINS.has(domain);
}
