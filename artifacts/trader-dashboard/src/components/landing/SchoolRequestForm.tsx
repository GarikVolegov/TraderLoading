import { useRef, useState } from "react";
import { Link } from "wouter";
import { apiJSON } from "@/lib/apiFetch";
import { trackEvent } from "@/lib/analytics";

export function SchoolRequestForm() {
  const key = useRef<string | null>(null);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  if (state === "sent")
    return (
      <div className="launch-school-form" role="status">
        <h3>Richiesta ricevuta.</h3>
        <p>
          Ti ricontatteremo per definire posti, accessi e preventivo. La ricevuta email è in coda
          per l’invio.
        </p>
      </div>
    );
  return (
    <form
      className="launch-school-form"
      onSubmit={async (event) => {
        event.preventDefault();
        if (state === "sending") return;
        const values = Object.fromEntries(new FormData(event.currentTarget));
        key.current ??= crypto.randomUUID();
        setState("sending");
        setError("");
        try {
          await apiJSON("school-requests", {
            method: "POST",
            body: JSON.stringify({
              ...values,
              requestKey: key.current,
              currentStudents: Number(values.currentStudents),
              monthlyEntrants: Number(values.monthlyEntrants),
            }),
          });
          setState("sent");
          trackEvent("school_partnership_requested");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Invio non riuscito. Riprova.");
          setState("idle");
        }
      }}
    >
      <label>
        Scuola o community
        <input name="school" required minLength={2} maxLength={160} autoComplete="organization" />
      </label>
      <label>
        Referente
        <input name="name" required minLength={2} maxLength={100} autoComplete="name" />
      </label>
      <label>
        Email di contatto
        <input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <div className="launch-form-pair">
        <label>
          Iscritti attuali
          <input name="currentStudents" type="number" required min={0} max={1000000} />
        </label>
        <label>
          Nuovi ingressi al mese
          <input name="monthlyEntrants" type="number" required min={0} max={1000000} />
        </label>
      </div>
      <label>
        Come vorresti usare LIMEN?
        <textarea name="needs" required minLength={10} maxLength={4000} rows={4} />
      </label>
      <p>
        Useremo i dati per gestire la richiesta. <Link href="/privacy">Informativa privacy</Link>.
      </p>
      {error && <p role="alert">{error}</p>}
      <button className="launch-button" disabled={state === "sending"}>
        {state === "sending" ? "Invio in corso…" : "Richiedi una proposta"}
      </button>
    </form>
  );
}
