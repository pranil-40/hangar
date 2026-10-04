import { beforeAll, describe, expect, it } from "vitest";
import {
  DEFAULT_COLLECTION_POLICY,
  allows,
  checkQuerySql,
  parseManifest,
  policyFor,
  readScope,
} from "./hosting/manifest";
import { isPrivateAddress, openSecret, parsePostgresUrl, queriesHash, sealSecret } from "./connectors";
import { isClaimableDomain, openPendingLogin, sealPendingLogin, validateIdToken } from "./google-auth";

beforeAll(() => {
  process.env.SESSION_SECRET = "test-secret-for-round-two";
});

describe("hangar.json collections", () => {
  it("defaults to: anyone reads and adds, only the author or an editor changes", () => {
    const { manifest } = parseManifest(null) as { ok: true; manifest: Parameters<typeof policyFor>[0] };
    expect(policyFor(manifest, "anything")).toEqual(DEFAULT_COLLECTION_POLICY);
    expect(allows("author", "VIEWER", false)).toBe(false);
    expect(allows("author", "VIEWER", true)).toBe(true);
    expect(allows("author", "EDITOR", false)).toBe(true);
  });

  it("lets a tool make approvals editor-only", () => {
    const result = parseManifest(JSON.stringify({ collections: { requests: { update: "editor", delete: "nobody" } } }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const policy = policyFor(result.manifest, "requests")!;
    expect(policy.create).toBe("anyone");
    expect(allows(policy.update, "VIEWER", true)).toBe(false);
    expect(allows(policy.update, "EDITOR", false)).toBe(true);
    expect(allows(policy.delete, "OWNER", true)).toBe(false);
  });

  it("refuses unlisted collections in strict mode", () => {
    const result = parseManifest(JSON.stringify({ strict: true, collections: { a: {} } }));
    expect(result.ok && policyFor(result.manifest, "b")).toBeNull();
  });

  it("scopes author-only reads to the caller's own records for viewers", () => {
    expect(readScope("author", "VIEWER", "u1")).toEqual({ createdById: "u1" });
    expect(readScope("author", "EDITOR", "u1")).toEqual({});
    expect(readScope("owner", "EDITOR", "u1")).toBeNull();
  });

  it("names the exact field in every error", () => {
    expect(parseManifest("{")).toEqual({ ok: false, error: "hangar.json is not valid JSON." });
    expect((parseManifest(JSON.stringify({ collections: { a: { write: "anyone" } } })) as { error: string }).error).toContain("collections.a.write");
    expect((parseManifest(JSON.stringify({ collections: { a: { update: "admins" } } })) as { error: string }).error).toContain("collections.a.update");
    expect((parseManifest(JSON.stringify({ colections: {} })) as { error: string }).error).toContain('unknown field "colections"');
  });
});

describe("hangar.json connectors", () => {
  it("accepts named read queries", () => {
    const result = parseManifest(JSON.stringify({ connectors: { "ops-db": { queries: { lowStock: "select sku from stock where qty < $1;" } } } }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.manifest.connectors["ops-db"].queries.lowStock).toBe("select sku from stock where qty < $1");
  });

  it("refuses writes and multiple statements", () => {
    expect(checkQuerySql("delete from stock")).toMatch(/read query/);
    expect(checkQuerySql("select 1; drop table stock")).toMatch(/single statement/);
    expect(checkQuerySql("WITH x AS (select 1) select * from x")).toBeNull();
    const bad = parseManifest(JSON.stringify({ connectors: { "ops-db": { queries: { wipe: "update stock set qty = 0" } } } }));
    expect(bad.ok).toBe(false);
  });

  it("fingerprints queries independent of order, and changes when SQL changes", () => {
    expect(queriesHash({ a: "select 1", b: "select 2" })).toBe(queriesHash({ b: "select 2", a: "select 1" }));
    expect(queriesHash({ a: "select 1" })).not.toBe(queriesHash({ a: "select 2" }));
  });
});

describe("connector safety", () => {
  it("round-trips sealed secrets and rejects tampering", () => {
    const sealed = sealSecret("postgresql://ro:pw@db.example.com/ops");
    expect(sealed).not.toContain("pw@");
    expect(openSecret(sealed)).toBe("postgresql://ro:pw@db.example.com/ops");
    const parts = sealed.split(".");
    parts[3] = Buffer.from("tampered").toString("base64url");
    expect(() => openSecret(parts.join("."))).toThrow();
  });

  it("recognises private and reserved addresses", () => {
    for (const address of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:10.0.0.1"]) {
      expect(isPrivateAddress(address)).toBe(true);
    }
    for (const address of ["8.8.8.8", "34.120.1.1", "2606:4700::1111"]) {
      expect(isPrivateAddress(address)).toBe(false);
    }
  });

  it("parses Postgres URLs and keeps TLS on unless disabled", () => {
    expect(parsePostgresUrl("postgresql://ro:p%40ss@db.example.com:6543/ops")).toEqual({
      host: "db.example.com", port: 6543, database: "ops", user: "ro", password: "p@ss", ssl: true,
    });
    expect((parsePostgresUrl("postgres://u:p@h/d?sslmode=disable") as { ssl: boolean }).ssl).toBe(false);
    expect(parsePostgresUrl("mysql://u:p@h/d")).toHaveProperty("error");
    expect(parsePostgresUrl("postgres://h/d")).toHaveProperty("error");
  });
});

describe("Google sign-in", () => {
  const token = (claims: Record<string, unknown>) =>
    `eyJhbGciOiJSUzI1NiJ9.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.sig`;
  const good = {
    iss: "https://accounts.google.com",
    aud: "client-1",
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: "n1",
    sub: "1234",
    email: "Jo@Acme.com",
    email_verified: true,
    name: "Jo Whitfield",
    hd: "acme.com",
  };

  it("accepts a valid token and normalises the email", () => {
    expect(validateIdToken(token(good), { clientId: "client-1", nonce: "n1" })).toEqual({
      subject: "1234", email: "jo@acme.com", name: "Jo Whitfield", hostedDomain: "acme.com",
    });
  });

  it("rejects the wrong issuer, audience, nonce, expiry and unverified email", () => {
    const expected = { clientId: "client-1", nonce: "n1" };
    for (const override of [
      { iss: "https://evil.example" },
      { aud: "someone-else" },
      { nonce: "replayed" },
      { exp: Math.floor(Date.now() / 1000) - 10 },
      { email_verified: false },
    ]) {
      expect(validateIdToken(token({ ...good, ...override }), expected)).toHaveProperty("error");
    }
  });

  it("seals the login state and refuses it once tampered or expired", () => {
    const sealed = sealPendingLogin({ state: "s", nonce: "n", verifier: "v", exp: Date.now() + 1000 });
    expect(openPendingLogin(sealed)?.state).toBe("s");
    expect(openPendingLogin(`${sealed}x`)).toBeNull();
    expect(openPendingLogin(sealed, Date.now() + 5000)).toBeNull();
  });

  it("never lets a personal-mail domain be claimed for auto-join", () => {
    expect(isClaimableDomain("acme.com")).toBe(true);
    expect(isClaimableDomain("gmail.com")).toBe(false);
    expect(isClaimableDomain("not a domain")).toBe(false);
  });
});
