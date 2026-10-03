#!/usr/bin/env bash
# Nightshift — runner notturno. Uso: ./auto/run.sh [--dry-run]
# Guard-rail: lavora SOLO in worktree sotto .worktrees/, pusha SOLO branch auto/*, mai merge.
set -euo pipefail

AUTO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(dirname "$AUTO_DIR")"
source "$AUTO_DIR/config.sh"
source "$AUTO_DIR/github.sh"

DRY=0
[[ "${1:-}" == "--dry-run" ]] && DRY=1

TODAY="$(date +%F)"
LOG_DIR="$AUTO_DIR/logs"
REPORT_DIR="$AUTO_DIR/reports"
mkdir -p "$LOG_DIR" "$REPORT_DIR"
RUN_LOG="$LOG_DIR/run-$TODAY.log"
REPORT_LINES=()

log() { printf '%s %s\n' "$(date '+%H:%M:%S')" "$*" | tee -a "$RUN_LOG"; }
report() { REPORT_LINES=(${REPORT_LINES[@]+"${REPORT_LINES[@]}"} "$*"); }
queue() { node "$AUTO_DIR/queue.mjs" "$@"; }
task_field() { node -pe 'JSON.parse(process.argv[1]).'"$2"' ?? ""' "$1"; }

# ---- pre-flight ---------------------------------------------------------------
[[ -f "$AUTO_DIR/STOP" ]] && { log "STOP presente: esco."; exit 0; }

LOCK="$AUTO_DIR/.lock"
if [[ -f "$LOCK" ]] && kill -0 "$(cat "$LOCK")" 2>/dev/null; then
  log "run già attiva (pid $(cat "$LOCK")): esco."
  exit 0
fi
echo $$ > "$LOCK"
trap 'rm -f "$LOCK"' EXIT

cd "$REPO_DIR"
git fetch origin --quiet
mkdir -p "$REPO_DIR/.worktrees"

stale="$(queue recover || true)"
[[ -n "$stale" ]] && report "⚠️ task interrotti dalla run precedente (ritentati): $(echo "$stale" | tr '\n' ' ')"

if [[ $DRY -eq 1 ]]; then
  queue materialize "$TODAY" --dry | while read -r line; do log "materialize: $line"; done
else
  queue materialize "$TODAY" | while read -r line; do log "materialize: $line"; done
fi

