import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { extractTextFromPdf } from "./knowledgeProcessor.js";

export type WikiSourceKind = "text" | "pdf" | "image" | "office" | "audio" | "video" | "url" | "unknown";

const TEXT_MIME = new Set(["text/plain", "text/markdown", "text/csv", "application/json"]);
const OFFICE_EXTS = new Set([".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".m4a", ".ogg", ".webm"]);
const VIDEO_EXTS = new Set([".mp4", ".mov", ".mkv", ".webm"]);
const MAX_URL_BYTES = 4 * 1024 * 1024;

// Uploads are buffered in memory (multer.memoryStorage) before being copied to
// storage, so the per-file cap directly bounds peak RAM per request. At a few
// concurrent uploads an unbounded cap is an OOM/DoS vector on a 2 GB task.
// Default 50 MB; raise WIKI_MAX_UPLOAD_MB only if the task memory allows it.
const DEFAULT_WIKI_UPLOAD_MB = 50;

export function getWikiUploadLimitBytes(
  env: Partial<Record<string, string>> = process.env,
): number {
  const raw = Number(env.WIKI_MAX_UPLOAD_MB);
  const mb = Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_WIKI_UPLOAD_MB;
  return Math.floor(mb * 1024 * 1024);
}

function extname(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index >= 0 ? filename.slice(index).toLowerCase() : "";
}

export function classifyWikiFile(filename: string, mimeType: string): WikiSourceKind {
  const ext = extname(filename);
  if (TEXT_MIME.has(mimeType) || [".txt", ".md", ".csv", ".json"].includes(ext)) return "text";
  if (mimeType === "application/pdf" || ext === ".pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/") || AUDIO_EXTS.has(ext)) return "audio";
  if (mimeType.startsWith("video/") || VIDEO_EXTS.has(ext)) return "video";
  if (OFFICE_EXTS.has(ext) || mimeType.includes("officedocument") || mimeType.includes("msword")) return "office";
  return "unknown";
}

export function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(h[1-6]|p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, "\"")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_match, code) => String.fromCodePoint(Number.parseInt(code, 16)));
}

function xmlToText(xml: string): string {
  return decodeXmlEntities(xml)
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\r\n]+/g, " ")
    .trim();
}

function bufferHead(buffer: Buffer, bytes = 512): string {
  return buffer.subarray(0, Math.min(buffer.length, bytes)).toString("utf8").trimStart();
}

function looksLikeHtml(buffer: Buffer): boolean {
  const head = bufferHead(buffer).toLowerCase();
  return head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<head") || head.includes("<body");
}

function isGoogleLoginHtml(text: string): boolean {
  const lower = text.toLowerCase();
  return lower.includes("accounts.google.com") || lower.includes("sign in - google accounts") || lower.includes("google accounts");
}

function extractHtmlDisguisedAsPdf(buffer: Buffer, filename: string): { text: string; status: "ready" | "error"; error?: string } {
  const html = buffer.toString("utf8");
  const text = stripHtmlToText(html);
  if (isGoogleLoginHtml(html) || isGoogleLoginHtml(text)) {
    return {
      text: "",
      status: "error",
      error: `${filename} non è il PDF originale: è una pagina di login Google. Scarica/esporta il documento reale e caricalo dalla memoria locale.`,
    };
  }
  return { text: `Documento HTML caricato come PDF:\n\n${text}`, status: "ready" };
}

function looksLikeText(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192));
  let printable = 0;
  let zero = 0;
  for (const byte of sample) {
    if (byte === 0) zero++;
    if (byte === 9 || byte === 10 || byte === 13 || (byte >= 32 && byte <= 126) || byte >= 160) printable++;
  }
  return zero === 0 && printable / sample.length > 0.85;
}

export function createArchivedFileText(filename: string, mimeType: string): string {
  return `archived_file: ${filename} è stato caricato e conservato nella wiki. Non contiene testo estraibile automaticamente per il tipo ${mimeType || "sconosciuto"}.`;
}

