// ─── AUREUS PROTOCOL — Note di Sessione & Talk to Journal ─────────────────────
// Gestione note vocali, trascrizione AI e appunti di sessione auto-collegati
// al replay storico e al Libro della Verità (Journal).

export interface ReplaySessionNote {
  id: string;
  timestamp: number; // unix seconds della candela corrente
  createdAt: number; // unix milliseconds della registrazione
  formattedTime: string;
  symbol: string;
  interval: string;
  price: number;
  transcript: string;
  audioBlobUrl?: string;
  direction?: "buy" | "sell" | "neutral";
  openProfit?: number;
  tags?: string[];
}

const STORAGE_PREFIX = "aureus_replay_session_notes_";

export function getSessionNotesKey(sessionKey: string): string {
  return `${STORAGE_PREFIX}${sessionKey}`;
}

export function loadSessionNotes(sessionKey: string): ReplaySessionNote[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(getSessionNotesKey(sessionKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn("[SessionNotes] Errore lettura note sessione:", err);
    return [];
  }
}

export function saveSessionNote(sessionKey: string, note: ReplaySessionNote): ReplaySessionNote[] {
  if (typeof window === "undefined") return [note];
  try {
    const existing = loadSessionNotes(sessionKey);
    const updated = [note, ...existing.filter((n) => n.id !== note.id)];
    window.localStorage.setItem(getSessionNotesKey(sessionKey), JSON.stringify(updated));
    // Dispatch custom event per aggiornare live i listener (JournalPanel, Header, ecc.)
    window.dispatchEvent(
      new CustomEvent("aureus-session-notes-updated", {
        detail: { sessionKey, count: updated.length },
      }),
    );
    return updated;
  } catch (err) {
    console.warn("[SessionNotes] Errore salvataggio nota:", err);
    return [note];
  }
}

export function deleteSessionNote(sessionKey: string, noteId: string): ReplaySessionNote[] {
  if (typeof window === "undefined") return [];
  try {
    const existing = loadSessionNotes(sessionKey);
    const updated = existing.filter((n) => n.id !== noteId);
    window.localStorage.setItem(getSessionNotesKey(sessionKey), JSON.stringify(updated));
    window.dispatchEvent(
      new CustomEvent("aureus-session-notes-updated", {
        detail: { sessionKey, count: updated.length },
      }),
    );
    return updated;
  } catch (err) {
    console.warn("[SessionNotes] Errore rimozione nota:", err);
    return [];
  }
}
