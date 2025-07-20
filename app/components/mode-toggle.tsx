import { Theme, useTheme } from 'remix-themes'
import { Button } from '@/ui/button'
import { Toggle } from '@/ui/toggle'
import { cn } from '@/utils/styles'
import { RiMoonFill, RiSunFill } from '@/components/icons'
import { useEffect } from 'react'

const ThemeIcon = {
	[Theme.LIGHT]: <RiMoonFill
				className={cn(
					'h-6 w-6 scale-100 rotate-90 transition-all',
				)}
			/>,	
	[Theme.DARK]: <RiSunFill
				className={cn(
					'h-6 w-6 scale-100 rotate-90 transition-all',
				)}
			/>,
}

export function ModeToggle() {
	const [theme, setTheme] = useTheme()
	if (!theme) {
		return null // or a loading spinner, etc.
	}
	return (
		<Button
			variant="ghost"
			size="icon"
			onClick={(e) => {
				setTheme(theme === Theme.LIGHT ? Theme.DARK : Theme.LIGHT)
			}}
		>
			{ThemeIcon[theme]}
		</Button>
	)
}
