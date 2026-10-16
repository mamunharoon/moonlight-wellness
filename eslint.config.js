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
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
