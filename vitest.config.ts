import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['app/**/__tests__/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['app/utils/aimodel.test.ts', 'node_modules/**'],
  },
})
