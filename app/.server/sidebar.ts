import { createCookie } from 'react-router'

export const sidebarCookie = createCookie('stashly-sidebar-default', {
  maxAge: 31_536_000, // 1
  path: '/',
  sameSite: 'lax',
  secure: false,
  // secure: process.env.NODE_ENV === 'production', // Enable in production
})

