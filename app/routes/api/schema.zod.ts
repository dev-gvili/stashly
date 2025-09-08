import { z } from "zod"

// ====================================================== //
// =================== Quota Api Route ================== //
// ====================================================== //

/**
 * This schema is for validating and parsing the input from the client.
 * It uses z.coerce.bigint() to safely convert various input types to bigint.
 * The action field is a discriminated union to handle different quota-related actions.
 */
export const quotaApiRouteInput = z.object({
    dataSize: z.coerce.bigint(),
    action: z
        .literal('find-quota')
        .or(z.literal('verify-free-quota'))
        .or(z.literal('update-total-quota'))
        .or(z.literal('items-uploaded'))
        .or(z.literal('items-trashed'))
        .or(z.literal('items-copied'))
        .or(z.literal('items-restored'))
        .or(z.literal('items-deleted')),
})


/**
 * This schema is for transforming the output before it's sent to the client.
 * It uses z.coerce.number() to safely convert bigint to number.
 */
export const quotaApiRouteOutput = z.object({
    id: z.string(),
    driveId: z.string(),
    deleted: z.coerce.number(),
    total: z.coerce.number(),
    used: z.coerce.number(),
    remaining: z.coerce.number(),
    state: z.enum(['normal', 'warning', 'critical', 'exceeded']),
})