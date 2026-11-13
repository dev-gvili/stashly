/**
 * Every id, email and name the specs and `global-setup.ts` share.
 *
 * **One seeded user per Playwright worker.** The specs share nothing but the
 * database and the dev server, so each worker gets its own user, drive, root
 * folder, bucket, quota, session and seeded items. `e2eIds(i)` derives all of
 * them from the worker index `i`: worker 0 keeps the original ids, worker `i`
 * replaces the last character of each id (they all end in `0`) with the digit
 * `i`, so up to 9 workers.
 *
 * The named exports below (`TEST_USER_ID`, `E2E_ITEM_A_ID`, ...) are the ids of
 * *the worker running this file*: Playwright sets `TEST_PARALLEL_INDEX` in each
 * worker's environment before it imports a spec, so a spec keeps importing
 * constants as before and gets its own worker's. (The runner process, which
 * only lists tests, and global setup see index 0; setup seeds every index
 * through `e2eIds` and never reads these.)
 */

/** How many workers run, and so how many users setup seeds. */
export const E2E_WORKERS = Math.min(9, Math.max(1, Number(process.env.E2E_WORKERS ?? 1) || 1))

/** The index of the worker this process is, 0 outside a worker. */
export const WORKER_INDEX = Number(process.env.TEST_PARALLEL_INDEX ?? 0) || 0

/** `id` for worker `i`: unchanged for 0, else its last character becomes `i`. */
const ix = (id: string, i: number) => (i === 0 ? id : id.slice(0, -1) + String(i))

export function e2eIds(i: number) {
  return {
    TEST_USER_ID: ix('usr_e2e_test_fixed_id_000000', i),
    TEST_USER_EMAIL: i === 0 ? 'e2e-test@stashly.test' : `e2e-test-${i}@stashly.test`,
    E2E_DRIVE_ID: ix('drv_e2e_test_000000', i),
    E2E_ROOT_FOLDER_ID: ix('root_e2e_test_000000', i),
    E2E_QUOTA_ID: ix('quo_e2e_test_000000', i),
    E2E_SUB_ID: ix('sub_e2e_test_000000', i),
    E2E_SESSION_ID: ix('ses_e2e_test_fixed_id_00000', i),

    // Favorites E2E — stable IDs reset on every global-setup run
    E2E_ITEM_A_ID: ix('item_e2e_fav_aaa0000000000000', i), // starts unfavorited (toggle-on test)
    E2E_ITEM_B_ID: ix('item_e2e_fav_bbb0000000000000', i), // starts favorited  (toggle-off test)
    E2E_ITEM_C_ID: ix('item_e2e_fav_ccc0000000000000', i), // starts favorited  (listing test)
    E2E_ITEM_D_ID: ix('item_e2e_fav_ddd0000000000000', i), // two favorite rows (duplicate)
    E2E_ITEM_E_ID: ix('item_e2e_fav_eee0000000000000', i), // starts unfavorited (favorited twice)
    E2E_ITEM_F_ID: ix('item_e2e_fav_fff0000000000000', i), // starts unfavorited (bulk add)
    E2E_ITEM_G_ID: ix('item_e2e_fav_ggg0000000000000', i), // starts favorited  (bulk skip)

    // The other user (one for all workers) owns a set of items per worker, each
    // shared with that worker's user only: whose items the user may or may not read
    OTHER_PRIVATE_ID: ix('item_e2e_oth_prv0000000000000', i), // never shared
    OTHER_SHARED_ID: ix('item_e2e_oth_shr0000000000000', i), // shared with the E2E user (read)
    OTHER_REVOKED_ID: ix('item_e2e_oth_rvk0000000000000', i), // shared, favorited, then revoked

    // Pins E2E — stable IDs reset on every global-setup run
    E2E_PIN_ITEM_A_ID: ix('item_e2e_pin_aaa0000000000000', i), // starts unpinned (toggle-on test)
    E2E_PIN_ITEM_B_ID: ix('item_e2e_pin_bbb0000000000000', i), // starts pre-pinned (toggle-off test)
    E2E_PIN_ITEM_C_ID: ix('item_e2e_pin_ccc0000000000000', i), // pre-pinned, never toggled (list test)

    // Images gallery E2E — three images landing in Today, Last week and a past
    // month. Each has a stage-2 thumbnail row so `getGalleryMedia` lists it; the
    // object behind it need not exist, the tests check layout and behaviour.
    E2E_GALLERY_IMAGES: [
      { id: ix('item_e2e_gal_aaa0000000000000', i), name: 'e2e-gallery-today.png', daysAgo: 0, width: 1600, height: 900 },
      { id: ix('item_e2e_gal_bbb0000000000000', i), name: 'e2e-gallery-week.png', daysAgo: 3, width: 900, height: 1200 },
      { id: ix('item_e2e_gal_ccc0000000000000', i), name: 'e2e-gallery-old.png', daysAgo: 60, width: 1200, height: 1200 },
    ] as const,

    /** Target for the gallery's "Add to collection"; emptied on every setup run. */
    E2E_GALLERY_COLLECTION: {
      id: ix('item_e2e_gal_col0000000000000', i),
      name: 'E2E Gallery Collection',
    } as const,

    /** Ids of rows only setup touches, one per worker. */
    PERM_SHARED_ID: `perm_e2e_oth_shared${i === 0 ? '' : '_' + i}`,
    PERM_REVOKED_ID: `perm_e2e_oth_revoked${i === 0 ? '' : '_' + i}`,
    FAV_ID_PREFIX: i === 0 ? 'fav_e2e_test_000_' : `fav_e2e_test_w${i}_`,
    PIN_ID_PREFIX: i === 0 ? 'pin_e2e_test_000_' : `pin_e2e_test_w${i}_`,
  }
}

