# Quota

Storage quota per drive: where it is read, where it is charged and refunded,
and the client code around it. The upload side is in
[upload-multipart.md](upload-multipart.md); trash, restore and delete are in
the `stashly-item-lifecycle` skill.

## Model

`prisma/models/quota.prisma`:

- `Quota`: one row per drive (`driveId` is unique). `total` (the plan's
  limit), `used`, `deleted` (bytes in the trash) and `status`, all bytes as
  `BigInt`.
- `QuotaDelta`: upload charges logged while the database is busy, applied by
  the size rollup (`app/.server/size-rollup.ts`).

A drive pays for what is on it: an upload charges the **folder's** drive, so a
collaborator's upload is paid for by the folder's owner. Refunds follow
`Item.driveId`, never the acting user. CLAUDE.md → Development has the details.

## Status

`toQuotaStatus` in `app/.server/quota-actions.ts`:

| Status | When `used / total` is |
|---|---|
| `normal` | 90% or less |
| `warning` | over 90% |
| `critical` | over 99% |
| `exceeded` | over 100% (or anything used with a `total` of 0) |

`toQuota` adds `remaining` and `status` to a row. `calculateQuota` projects a
change (deltas added, `total` replaced, floored at zero) for previews only; it
is not a write path.

## Where quota changes

Only on the server, in the code that changes the rows it accounts for. No
request can set a quota.

| Change | Code | How |
|---|---|---|
| Upload | `insertUploadedItem` (`app/.server/item-actions.ts`) | `stashly_charge_upload()` (migration `20261106120000_upload_quota_log`) in the same statement that creates the `Item`. The `UPDATE` only matches when the file fits, so the limit can't be overrun by two uploads at once; a refusal answers 507 and writes no row. Far from the limit a busy upload logs its charge in `QuotaDelta`; near the limit it charges directly, one at a time. `refuseUploadCharge` says why after a refusal |
| Copy | `onItemsCopied`, inside the copy's transaction | the copier pays, for the bytes actually copied; a refusal rolls the copy back |
| Trash | `onItemsTrashed`, after `settlePendingCharges` | `settlePendingCharges` applies a drive's logged charges first, so `used` can't clamp at 0 against a charge still in the log |
| Restore | `onItemsRestored` | |
| Delete | `onItemsDeleted` | |
| Plan change | `subscription-actions.ts` | `updateTotalQuota`, or a direct `quota.update` of `total` to the plan's `storageLimit` |

The trash, restore and delete refunds run once per `Item.driveId` with the
bytes the statement itself moved.

## Reads: `/api/quota`

`app/routes/api/quota.ts`, JSON body, `action` discriminator
(`quotaApiRouteInput`), read-only. The user comes from the session. A body that
fails the schema answers 400.

| `action` | Returns |
|---|---|
| `find-quota` | the user's quota (`quotaApiRouteOutput`, bytes as numbers) |
| `verify-free-quota` `{ dataSize, folderId? }` | `boolean` |
| `check-free-quota` `{ itemId, dataSize, folderId? }` | `{ itemId, result: 'allowed' \| 'denied' }` |

With a `folderId`, the answer is for that folder's drive (`findQuotaForFolder`)
and only ever yes or no, so a collaborator isn't told the owner's free space.

Three server functions answer "is there room?": `verifyFreeQuota` (boolean),
`checkFreeQuota` (the allowed/denied object) and `validateQuotaFreeSpace`
(throws `INSUFFICIENT_QUOTA`).

## Client

- `app/machines/quota/quota.actors.ts`: `checkQuota`, `verifyQuota`,
  `findQuota`, fetch actors over `/api/quota`. The file machine invokes
  `checkQuota` in its `checkingQuota` state as a pre-check that saves a doomed
  transfer.
- `useUpload.ts` checks a whole batch once and queues its files with
  `skipQuotaCheck: true`.
- `app/machines/quota/quota.machine.ts` exists but nothing spawns it. It only
  reads, and is kept in case quota reads move into one shared actor
  (tech-debt item 41).

## Tests

`app/routes/api/__tests__/quota.test.ts`,
`app/machines/reviset/__tests__/file-quota-check.test.ts`, and the live-database
`app/.server/__tests__/upload-quota-charge.test.ts` (refusal, exact fill,
concurrency).
