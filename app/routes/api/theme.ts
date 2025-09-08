import { createThemeAction } from 'remix-themes'
import { themeService } from '@/.server/theme'

export const action = createThemeAction(themeService)
