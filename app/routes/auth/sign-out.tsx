import { redirect } from 'react-router'
import {authClient} from '@/.client/auth'
import { resetVinktarUser } from '@/.client/vinktar'

export async function loader() {
  await authClient.signOut()
  return redirect('/auth/sign-in')
}

export async function clientAction() {
  await authClient.signOut()
  resetVinktarUser()
  return redirect('/auth/sign-in')
}
