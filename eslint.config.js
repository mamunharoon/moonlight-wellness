import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 'android' added alongside the existing 'dist'/'ios' exclusions —
  // android/app/src/main/assets/public/assets/*.js is `npx cap sync
  // android`'s own copy of this project's built dist/ output (minified,
  // generated, never hand-authored), not app source; without this,
  // `npm run lint` tries to lint that generated bundle too and fails with
  // hundreds of unrelated no-unused-vars/no-empty errors on every run.
  globalIgnores(['dist', 'ios', 'android']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        // DEV build-freshness indicator (2026-10-22) — literal string
        // replacements injected by vite.config.js's own `define` (see its
        // comment), never real runtime globals; declared here only so
        // ESLint's no-undef doesn't flag the identifiers src/lib/buildInfo.js
        // reads.
        __WAKEWISE_BUILD_COMMIT__: 'readonly',
        __WAKEWISE_BUILD_TIME__: 'readonly',
      },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // vite.config.js runs under Node at build time (not in the browser) —
    // its own resolveCommitSha() (2026-10-22, DEV build-freshness
    // indicator) reads `process.env`, which only globals.node declares.
    files: ['vite.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
