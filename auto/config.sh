# Nightshift — configurazione (sourced da run.sh; niente logica qui)
export PATH="$HOME/.local/bin:$HOME/.local/node/bin:$HOME/Library/pnpm/.tools/pnpm/9.12.0:$PATH"

MAX_TASKS=1                              # task pesanti (audit/prd) per notte
STOP_HOUR=7                              # nelle run schedulate non si iniziano task dopo quest'ora
TASK_TIMEOUT=3600                        # secondi max per un task pesante
CHORE_TIMEOUT=1200                       # secondi max per chore e review
BASE_BRANCH="feat/community-management"  # branch da cui partono i worktree e verso cui aprire le PR
GITHUB_REPO="GarikVolegov/TraderLoading" # repo canonico (il vecchio nome redirige)
CLAUDE_BIN="$HOME/.local/bin/claude"
LIGHT_MODEL="sonnet"                     # modello per chore e review
