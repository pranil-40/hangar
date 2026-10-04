import { createHmac, timingSafeEqual } from "node:crypto";
import { derivedKey } from "@/lib/secret";

/**
 * Short-lived signed claims handed to a running tool.
 *
 * "tool" tickets authenticate the tool data API as one viewer of one tool.
 * "asset" tickets form the path prefix a tool's static files are served
 * from, so the files are only reachable by someone who was just shown the
 * tool, and only for a few hours.
 *
 * Both are checked against the database on every use as well, so removing
 * someone from the team cuts them off immediately rather than at expiry.
 */

export type TicketKind = "tool" | "asset";

export type ToolClaims = { appId: string; userId: string };
export type AssetClaims = { deploymentId: string; userId: string };

type ClaimsFor<K extends TicketKind> = K extends "tool" ? ToolClaims : AssetClaims;

export const TICKET_TTL_MS = 8 * 60 * 60 * 1000;

function sign(kind: TicketKind, payload: string): string {
  return createHmac("sha256", derivedKey(`ticket:${kind}`)).update(payload).digest("base64url");
}

export function issueTicket<K extends TicketKind>(
  kind: K,
  claims: ClaimsFor<K>,
  now: number = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({ ...claims, k: kind, exp: now + TICKET_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${sign(kind, payload)}`;
}

export function readTicket<K extends TicketKind>(
  kind: K,
  token: string,
  now: number = Date.now(),
): ClaimsFor<K> | null {
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(kind, payload));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
  } catch {
    return null;
  }
  if (parsed.k !== kind) return null;
  if (typeof parsed.exp !== "number" || parsed.exp < now) return null;
  if (typeof parsed.userId !== "string") return null;

  if (kind === "tool") {
    if (typeof parsed.appId !== "string") return null;
    return { appId: parsed.appId, userId: parsed.userId } as ClaimsFor<K>;
  }
  if (typeof parsed.deploymentId !== "string") return null;
  return { deploymentId: parsed.deploymentId, userId: parsed.userId } as ClaimsFor<K>;
}
