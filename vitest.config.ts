import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['app/**/__tests__/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['app/utils/aimodel.test.ts', 'node_modules/**'],
  },
})