export function validateWikiUploadContent(input: { kind: WikiSourceKind; filename: string; buffer: Buffer }): string | null {
  if (input.kind !== "pdf") return null;
  if (!looksLikeHtml(input.buffer)) return null;
  const html = input.buffer.toString("utf8");
  if (isGoogleLoginHtml(html) || isGoogleLoginHtml(stripHtmlToText(html))) {
    return `${input.filename} non è il PDF originale: è una pagina di login Google. Scarica/esporta il documento reale e caricalo dalla memoria locale.`;
  }
  return null;
}

export function chunkWikiText(text: string, maxChars = 2400): Array<{ index: number; text: string; tokenEstimate: number }> {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) chunks.push(current);
    if (paragraph.length <= maxChars) {
      current = paragraph;
    } else {
      for (let i = 0; i < paragraph.length; i += maxChars) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
      current = "";
    }
  }
  if (current) chunks.push(current);
  return chunks.map((chunk, index) => ({ index, text: chunk, tokenEstimate: Math.ceil(chunk.length / 4) }));
}

export function createPendingTranscriptionText(filename: string): string {
  return `pending_transcription: ${filename} è stato caricato, ma Whisper locale non è disponibile o non è configurato. Il file resterà nella wiki e diventerà interrogabile dopo la trascrizione.`;
}

async function transcribeWithWhisper(filePath: string): Promise<string | null> {
  const command = process.env.WIKI_WHISPER_COMMAND?.trim();
  if (!command) return null;
  return new Promise((resolve) => {
    const child = spawn(command, [filePath], { shell: true, windowsHide: true });
    let output = "";
    child.stdout.on("data", (chunk) => { output += String(chunk); });
    child.on("error", () => resolve(null));
    child.on("close", (code) => resolve(code === 0 && output.trim() ? output.trim() : null));
  });
}

export function createUnextractablePdfText(filename: string, reason?: string): string {
  const detail = reason ? ` Motivo tecnico: ${reason}` : "";
  return `unextractable_pdf: ${filename} è stato caricato, ma non contiene testo estraibile automaticamente oppure la struttura PDF non è leggibile.${detail}`;
}

