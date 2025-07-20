import { createThemeAction } from 'remix-themes'
import { themeService } from '@/services/theme.server'

export const action = createThemeAction(themeService)
