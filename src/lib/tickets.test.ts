import { beforeAll, describe, expect, it } from "vitest";
import { TICKET_TTL_MS, issueTicket, readTicket } from "./tickets";
import { __testing as session } from "./session";
import { bearerToken, generateDeployToken, hashDeployToken } from "./token-format";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-for-tickets";
});

describe("tickets", () => {
  it("round-trips claims for their own kind", () => {
    const token = issueTicket("tool", { appId: "a1", userId: "u1" });
    expect(readTicket("tool", token)).toEqual({ appId: "a1", userId: "u1" });
  });

  it("are not interchangeable between kinds", () => {
    const tool = issueTicket("tool", { appId: "a1", userId: "u1" });
    const asset = issueTicket("asset", { deploymentId: "d1", userId: "u1" });
    expect(readTicket("asset", tool)).toBeNull();
    expect(readTicket("tool", asset)).toBeNull();
  });

  it("can never be replayed as a login cookie, or vice versa", () => {
    const tool = issueTicket("tool", { appId: "a1", userId: "u1" });
    expect(session.decode(tool)).toBeNull();
    const cookie = session.encode("u1");
    expect(readTicket("tool", cookie)).toBeNull();
  });

  it("expire", () => {
    const issuedAt = Date.now();
    const token = issueTicket("tool", { appId: "a1", userId: "u1" }, issuedAt);
    expect(readTicket("tool", token, issuedAt + TICKET_TTL_MS - 1)).not.toBeNull();
    expect(readTicket("tool", token, issuedAt + TICKET_TTL_MS + 1)).toBeNull();
  });

  it("reject tampering", () => {
    const token = issueTicket("tool", { appId: "a1", userId: "u1" });
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ appId: "a2", userId: "u1", k: "tool", exp: Date.now() + 1e6 })).toString("base64url");
    expect(readTicket("tool", `${forged}.${signature}`)).toBeNull();
    expect(readTicket("tool", `${payload}.${signature}x`)).toBeNull();
    expect(readTicket("tool", `${payload}.${signature}.extra`)).toBeNull();
  });
});

describe("deploy tokens", () => {
  it("are random, prefixed, and stored only as a hash", () => {
    const a = generateDeployToken();
    const b = generateDeployToken();
    expect(a.token).toMatch(/^hgr_[A-Za-z0-9_-]{43}$/);
    expect(a.token).not.toBe(b.token);
    expect(a.tokenHash).toBe(hashDeployToken(a.token));
    expect(a.tokenHash).not.toContain(a.token.slice(4));
    expect(a.token.startsWith(a.prefix)).toBe(true);
  });

  it("parse only well-formed bearer headers", () => {
    expect(bearerToken("Bearer hgr_abc")).toBe("hgr_abc");
    expect(bearerToken("bearer   hgr_abc ")).toBe("hgr_abc");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken("Bearer a b")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
