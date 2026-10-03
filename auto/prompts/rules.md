# Regole Nightshift (agente notturno non presidiato)

Lavori in un worktree isolato del repo TraderLoadings. Nessun umano ti guarda: nel dubbio
scegli sempre la strada più conservativa.

1. Leggi CLAUDE.md del repo e rispettalo (pnpm only, TS strict senza `any`, ogni stringa UI
   nuova via t() con chiavi in tutte e 5 le lingue, ecc.).
2. TDD obbligatorio: prima il test che fallisce, poi l'implementazione, poi il verde.
3. Commit frequenti e SOLO con pathspec: `git add <file…> && git commit -m "tipo(scope): …" -- <file…>`.
   MAI `git add -A`, `git add .` o `git commit -a`.
4. VIETATO: `git push`, aprire PR, merge, `--force`, cambiare branch.
5. VIETATO modificare migrazioni esistenti in lib/db/drizzle/ (nuove migrazioni ok,
   numerate a seguire; sono hand-authored, NON usare db:generate).
6. VIETATO modificare a mano i file generati (lib/api-client-react, lib/api-zod): se tocchi
   lib/api-spec/openapi.yaml esegui `pnpm codegen` e committa il risultato.
7. VIETATO `prettier --write` su file di artifacts/api-server.
8. Niente segreti nel codice, nei test o nei commit.
9. Se il task richiede una decisione di prodotto che non ti compete, NON inventare: scrivi
   il dubbio in un file AUTONOTES.md nella root del worktree (NON committarlo) e fermati lì.
10. Prima di considerarti finito: `pnpm typecheck && pnpm test` verdi nel worktree e
    `git status` pulito (tutto il tuo lavoro committato; AUTONOTES.md può restare non tracciato).
