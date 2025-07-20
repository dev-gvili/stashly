import { createCookieSessionStorage } from 'react-router'
import { createThemeSessionResolver } from 'remix-themes'

const sessionStorage = createCookieSessionStorage({
	cookie: {
		name: 'theme',
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secrets: ['stashly_theme'],
	},
})

export const themeService = createThemeSessionResolver(sessionStorage)
