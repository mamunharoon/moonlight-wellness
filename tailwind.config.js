/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        "primary": "var(--color-primary)",
        "on-primary": "var(--color-on-primary)",
        "primary-container": "var(--color-primary-container)",
        "on-primary-container": "var(--color-on-primary-container)",
        "secondary": "var(--color-secondary)",
        "on-secondary": "var(--color-on-secondary)",
        "secondary-container": "var(--color-secondary-container)",
        "on-secondary-container": "var(--color-on-secondary-container)",
        "tertiary": "var(--color-tertiary)",
        "on-tertiary": "var(--color-on-tertiary)",
        "tertiary-container": "var(--color-tertiary-container)",
        "on-tertiary-container": "var(--color-on-tertiary-container)",

        // Phase 3 UX correction — Gratitude's selected-answer accent
        // (see src/index.css's matching comment). Reflection reuses the
        // existing primary/on-primary pair above, so no new token is
        // needed for it.
        "gratitude-accent": "var(--color-gratitude-accent)",
        "on-gratitude-accent": "var(--color-on-gratitude-accent)",

        // Build 15 — Home's "Today's Rhythm" Morning selector card needs
        // its own identity distinct from Anytime's peach (primary) and
        // Evening's blue (evening-accent). Reuses this exact same
        // already-contrast-verified warm gold value (see the comment
        // above) rather than inventing a second, near-identical gold -
        // a second Tailwind name for the SAME CSS variable, not a new
        // colour. Morning's own existing full detail card below is
        // unaffected - it keeps using `primary` exactly as it always has.
        "morning-accent": "var(--color-gratitude-accent)",
        "on-morning-accent": "var(--color-on-gratitude-accent)",

        // Prepare for Rest subphase — the four preparation toggles'
        // selected accent (see src/index.css's matching comment).
        "evening-accent": "var(--color-evening-accent)",
        "on-evening-accent": "var(--color-on-evening-accent)",
        "evening-track-off": "var(--color-evening-track-off)",
        "background": "var(--color-background)",
        "on-background": "var(--color-on-background)",
        "surface": "var(--color-surface)",
        "on-surface": "var(--color-on-surface)",
        "surface-variant": "var(--color-surface-variant)",
        "on-surface-variant": "var(--color-on-surface-variant)",
        "outline": "var(--color-outline)",
        "outline-variant": "var(--color-outline-variant)",
        "surface-container-lowest": "var(--color-surface-lowest)",
        "surface-container-low": "var(--color-surface-low)",
        "surface-container": "var(--color-surface-container)",
        "surface-container-high": "var(--color-surface-high)",
        "surface-container-highest": "var(--color-surface-highest)",

        // Build 15 Phase A — shared Morning/Evening tint tokens.
        // Additive only, not yet consumed by any file (see
        // src/index.css's own comment on the same pair).
        // Build 15 Phase B fix: rgb(var(--x) / <alpha-value>) (not the
        // plain var(--x) every other token above uses) so Tailwind can
        // actually generate the /10, /20 opacity-modified utilities
        // Home.jsx now depends on - see src/index.css's matching comment.
        "morning-tint": "rgb(var(--color-morning-tint) / <alpha-value>)",
        "on-morning-tint": "var(--color-on-morning-tint)",
        "evening-tint": "rgb(var(--color-evening-tint) / <alpha-value>)",
        "on-evening-tint": "var(--color-on-evening-tint)",

        // Stage 3 tokens — additive only, namespaced, never consumed by
        // any existing Stage 2 file. See src/styles/stage3-tokens.css.
        "stage3-ink": "var(--stage3-ink)",
        "stage3-ink-raised": "var(--stage3-ink-raised)",
        "stage3-dusk": "var(--stage3-dusk)",
        "stage3-dusk-line": "var(--stage3-dusk-line)",
        "stage3-moonlight": "var(--stage3-moonlight)",
        "stage3-moonlight-dim": "var(--stage3-moonlight-dim)",
        "stage3-dawn": "var(--stage3-dawn)",
        "stage3-ember": "var(--stage3-ember)",
        "stage3-mist": "var(--stage3-mist)",
        "stage3-mist-dim": "var(--stage3-mist-dim)",
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        // Stage 3's "felt" voice (design proposal §11) — additive; no
        // existing file uses the default font-serif utility today.
        serif: ['"Newsreader"', 'Georgia', 'serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '24px',
        '3xl': '32px',
      }
    },
  },
  plugins: [],
}