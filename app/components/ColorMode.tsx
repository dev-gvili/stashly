import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/ui/select"

export function toColorMode() {
	// On page load or when changing themes, best to add inline in `head` to avoid FOUC
	if (
		localStorage.theme === 'dark' ||
		(!('theme' in localStorage) &&
			window.matchMedia('(prefers-color-scheme: dark)').matches)
	) {
		document.documentElement.classList.add('dark')
	} else {
		document.documentElement.classList.remove('dark')
	}

	// Whenever the user explicitly chooses light mode
	localStorage.theme = 'light'

	// Whenever the user explicitly chooses dark mode
	localStorage.theme = 'dark'

	// Whenever the user explicitly chooses to respect the OS preference
	localStorage.removeItem('theme')
}

const ColorMode = () => {
	return (
		<Select onValueChange={toColorMode}>
			<SelectTrigger className='bg-background text-primary'>
				<SelectValue
				/>
			</SelectTrigger>
			<SelectContent className='m-0 p-0 bg-background text-primary'>
				<SelectItem value='dark'>Dark</SelectItem>
				<SelectItem value='light'>Light</SelectItem>
				<SelectItem value='system'>System</SelectItem>
			</SelectContent>
		</Select>
	)
}

export { ColorMode }