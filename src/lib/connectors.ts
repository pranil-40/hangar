import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { Client } from "pg";
import { derivedKey } from "@/lib/secret";

/**
 * Connectors let a tool read a company database without ever holding its
 * credentials.
 *
 * An owner registers a Postgres connection once; the URL is sealed with
 * AES-256-GCM and never leaves the server. A tool declares the exact queries
 * it needs in hangar.json, an owner approves them, and from then on the tool
 * can run those queries by name, with parameters, and nothing else. Every
 * query runs in a READ ONLY transaction with a timeout and a row cap, and
 * every call is logged with who made it.
 */

// ------------------------------------------------------------ sealed secrets

const key = () => derivedKey("connector-secrets");

/** Format v1.<iv>.<tag>.<ciphertext>, base64url. */
export function sealSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return ["v1", iv, cipher.getAuthTag(), body].map((part) => (typeof part === "string" ? part : part.toString("base64url"))).join(".");
}

export function openSecret(sealed: string): string {
  const [version, iv, tag, body] = sealed.split(".");
  if (version !== "v1" || !iv || !tag || !body) throw new Error("Unreadable connector secret.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(body, "base64url")), decipher.final()]).toString("utf8");
}

// ------------------------------------------------------------ approvals

/** Fingerprint of the queries an owner approved, so a changed query needs a new approval. */
export function queriesHash(queries: Record<string, string>): string {
  const canonical = JSON.stringify(Object.keys(queries).sort().map((name) => [name, queries[name]]));
  return createHash("sha256").update(canonical).digest("hex");
}

// ------------------------------------------------------------ target safety

/** Loopback, private, link-local, CGNAT, benchmark, multicast and reserved ranges. */
export function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const [a, b] = address.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    const lower = address.toLowerCase();
    if (lower === "::" || lower === "::1") return true;
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(lower);
    if (mapped) return isPrivateAddress(mapped[1]);
    return /^(fc|fd|fe[89ab]|ff)/.test(lower);
  }
  return true;
}

/**
 * Private targets are refused unless explicitly allowed for local
 * development, and never in production: a hosted Hangar must not become a
 * way to reach its own network.
 */
export function privateTargetsAllowed(): boolean {
  return process.env.HANGAR_ALLOW_PRIVATE_CONNECTORS === "1" && process.env.NODE_ENV !== "production";
}

export type PostgresTarget = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export function parsePostgresUrl(raw: string): PostgresTarget | { error: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return { error: "That is not a valid connection URL." };
  }
  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    return { error: "Use a postgres:// or postgresql:// URL." };
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!host || !database || !url.username) return { error: "The URL needs a host, a user and a database name." };
  const sslmode = url.searchParams.get("sslmode");
  return {
    host,
    port: url.port ? Number(url.port) : 5432,
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: sslmode !== "disable",
  };
}

async function resolveSafely(host: string): Promise<string> {
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (addresses.length === 0) throw new ConnectorError("The database host does not resolve.", 502);
  if (!privateTargetsAllowed() && addresses.some((entry) => isPrivateAddress(entry.address))) {
    throw new ConnectorError("The database host resolves to a private network address, which Hangar will not connect to.", 502);
  }
  return addresses[0].address;
}

// ------------------------------------------------------------ running a query

export const QUERY_LIMITS = { timeoutMs: 5_000, maxRows: 1_000, maxParams: 20 };

export type QueryResult = { columns: string[]; rows: Record<string, unknown>[]; truncated: boolean };

/**
 * DNS is resolved once and the socket goes to the address that was checked,
 * so a rebinding DNS server cannot swap in an internal IP afterwards; TLS is
 * still verified against the real hostname.
 */
export async function runReadOnlyQuery(target: PostgresTarget, sql: string, params: unknown[]): Promise<QueryResult> {
  const address = await resolveSafely(target.host);
  const client = new Client({
    host: address,
    port: target.port,
    database: target.database,
    user: target.user,
    password: target.password,
    ssl: target.ssl ? { servername: isIP(target.host) ? undefined : target.host, rejectUnauthorized: true } : false,
    connectionTimeoutMillis: QUERY_LIMITS.timeoutMs,
    statement_timeout: QUERY_LIMITS.timeoutMs,
    query_timeout: QUERY_LIMITS.timeoutMs + 1_000,
    application_name: "hangar-connector",
  });

  await client.connect();
  try {
    await client.query("BEGIN READ ONLY");
    await client.query(`SET LOCAL statement_timeout = ${QUERY_LIMITS.timeoutMs}`);
    // Parameterised queries use the extended protocol, which refuses more
    // than one statement, and the subquery wrapper caps the rows returned.
    const result = await client.query({
      text: `SELECT * FROM (${sql}) AS hangar_query LIMIT ${QUERY_LIMITS.maxRows + 1}`,
      values: params,
    });
    await client.query("ROLLBACK");
    const truncated = result.rows.length > QUERY_LIMITS.maxRows;
    return {
      columns: result.fields.map((field) => field.name),
      rows: truncated ? result.rows.slice(0, QUERY_LIMITS.maxRows) : result.rows,
      truncated,
    };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    const message = (error as { message?: string }).message ?? "Query failed.";
    throw new ConnectorError(`The database refused the query: ${message}`, 400);
  } finally {
    await client.end().catch(() => {});
  }
}

export class ConnectorError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}
