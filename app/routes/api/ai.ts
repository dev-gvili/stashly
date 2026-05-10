import { data } from 'react-router'
import type { Route } from './+types/ai'

/**
 * Placeholder for the AI API resource route. The original implementation was
 * commented out in bulk during a refactor; valid module exports are preserved
 * here so React Router's typegen can build (the route is registered under
 * `prefix('ai', [...])` in `app/routes.ts`).
 *
 * TODO: re-implement caption / transcribe / translate / summarize / embed /
 * suggest / chat handlers per the schemas in `app/schemas/api.schemas.ts`
 * (`aiApiRouteInput`).
 */
export async function loader(_: Route.LoaderArgs) {
  return data({ error: 'AI API not implemented yet' }, { status: 501 })
}

export async function action(_: Route.ActionArgs) {
  return data({ error: 'AI API not implemented yet' }, { status: 501 })
}
