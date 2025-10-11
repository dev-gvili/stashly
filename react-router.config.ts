import { type Config } from '@react-router/dev/config'

export default {
	// Config options...
	// Server-side render by default, to enable SPA mode set this to `false`
	ssr: true,
	routeDiscovery: {
		mode: 'initial',
	},
	future:{
		unstable_middleware: true,
	}
} satisfies Config
