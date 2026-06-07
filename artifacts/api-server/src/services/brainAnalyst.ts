import { z } from "zod";
import { getVisionClient, markKeyInvalid } from "./llmClient.js";

// ─── Brain analyst: il cuore del "cervello" vision ──────────────────────────────
// Manda l'immagine del grafico + la strategia dell'utente + memoria feedback ed
// esempi al modello multimodale, e ritorna un segnale strutturato e validato.

const num = z.number().nullable().optional();

// Una "zona" può essere un range [min,max] oppure un singolo prezzo, con motivazione.
const ZoneSchema = z.object({
  min: num,
  max: num,
  price: num,
  rr: num,                 // rapporto rischio/rendimento (solo per i TP)
  rationale: z.string().optional().default(""),
});
export type BrainZone = z.infer<typeof ZoneSchema>;

export const BrainSignalSchema = z.object({
  context: z.string().optional().default(""),     // narrativa: struttura, bias, confluenze
  direction: z.enum(["long", "short", "wait"]),
  confidence: z.number().min(0).max(100),
  entryZone: z.object({ min: num, max: num }).nullable().optional(),
  stopLossZones: z.array(ZoneSchema).optional().default([]),
  takeProfitZones: z.array(ZoneSchema).optional().default([]),
  reasoning: z.string().optional().default(""),   // sintesi finale
});

export type BrainSignal = z.infer<typeof BrainSignalSchema>;

export interface FewShotExample {
  symbol: string;
  interval: string;
  direction: string;
  reasoning: string;
}

export interface AnalyzeInput {
  imageDataUrl: string;
  symbol: string;
  interval: string;
  strategyRules: string;
  graphContext?: string;        // contesto dal grafo di conoscenza (GraphRAG)
  fewShotExamples?: FewShotExample[];
  feedbackMemory?: string[];
  candleMeta?: {
    lastClose: number;
    recentHigh: number;
    recentLow: number;
    count: number;
  };
}

/** Punto medio di una zona (per i valori rappresentativi retro-compatibili). */
function zoneMid(z: { min?: number | null; max?: number | null; price?: number | null } | null | undefined): number | null {
  if (!z) return null;
  if (z.price != null) return z.price;
  if (z.min != null && z.max != null) return (z.min + z.max) / 2;
  return z.min ?? z.max ?? null;
}

/**
 * representativeLevels(signal)
 * ----------------------------
 * Estrae entry/SL/TP "singoli" dalle zone, per compatibilità con le colonne
 * numeriche esistenti (entry_price/stop_loss/take_profit) e le push.
 */
export function representativeLevels(signal: BrainSignal): {
  entry: number | null; stopLoss: number | null; takeProfit: number | null;
} {
  return {
    entry: zoneMid(signal.entryZone),
    stopLoss: zoneMid(signal.stopLossZones[0]),
    takeProfit: zoneMid(signal.takeProfitZones[0]),
  };
}

export interface AnalyzeResult extends BrainSignal {
  model: string;
  raw: string;
}

const SYSTEM_PROMPT = `Sei un analista tecnico di trading disciplinato. Il tuo compito è GUARDARE
l'immagine del grafico a candele fornita e applicare RIGOROSAMENTE la strategia descritta dall'utente,
SFRUTTANDO la "MAPPA DI CONOSCENZA" (grafo) e le correzioni passate quando presenti.
Non inventare dati che non vedi. Analizza struttura di mercato, livelli, pattern e momentum visibili.

Invece di singoli prezzi, fornisci ZONE (range) per ingresso, stop loss e take profit, con motivazione.

Rispondi ESCLUSIVAMENTE con un oggetto JSON valido con questo schema esatto:
{
  "context": string,                 // analisi di contesto in italiano: struttura di mercato, bias, confluenze rilevanti dal grafo
  "direction": "long" | "short" | "wait",  // "wait" se non c'è un setup conforme alla strategia
  "confidence": number,              // 0-100, quanto il setup rispetta strategia e conoscenza
  "entryZone": { "min": number, "max": number } | null,   // zona d'ingresso (null se direction=wait)
  "stopLossZones": [ { "min": number, "max": number, "rationale": string } ],   // una o più zone di stop, motivate
  "takeProfitZones": [ { "min": number, "max": number, "rr": number, "rationale": string } ], // target progressivi, con R:R
  "reasoning": string                // sintesi finale concisa
}
Per una zona puntuale puoi usare lo stesso valore in "min" e "max". Non aggiungere testo fuori dal JSON. Niente disclaimer.`;

