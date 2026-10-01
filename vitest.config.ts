import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['app/**/__tests__/**/*.test.ts', 'app/**/*.test.ts'],
    exclude: ['node_modules/**'],
    // Pinned, not left to Vitest: it switches to the `minimal` reporter when
    // it detects an AI agent (std-env's isAgent, e.g. CLAUDECODE=1), which
    // hides console output — errors included — from passing tests. Every run
    // shows the same output a person sees in a terminal and CI.
    reporters: [
      'default',
      ...(process.env.GITHUB_ACTIONS === 'true' ? ['github-actions'] : []),
    ],
  },
})
