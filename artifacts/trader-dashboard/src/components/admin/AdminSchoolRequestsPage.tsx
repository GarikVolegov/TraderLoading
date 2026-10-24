import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiJSON } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type SchoolRequest = {
  id: number;
  school: string;
  name: string;
  email: string;
  currentStudents: number;
  monthlyEntrants: number;
  needs: string;
  status: string;
  notes: string;
};
export function AdminSchoolRequestsPage() {
  const rows = useQuery({
    queryKey: ["admin", "school-requests"],
    queryFn: () => apiJSON<SchoolRequest[]>("admin/school-requests"),
  });
  const emails = useQuery({
    queryKey: ["admin", "launch-emails"],
    queryFn: () =>
      apiJSON<{ key: string; kind: string; status: string; attempts: number }[]>(
        "admin/launch-emails",
      ),
    retry: false,
  });
  return (
    <main className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold">Partnership scuole</h1>
      <p>
        Setup e accessi concordati per sei mesi; quota per ogni nuovo ingresso. Prezzi e rinnovi
        restano nel preventivo privato.
      </p>
      {rows.isPending ? (
        <p role="status">Caricamento…</p>
      ) : rows.isError ? (
        <p role="alert">Richieste non disponibili.</p>
      ) : !rows.data.length ? (
        <p>Nessuna richiesta ricevuta.</p>
      ) : (
        rows.data.map((row) => <Request key={row.id} row={row} />)
      )}
      <section>
        <h2 className="text-xl">Invii email del lancio</h2>
        {emails.isError ? (
          <p>Registro riservato agli amministratori con permesso audit.</p>
        ) : (
          <ul>
            {emails.data?.map((email) => (
              <li key={email.key}>
                {email.kind} · {email.status} · tentativi: {email.attempts}
              </li>
            ))}
          </ul>
        )}
        <p>
          Gli invii “needs_review” richiedono verifica presso il provider prima di un eventuale
          nuovo invio.
        </p>
      </section>
    </main>
  );
}
function Request({ row }: { row: SchoolRequest }) {
  const client = useQueryClient();
  const [status, setStatus] = useState(row.status);
  const [notes, setNotes] = useState(row.notes);
  const save = useMutation({
    mutationFn: () =>
      apiJSON(`admin/school-requests/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, notes }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "school-requests"] }),
  });
  return (
    <article className="space-y-3 rounded-xl border p-5">
      <h2 className="text-xl">{row.school}</h2>
      <p>
        {row.name} · <a href={`mailto:${row.email}`}>{row.email}</a>
      </p>
      <p>
        {row.currentStudents} iscritti attuali · {row.monthlyEntrants} ingressi mensili stimati
      </p>
      <p className="whitespace-pre-wrap">{row.needs}</p>
      <label className="block">
        Stato
        <select
          className="academy-select"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="new">Nuova</option>
          <option value="contacted">Contattata</option>
          <option value="quoted">Preventivo inviato</option>
          <option value="closed">Chiusa</option>
        </select>
      </label>
      <label className="block">
        Note
        <Textarea value={notes} maxLength={4000} onChange={(e) => setNotes(e.target.value)} />
      </label>
      <Button disabled={save.isPending} onClick={() => save.mutate()}>
        Salva
      </Button>
      {save.isError && <p role="alert">Salvataggio non riuscito. Verifica i permessi.</p>}
      {save.isSuccess && <p role="status">Salvato.</p>}
    </article>
  );
}
