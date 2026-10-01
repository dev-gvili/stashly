# Honest CI and delete safety — 2026-10-02

Tech-debt pass (2026-09-29 → 10-02). The full register is `docs/tech-debt.md`; this note covers what's open.

## Shipped
- `b95cdd5`..`0b98234` CI added (#1); `e8a61eb` `326c317` `eda8fc7` Dockerfile + fly.toml (#2), plus the CI docker job that caught two boot-breaking bugs.
- `e6ac762` `fix(health)` — `/api/health` was a TODO stub returning 200; it now runs `SELECT 1` (200/503). This is also Fly's health check.
- `3f34e5e` `ci:` both jobs run on a pgvector:pg17 service: migrations from the image, every test with nothing excluded, and a 503 check with no DB.
- `e60b2eb` `test:` pinned Vitest's reporter: under Claude Code it picked `minimal`, which hid console output and errors.
- `3125712` `fba3a4b` `6030753` hidden test failures traced and fixed (silently changed feed wording, stale tests, empty `itemIds` 500 → 400).
- `e506455` `5727307` filters: an invalid value is a 400, not silently dropped; `roles` checks its own kind (`?roles=viewer,member` was a 500).
- `736d6ca` drive/notification filter keys aligned with their schemas (#8 closed).
- `6218641` permanent delete now removes S3 objects (it never did); `3d5e1d7` the orphan sweep script.
- `c554b8c` permanent delete requires `owner` via `assertItemAccess` (workspace taken from the item), all-or-nothing, 403 not 200.

## Not done
- **Trash/restore have no permission check** (`trashItem(s)`, `restoreItem(s)`): any signed-in user can trash or restore others' items. Logged in TASKS.md. Same fix as delete; role (`write`?) is the owner's call.
- **Other `/api/items` branches** (trash/move/restore) still catch errors and answer 200 `{ success: false }`; only the delete branches were fixed.
- **Malformed route params answer 500** (`?type=bogus`, `?category=bogus`, `?take=abc`): `parseSearchParams` throws a bare Error (TASKS "Loader plumbing" (d)).
- **Quota after lost uploads**: the bytes are swept; whether to recompute quota from `Item` rows is undecided (TASKS).
- **PinTest leftover users** on `default-bucket` (AccessDenied); the sweep exits 1 on them every run (TASKS).
- **#2 first real `fly deploy`**: skipped by the owner; the release command is untested against prod.
- **#4 error tracking and #12 linter** need the owner's package choice. **#14** waits on visual sign-off.
- **Trash/restore wording, #10 a11y, #13 tests, #16, #17**: open in the register.

## You must run
Nothing. No schema change, and no restart needed beyond what HMR picked up.

## Known-broken
- Nothing red in CI: the run for `c554b8c` completed with check and docker both `success` (polled to `completed`).
- No failing tests: `pnpm test` is 629/629 (44 files) locally; the type baseline is 11 errors (pre-existing, `.claude/tsc-baseline.json`).
- `.claude/settings.json` and `migration_lock.toml` are uncommitted on purpose: personal allow rules, and line endings only.

## Context worth keeping
- The S3 sweep was **applied** 2026-10-02: 652 objects deleted, 85 stale uploads aborted, 0 failures; all 534 File rows verified present after.
- Tigris rejects `AbortIncompleteMultipartUpload` lifecycle rules (400), measured. The sweep aborts stale uploads instead.
- `DeleteObjects` answers 200 even when keys fail; read `Errors` (`deleteObjects` in `s3.ts` does).
- `rc-test-*.jpg` thumbnails look like grey placeholders but are correct: the source images are grey stripe patterns.
- The owner declined the peek-references "importers" feature; the 2026-09-02 SessionStart handoff still lists it. Ignore it.
- `gh run watch` once returned before the docker job finished. Poll `status == completed` instead.
