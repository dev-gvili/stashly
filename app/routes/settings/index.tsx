import { replace } from 'react-router'
import type { Route } from './+types/index'

/** `/:me/settings` opens on Profile. */
export function loader({ params }: Route.LoaderArgs) {
  return replace(`/${params.me}/settings/profile`)
}
