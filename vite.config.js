import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mobile navigation repair, Phase 4 (performance): splits the large,
// rarely-changing vendor dependencies (React, React Router, the Supabase
// client) into their own chunk, separate from the app's own code. These
// almost never change between deploys, so browsers can cache this chunk
// across releases instead of re-downloading it every time any app file
// changes — on top of (not a replacement for) the route-level
// React.lazy() splitting already done in App.jsx.
export default defineConfig({
  plugins: [react()],
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
