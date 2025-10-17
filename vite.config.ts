import { reactRouter } from '@react-router/dev/vite'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'
const isStorybook = process.argv[1]?.includes('storybook');
export default defineConfig(({ isSsrBuild, mode }) => ({
	define: {
		env: JSON.stringify(loadEnv(mode, process.cwd(), '')),
	},
	server:{
		allowedHosts: ['604feeed9b06.ngrok-free.app', 'stashly.onrender.com', 'localhost']
	},
	build: {
		rollupOptions: isSsrBuild
			? {
					input: './server/app.ts',
			  }
			: undefined,
	},
	plugins: [tailwindcss(), !isStorybook && reactRouter(), tsconfigPaths()],
}))
