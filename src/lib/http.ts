/**
 * Reads a JSON body with a hard byte ceiling enforced while streaming, so a
 * chunked upload with no Content-Length (or a false one) cannot make the
 * server buffer more than `maxBytes`.
 */
export async function readJsonLimited(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413; error: string }> {
  const tooLarge = { ok: false as const, status: 413 as const, error: `Request body is larger than ${Math.round(maxBytes / 1024)} KB.` };

  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return tooLarge;
  if (!request.body) return { ok: false, status: 400, error: "Body must be JSON." };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge;
    }
    chunks.push(value);
  }

  try {
    return { ok: true, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) };
  } catch {
    return { ok: false, status: 400, error: "Body must be JSON." };
  }
}
