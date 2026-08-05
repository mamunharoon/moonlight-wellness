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