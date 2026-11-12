// Flat config. One job so far: ban `as any` (tech-debt items 7 and 12). Rules
// that need type information are left out so the run stays at a few seconds.
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    // Generated or built output, never hand-edited.
    ignores: ['app/prisma/**', 'build/**', '.react-router/**', 'public/**', '.claude/**', '.worktrees/**', 'node_modules/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { parser: tseslint.parser },
    // The repo's old disable comments name plugins this config doesn't load.
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSAsExpression > TSAnyKeyword.typeAnnotation',
          message: 'No `as any`: cast to the real type, or to `unknown` and narrow it.',
        },
      ],
    },
  },
)
