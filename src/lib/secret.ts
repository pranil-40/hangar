import { createHmac } from "node:crypto";

/**
 * SESSION_SECRET is the root of every signature Hangar issues. Each kind of
 * token signs with its own key derived from it, so a token minted for one
 * purpose can never be replayed as another. A tool's data token must not
 * work as a login cookie, even though both carry a user id.
 */
export function rootSecret(): string {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    throw new Error("SESSION_SECRET is not set. Copy .env.example to .env.");
  }
  if (process.env.NODE_ENV === "production" && value.startsWith("dev-only")) {
    throw new Error("Refusing to start in production with the example SESSION_SECRET.");
  }
  return value;
}

export function derivedKey(purpose: string): Buffer {
  return createHmac("sha256", rootSecret()).update(`hangar:${purpose}`).digest();
}
