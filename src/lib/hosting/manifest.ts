import type { Role } from "@/lib/permissions";

/**
 * hangar.json: what a tool declares about itself, validated at deploy time.
 *
 *   {
 *     "collections": { "requests": { "update": "editor", "delete": "editor" } },
 *     "connectors": { "ops-db": { "queries": { "lowStock": "select sku, qty from stock where qty < $1" } } }
 *   }
 *
 * Collections: who may read, add, change and remove records, enforced on the
 * server. Without a rule, everyone on the team can read and add, and only a
 * record's author (or an editor or owner) can change or remove it, so a
 * viewer cannot rewrite someone else's record from the browser console.
 *
 * Connectors: the exact read-only queries the tool wants to run against a
 * company database. They do nothing until an owner approves them, and a
 * deploy that changes them needs approval again.
 */

export const RECORD_ACTIONS = ["read", "create", "update", "delete"] as const;
export type RecordAction = (typeof RECORD_ACTIONS)[number];

export const RECORD_RULES = ["anyone", "author", "editor", "owner", "nobody"] as const;
export type RecordRule = (typeof RECORD_RULES)[number];

export type CollectionPolicy = Record<RecordAction, RecordRule>;

export type ToolManifest = {
  collections: Record<string, CollectionPolicy>;
  /** When true, collections not listed above are refused entirely. */
  strict: boolean;
  connectors: Record<string, { queries: Record<string, string> }>;
};

export const DEFAULT_COLLECTION_POLICY: CollectionPolicy = {
  read: "anyone",
  create: "anyone",
  update: "author",
  delete: "author",
};

export const EMPTY_MANIFEST: ToolManifest = { collections: {}, strict: false, connectors: {} };

export const MANIFEST_FILE = "hangar.json";

const RANK: Record<Role, number> = { VIEWER: 0, EDITOR: 1, OWNER: 2 };
const NAME = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;
const SLUG = /^[a-z0-9][a-z0-9-]{0,39}$/;

export function policyFor(manifest: ToolManifest, collection: string): CollectionPolicy | null {
  const declared = manifest.collections[collection];
  if (declared) return declared;
  return manifest.strict ? null : DEFAULT_COLLECTION_POLICY;
}

/** isAuthor: whether the caller wrote the record being changed. */
export function allows(rule: RecordRule, role: Role, isAuthor: boolean): boolean {
  switch (rule) {
    case "anyone":
      return true;
    case "author":
      return isAuthor || RANK[role] >= RANK.EDITOR;
    case "editor":
      return RANK[role] >= RANK.EDITOR;
    case "owner":
      return role === "OWNER";
    case "nobody":
      return false;
  }
}

/**
 * For listing: null means the caller may see nothing, {} means everything,
 * and { createdById } limits viewers to their own records when read is
 * "author".
 */
export function readScope(rule: RecordRule, role: Role, userId: string): { createdById?: string } | null {
  if (rule === "author") return RANK[role] >= RANK.EDITOR ? {} : { createdById: userId };
  return allows(rule, role, false) ? {} : null;
}

/**
 * Only plain read queries are accepted. The connector also runs them inside
 * a READ ONLY transaction with a timeout, so this check is for clear errors
 * at deploy time rather than the security boundary.
 */
export function checkQuerySql(sql: string): string | null {
  const trimmed = sql.trim().replace(/;\s*$/, "");
  if (trimmed.length === 0 || trimmed.length > 10_000) return "must be between 1 and 10,000 characters";
  if (trimmed.includes(";")) return "must be a single statement";
  if (!/^(select|with|values|table)\b/i.test(trimmed)) return "must be a read query (SELECT, WITH, VALUES or TABLE)";
  return null;
}

