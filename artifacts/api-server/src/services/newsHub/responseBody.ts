export const NEWS_FEED_MAX_BYTES = 2 * 1024 * 1024;

/** Bound both declared and streamed size; AbortSignal on fetch bounds the read too. */
export async function readBoundedNewsResponse(response: Response, maxBytes = NEWS_FEED_MAX_BYTES): Promise<string> {
  const declared = Number(response.headers.get("content-length"));
  if (declared > maxBytes) { await response.body?.cancel(); throw new Error("News feed exceeds size limit"); }
  if (!response.body) throw new Error("News feed has no body");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > maxBytes) { await reader.cancel(); throw new Error("News feed exceeds size limit"); }
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString("utf8");
}

