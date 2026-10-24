import { z } from "zod/v4";
import { COCKPIT_VERSION, cockpitRequirements, MARKETS, cockpitDay } from "../../../../contracts/cockpit.js";
export { cockpitRequirements, MARKETS, cockpitDay };
export const cockpitAnalysisSchema = z
  .object({
    version: z.literal(COCKPIT_VERSION),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    mode: z.enum(["scalp", "swing"]),
    market: z.string().min(1).max(32),
    phase: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    cycle: z.enum(["", "up", "down", "end_up", "end_down"]),
    context: z.enum(["", "compression", "swept", "intermediate"]),
    scenario: z.enum(["", "valid_zone", "no_zone", "reaccum"]),
    itfSchema: z.boolean(),
    ltfSchema: z.boolean(),
    trigger: z.enum(["", "TEST", "POC", "JTC", "BTI"]),
    area: z.enum(["", "history", "virgin"]),
    imbalance: z.boolean(),
    target: z.string().max(4000),
    targetConfirmed: z.boolean(),
    execTF: z.enum(["M1", "M5"]),
    asiaConfirmed: z.boolean(),
    impulseStarted: z.boolean(),
    news: z.enum(["unchecked", "clear", "pre", "post"]),
    newsDay: z.string().max(10),
    notes: z.string().max(4000),
  })
  .strict();

/** Calendar provenance is checked server-side; a client checkbox cannot clear an outage. */
export function cockpitCalendarReason(
  events: { date: string; country: string; impact: string }[],
  currencies: readonly string[],
  now = new Date(),
): string | null {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const at = Date.parse(day + "T12:00:00Z"),
    weekday = new Date(at).getUTCDay();
  const monday = at - ((weekday + 6) % 7) * 86400000,
    sunday = monday + 7 * 86400000;
  if (
    !events.some((e) => Date.parse(e.date) >= monday - 12 * 3600000 && Date.parse(e.date) < sunday)
  )
    return "Calendario economico non aggiornato: verifica le fonti e salva un’attesa.";
  if (
    events.some(
      (e) =>
        e.impact === "High" &&
        currencies.includes(e.country) &&
        Date.parse(e.date) >= now.getTime() &&
        Date.parse(e.date) - now.getTime() <= 10 * 60000,
    )
  )
    return "News ad alto impatto imminente: attendi e rivalida le schematiche dopo il rilascio.";
  return null;
}