async function extractPdfWithPdftotext(buffer: Buffer): Promise<string | null> {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wiki-pdf-"));
  const filePath = path.join(tempDir, "source.pdf");
  try {
    await fs.writeFile(filePath, buffer);
    return await new Promise((resolve) => {
      const child = spawn("pdftotext", ["-layout", filePath, "-"], { windowsHide: true });
      let output = "";
      child.stdout.on("data", (chunk) => { output += String(chunk); });
      child.on("error", () => resolve(null));
      child.on("close", (code) => resolve(code === 0 && output.trim() ? output.trim() : null));
    });
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function extractPdfTextForWiki(buffer: Buffer, filename: string): Promise<string> {
  try {
    const text = await extractTextFromPdf(buffer);
    if (text.trim()) return text;
  } catch (err) {
    const fallback = await extractPdfWithPdftotext(buffer);
    if (fallback?.trim()) return fallback.trim();
    const reason = err instanceof Error ? err.message : String(err);
    return createUnextractablePdfText(filename, reason);
  }
  const fallback = await extractPdfWithPdftotext(buffer);
  return fallback?.trim() || createUnextractablePdfText(filename, "nessun testo trovato");
}

function readZipEntries(buffer: Buffer): Array<{ name: string; content: Buffer }> {
  const entries: Array<{ name: string; content: Buffer }> = [];
  let offset = 0;
  while (offset + 30 <= buffer.length) {
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;
    const flags = buffer.readUInt16LE(offset + 6);
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if ((flags & 0x08) !== 0 || dataEnd > buffer.length) break;
    const name = buffer.subarray(nameStart, nameStart + nameLength).toString("utf8");
    const compressed = buffer.subarray(dataStart, dataEnd);
    let content: Buffer | null = null;
    if (method === 0) content = compressed;
    if (method === 8) content = inflateRawSync(compressed, { finishFlush: 2 });
    if (content && (!uncompressedSize || content.length === uncompressedSize)) entries.push({ name, content });
    offset = dataEnd;
  }
  return entries;
}

export function extractOfficeText(buffer: Buffer, filename: string): string {
  const entries = readZipEntries(buffer);
  const lowerName = filename.toLowerCase();
  const wanted = entries
    .filter((entry) => {
      if (!entry.name.endsWith(".xml")) return false;
      if (lowerName.endsWith(".docx")) return entry.name === "word/document.xml" || entry.name.startsWith("word/header") || entry.name.startsWith("word/footer");
      if (lowerName.endsWith(".pptx")) return entry.name.startsWith("ppt/slides/slide") || entry.name.startsWith("ppt/notesSlides/");
      if (lowerName.endsWith(".xlsx")) return entry.name === "xl/sharedStrings.xml" || entry.name.startsWith("xl/worksheets/");
      return entry.name.includes("document") || entry.name.includes("slide") || entry.name.includes("sharedStrings") || entry.name.includes("sheet");
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const text = wanted.map((entry) => xmlToText(entry.content.toString("utf8"))).filter(Boolean).join("\n");
  return text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function fetchUrlText(url: string): Promise<{ title: string; text: string }> {
  const parsed = new URL(url);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("URL non valido: usa http o https.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  const response = await fetch(parsed.toString(), {
    headers: { "user-agent": "TraderLoading-Wiki/1.0" },
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) throw new Error(`URL non scaricabile (${response.status})`);
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_URL_BYTES) throw new Error("URL troppo grande per l'import wiki.");
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType && !contentType.includes("text/") && !contentType.includes("html") && !contentType.includes("xml") && !contentType.includes("json")) {
    throw new Error("URL non testuale: carica il file direttamente nella wiki.");
  }
  const html = await response.text();
  if (Buffer.byteLength(html, "utf8") > MAX_URL_BYTES) throw new Error("URL troppo grande per l'import wiki.");
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim() || parsed.hostname;
  return { title, text: stripHtmlToText(html) };
}

export async function extractWikiText(input: {
  kind: WikiSourceKind;
  filename: string;
  mimeType: string;
  buffer?: Buffer;
  localPath?: string;
  text?: string;
}): Promise<{ text: string; status: "ready" | "pending_transcription" | "error"; error?: string }> {
  if (input.kind === "text" || input.kind === "url") {
    return { text: (input.text ?? input.buffer?.toString("utf8") ?? "").trim(), status: "ready" };
  }
  if (input.kind === "pdf" && input.buffer) {
    if (looksLikeHtml(input.buffer)) return extractHtmlDisguisedAsPdf(input.buffer, input.filename);
    return { text: await extractPdfTextForWiki(input.buffer, input.filename), status: "ready" };
  }
  if (input.kind === "image") {
    // Pure archive: images are stored as-is and stay searchable by title/filename
    // (no AI vision description).
    return { text: "", status: "ready" };
  }
  if ((input.kind === "audio" || input.kind === "video") && input.localPath) {
    const transcript = await transcribeWithWhisper(input.localPath);
    return transcript
      ? { text: transcript, status: "ready" }
      : { text: createPendingTranscriptionText(input.filename), status: "pending_transcription" };
  }
  if (input.kind === "audio" || input.kind === "video") {
    return { text: createPendingTranscriptionText(input.filename), status: "pending_transcription" };
  }
  if (input.kind === "office") {
    const text = input.buffer ? extractOfficeText(input.buffer, input.filename) : "";
    if (text) return { text, status: "ready" };
    return { text: "", status: "error", error: "Non riesco a leggere testo da questo file Office. Prova a esportarlo in PDF o testo." };
  }
  if (input.kind === "unknown" && input.buffer) {
    if (looksLikeText(input.buffer)) {
      return { text: input.buffer.toString("utf8").trim(), status: "ready" };
    }
    return { text: createArchivedFileText(input.filename, input.mimeType), status: "ready" };
  }
  return { text: "", status: "error", error: "Tipo file non supportato." };
}
