/*
 * WakeWise DEV — Morning/Anytime/Evening colour-glow extension.
 *
 * A single, shared, purely decorative background layer, reused across
 * journey screens that don't already have their own atmosphere system.
 * Evening's own screens (EveningSceneShell/AtmosphereManager) already
 * deliver a periwinkle/moonlight backdrop of their own - this component
 * is never mounted alongside that; see each consuming page's own doc
 * comment for which pages use it and why.
 *
 * Reuses the exact same three circadian accent colours already
 * established throughout this app (morning-accent, tertiary,
 * evening-accent) - via their own `-tint` RGB-triplet counterparts
 * (morning-accent-tint/tertiary-tint/evening-accent-tint), because the
 * base tokens are plain hex strings and Tailwind's `/<n>` opacity
 * modifier silently resolves to fully transparent on those (confirmed
 * live: bg-morning-accent/10 computed to rgba(0,0,0,0)) - the exact,
 * already-documented gap tertiary-tint/morning-tint/evening-tint exist
 * to work around elsewhere in this app (see src/index.css's matching
 * comments). Never a new/invented colour, only the RGB-triplet form of
 * each existing hex value. Matches Layout.jsx's own existing
 * "Immersive background layer" sizing/opacity/blur exactly (two blurred
 * circles, opacity-40 wrapper, /10 fill, 350-400px, 100-120px blur),
 * just tinted per journey instead of Layout's generic peach/secondary
 * pair. Same restrained, "sparing" spirit as the existing morning-glow/
 * evening-glow/mint-glow shadow tokens (tailwind.config.js) - a wash
 * behind the content, never a shape that competes with it.
 *
 * `fixed inset-0` so it always covers the full viewport regardless of
 * where in the page tree it's mounted (no positioned/transformed
 * ancestor changes that). `-z-10` (not z-0) is deliberate: unlike
 * Layout.jsx, none of this component's consumers wrap their own content
 * in a `relative z-10` wrapper of their own - per CSS stacking order, a
 * position:fixed element at z-index 0/auto actually paints ABOVE plain
 * in-flow (non-positioned) siblings, which would put a z-0 glow over the
 * text instead of behind it. A negative z-index keeps it behind both
 * the real content (untouched, no positioning added to it) and in front
 * of the app's own <body> background (index.css's `body { background-color:
 * var(--color-background) }`, the true root canvas, always painted
 * first). `pointer-events-none` - never intercepts a tap/click meant for
 * real content. `aria-hidden` - decorative only, nothing for assistive
 * tech to announce.
 */
const JOURNEY_GLOW_CIRCLES = {
  morning: [
    'absolute top-[10%] left-1/4 w-[350px] h-[350px] bg-morning-accent-tint/10 rounded-full blur-[100px]',
    'absolute bottom-[20%] right-1/4 w-[400px] h-[400px] bg-morning-accent-tint/10 rounded-full blur-[120px]'
  ],
  anytime: [
    'absolute top-[10%] left-1/4 w-[350px] h-[350px] bg-tertiary-tint/10 rounded-full blur-[100px]',
    'absolute bottom-[20%] right-1/4 w-[400px] h-[400px] bg-tertiary-tint/10 rounded-full blur-[120px]'
  ],
  evening: [
    'absolute top-[10%] left-1/4 w-[350px] h-[350px] bg-evening-accent-tint/10 rounded-full blur-[100px]',
    'absolute bottom-[20%] right-1/4 w-[400px] h-[400px] bg-evening-accent-tint/10 rounded-full blur-[120px]'
  ]
};

export const JourneyGlow = ({ journey }) => {
  const circles = JOURNEY_GLOW_CIRCLES[journey];
  if (!circles) return null;
  return (
    <div className="fixed inset-0 -z-10 opacity-40 pointer-events-none" aria-hidden="true">
      <div className={circles[0]} />
      <div className={circles[1]} />
    </div>
  );
};
