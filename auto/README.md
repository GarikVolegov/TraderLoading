# Nightshift — runbook

Agente autonomo notturno: ogni notte alle 01:00 lavora la coda (`queue.json`) in worktree
isolati, apre PR su GitHub e lascia un report in `reports/`. Spec:
`docs/superpowers/specs/2026-07-05-nightshift-autonomous-agent-design.md`.

## Installazione (una tantum)

```bash
cp auto/com.traderloadings.nightshift.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.traderloadings.nightshift.plist
sudo pmset repeat wakeorpoweron MTWRFSU 00:55:00   # il Mac si sveglia alle 00:55
```

## Uso quotidiano

- **Fermarlo:** `touch auto/STOP` (soft) · `launchctl unload ~/Library/LaunchAgents/com.traderloadings.nightshift.plist` (hard).
- **Riattivarlo:** `rm auto/STOP` (e `launchctl load …` se scaricato).
- **Run manuale diurna:** `./auto/run.sh` (ignora STOP_HOUR) · prova generale: `./auto/run.sh --dry-run`.
- **Report:** `auto/reports/YYYY-MM-DD.md` · log dettagliati in `auto/logs/`.
- **Quota:** regola `MAX_TASKS` in `auto/config.sh` (Max 5x → 2 di default).

## Alimentare la coda

- **Audit:** aggiungi task a `queue.json` copiando il formato esistente (description → sezione
  del piano audit, priority progressiva).
- **Feature:** genera un PRD con `/prd`, convertilo con `/ralph`, poi copia le storie in
  `queue.json` con `source:"prd"` e i campi di stato (`status:"pending"`, `attempts:0`,
  `maxAttempts:2`, `branch:null`, `prUrl:null`, `notes:""`).
- **Chore:** aggiungi template in `chores.json` (`recurrence: "nightly"|"weekly"`, `weekday` 0–6).

## Esiti di un task

- ✅ PR aperta verso `feat/community-management` → la mergi tu.
- ✅ «nessuna modifica necessaria» (chore già verdi).
- ❌ gate rosso/timeout → riprova la notte dopo (max 2 tentativi), worktree lasciato in
  `.worktrees/auto-<id>` per ispezione; poi `failed` nel report.
- 📝 AUTONOTES.md nel report = l'agente s'è fermato davanti a una decisione di prodotto.

## Note

- Lo step audit 0.2 (E2EE) NON è in coda di proposito: richiede una decisione di prodotto.
- Il gate meccanico (typecheck+test+anti-secret+migrazioni intoccate) gira comunque,
  qualunque cosa dichiari il modello.
- Se il Mac era spento alle 01:00 la run salta (launchd non recupera le StartCalendarInterval
  perse a Mac spento; a Mac acceso/sleep la recupera al risveglio).
