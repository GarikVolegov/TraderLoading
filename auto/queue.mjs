// Nightshift — operazioni sulla coda dei task. Node puro, zero dipendenze.
// Le funzioni mutano `queue` in place; il salvataggio è responsabilità della CLI.

export function nextTask(queue, kind) {
  const match = (t) =>
    t.status === "pending" &&
    (kind === undefined ||
      (kind === "chore" && t.source === "chore") ||
      (kind === "heavy" && t.source !== "chore"));
  const pending = queue.filter(match);
  pending.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));
  return pending[0] ?? null;
}

function mustFind(queue, id) {
  const t = queue.find((x) => x.id === id);
  if (!t) throw new Error(`task non trovato in coda: ${id}`);
  return t;
}

function appendNote(existing, note) {
  return existing ? `${existing} | ${note}` : note;
}

export function startTask(queue, id) {
  mustFind(queue, id).status = "in_progress";
  return queue;
}

export function completeTask(queue, id, prUrl = null, note = "") {
  const t = mustFind(queue, id);
  t.status = "done";
  if (prUrl) t.prUrl = prUrl;
  if (note) t.notes = appendNote(t.notes, note);
  return queue;
}

export function failTask(queue, id, note = "") {
  const t = mustFind(queue, id);
  t.attempts = (t.attempts ?? 0) + 1;
  t.status = t.attempts >= (t.maxAttempts ?? 2) ? "failed" : "pending";
  if (note) t.notes = appendNote(t.notes, note);
  return queue;
}

export function recoverStale(queue, note = "run precedente interrotta") {
  const stale = queue.filter((t) => t.status === "in_progress").map((t) => t.id);
  for (const id of stale) failTask(queue, id, note);
  return stale;
}

export function materializeChores(queue, chores, dateISO) {
  const weekday = new Date(`${dateISO}T00:00:00Z`).getUTCDay(); // 0=domenica
  const added = [];
  for (const chore of chores) {
    const due =
      chore.recurrence === "nightly" ||
      (chore.recurrence === "weekly" && weekday === (chore.weekday ?? 1));
    if (!due) continue;
    const id = `${chore.id}-${dateISO}`;
    const open = queue.some(
      (t) => t.id.startsWith(`${chore.id}-`) && (t.status === "pending" || t.status === "in_progress"),
    );
    if (open || queue.some((t) => t.id === id)) continue;
    const task = {
      ...structuredClone(chore.template),
      id,
      source: "chore",
      status: "pending",
      attempts: 0,
      maxAttempts: chore.template.maxAttempts ?? 1,
      branch: null,
      prUrl: null,
      notes: "",
    };
    queue.push(task);
    added.push(task);
  }
  return added;
}
