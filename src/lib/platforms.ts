export const PLATFORMS = [
  "LOVABLE",
  "REPLIT",
  "BOLT",
  "V0",
  "BASE44",
  "OTHER",
] as const;
export type Platform = (typeof PLATFORMS)[number];

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

type PlatformMeta = { label: string; hostPatterns: string[]; accent: string };

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  LOVABLE: { label: "Lovable", hostPatterns: ["lovable.app", "lovable.dev"], accent: "#f0629b" },
  REPLIT: { label: "Replit", hostPatterns: ["replit.app", "repl.co", "replit.dev"], accent: "#f26207" },
  BOLT: { label: "Bolt", hostPatterns: ["bolt.new", "stackblitz.io"], accent: "#1389fd" },
  V0: { label: "v0", hostPatterns: ["v0.dev", "vercel.app"], accent: "#8b8b8b" },
  BASE44: { label: "Base44", hostPatterns: ["base44.app"], accent: "#3b82f6" },
  OTHER: { label: "Other", hostPatterns: [], accent: "#64748b" },
};

/** Best-effort guess so the person adding a tool rarely has to pick. */
export function detectPlatform(rawUrl: string): Platform {
  let host: string;
  try {
    host = new URL(rawUrl).hostname.toLowerCase();
  } catch {
    return "OTHER";
  }

  for (const platform of PLATFORMS) {
    if (platform === "OTHER") continue;
    const { hostPatterns } = PLATFORM_META[platform];
    if (hostPatterns.some((pattern) => host === pattern || host.endsWith(`.${pattern}`))) {
      return platform;
    }
  }
  return "OTHER";
}

/**
 * Only http(s) is accepted. Blocking javascript:, data: and file: here is
 * what stops a team member from registering a "tool" that runs script in
 * another member's session when they click through to it.
 */
export function normaliseAppUrl(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname) return null;
  return parsed.toString();
}
