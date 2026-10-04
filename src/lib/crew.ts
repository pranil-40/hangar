import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { appUrl } from "@/lib/urls";

/**
 * Crew links: how someone with no work email gets into a team.
 *
 * A manager adds a crew member by name and sends them a personal link (by
 * text, WhatsApp, or a QR code on screen). Opening it shows who it is for;
 * tapping the button signs that phone in. The tap matters: messaging apps
 * fetch links to build previews, and a link that signed in on a plain GET
 * would be spent by the preview bot before the person ever saw it.
 *
 * Links are single-use, expire after a week, and only their SHA-256 is
 * stored. Access is the membership, so removing someone from the team
 * locks their phone out on its next request.
 */

export const CREW_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CREW_ROLES = ["VIEWER", "EDITOR"] as const;

export function generateCrewToken(): { token: string; tokenHash: string } {
  const token = `crew_${randomBytes(24).toString("base64url")}`;
  return { token, tokenHash: hashCrewToken(token) };
}

export function hashCrewToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function crewLinkView(token: string): Promise<{ url: string; qr: string }> {
  const url = appUrl(`/join/${token}`);
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return { url, qr: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` };
}
