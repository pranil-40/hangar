"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCapability } from "@/lib/guard";
import { UPLOAD_BUILDERS } from "@/lib/hosting/builders";
import { deployTool } from "@/lib/hosting/deploy";

export type UploadState = { error?: string; details?: string[] };

/**
 * Deploys a tool from the browser, for managers who built it in a chat
 * rather than with a coding agent: paste the HTML, or upload the files.
 * It goes through exactly the same checks as an agent's deploy.
 */
export async function uploadToolAction(slug: string, _prev: UploadState, formData: FormData): Promise<UploadState> {
  const { team, user, can } = await requireCapability(slug, "app:create");

  const html = String(formData.get("html") ?? "").trim();
  const uploads = formData.getAll("files").filter((value): value is File => value instanceof File && value.size > 0);

  let files: { path: string; data: string }[];
  if (html) {
    files = [{ path: "index.html", data: Buffer.from(html, "utf8").toString("base64") }];
  } else if (uploads.length > 0) {
    files = await Promise.all(
      uploads.map(async (file) => ({ path: file.name, data: Buffer.from(await file.arrayBuffer()).toString("base64") })),
    );
  } else {
    return { error: "Paste the page's HTML, or choose its files." };
  }

  const builder = String(formData.get("builder") ?? "");
  const result = await deployTool(
    { userId: user.id, teamId: team.id, can },
    {
      name: String(formData.get("name") ?? "").trim() || undefined,
      description: String(formData.get("description") ?? "").trim() || undefined,
      source: "UPLOAD",
      agent: (UPLOAD_BUILDERS as readonly string[]).includes(builder) ? builder.toLowerCase() : undefined,
      files,
    },
  );

  if (!result.ok) {
    return {
      error: result.error,
      details: [
        ...(result.findings ?? []).map((finding) => `${finding.kind} in ${finding.path}, line ${finding.line}`),
        ...(result.refs ?? []),
      ],
    };
  }

  revalidatePath(`/t/${slug}`);
  redirect(`/t/${slug}/apps/${result.app.id}`);
}
