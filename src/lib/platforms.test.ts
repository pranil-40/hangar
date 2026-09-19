import { describe, expect, it } from "vitest";
import { detectPlatform, normaliseAppUrl } from "./platforms";

describe("detectPlatform", () => {
  it("recognises the builders we care about", () => {
    expect(detectPlatform("https://my-thing.lovable.app")).toBe("LOVABLE");
    expect(detectPlatform("https://stock.replit.app/path")).toBe("REPLIT");
    expect(detectPlatform("https://x.bolt.new")).toBe("BOLT");
    expect(detectPlatform("https://demo.vercel.app")).toBe("V0");
    expect(detectPlatform("https://app.base44.app")).toBe("BASE44");
  });

  it("falls back to OTHER for a custom domain", () => {
    expect(detectPlatform("https://tools.acme.com")).toBe("OTHER");
  });

  it("does not match a lookalike domain", () => {
    expect(detectPlatform("https://notlovable.app")).toBe("OTHER");
    expect(detectPlatform("https://lovable.app.evil.com")).toBe("OTHER");
  });

  it("returns OTHER rather than throwing on rubbish", () => {
    expect(detectPlatform("not a url")).toBe("OTHER");
    expect(detectPlatform("")).toBe("OTHER");
  });
});

describe("normaliseAppUrl", () => {
  it("accepts http and https", () => {
    expect(normaliseAppUrl("https://a.lovable.app")).toBe("https://a.lovable.app/");
    expect(normaliseAppUrl("http://localhost:3000")).toBe("http://localhost:3000/");
  });

  it("trims surrounding whitespace", () => {
    expect(normaliseAppUrl("  https://a.lovable.app  ")).toBe("https://a.lovable.app/");
  });

  it("rejects script-bearing and local-file schemes", () => {
    expect(normaliseAppUrl("javascript:alert(1)")).toBeNull();
    expect(normaliseAppUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(normaliseAppUrl("file:///C:/Windows/System32")).toBeNull();
  });

  it("rejects anything unparseable", () => {
    expect(normaliseAppUrl("")).toBeNull();
    expect(normaliseAppUrl("just some words")).toBeNull();
  });
});
