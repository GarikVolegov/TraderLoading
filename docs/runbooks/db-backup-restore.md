# Runbook — Database backup, restore & migration rollback

> Addresses audit finding **2.5** ("Nessun backup/restore DB Neon né rollback migrazioni").
> Production DB is **Neon** (managed Postgres). Migrations are **forward-only**, applied by
> Railway's `preDeployCommand: pnpm run db:migrate` ([railway.json](../../railway.json)) on every
> deploy from `main`. There is **no automatic rollback** — this runbook is the manual procedure.

## 0. Targets (RPO / RTO)

| Metric | Target | Basis |
|---|---|---|
| **RPO** (max data loss) | ≤ 5 min | Neon PITR granularity (WAL-based) |
| **RTO** (time to restore) | ≤ 30 min | Neon branch/restore is near-instant; app redeploy dominates |

Confirm the **history-retention window** on the current Neon plan (Free ≈ 24 h, paid plans up to
30 d). If retention is shorter than the desired recovery window, **enable the scheduled logical
backup** in §4 as the long-term copy.

## 1. Backup — what protects the data today

1. **Neon PITR (primary).** Neon continuously retains WAL, so the DB can be restored to any second
   within the retention window. Nothing to run; verify it's enabled in the Neon console
   (Project → Settings → *History retention* > 0).
2. **Neon branching (safety copy).** A branch is a copy-on-write clone of the DB at a point in time —
   free and instant. Use one as a **pre-migration snapshot** (§3) and for **read-only forensics**
   without touching prod.
3. **Scheduled logical backup (belt-and-suspenders).** `pg_dump` → object storage, off Neon, so a
   Neon-side incident or an expired retention window is still recoverable (§4).

## 2. Restore — recover from data loss / bad write

**A. Point-in-time restore (Neon console)**
1. Neon console → Project → **Restore** (or *Branches → Restore*).
2. Pick the timestamp **just before** the incident (respect RPO; err earlier).
3. Restore **into a new branch** first (non-destructive), point a throwaway `DATABASE_URL` at it, and
   verify the data is correct.
4. Promote: either repoint prod `DATABASE_URL` (Railway env) to the restored branch, **or** reset the
   primary branch to the restore point. Redeploy the Railway service so the app reconnects.

**B. Restore from the logical dump (§4)** — when Neon retention has already expired:
```bash
# against an empty target DB / branch
pg_restore --clean --if-exists --no-owner -d "$TARGET_DATABASE_URL" latest.dump
```

## 3. Migration rollback (forward-only schema)

Drizzle migrations only go forward, so "rollback" is one of:

**Path A — schema-only mistake, no data written yet (fastest):** write a **compensating forward
migration** that undoes the change (e.g. `DROP COLUMN` / `DROP INDEX`), commit it as the next
numbered migration + `_journal.json` entry, deploy. Preferred for small, reversible DDL.

**Path B — destructive/irreversible migration (dropped column, bad backfill):** restore the DB to the
**pre-migration point** via §2A, then redeploy the *previous* app revision (Railway → Deployments →
Redeploy the last-good build) so code and schema match again.

**Always, before a risky migration:** take a **Neon branch** as the snapshot —
```
Neon console → Branches → New branch (from primary, "now")  →  name it pre-<migration-tag>
```
so Path B is a one-click reset instead of a PITR hunt. Consider adding this as a manual pre-deploy
step for migrations touching existing data (drops, type changes, backfills).

## 4. Scheduled logical backup (GitHub Action → R2/S3)

Nightly `pg_dump` to object storage, independent of Neon retention. Sketch (wire with the real
`DATABASE_URL` + storage secrets before enabling):

```yaml
# .github/workflows/db-backup.yml
name: db-backup
on:
  schedule: [{ cron: "0 3 * * *" }]   # 03:00 UTC daily
  workflow_dispatch:
jobs:
  dump:
    runs-on: ubuntu-latest
    steps:
      - run: pg_dump --format=custom --no-owner "$DATABASE_URL" -f "db-$(date +%F).dump"
        env: { DATABASE_URL: "${{ secrets.DATABASE_URL_RO }}" }   # use a read-only role
      - run: |   # upload to R2/S3 with lifecycle-expiry on the bucket (e.g. 30 days)
          aws s3 cp "db-$(date +%F).dump" "s3://$BUCKET/db/" --endpoint-url "$S3_ENDPOINT"
        env:
          AWS_ACCESS_KEY_ID: "${{ secrets.R2_KEY }}"
          AWS_SECRET_ACCESS_KEY: "${{ secrets.R2_SECRET }}"
          S3_ENDPOINT: "${{ secrets.R2_ENDPOINT }}"
          BUCKET: "${{ secrets.R2_BUCKET }}"
```

## 5. Quarterly restore drill (don't trust an untested backup)

1. Restore the newest logical dump (§2B) into a fresh Neon branch.
2. Point a local API at it (`DATABASE_URL=<branch-url> pnpm --filter api-server dev`), smoke-test
   login + a couple of reads.
3. Record the wall-clock **RTO** and the effective **RPO** (dump age). If either misses the §0 target,
   shorten the backup interval or upgrade Neon retention.

## Owner & escalation

- **First responder:** whoever owns the deploy. Prefer restore-into-a-branch (non-destructive) before
  any reset of the primary branch.
- **Never** run a destructive `--clean` restore straight at the prod branch without a verified branch copy first.
