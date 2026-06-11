import assert from "node:assert/strict";
import { Buffer } from "node:buffer";

const {
  classifyWikiFile,
  chunkWikiText,
  extractWikiText,
  stripHtmlToText,
  createPendingTranscriptionText,
  extractOfficeText,
  validateWikiUploadContent,
} = await import("./wikiProcessor.js");

function createStoredZip(entries: Array<{ name: string; content: string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const content = Buffer.from(entry.content);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0, 6);
    header.writeUInt16LE(0, 8);
    header.writeUInt32LE(0, 10);
    header.writeUInt32LE(0, 14);
    header.writeUInt32LE(content.length, 18);
    header.writeUInt32LE(content.length, 22);
    header.writeUInt16LE(name.length, 26);
    header.writeUInt16LE(0, 28);
    chunks.push(header, name, content);
  }
  return Buffer.concat(chunks);
}

assert.equal(classifyWikiFile("notes.md", "text/markdown"), "text");
assert.equal(classifyWikiFile("deck.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"), "office");
assert.equal(classifyWikiFile("screen.png", "image/png"), "image");
assert.equal(classifyWikiFile("call.mp3", "audio/mpeg"), "audio");
assert.equal(classifyWikiFile("lesson.mp4", "video/mp4"), "video");

assert.deepEqual(chunkWikiText("alpha\n\nbeta\n\ngamma", 12).map((c) => c.text), ["alpha\n\nbeta", "gamma"]);
assert.equal(stripHtmlToText("<h1>Title</h1><script>bad()</script><p>Hello&nbsp;world</p>").includes("bad"), false);
assert.match(stripHtmlToText("<h1>Title</h1><p>Hello&nbsp;world</p>"), /Title\s+Hello world/);
assert.match(createPendingTranscriptionText("lesson.mp4"), /pending_transcription/);

const urlExtraction = await extractWikiText({
  kind: "url",
  filename: "example.html",
  mimeType: "text/html",
  text: "Fetched URL body",
});
assert.deepEqual(urlExtraction, { text: "Fetched URL body", status: "ready" });

const docxBuffer = createStoredZip([
  { name: "word/document.xml", content: "<w:t>Brain AI</w:t><w:t>wiki personale</w:t>" },
]);
assert.match(extractOfficeText(docxBuffer, "knowledge.docx"), /Brain AI wiki personale/);
assert.deepEqual(await extractWikiText({
  kind: "office",
  filename: "knowledge.docx",
  mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  buffer: docxBuffer,
}), { text: "Brain AI wiki personale", status: "ready" });

const pptxBuffer = createStoredZip([
  { name: "ppt/slides/slide1.xml", content: "<a:t>Slide uno</a:t><a:t>regole operative</a:t>" },
]);
assert.match(extractOfficeText(pptxBuffer, "deck.pptx"), /Slide uno regole operative/);

const xlsxBuffer = createStoredZip([
  { name: "xl/sharedStrings.xml", content: "<t>Asset</t><t>EURUSD</t>" },
  { name: "xl/worksheets/sheet1.xml", content: "<v>1</v><v>2</v>" },
]);
assert.match(extractOfficeText(xlsxBuffer, "sheet.xlsx"), /Asset EURUSD/);

const invalidPdfExtraction = await extractWikiText({
  kind: "pdf",
  filename: "eclipse2.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("not a real pdf"),
});
assert.equal(invalidPdfExtraction.status, "ready");
assert.match(invalidPdfExtraction.text, /^unextractable_pdf:/);

const googleLoginPdf = await extractWikiText({
  kind: "pdf",
  filename: "eclipse2.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("<!doctype html><html><head><title>Sign in - Google Accounts</title></head><body>Sign in Google Accounts</body></html>"),
});
assert.equal(googleLoginPdf.status, "error");
assert.match(googleLoginPdf.error ?? "", /pagina di login Google/i);
assert.match(validateWikiUploadContent({
  kind: "pdf",
  filename: "eclipse2.pdf",
  buffer: Buffer.from("<!doctype html><html><head><base href=\"https://accounts.google.com/v3/signin/\"></head><body>Sign in</body></html>"),
}) ?? "", /pagina di login Google/i);

const htmlNamedPdf = await extractWikiText({
  kind: "pdf",
  filename: "export.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("<!doctype html><html><head><title>Report</title></head><body><h1>Risk plan</h1><p>Use 1% max risk.</p></body></html>"),
});
assert.equal(htmlNamedPdf.status, "ready");
assert.match(htmlNamedPdf.text, /Risk plan\s+Use 1% max risk/);
assert.equal(validateWikiUploadContent({
  kind: "pdf",
  filename: "export.pdf",
  buffer: Buffer.from("<!doctype html><html><body><h1>Risk plan</h1></body></html>"),
}), null);
assert.equal(validateWikiUploadContent({
  kind: "pdf",
  filename: "real.pdf",
  buffer: Buffer.from("%PDF-1.7\n1 0 obj"),
}), null);

const unknownBinary = await extractWikiText({
  kind: "unknown",
  filename: "archive.zip",
  mimeType: "application/zip",
  buffer: Buffer.from([0, 1, 2, 3, 255, 254, 253]),
});
assert.equal(unknownBinary.status, "ready");
assert.match(unknownBinary.text, /^archived_file:/);

const unknownText = await extractWikiText({
  kind: "unknown",
  filename: "notes.log",
  mimeType: "application/octet-stream",
  buffer: Buffer.from("Breakout rule: wait for retest before entry."),
});
assert.equal(unknownText.status, "ready");
assert.match(unknownText.text, /Breakout rule/);

console.log("wiki processor checks passed");
