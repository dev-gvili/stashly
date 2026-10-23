export const TEST_USER_ID = 'usr_e2e_test_fixed_id_000000'
export const TEST_USER_EMAIL = 'e2e-test@stashly.test'

// Favorites E2E — stable IDs reset on every global-setup run
export const E2E_ITEM_A_ID = 'item_e2e_fav_aaa0000000000000' // starts unfavorited (toggle-on test)
export const E2E_ITEM_B_ID = 'item_e2e_fav_bbb0000000000000' // starts favorited  (toggle-off test)
export const E2E_ITEM_C_ID = 'item_e2e_fav_ccc0000000000000' // starts favorited  (listing test)
export const E2E_ITEM_D_ID = 'item_e2e_fav_ddd0000000000000' // two favorite rows (duplicate)
export const E2E_ITEM_E_ID = 'item_e2e_fav_eee0000000000000' // starts unfavorited (favorited twice)
export const E2E_ITEM_F_ID = 'item_e2e_fav_fff0000000000000' // starts unfavorited (bulk add)
export const E2E_ITEM_G_ID = 'item_e2e_fav_ggg0000000000000' // starts favorited  (bulk skip)
export const E2E_ITEM_A_NAME = 'E2E Fav Item A'
export const E2E_ITEM_B_NAME = 'E2E Fav Item B'
export const E2E_ITEM_C_NAME = 'E2E Fav Item C'
export const E2E_ITEM_D_NAME = 'E2E Fav Item D'
export const E2E_ITEM_E_NAME = 'E2E Fav Item E'
export const E2E_ITEM_F_NAME = 'E2E Fav Item F'
export const E2E_ITEM_G_NAME = 'E2E Fav Item G'

// A second user, for access control: whose items the E2E user may or may not read
export const OTHER_USER_ID = 'usr_e2e_other_fixed_id_00000'
export const OTHER_USER_EMAIL = 'e2e-other@stashly.test'
export const OTHER_DRIVE_ID = 'drv_e2e_other_000000'
export const OTHER_PRIVATE_ID = 'item_e2e_oth_prv0000000000000' // never shared
export const OTHER_SHARED_ID = 'item_e2e_oth_shr0000000000000' // shared with the E2E user (read)
export const OTHER_REVOKED_ID = 'item_e2e_oth_rvk0000000000000' // shared, favorited, then revoked
export const OTHER_PRIVATE_NAME = 'E2E Other Private'
export const OTHER_SHARED_NAME = 'E2E Other Shared'
export const OTHER_REVOKED_NAME = 'E2E Other Revoked'
export const E2E_ROOT_FOLDER_ID = 'root_e2e_test_000000'
/** The E2E user's drive, seeded by `global-setup.ts`; new folders need it. */
export const E2E_DRIVE_ID = 'drv_e2e_test_000000'

// Pins E2E — stable IDs reset on every global-setup run
export const E2E_PIN_ITEM_A_ID = 'item_e2e_pin_aaa0000000000000' // starts unpinned (toggle-on test)
export const E2E_PIN_ITEM_B_ID = 'item_e2e_pin_bbb0000000000000' // starts pre-pinned (toggle-off test)
export const E2E_PIN_ITEM_C_ID = 'item_e2e_pin_ccc0000000000000' // pre-pinned, never toggled (list test)
export const E2E_PIN_ITEM_A_NAME = 'E2E Pin Item A'
export const E2E_PIN_ITEM_B_NAME = 'E2E Pin Item B'
export const E2E_PIN_ITEM_C_NAME = 'E2E Pin Item C'