clock_ok() { # nelle run schedulate non si iniziano task dopo STOP_HOUR
  [[ "${NIGHTSHIFT_SCHEDULED:-0}" != "1" ]] && return 0
  (( 10#$(date +%H) < STOP_HOUR ))
}

# ---- gate meccanico -------------------------------------------------------------
gate() { # gate WORKTREE — indipendente da ciò che dichiara il modello
  local wt="$1"
  ( cd "$wt" && pnpm install --prefer-offline >>"$RUN_LOG" 2>&1 \
      && pnpm typecheck >>"$RUN_LOG" 2>&1 \
      && pnpm test >>"$RUN_LOG" 2>&1 ) || { log "gate: typecheck/test rossi"; return 1; }
  if ( cd "$wt" && git diff "origin/$BASE_BRANCH...HEAD" -- . ':!pnpm-lock.yaml' \
      | grep -qE 'sk-[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY' ); then
    log "gate: possibile segreto nel diff"; return 1
  fi
  if ( cd "$wt" && git diff --name-only --diff-filter=MD "origin/$BASE_BRANCH...HEAD" -- 'lib/db/drizzle/*.sql' | grep -q . ); then
    log "gate: migrazione esistente modificata/cancellata"; return 1
  fi
  if ( cd "$wt" && git status --porcelain | grep -v 'AUTONOTES.md' | grep -q . ); then
    log "gate: working tree non pulita (lavoro non committato)"; return 1
  fi
  return 0
}

make_pr_body() { # make_pr_body TASK_JSON N_COMMIT
  node -e '
    const t = JSON.parse(process.argv[1]);
    const n = process.argv[2];
    const ac = t.acceptanceCriteria.map(c => "- " + c).join("\n");
    process.stdout.write(`## ${t.title}\n\n${t.description}\n\n### Criteri di accettazione\n${ac}\n\n### Gate\n- typecheck ✅ · test ✅ · anti-secret ✅ (${n} commit)\n\n_Aperta automaticamente da Nightshift (task ${t.id})._\n`);
  ' "$1" "$2"
}

# ---- fase review ----------------------------------------------------------------
log "fase review PR aperte"
while IFS=$'\t' read -r num branch; do
  [[ -z "${num:-}" ]] && continue
  if gh_pr_reviewed "$num"; then log "PR #$num già recensita"; continue; fi
  if [[ $DRY -eq 1 ]]; then log "DRY: recensirei PR #$num ($branch)"; continue; fi
  log "review PR #$num ($branch)"
  body="$LOG_DIR/review-$num.md"
  if { cat "$AUTO_DIR/prompts/review.md"; echo; gh_pr_diff "$num"; } \
      | timeout "$CHORE_TIMEOUT" "$CLAUDE_BIN" -p --model "$LIGHT_MODEL" --dangerously-skip-permissions \
      > "$body" 2>>"$RUN_LOG" && grep -q 'nightshift-review' "$body"; then
    gh_comment "$num" "$body"
    report "🔍 review postata su PR #$num ($branch)"
  else
    report "❌ review PR #$num fallita (vedi $RUN_LOG)"
  fi
done < <(gh_open_prs)

# ---- fase lavoro ------------------------------------------------------------------
work_loop() { # work_loop KIND BUDGET TIMEOUT
  local kind="$1" budget="$2" tmo="$3" launched=0
  while (( launched < budget )); do
    clock_ok || { log "oltre STOP_HOUR: non inizio altri task $kind"; break; }
    local task_json
    task_json=$(queue next "$kind") || { log "coda $kind vuota"; break; }
    local id src model title
    id=$(task_field "$task_json" id)
    src=$(task_field "$task_json" source)
    model=$(task_field "$task_json" model)
    title=$(task_field "$task_json" title)
    if [[ $DRY -eq 1 ]]; then log "DRY: lavorerei $id ($src): $title"; break; fi
    launched=$((launched + 1))
    queue start "$id"
    log "task $id ($src): $title"

    local wt="$REPO_DIR/.worktrees/auto-$id" branch="auto/$id"
    git worktree remove --force "$wt" 2>/dev/null || true
    git branch -D "$branch" 2>/dev/null || true
    git worktree add "$wt" -b "$branch" "origin/$BASE_BRANCH" >>"$RUN_LOG" 2>&1

    local prompt="$LOG_DIR/prompt-$id.md"
    { cat "$AUTO_DIR/prompts/rules.md"; echo; cat "$AUTO_DIR/prompts/$src.md"; echo
      echo '## Il tuo task'; echo '```json'; printf '%s\n' "$task_json"; echo '```'; } > "$prompt"
    local margs=()
    [[ -n "$model" ]] && margs=(--model "$model")
    if ! ( cd "$wt" && timeout "$tmo" "$CLAUDE_BIN" -p ${margs[@]+"${margs[@]}"} --dangerously-skip-permissions \
        < "$prompt" >>"$RUN_LOG" 2>&1 ); then
      queue fail "$id" "claude fallito o timeout"
      report "❌ $id: claude fallito/timeout (worktree lasciato: $wt)"
      continue
    fi
    [[ -f "$wt/AUTONOTES.md" ]] && report "📝 $id ha lasciato note: $(head -c 500 "$wt/AUTONOTES.md")"
    if ! gate "$wt"; then
      queue fail "$id" "gate rosso"
      report "❌ $id: gate rosso (worktree lasciato per ispezione: $wt)"
      continue
    fi
    local commits
    commits=$(cd "$wt" && git rev-list --count "origin/$BASE_BRANCH..HEAD")
    if (( commits == 0 )); then
      queue done "$id" "" "nessuna modifica necessaria"
      git worktree remove --force "$wt"
      git branch -D "$branch" 2>/dev/null || true
      report "✅ $id: nessuna modifica necessaria"
      continue
    fi
    if ! ( cd "$wt" && git push -u origin "$branch" ) >>"$RUN_LOG" 2>&1; then
      queue fail "$id" "push fallito"
      report "❌ $id: push fallito (worktree lasciato: $wt)"
      continue
    fi
    local prbody="$LOG_DIR/prbody-$id.md" pr_url=""
    make_pr_body "$task_json" "$commits" > "$prbody"
    pr_url=$(gh_create_pr "$branch" "[nightshift] $title" "$prbody") || pr_url=""
    queue done "$id" "$pr_url"
    git worktree remove --force "$wt"
    report "✅ $id → ${pr_url:-PR non creata, branch pushato: $branch}"
  done
}

log "fase chore"
work_loop chore 10 "$CHORE_TIMEOUT"
log "fase lavoro pesante (max $MAX_TASKS)"
work_loop heavy "$MAX_TASKS" "$TASK_TIMEOUT"

# ---- chiusura -----------------------------------------------------------------------
REPORT_FILE="$REPORT_DIR/$TODAY.md"
{
  echo "# Nightshift — $TODAY"
  echo
  if [[ ${#REPORT_LINES[@]} -eq 0 ]]; then
    echo "- nessun evento (coda vuota o solo review già fatte)"
  else
    for line in "${REPORT_LINES[@]}"; do echo "- $line"; done
  fi
} > "$([[ $DRY -eq 1 ]] && echo /dev/stdout || echo "$REPORT_FILE")"
if [[ $DRY -eq 0 ]]; then
  log "report: $REPORT_FILE"
  osascript -e "display notification \"${#REPORT_LINES[@]} eventi — vedi auto/reports/$TODAY.md\" with title \"Nightshift\"" 2>/dev/null || true
fi
log "fine run"
