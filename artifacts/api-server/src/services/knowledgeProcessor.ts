import { getVisionClient } from "./llmClient.js";

// ─── Knowledge processor ─────────────────────────────────────────────────────────
// Converte i materiali caricati (PDF, immagini, testo) in TESTO grezzo, che verrà
// poi trasformato nel grafo di conoscenza da knowledgeGraph.ts.

/** Tronca un testo a `max` caratteri, segnalando il taglio. */
export function capText(s: string, max = 12000): string {
  const t = (s ?? "").trim();
  if (t.length <= max) return t;
  return t.slice(0, max) + `\n…[testo troncato a ${max} caratteri]`;
}

/**
 * extractTextFromPdf(buffer)
 * --------------------------
 * Estrae il testo da un PDF con `unpdf` (puro JS, niente dipendenze native).
 * Le pagine vengono unite in un'unica stringa.
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { getDocumentProxy, extractText } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;
  return capText(merged);
}

const IMAGE_DESCRIBE_PROMPT =
  `Sei un analista tecnico. Descrivi in italiano, in modo conciso ma completo, il ` +
  `contenuto RILEVANTE PER IL TRADING di questa immagine: strumento/timeframe se visibili, ` +
  `struttura di mercato, pattern, livelli e zone (supporti/resistenze, FVG, order block, ` +
  `trendline), annotazioni e testo presenti, regole o concetti illustrati. ` +
  `Non inventare dati che non vedi. Niente premesse né disclaimer.`;

/**
 * describeImage(dataUrl)
 * ----------------------
 * Usa il modello vision per produrre UNA descrizione testuale dell'immagine
 * caricata (eseguita una sola volta, all'upload). Se il cervello non è
 * configurato ritorna una stringa segnaposto (degradazione graziosa).
 */
export async function describeImage(dataUrl: string): Promise<string> {
  const vc = getVisionClient();
  if (!vc) return "Immagine caricata (descrizione automatica non disponibile: cervello vision non configurato).";

  const completion = await vc.client.chat.completions.create({
    model: vc.model,
    temperature: 0.2,
    max_tokens: 600,
    messages: [
      { role: "system", content: IMAGE_DESCRIBE_PROMPT },
      {
        role: "user",
        content: [
          { type: "text", text: "Descrivi questa immagine per il trading." },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ],
  });
  return capText(completion.choices[0]?.message?.content?.trim() || "Immagine senza contenuto testuale estraibile.");
}

/** Costruisce un data URL base64 da un buffer e dal suo mime type. */
export function bufferToDataUrl(buffer: Buffer, mime: string): string {
  return `data:${mime};base64,${buffer.toString("base64")}`;
}
