import { data } from 'react-router'
import type { Route } from './+types/images'

/**
 * Placeholder for the image-resize resource route. Original implementation
 * (an on-the-fly image resizer) was commented out in bulk during a refactor.
 * Valid module exports preserved so React Router's typegen can build.
 *
 * TODO: re-implement on-the-fly image resizing — fetch source from S3,
 * transform via sharp/wasm, return resized response.
 */
export async function loader(_: Route.LoaderArgs) {
  return data({ error: 'Image API not implemented yet' }, { status: 501 })
}
