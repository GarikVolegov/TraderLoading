# Chat: cifratura at-rest onesta + hardening media/backup — Design

> Audit finding 0.2 (+ code della social-chat). Risolve il claim "E2EE" ingannevole
> e i due bug reali adiacenti. Scelta di prodotto (2026-07-05): **cifratura at-rest
> onesta** — si tiene la cifratura AES-GCM, si abbandona la pretesa end-to-end, si
> documenta che le chiavi sono in custodia del server.

## Problema

La chat DM è pubblicizzata come **E2EE**, ma la chiave privata ECDH di ogni utente
viene caricata e salvata **in chiaro** sul server (`user_e2ee_key_backups.private_key_jwk`
= `text`), e la derivazione della shared key è deterministica (HKDF, salt fisso).
Chiunque abbia accesso al DB può quindi decifrare tutti i DM: la proprietà E2EE è di
fatto assente. Lo schema crittografico in sé (ECDH P-256 + AES-GCM) è corretto; il
problema è la **custodia della chiave**, non l'algoritmo.

Nella stessa area esistono due bug reali indipendenti dall'etichetta:
- **Perdita permanente dello storico**: `getOrCreateAccountKeyPair` rigenera e
  **sovrascrive** il backup della chiave su un errore transitorio di caricamento
  (nuovo device / rete), rendendo indecifrabili tutti i messaggi passati.
- **Media serviti senza autorizzazione**: immagini/vocali/file dei DM sono su
  `/api/uploads/{chat-files,voice}` serviti dallo static pubblico (solo check
  estensione), scaricabili da chiunque indovini l'URL.

## Decisione

Modello **"cifrato at-rest, chiavi gestite dal server"**: onesto e a zero attrito per
una feature social secondaria. Non si costruisce un flusso di recovery/passphrase.
Si smette di dichiarare E2EE e si mettono in sicurezza i due bug adiacenti.

## Ambito

Tre parti indipendenti, integrabili e committabili separatamente.

### Parte A — Relabel onesto + documentazione

Sostituire ogni dicitura "E2EE"/"end-to-end" con "cifrato"/"cifrate" (copy onesto
sulla cifratura a riposo), su tutte e 5 le lingue. Punti noti:

| Dove | Ora | Dopo |
|---|---|---|
| `MessaggiTab.tsx:813` | literal hardcoded `<Shield/> E2EE` | chiave `t()` → "Cifrato" |
| `auto.ui.5196dca303` | "Messaggi E2EE" | "Messaggi cifrati" |
| `chat.e2ee_info` | "Messaggi crittografati end-to-end" | "Messaggi cifrati" |
| `auth.shell.trust.e2ee.title` | "Chat cifrate end-to-end" | "Chat cifrate" |
| `auth.shell.trust.e2ee.desc` | "Leggi solo tu e il destinatario" (falso) | "I messaggi sono cifrati, non in chiaro" |
| `auth.shell.footer.secure` | "…chat cifrate end-to-end" | "…chat cifrate" |
| `landing.features.community.desc` | "…messaggi E2EE…" | "…messaggi cifrati…" |

Il literal hardcoded a `:813` va instradato da `t()` (una nuova chiave in tutte le
5 lingue) per rispettare il gate i18n. Le chiavi restano invariate (solo i valori
cambiano), quindi il test di parità i18n resta verde.

Documentazione: commento in `routes/chat.ts` (endpoint key-backup) e `lib/e2ee.ts`
che chiarisce: messaggi cifrati AES-GCM a riposo, chiave privata **in custodia del
server** per il recupero cross-device — **non** end-to-end.

### Parte B — Fix perdita storico (backup-overwrite) · TDD

In `getOrCreateAccountKeyPair` (`lib/e2ee.ts`) distinguere due esiti di
`accountBackup.load()`:
- **`null`** = nessun backup remoto esiste ⇒ è sicuro generare una nuova chiave.
- **eccezione** = impossibile determinare (500/timeout/rete) ⇒ **fail closed**: se
  esiste una chiave locale usarla (senza sovrascrivere il backup), altrimenti
  propagare l'errore. **Mai** generare e sovrascrivere su eccezione.

