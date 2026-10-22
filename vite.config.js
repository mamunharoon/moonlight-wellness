import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execSync } from 'node:child_process'

// Mobile navigation repair, Phase 4 (performance): splits the large,
// rarely-changing vendor dependencies (React, React Router, the Supabase
// client) into their own chunk, separate from the app's own code. These
// almost never change between deploys, so browsers can cache this chunk
// across releases instead of re-downloading it every time any app file
// changes — on top of (not a replacement for) the route-level
// React.lazy() splitting already done in App.jsx.

// DEV build-freshness indicator (2026-10-22) — bakes the exact commit SHA
// and build time into the bundle at build time (see src/lib/buildInfo.js/
// DevBuildIndicator.jsx), so "which commit is actually running" can be
// read directly from inside the running app instead of only inferred from
// Vercel/GitHub's own APIs, which can't see past this project's own
// Deployment Protection gate. VERCEL_GIT_COMMIT_SHA is populated
// automatically by Vercel for every deployment (no dashboard
// configuration needed, confirmed in Vercel's own build-time system
// environment variable docs); falls back to the local git HEAD for any
// build that isn't running on Vercel (a plain `npm run build`/`vitest
// run`, or the Codemagic iOS workflow), so this never silently becomes
// "unknown" there either.
const resolveCommitSha = () => {
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return 'unknown'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __WAKEWISE_BUILD_COMMIT__: JSON.stringify(resolveCommitSha()),
    __WAKEWISE_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          supabase: ['@supabase/supabase-js'],
        },
      },
    },
  },
})
