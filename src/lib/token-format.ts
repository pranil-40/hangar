import { createHash, randomBytes } from "node:crypto";

/** Pure helpers for deploy tokens and bearer headers (no database access). */

export const DEPLOY_TOKEN_PREFIX = "hgr_";

export function generateDeployToken(): { token: string; prefix: string; tokenHash: string } {
  const token = DEPLOY_TOKEN_PREFIX + randomBytes(32).toString("base64url");
  return { token, prefix: token.slice(0, DEPLOY_TOKEN_PREFIX.length + 6), tokenHash: hashDeployToken(token) };
}

export function hashDeployToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function bearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