Oggi il `try/catch` collassa l'eccezione in `null` e cade nel ramo "genera +
`accountBackup.save()`", distruggendo l'unica copia valida. Il fix rimuove questa
conflazione.

**Test** (in `lib/e2ee.test.ts`): (1) `load()` lancia + nessuna chiave locale →
non chiama `save`, propaga l'errore; (2) `load()` lancia + chiave locale presente →
ritorna la locale, non chiama `save` (nessuna sovrascrittura); (3) `load()` ritorna
`null` → genera e salva (comportamento invariato del primo accesso).

### Parte C — Auth-gate media chat (participant-scoped)

Il server non conosce l'associazione file→conversazione (l'URL è nel ciphertext),
quindi la si registra all'upload.

**Dati** — nuova tabella (migrazione SQL hand-authored + schema Drizzle):
```
chat_file_access(
  id            serial pk,
  file_key      text not null unique,   -- il filename servito (es. "chat-<uuid>.pdf")
  owner_user_id text not null,          -- chi ha caricato
  peer_user_id  text not null,          -- l'altro partecipante del DM
  created_at    timestamptz not null default now()
)
index (owner_user_id), index (peer_user_id)
```

**Upload** — `/social/upload-image`, `/upload-file`, `/upload-voice` ricevono un
`toUserId` (l'altro partecipante). Validazione: `areMutualFollowers(uploader, toUserId)`
(gate già usato dai DM); in mancanza/di non-amico → 400. Registrano la riga
`chat_file_access(file_key, owner=uploader, peer=toUserId)`.

**Serving** — rimuovere `chat-files` e `voice` da `ALLOWED_UPLOAD_DIRS`
(`lib/security.ts`); `post-images` resta pubblico (feed social). Aggiungere route
autenticate `GET /uploads/chat-files/:filename` e `GET /uploads/voice/:filename`
(nel social router, come già fatto per wiki/community-files): risolvono la riga per
`file_key` e consentono solo `requester ∈ {owner_user_id, peer_user_id}`; altrimenti
404 (nessun segnale di esistenza). Stream dal disco (`CHAT_FILES_DIR`/`VOICE_DIR`).

**Frontend** — `MessaggiTab` passa `toUserId` (l'amico della conversazione attiva)
alle chiamate di upload. Gli URL dei media restano invariati (stesso path, ora
servito dalla route autenticata; l'auth è cookie-based quindi `<img>/<a>` funzionano).

**GDPR** — `chat_file_access` va aggiunta a `deleteLocalAccountData`
(`owner_user_id = ${userId} OR peer_user_id = ${userId}`); non ha una colonna
`user_id` letterale, quindi il test anti-regressione non la intercetta: aggiungerla
esplicitamente e, opzionalmente, rimuovere i file su disco dei propri upload.

**Media esistenti (pre-migrazione)** — i file caricati prima di questo cambiamento
non hanno una riga `chat_file_access`, quindi la route autenticata li restituisce
404 (per tutti, partecipanti inclusi): i media DM storici smettono di caricarsi.
Non è possibile fare backfill dei partecipanti (l'URL è nel ciphertext, il server non
sa a chi appartenessero). Conseguenza **accettata** per una feature social secondaria:
meglio 404 su media vecchi che lasciarli pubblicamente scaricabili. Da comunicare
nel changelog; nessuno script di migrazione dati.

## Fuori ambito (follow-up)

- Vero E2EE con recovery a passphrase / chiavi per-device.
- WebRTC signaling senza controllo di relazione (finding separato 0.4).
- Cifratura dei byte del media (non necessaria nel modello at-rest: basta l'auth-gate).
- Store `accountBridge` con lo stesso bug multi-tenant di 0.11 (follow-up di 0.11).

## Verifica

- Parte A: gate i18n verde (chiavi invariate); nessun "E2EE"/"end-to-end" residuo in UI.
- Parte B: i 3 test in `e2ee.test.ts` (fail-closed su eccezione, no overwrite).
- Parte C: typecheck; test statico che le route autenticate esistono e gattano su
  owner/peer; `chat-files`/`voice` non più in `ALLOWED_UPLOAD_DIRS`; coverage GDPR
  include `chat_file_access`.
