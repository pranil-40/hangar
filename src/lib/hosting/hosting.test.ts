import { describe, expect, it } from "vitest";
import {
  LIMITS,
  contentTypeFor,
  findRootAbsoluteRefs,
  normaliseBundlePath,
  parseBundle,
} from "./bundle";
import { scanText } from "./secrets";
import { findExternalRefs } from "./bundle";
import { CLIENT_SCRIPT, TOOL_CSP, injectRuntime, scriptSafeJson, type Bootstrap } from "./runtime";

const b64 = (text: string) => Buffer.from(text).toString("base64");

describe("bundle paths", () => {
  it("accepts ordinary relative paths and strips ./", () => {
    expect(normaliseBundlePath("index.html")).toBe("index.html");
    expect(normaliseBundlePath("./assets/app-1a2b.js")).toBe("assets/app-1a2b.js");
  });

  it("refuses anything that could escape the bundle", () => {
    for (const bad of ["../secret", "a/../../b", "/etc/passwd", "a//b", "a\\b", "a\0b", "", "."]) {
      expect(normaliseBundlePath(bad)).toBeNull();
    }
  });

  it("never publishes dotfiles", () => {
    expect(normaliseBundlePath(".env")).toBeNull();
    expect(normaliseBundlePath("config/.npmrc")).toBeNull();
    expect(normaliseBundlePath(".git/config")).toBeNull();
  });

  it("caps path length", () => {
    expect(normaliseBundlePath("a".repeat(LIMITS.maxPathLength + 1))).toBeNull();
  });
});

