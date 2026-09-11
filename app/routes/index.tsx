import { auth } from '@/services/auth'
import { redirect } from 'react-router'
import type { Route } from './+types'

export const loader = async ({ request }: Route.LoaderArgs) => {
  const session = await auth.api.getSession({
    headers: request.headers,
  })
  if (!session) return null
  return redirect(`${session?.user?.id}/stash?layout=grid&take=100`)
}

export default function Index() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans">
      <h1>Welcome to Stashly</h1>
      <p className="text-gray-500">Your personal file management system.</p>
      <p className="text-gray-500">Please sign in to continue.</p>
    </div>
  )
}
