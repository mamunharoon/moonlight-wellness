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

        // Anytime Reset Visual Uplift — the RGB-triplet form of
        // --color-tertiary (see src/index.css's matching comment), needed
        // wherever an opacity-modified mint utility (bg-tertiary-tint/20,
        // etc.) is actually required. Narrowly additive: --color-primary
        // itself and every existing `tertiary`/`tertiary-container` usage
        // above are completely untouched by this addition - this is a
        // second, new Tailwind key, never a redefinition.
        "tertiary-tint": "rgb(var(--color-tertiary-tint) / <alpha-value>)",

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
        // Home Visual Uplift — Home-scoped only (see src/index.css's
        // matching comment). A second, additive Tailwind key; the shared
        // "background" token above is completely untouched, so every other
        // page's bg-background stays exactly as it renders today.
        "home-background": "var(--color-home-background)",
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

        // Morning Visual Uplift (Build 16) — the three real Affirmation.jsx
        // gradient stops, named (see src/index.css's matching comment).
        // Morning-only.
        "morning-affirmation-from": "var(--color-morning-affirmation-from)",
        "morning-affirmation-via": "var(--color-morning-affirmation-via)",
        "morning-affirmation-to": "var(--color-morning-affirmation-to)",
        "on-morning-affirmation": "var(--color-on-morning-affirmation)",

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
        // Stage 3's "felt" voice (design proposal §11) — additive; used
        // by Evening's question headings and elsewhere app-wide.
        // Deliberately UNCHANGED by the Morning Visual Uplift below -
        // Evening keeps this exact font, this exact Tailwind key.
        serif: ['"Newsreader"', 'Georgia', 'serif'],
        // Morning Visual Uplift (Build 16) — a second, deliberately
        // DISTINCT display serif reserved for Morning's own display
        // headings/affirmation text/prominent moments only (approved:
        // "I want Morning to feel visually distinct from Evening").
        // `font-serif` above (Newsreader) is not touched or reused here -
        // this is a genuinely separate Tailwind key, never a redefinition
        // of the same one, so no existing `font-serif` caller anywhere in
        // the app (Evening included) is affected by this addition.
        // Loaded via index.html's own established Google Fonts <link>
        // pattern (the same mechanism Newsreader/Plus Jakarta Sans already
        // use) - never a runtime/CDN <script> request. Georgia/serif
        // fallback keeps Morning fully readable if the network request for
        // the real font ever fails. SIL Open Font License (OFL) - free for
        // this app's commercial use, same license family already relied
        // on for Newsreader and Plus Jakarta Sans.
        "morning-display": ['"Playfair Display"', 'Georgia', 'serif'],
      },
      borderRadius: {
        'xl': '12px',
        '2xl': '24px',
        '3xl': '32px',
      },
      boxShadow: {
        // Morning Visual Uplift (Build 16) — one sparing, named glow
        // token, reusing the already-contrast-verified morning-accent
        // gold (see the gratitude-accent comment above) at a deliberately
        // low, non-competing opacity. "Sparing" per the approved brief:
        // applied to at most a handful of specific moments (the Morning
        // intro icon, primary CTA buttons, the completion ring) - never a
        // default/ambient shadow on ordinary cards or rows.
        "morning-glow": "0 0 40px -8px rgba(244, 197, 106, 0.35)",
        // Authentication polish (Build 16) — deliberately a SEPARATE,
        // peach-based glow (the existing primary token, #ffc5b7 at low
        // opacity - never a new colour), not a reuse of morning-glow's
        // gold. Auth.jsx/ResetPassword.jsx are reached from many entry
        // points, not only the Morning journey, so they get their own
        // "first-use/Welcome" identity, visually connected to
        // Introduction.jsx's own peach language without implying these
        // are Morning-specific screens.
        "welcome-glow": "0 10px 25px -6px rgba(255, 197, 183, 0.35)",
        // Evening Visual Uplift (Build 17) — same restrained, low-opacity
        // shape as morning-glow above, built from the existing
        // evening-accent periwinkle (#9fb4f0) rather than a new colour.
        // Applied only to Evening's own card shells/icon rings/CTAs
        // approved in the Phase 2 brief — never a default/ambient shadow.
        "evening-glow": "0 0 40px -8px rgba(159, 180, 240, 0.35)",
        // Anytime Reset Visual Uplift — same restrained, low-opacity shape
        // as morning-glow/evening-glow above, built from the existing
        // tertiary mint (#7fe4d0) rather than a new colour. Applied only
        // to Anytime's own card shells/CTAs approved in the Phase 2 brief.
        "mint-glow": "0 0 40px -8px rgba(127, 228, 208, 0.35)",
      }
    },
  },
  plugins: [],
}