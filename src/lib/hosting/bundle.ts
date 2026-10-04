import { createHash } from "node:crypto";

/**
 * Turning an uploaded set of files into something safe to store and serve.
 *
 * Small software is small: a built single-page tool is usually well under a
 * megabyte. The limits below are generous for that and also keep a deploy
 * inside a single serverless request body (Vercel caps those at 4.5 MB,
 * and base64 adds a third).
 */

export const LIMITS = {
  maxFiles: 500,
  maxTotalBytes: 3 * 1024 * 1024,
  maxFileBytes: 2 * 1024 * 1024,
  maxPathLength: 200,
} as const;

export const ENTRY = "index.html";

export type BundleFile = {
  path: string;
  bytes: Buffer;
  contentType: string;
  sha256: string;
};

const CONTENT_TYPES: Record<string, string> = {
  html: "text/html; charset=utf-8",
  htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8",
  mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json; charset=utf-8",
  map: "application/json; charset=utf-8",
  webmanifest: "application/manifest+json; charset=utf-8",
  txt: "text/plain; charset=utf-8",
  csv: "text/csv; charset=utf-8",
  md: "text/plain; charset=utf-8",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  wasm: "application/wasm",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  webm: "video/webm",
  pdf: "application/pdf",
};

export function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf(".");
  const ext = dot === -1 ? "" : path.slice(dot + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

export function isHtmlPath(path: string): boolean {
  return contentTypeFor(path).startsWith("text/html");
}

/** True for anything worth scanning for secrets or root-absolute links. */
export function isTextual(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType.startsWith("application/json") ||
    contentType.startsWith("application/manifest+json") ||
    contentType === "image/svg+xml"
  );
}

/**
 * Returns a canonical relative path, or null if the path could escape the
 * bundle or names something that should never be published.
 *
 * Dotfiles are refused outright: a stray .env in a build folder is the
 * single most likely way a secret ends up on the internet.
 */
export function normaliseBundlePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (raw.length === 0 || raw.length > LIMITS.maxPathLength) return null;
  if (raw.includes("\0") || raw.includes("\\")) return null;

  let path = raw;
  while (path.startsWith("./")) path = path.slice(2);
  if (path.startsWith("/")) return null;

  const segments = path.split("/");
  for (const segment of segments) {
    if (segment === "" || segment === "." || segment === "..") return null;
    if (segment.startsWith(".")) return null;
  }
  return segments.join("/");
}

const BASE64 = /^[A-Za-z0-9+/]*={0,2}$/;

function decodeBase64(value: unknown): Buffer | null {
  if (typeof value !== "string" || value.length % 4 !== 0 || !BASE64.test(value)) {
    return null;
  }
  return Buffer.from(value, "base64");
}

export type ParseResult =
  | { ok: true; files: BundleFile[]; totalBytes: number }
  | { ok: false; error: string };

export function parseBundle(input: unknown): ParseResult {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "No files were uploaded." };
  }
  if (input.length > LIMITS.maxFiles) {
    return { ok: false, error: `A tool can have at most ${LIMITS.maxFiles} files.` };
  }

  const seen = new Set<string>();
  const files: BundleFile[] = [];
  let totalBytes = 0;

  for (const item of input) {
    const record = (item ?? {}) as { path?: unknown; data?: unknown };
    const path = normaliseBundlePath(record.path);
    if (!path) {
      return {
        ok: false,
        error: `"${String(record.path).slice(0, 80)}" is not an allowed path. Paths must be relative, without "..", and dotfiles are never published.`,
      };
    }
    if (seen.has(path)) {
      return { ok: false, error: `"${path}" was uploaded twice.` };
    }
    seen.add(path);

    const bytes = decodeBase64(record.data);
    if (!bytes) {
      return { ok: false, error: `"${path}" is not valid base64.` };
    }
    if (bytes.length > LIMITS.maxFileBytes) {
      return { ok: false, error: `"${path}" is larger than ${LIMITS.maxFileBytes / 1024 / 1024} MB.` };
    }
    totalBytes += bytes.length;
    if (totalBytes > LIMITS.maxTotalBytes) {
      return {
        ok: false,
        error: `The tool is larger than ${LIMITS.maxTotalBytes / 1024 / 1024} MB. Small software should be small, so check that the build folder, not the project folder, was deployed.`,
      };
    }

    files.push({
      path,
      bytes,
      contentType: contentTypeFor(path),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
  }

  if (!seen.has(ENTRY)) {
    return {
      ok: false,
      error: `There is no ${ENTRY} at the top level. Deploy the folder your build writes to (often dist/ or build/).`,
    };
  }

  return { ok: true, files, totalBytes };
}

/**
 * Root-absolute references (src="/assets/app.js") would resolve against
 * Hangar's own origin instead of the tool, so the page would load blank.
 * Build tools emit them by default; the fix is one line of config, and
 * telling the agent that line is faster than shipping a broken page.
 */
export function findRootAbsoluteRefs(html: string): string[] {
  const found: string[] = [];
  const pattern = /\b(?:src|href)\s*=\s*["'](\/(?!\/)[^"']*)["']/gi;
  for (const match of html.matchAll(pattern)) {
    found.push(match[1]);
    if (found.length >= 5) break;
  }
  return found;
}

/**
 * Scripts and stylesheets loaded from another host. A tool's CSP only lets
 * it load from Hangar, so these would fail silently at runtime; refusing the
 * deploy with the fix is kinder than a blank page in front of the crew.
 */
export function findExternalRefs(html: string): string[] {
  const found: string[] = [];
  const external = /^(?:https?:)?\/\//i;
  for (const tag of html.matchAll(/<(script|link)\b[^>]*>/gi)) {
    const text = tag[0];
    const attribute = tag[1].toLowerCase() === "script" ? "src" : "href";
    const value = new RegExp(`\\b${attribute}\\s*=\\s*["']([^"']*)["']`, "i").exec(text)?.[1];
    if (!value || !external.test(value)) continue;
    if (attribute === "href" && !/\brel\s*=\s*["']?(?:stylesheet|preload|modulepreload)/i.test(text)) continue;
    found.push(value);
    if (found.length >= 5) break;
  }
  return found;
}
