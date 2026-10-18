/** Permit passive raster formats only; MIME and filename are caller-controlled. */
export function rasterImageType(bytes: Uint8Array): "png" | "jpeg" | "gif" | "webp" | null {
  const b = Buffer.from(bytes);
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && b.toString("ascii", 12, 16) === "IHDR") return "png";
  if (b.length >= 4 && b[0] === 255 && b[1] === 216 && b[2] === 255) return "jpeg";
  if (b.length >= 13 && ["GIF87a", "GIF89a"].includes(b.toString("ascii", 0, 6))) return "gif";
  if (b.length >= 16 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}
export function imageMatchesType(bytes: Uint8Array, mime: string, filename: string): boolean {
  const kind = rasterImageType(bytes);
  const extension = filename.toLowerCase().split(".").at(-1);
  return kind !== null && mime === `image/${kind}` && (extension === kind || (kind === "jpeg" && extension === "jpg"));
}
