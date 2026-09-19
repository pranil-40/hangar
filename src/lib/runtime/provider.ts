import type { Platform } from "@/lib/platforms";

/**
 * The seam for how a tool actually runs.
 *
 * v1 ships `hostedEmbed`: tools built on Lovable/Replit/Bolt already run at
 * a URL, so Hangar's job is deciding who may reach it — not executing code.
 * That removes e2b/Modal from the critical path for the pilot.
 *
 * When Hangar starts holding source rather than links, add a provider that
 * boots a sandbox and returns its URL from `resolve()`. Nothing above this
 * interface should need to change.
 */

export type RuntimeTarget = {
  /** Where the runner iframe points. */
  url: string;
  /** False when the provider knows the origin refuses to be framed. */
  embeddable: boolean;
  /** Shown to the user when embeddable is false. */
  reason?: string;
};

export interface RuntimeProvider {
  readonly id: string;
  resolve(input: { url: string; platform: Platform }): Promise<RuntimeTarget>;
}

/**
 * Hosts known to send X-Frame-Options / frame-ancestors. We surface an
 * "open in new tab" affordance immediately instead of rendering an iframe
 * that silently fails, which is the single most confusing failure mode
 * for a non-technical user.
 */
const KNOWN_FRAME_BLOCKERS = ["replit.com", "github.com", "notion.so", "figma.com"];

export const hostedEmbed: RuntimeProvider = {
  id: "hosted-embed",
  async resolve({ url }) {
    let host = "";
    try {
      host = new URL(url).hostname.toLowerCase();
    } catch {
      return { url, embeddable: false, reason: "That address could not be parsed." };
    }

    const blocked = KNOWN_FRAME_BLOCKERS.some(
      (pattern) => host === pattern || host.endsWith(`.${pattern}`),
    );

    return blocked
      ? { url, embeddable: false, reason: `${host} does not allow embedding.` }
      : { url, embeddable: true };
  },
};

export function runtimeProvider(): RuntimeProvider {
  return hostedEmbed;
}
