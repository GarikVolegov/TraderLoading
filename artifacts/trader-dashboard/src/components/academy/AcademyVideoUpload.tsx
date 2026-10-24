import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiJSON } from "@/lib/apiFetch";
import { Button } from "@/components/ui/button";

export function ManagedLessonVideo({ id, title }: { id: string; title: string }) {
  const playback = useQuery({
    queryKey: ["academy", "playback", id],
    queryFn: () =>
      apiJSON<{ url: string; expiresAt: string }>(
        `academy/lessons/${encodeURIComponent(id)}/playback`,
      ),
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  if (playback.isError)
    return (
      <div role="alert">
        <p>Video non disponibile o accesso scaduto.</p>
        <Button variant="outline" onClick={() => void playback.refetch()}>
          Riprova
        </Button>
      </div>
    );
  return playback.data ? (
    <>
      <iframe
        className="academy-player"
        src={playback.data.url}
        title={title}
        allow="fullscreen; picture-in-picture; encrypted-media"
        allowFullScreen
        sandbox="allow-scripts allow-same-origin allow-presentation"
      />
      <Button type="button" variant="ghost" onClick={() => void playback.refetch()}>
        Rinnova accesso al video
      </Button>
    </>
  ) : (
    <p role="status">Preparazione del video…</p>
  );
}

/** TUS HEAD + bounded PATCH chunks resume from the server offset after interruption. */
export async function uploadVideoChunks(
  file: File,
  url: string,
  signal: AbortSignal,
  progress: (value: number) => void,
) {
  const head = await fetch(url, {
    method: "HEAD",
    headers: { "Tus-Resumable": "1.0.0" },
    signal,
    credentials: "omit",
  });
  if (!head.ok || !head.headers.has("Upload-Offset"))
    throw new Error("Impossibile riprendere il caricamento. Riprova.");
  let offset = Number(head.headers.get("Upload-Offset"));
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > file.size)
    throw new Error("Stato di caricamento non valido.");
  while (offset < file.size) {
    const end = Math.min(offset + 8 * 1024 ** 2, file.size);
    const response = await fetch(url, {
      method: "PATCH",
      headers: {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": String(offset),
        "Content-Type": "application/offset+octet-stream",
      },
      body: file.slice(offset, end),
      signal,
      credentials: "omit",
    });
    if (!response.ok)
      throw new Error("Caricamento interrotto. Premi Riprendi per continuare dal punto salvato.");
    const next = Number(response.headers.get("Upload-Offset"));
    if (!response.headers.has("Upload-Offset") || next !== end)
      throw new Error("Offset video non valido. Riprendi per verificare lo stato.");
    offset = next;
    progress(Math.round((offset / file.size) * 100));
  }
}
export function AcademyVideoUpload({
  currentId,
  onConfirm,
}: {
  currentId: string | null;
  onConfirm: (id: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<{ id: string; uploadUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const status = useQuery({
    queryKey: ["academy", "upload", upload?.id],
    queryFn: () =>
      apiJSON<{ state: string; error: string | null; url?: string }>(
        `academy/videos/${upload!.id}`,
      ),
    enabled: uploaded && Boolean(upload),
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.state === "ready" || query.state.data?.state === "error" ? false : 5000,
  });
  return (
    <section className="academy-panel" aria-label="Video del docente">
      <h3>Carica il tuo video</h3>
      <p className="academy-caption">
        Il video attuale rimane associato fino alla conferma del nuovo video e al salvataggio della
        lezione.
      </p>
      <label className="block">
        File video
        <input
          type="file"
          accept="video/*"
          disabled={busy}
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null);
            setUpload(null);
            setUploaded(false);
            setPercent(0);
            setError("");
          }}
        />
      </label>
      <div className="academy-actions">
        <Button
          type="button"
          variant="outline"
          disabled={!file || busy || uploaded}
          onClick={async () => {
            if (!file) return;
            controller.current = new AbortController();
            setBusy(true);
            setError("");
            try {
              const target =
                upload ??
                (await apiJSON<{ id: string; uploadUrl: string }>("academy/videos/upload", {
                  method: "POST",
                  body: JSON.stringify({ size: file.size }),
                }));
              setUpload(target);
              await uploadVideoChunks(
                file,
                target.uploadUrl,
                controller.current.signal,
                setPercent,
              );
              setUploaded(true);
            } catch (err) {
              setError(
                err instanceof Error && err.name !== "AbortError"
                  ? err.message
                  : "Caricamento in pausa. Puoi riprenderlo.",
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {upload ? "Riprendi caricamento" : "Carica video"}
        </Button>
        {busy && (
          <Button type="button" variant="outline" onClick={() => controller.current?.abort()}>
            Pausa
          </Button>
        )}
      </div>
      {(busy || upload) && (
        <div role="status">
          <progress aria-label="Avanzamento caricamento" value={percent} max={100} /> {percent}%
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {uploaded && !status.data && <p role="status">Verifica dell’elaborazione…</p>}
      {status.isError && (
        <div role="alert">
          <p>Verifica del video non riuscita.</p>
          <Button type="button" onClick={() => void status.refetch()}>
            Riprova verifica
          </Button>
        </div>
      )}
      {status.data?.state === "processing" && (
        <p role="status">Caricamento completato. Elaborazione in corso…</p>
      )}
      {status.data?.state === "error" && <p role="alert">{status.data.error}</p>}
      {status.data?.state === "ready" && upload && (
        <>
          <iframe
            className="academy-player"
            src={status.data.url}
            title="Anteprima video da confermare"
            allow="fullscreen; picture-in-picture"
            allowFullScreen
          />
          <Button
            type="button"
            disabled={currentId === upload.id}
            onClick={() => onConfirm(upload.id)}
          >
            {currentId === upload.id
              ? "Video selezionato: salva la lezione"
              : "Conferma questo video"}
          </Button>
        </>
      )}
      {currentId && !uploaded && <p className="academy-caption">Video gestito già associato.</p>}
    </section>
  );
}
