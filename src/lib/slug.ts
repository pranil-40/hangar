import { db } from "@/lib/db";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Appends -2, -3, ... until the slug is free. */
export async function uniqueTeamSlug(name: string): Promise<string> {
  const base = slugify(name) || "team";
  let candidate = base;
  let suffix = 2;

  while (await db.team.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
}