export type ManifestResult = { ok: true; manifest: ToolManifest } | { ok: false; error: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Validates hangar.json. Every error names the field, so an agent can fix it. */
export function parseManifest(text: string | null): ManifestResult {
  if (text === null) return { ok: true, manifest: EMPTY_MANIFEST };

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: "hangar.json is not valid JSON." };
  }
  if (!isObject(raw)) return { ok: false, error: "hangar.json must be a JSON object." };

  const known = new Set(["collections", "strict", "connectors", "$schema"]);
  for (const key of Object.keys(raw)) {
    if (!known.has(key)) return { ok: false, error: `hangar.json: unknown field "${key.slice(0, 40)}".` };
  }

  const manifest: ToolManifest = { collections: {}, strict: false, connectors: {} };

  if (raw.collections !== undefined) {
    if (!isObject(raw.collections)) return { ok: false, error: 'hangar.json: "collections" must be an object.' };
    const entries = Object.entries(raw.collections);
    if (entries.length > 50) return { ok: false, error: "hangar.json: at most 50 collections." };
    for (const [name, rules] of entries) {
      if (!NAME.test(name)) return { ok: false, error: `hangar.json: "${name.slice(0, 40)}" is not a valid collection name.` };
      if (!isObject(rules)) return { ok: false, error: `hangar.json: collections.${name} must be an object.` };
      const policy: CollectionPolicy = { ...DEFAULT_COLLECTION_POLICY };
      for (const [action, rule] of Object.entries(rules)) {
        if (!(RECORD_ACTIONS as readonly string[]).includes(action)) {
          return { ok: false, error: `hangar.json: collections.${name}.${action.slice(0, 20)} must be one of ${RECORD_ACTIONS.join(", ")}.` };
        }
        if (typeof rule !== "string" || !(RECORD_RULES as readonly string[]).includes(rule)) {
          return { ok: false, error: `hangar.json: collections.${name}.${action} must be one of ${RECORD_RULES.join(", ")}.` };
        }
        policy[action as RecordAction] = rule as RecordRule;
      }
      manifest.collections[name] = policy;
    }
  }

  if (raw.strict !== undefined) {
    if (typeof raw.strict !== "boolean") return { ok: false, error: 'hangar.json: "strict" must be true or false.' };
    manifest.strict = raw.strict;
  }

  if (raw.connectors !== undefined) {
    if (!isObject(raw.connectors)) return { ok: false, error: 'hangar.json: "connectors" must be an object.' };
    const connectors = Object.entries(raw.connectors);
    if (connectors.length > 10) return { ok: false, error: "hangar.json: at most 10 connectors." };
    for (const [slug, spec] of connectors) {
      if (!SLUG.test(slug)) return { ok: false, error: `hangar.json: connector "${slug.slice(0, 40)}" must be lowercase letters, numbers and dashes.` };
      if (!isObject(spec) || !isObject(spec.queries)) {
        return { ok: false, error: `hangar.json: connectors.${slug} needs a "queries" object.` };
      }
      const queries: Record<string, string> = {};
      const entries = Object.entries(spec.queries);
      if (entries.length === 0 || entries.length > 50) return { ok: false, error: `hangar.json: connectors.${slug} needs 1 to 50 queries.` };
      for (const [name, sql] of entries) {
        if (!NAME.test(name)) return { ok: false, error: `hangar.json: "${name.slice(0, 40)}" is not a valid query name.` };
        if (typeof sql !== "string") return { ok: false, error: `hangar.json: connectors.${slug}.queries.${name} must be a SQL string.` };
        const problem = checkQuerySql(sql);
        if (problem) return { ok: false, error: `hangar.json: connectors.${slug}.queries.${name} ${problem}.` };
        queries[name] = sql.trim().replace(/;\s*$/, "");
      }
      manifest.connectors[slug] = { queries };
    }
  }

  return { ok: true, manifest };
}

/** Stored manifests were validated at deploy; this only guards against old rows. */
export function readStoredManifest(json: string | null | undefined): ToolManifest {
  if (!json) return EMPTY_MANIFEST;
  try {
    const parsed = JSON.parse(json) as Partial<ToolManifest>;
    return {
      collections: parsed.collections ?? {},
      strict: parsed.strict === true,
      connectors: parsed.connectors ?? {},
    };
  } catch {
    return EMPTY_MANIFEST;
  }
}