const mine = e2eIds(WORKER_INDEX)

export const TEST_USER_ID = mine.TEST_USER_ID
export const TEST_USER_EMAIL = mine.TEST_USER_EMAIL
export const E2E_ITEM_A_ID = mine.E2E_ITEM_A_ID
export const E2E_ITEM_B_ID = mine.E2E_ITEM_B_ID
export const E2E_ITEM_C_ID = mine.E2E_ITEM_C_ID
export const E2E_ITEM_D_ID = mine.E2E_ITEM_D_ID
export const E2E_ITEM_E_ID = mine.E2E_ITEM_E_ID
export const E2E_ITEM_F_ID = mine.E2E_ITEM_F_ID
export const E2E_ITEM_G_ID = mine.E2E_ITEM_G_ID
export const E2E_ITEM_A_NAME = 'E2E Fav Item A'
export const E2E_ITEM_B_NAME = 'E2E Fav Item B'
export const E2E_ITEM_C_NAME = 'E2E Fav Item C'
export const E2E_ITEM_D_NAME = 'E2E Fav Item D'
export const E2E_ITEM_E_NAME = 'E2E Fav Item E'
export const E2E_ITEM_F_NAME = 'E2E Fav Item F'
export const E2E_ITEM_G_NAME = 'E2E Fav Item G'

// The other user, shared by every worker: it owns each worker's access-control items
export const OTHER_USER_ID = 'usr_e2e_other_fixed_id_00000'
export const OTHER_USER_EMAIL = 'e2e-other@stashly.test'
export const OTHER_DRIVE_ID = 'drv_e2e_other_000000'
export const OTHER_PRIVATE_ID = mine.OTHER_PRIVATE_ID
export const OTHER_SHARED_ID = mine.OTHER_SHARED_ID
export const OTHER_REVOKED_ID = mine.OTHER_REVOKED_ID
export const OTHER_PRIVATE_NAME = 'E2E Other Private'
export const OTHER_SHARED_NAME = 'E2E Other Shared'
export const OTHER_REVOKED_NAME = 'E2E Other Revoked'
export const E2E_ROOT_FOLDER_ID = mine.E2E_ROOT_FOLDER_ID
/** The E2E user's drive, seeded by `global-setup.ts`; new folders need it. */
export const E2E_DRIVE_ID = mine.E2E_DRIVE_ID

export const E2E_PIN_ITEM_A_ID = mine.E2E_PIN_ITEM_A_ID
export const E2E_PIN_ITEM_B_ID = mine.E2E_PIN_ITEM_B_ID
export const E2E_PIN_ITEM_C_ID = mine.E2E_PIN_ITEM_C_ID
export const E2E_PIN_ITEM_A_NAME = 'E2E Pin Item A'
export const E2E_PIN_ITEM_B_NAME = 'E2E Pin Item B'
export const E2E_PIN_ITEM_C_NAME = 'E2E Pin Item C'

export const E2E_GALLERY_IMAGES = mine.E2E_GALLERY_IMAGES
export const E2E_GALLERY_COLLECTION = mine.E2E_GALLERY_COLLECTION
