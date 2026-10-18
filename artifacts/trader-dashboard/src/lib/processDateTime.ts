/** Parse a wall-clock value in Rome, independently of the browser timezone. */
export function processDateTimeInput(date = new Date(), seconds = false): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" } : {}),
    hourCycle: "h23",
  }).formatToParts(date);
  const value = (key: string) => parts.find((part) => part.type === key)!.value;
  return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:${value("minute")}${seconds ? ":" + value("second") : ""}`;
}
export function parseProcessDateTime(input: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(input))
    throw new Error("Indica data e ora valide (Europe/Rome).");
  const seconds = input.length === 19;
  const base = Date.parse(`${input}${seconds ? "" : ":00"}Z`);
  const candidates = [base - 3600000, base - 7200000].filter(
    (value) => Number.isFinite(value) && processDateTimeInput(new Date(value), seconds) === input,
  );
  if (candidates.length !== 1)
    throw new Error(
      "Quest’ora non è univoca nel cambio ora Europe/Rome. Scegli un’ora valida fuori dall’intervallo del cambio.",
    );
  return new Date(candidates[0]).toISOString();
}
