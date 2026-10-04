import type { Platform } from "@/lib/platforms";

/**
 * How a LINK tool is shown: one that runs at someone else's URL (Lovable,
 * Replit, Bolt). Hangar can only frame it, so access to it is as open as
 * that URL is, and the tool page says so.
 *
 * HOSTED tools do not come through here. Their files live in Hangar and are
 * served by /run/<appId> under the sandbox in src/lib/hosting/runtime.ts.
 * When tools need server-side code, that is a second runtime next to the
 * static one, not a change to this file.
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