function buildUserText(input: AnalyzeInput): string {
  const parts: string[] = [];
  parts.push(`Strumento: ${input.symbol} — Timeframe: ${input.interval}`);
  if (input.candleMeta) {
    parts.push(
      `Contesto numerico: ultimo close=${input.candleMeta.lastClose}, ` +
      `max recente=${input.candleMeta.recentHigh}, min recente=${input.candleMeta.recentLow}, ` +
      `candele visibili=${input.candleMeta.count}.`
    );
  }
  parts.push(`\n=== STRATEGIA DA APPLICARE ===\n${input.strategyRules}`);

  if (input.graphContext && input.graphContext.trim().length > 0) {
    parts.push(
      `\n=== CONTESTO DAL GRAFO DI CONOSCENZA (materiale di studio caricato) ===\n` +
      input.graphContext.trim()
    );
  }

  if (input.feedbackMemory && input.feedbackMemory.length > 0) {
    parts.push(
      `\n=== CORREZIONI PASSATE DEL TRADER (impara da questi feedback) ===\n` +
      input.feedbackMemory.map((f) => `- ${f}`).join("\n")
    );
  }
  if (input.fewShotExamples && input.fewShotExamples.length > 0) {
    parts.push(
      `\n=== ESEMPI DI ANALISI CORRETTE PASSATE ===\n` +
      input.fewShotExamples
        .map((e) => `- ${e.symbol} ${e.interval}: ${e.direction} — ${e.reasoning}`)
        .join("\n")
    );
  }
  parts.push(`\nAnalizza il grafico in allegato e produci il JSON.`);
  return parts.join("\n");
}

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  // Rimuove eventuali fence ```json ... ```
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : trimmed;
  // Estrae il primo blocco {...}
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Nessun JSON trovato nella risposta del modello");
  }
  return JSON.parse(candidate.slice(start, end + 1));
}

/**
 * analyzeChart(input)
 * -------------------
 * Esegue l'analisi vision. Lancia se il cervello non è configurato o se il modello
 * non produce un output valido (dopo un retry).
 */
export async function analyzeChart(input: AnalyzeInput): Promise<AnalyzeResult> {
  const vc = getVisionClient();
  if (!vc) {
    throw new Error("Cervello vision non configurato: imposta BRAIN_LLM_PROVIDER e la chiave relativa.");
  }

  const userText = buildUserText(input);
  const messages = [
    { role: "system" as const, content: SYSTEM_PROMPT },
    {
      role: "user" as const,
      content: [
        { type: "text" as const, text: userText },
        { type: "image_url" as const, image_url: { url: input.imageDataUrl } },
      ],
    },
  ];

  const callModel = async (forceJsonText: boolean): Promise<string> => {
    const completion = await vc.client.chat.completions.create({
      model: vc.model,
      messages,
      temperature: 0.2,
      max_tokens: 1200,
      ...(forceJsonText ? {} : { response_format: { type: "json_object" as const } }),
    });
    return completion.choices[0]?.message?.content ?? "";
  };

  let raw = "";
  try {
    try {
      raw = await callModel(false);
    } catch {
      // alcuni provider/modelli non supportano response_format → retry senza
      raw = await callModel(true);
    }
    const parsed = BrainSignalSchema.parse(extractJson(raw));
    return { ...parsed, model: vc.model, raw };
  } catch (err: unknown) {
    const status = (err as { status?: number })?.status;
    if (status === 401 || status === 403 || status === 429) {
      markKeyInvalid();
    }
    // Un retry "best effort" se il parsing è fallito ma la chiamata era andata
    if (raw) {
      try {
        const retryRaw = await callModel(true);
        const parsed = BrainSignalSchema.parse(extractJson(retryRaw));
        return { ...parsed, model: vc.model, raw: retryRaw };
      } catch { /* cade nel throw sotto */ }
    }
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Analisi vision fallita: ${msg}`);
  }
}