describe("parseBundle", () => {
  it("requires index.html at the top level", () => {
    const result = parseBundle([{ path: "app/index.html", data: b64("<html>") }]);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicates, bad base64 and oversize bundles", () => {
    expect(parseBundle([{ path: "index.html", data: b64("a") }, { path: "./index.html", data: b64("b") }]).ok).toBe(false);
    expect(parseBundle([{ path: "index.html", data: "not base64!" }]).ok).toBe(false);
    const big = Buffer.alloc(LIMITS.maxFileBytes, 1).toString("base64");
    expect(parseBundle([{ path: "index.html", data: big }, { path: "b.bin", data: big }]).ok).toBe(false);
  });

  it("returns typed, hashed files", () => {
    const result = parseBundle([
      { path: "index.html", data: b64("<html></html>") },
      { path: "assets/app.js", data: b64("console.log(1)") },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.files.map((f) => f.contentType)).toEqual([
      "text/html; charset=utf-8",
      "text/javascript; charset=utf-8",
    ]);
    expect(result.files[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("serves unknown types as opaque bytes", () => {
    expect(contentTypeFor("data.xyz")).toBe("application/octet-stream");
  });
});

describe("root-absolute references", () => {
  it("flags /assets but not relative or protocol-relative paths", () => {
    const html = `<script src="/assets/a.js"></script><link href="./b.css"><img src="//cdn.x/y.png"><a href="https://x">`;
    expect(findRootAbsoluteRefs(html)).toEqual(["/assets/a.js"]);
  });
});

describe("secret scanning", () => {
  it("blocks real credential shapes", () => {
    const samples: [string, string][] = [
      ["AWS access key", "AKIAABCDEFGHIJKLMNOP"],
      ["Stripe secret key", `sk_live_${"a".repeat(24)}`],
      ["GitHub token", `ghp_${"a".repeat(36)}`],
      ["Anthropic API key", `sk-ant-api03-${"a".repeat(30)}`],
      ["Database URL with password", "postgresql://app:hunter2@db.internal:5432/prod"],
      ["Private key", "-----BEGIN RSA PRIVATE KEY-----"],
    ];
    for (const [kind, secret] of samples) {
      const findings = scanText("app.js", `const x = "${secret}";`);
      expect(findings.map((f) => f.kind)).toContain(kind);
      expect(findings.find((f) => f.kind === kind)!.severity).toBe("block");
    }
  });

  it("tells a Supabase service_role key from a public anon key", () => {
    const jwt = (role: string) =>
      `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.c2lnbmF0dXJl`;
    expect(scanText("a.js", jwt("service_role")).map((f) => f.kind)).toContain("Supabase service_role key");
    expect(scanText("a.js", jwt("anon"))).toEqual([]);
  });

  it("only warns on Google API keys, which are designed to be public", () => {
    const [finding] = scanText("a.js", `"AIza${"a".repeat(35)}"`);
    expect(finding.severity).toBe("warn");
  });

  it("reports the line and redacts the value", () => {
    const [finding] = scanText("a.js", `\n\nconst k = "AKIAABCDEFGHIJKLMNOP";`);
    expect(finding.line).toBe(3);
    expect(finding.preview).not.toContain("ABCDEFGHIJKLMNOP");
  });

  it("does not flag ordinary code", () => {
    expect(scanText("a.js", "const skip = 'sk-'; const url = 'https://example.com';")).toEqual([]);
  });
});

describe("runtime injection", () => {
  const bootstrap: Bootstrap = {
    api: "/api/tool/v1",
    token: "t.k",
    user: { id: "u1", name: "</script><script>alert(1)</script>", email: "a@b.c" },
    role: "VIEWER",
    app: { id: "a1", name: "Tool" },
    rules: { collections: {}, strict: false, defaults: { read: "anyone", create: "anyone", update: "author", delete: "author" } },
  };

  it("puts <base> and the client first in <head>", () => {
    const out = injectRuntime(`<!doctype html><html><head><base href="/"><title>x</title></head></html>`, "/a/T/", bootstrap);
    const head = out.indexOf("<head>") + "<head>".length;
    expect(out.slice(head).startsWith('<base href="/a/T/">')).toBe(true);
    // Ours precedes the tool's own <base>, and the first <base> wins.
    expect(out.indexOf('<base href="/a/T/">')).toBeLessThan(out.indexOf('<base href="/">'));
  });

  it("cannot be broken out of by a hostile user name", () => {
    const out = injectRuntime("<html><head></head></html>", "/a/T/", bootstrap);
    expect(out).not.toContain("</script><script>alert(1)");
    expect(scriptSafeJson("</script>")).toBe('"\\u003c/script\\u003e"');
  });

  it("handles documents without <head>", () => {
    expect(injectRuntime("<p>hi</p>", "/a/T/", bootstrap)).toContain("<head><base");
    expect(injectRuntime("<html><body></body></html>", "/a/T/", bootstrap)).toMatch(/^<html><head><base/);
  });

  it("keeps the client self-contained", () => {
    expect(CLIENT_SCRIPT).toContain("credentials: \"omit\"");
    expect(CLIENT_SCRIPT).not.toMatch(/https?:\/\//);
  });
});

describe("tool content security policy", () => {
  it("sandboxes without same-origin and keeps traffic on Hangar", () => {
    expect(TOOL_CSP).toMatch(/^sandbox /);
    expect(TOOL_CSP).not.toContain("allow-same-origin");
    expect(TOOL_CSP).not.toContain("allow-popups");
    expect(TOOL_CSP).not.toContain("allow-top-navigation");
    expect(TOOL_CSP).toContain("connect-src 'self'");
    expect(TOOL_CSP).toContain("frame-ancestors 'self'");
  });
});

describe("secret scanner performance", () => {
  // Each input repeats a rule's prefix with characters its quantifiers
  // accept, the shape that makes backtracking regexes go quadratic.
  const adversarial = [
    "eyJ-",
    "eyJa.eyJ",
    "sk-ant-",
    "sk-",
    "sk_live_a",
    "ghp_",
    "github_pat_",
    "xoxb-",
    "redis://a:b",
    "postgres://a:",
    "AKIA",
    "SG.",
    "AIza",
    "-----BEGIN ",
  ];

  for (const unit of adversarial) {
    it(`stays linear on 2 MB of "${unit}"`, () => {
      const text = unit.repeat(Math.ceil((2 * 1024 * 1024) / unit.length));
      const started = performance.now();
      scanText("index.html", text);
      expect(performance.now() - started).toBeLessThan(1500);
    });
  }
});

describe("external references", () => {
  it("flags CDN scripts and stylesheets but not local files or plain links", () => {
    const html = `<script src="https://cdn.tailwindcss.com"></script><script src="./app.js"></script>
      <link rel="stylesheet" href="//fonts.googleapis.com/css?family=Inter"><link rel="icon" href="https://x.test/f.ico">
      <a href="https://example.com">docs</a>`;
    expect(findExternalRefs(html)).toEqual(["https://cdn.tailwindcss.com", "//fonts.googleapis.com/css?family=Inter"]);
  });
});
