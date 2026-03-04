export default function theme() {
  function getTheme() {
    const persisted = document.cookie.match(/theme=(light|dark)/)?.[1]
    if (persisted) {
      document.documentElement.setAttribute('data-theme', persisted)
    }
    const userPrefTheme = window.matchMedia('(prefers-color-scheme: dark)')
      .matches
      ? 'dark'
      : 'light' // Default to light if no preference
    if (userPrefTheme) {
      document.documentElement.setAttribute('data-theme', userPrefTheme)
    }
  }
  getTheme()
}
