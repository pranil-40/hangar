import { isTextual, type BundleFile } from "@/lib/hosting/bundle";

/**
 * Every byte of a tool is readable by everyone who can open it, so a
 * credential in a tool is a credential shared with the whole team, and
 * with anyone they forward a screenshot of devtools to.
 *
 * "block" findings stop the deploy. "warn" findings are keys that are
 * designed to be public but are still worth a second look.
 *
 * This is a blocklist of known credential shapes, so it is defence in depth
 * rather than a guarantee: the guarantee is that Hangar never gives a tool a
 * credential, and connector credentials stay sealed on the server. Every
 * pattern here is linear-time; the tests feed each one adversarial input.
 */

export type Severity = "block" | "warn";

export type SecretFinding = {
  path: string;
  line: number;
  kind: string;
  severity: Severity;
  preview: string;
};

type Rule = {
  kind: string;
  severity: Severity;
  pattern: RegExp;
  /** Optional second check on the matched text, to cut false positives. */
  confirm?: (match: string) => boolean;
};

function jwtRole(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as {
      role?: unknown;
    };
    return typeof payload.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

const RULES: Rule[] = [
  { kind: "Private key", severity: "block", pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP |ENCRYPTED )?PRIVATE KEY-----/g },
  { kind: "AWS access key", severity: "block", pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "Anthropic API key", severity: "block", pattern: /\bsk-ant-[A-Za-z0-9_-]{20,}/g },
  { kind: "OpenAI API key", severity: "block", pattern: /\bsk-(?!ant-)(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}/g },
  { kind: "Stripe secret key", severity: "block", pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: "GitHub token", severity: "block", pattern: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g },
  { kind: "Slack token", severity: "block", pattern: /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "SendGrid API key", severity: "block", pattern: /\bSG\.[A-Za-z0-9_-]{22}\.[A-Za-z0-9_-]{43}\b/g },
  {
    kind: "Database URL with password",
    severity: "block",
    pattern: /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis):\/\/[^\s:"'@/]+:[^\s"'@/]+@[^\s"']+/g,
  },
  { kind: "Google API key", severity: "warn", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
];

function redact(match: string): string {
  return match.length <= 8 ? "…" : `${match.slice(0, 6)}…${match.slice(-2)}`;
}

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

/**
 * Supabase's anon key is meant to be public; its service_role key bypasses
 * row-level security entirely. Same JWT shape, opposite risk, so the role
 * claim decides. Found by splitting on non-token characters rather than
 * with a regex: a pattern like eyJ[...]+\.eyJ backtracks quadratically on
 * adversarial input, and this runs on the request path.
 */
function scanJwts(path: string, text: string, findings: SecretFinding[]) {
  let offset = 0;
  for (const token of text.split(/[^A-Za-z0-9_.-]/)) {
    const at = offset;
    offset += token.length + 1;
    if (token.length < 30 || !token.startsWith("eyJ")) continue;
    const parts = token.split(".");
    if (parts.length !== 3 || !parts[1].startsWith("eyJ") || !parts[2]) continue;
    if (jwtRole(token) !== "service_role") continue;
    findings.push({ path, line: lineOf(text, at), kind: "Supabase service_role key", severity: "block", preview: redact(token) });
    if (findings.length >= 20) return;
  }
}

export function scanText(path: string, text: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const rule of RULES) {
    for (const match of text.matchAll(rule.pattern)) {
      if (rule.confirm && !rule.confirm(match[0])) continue;
      findings.push({
        path,
        line: lineOf(text, match.index ?? 0),
        kind: rule.kind,
        severity: rule.severity,
        preview: redact(match[0]),
      });
      if (findings.length >= 20) return findings;
    }
  }
  scanJwts(path, text, findings);
  return findings;
}

export function scanBundle(files: BundleFile[]): SecretFinding[] {
  const findings: SecretFinding[] = [];
  for (const file of files) {
    if (!isTextual(file.contentType)) continue;
    findings.push(...scanText(file.path, file.bytes.toString("utf8")));
    if (findings.length >= 20) break;
  }
  return findings;
}
