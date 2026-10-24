import { Outlet } from 'react-router'

/** Auth pages own their full-screen layout; sign-out only redirects. */
export default function AuthLayout() {
  return <Outlet />
}
