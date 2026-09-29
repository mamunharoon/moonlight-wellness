/*
 * Physical-iPhone correction — shared exercise-page shell.
 *
 * Root cause found live on a physical iPhone (Morning Stretch, but the
 * same architecture underlies every affected screen): the Back button/
 * progress row and the safe-area top padding were both ordinary in-flow
 * children of the ONE scrollable region the page owned (whether that was
 * Layout.jsx's own hideNavigation Outlet, or a page's own `h-dvh
 * overflow-hidden` > `overflow-y-auto` pair). Padding-top only offsets the
 * INITIAL scroll position — once the user actually scrolls, that padding
 * (and the header content sitting right after it) moves up and out of
 * view exactly like any other content, and whatever scrolls up to fill
 * y=0 renders directly under the iOS status bar/notch, since nothing
 * left behind is opaque or "still there" to protect that region. Framed
 * differently: the safe area was implemented as scroll-away padding, not
 * as a persistent, non-scrolling protected zone.
 *
 * Fix: the three-layer shape the task itself specifies, matching
 * Layout.jsx's own already-correct header/Outlet split (that header
 * never had this bug, precisely because it is a real `shrink-0` sibling
 * BEFORE the scrollable Outlet, never inside it):
 *   - outer: `h-dvh overflow-hidden flex flex-col` (a real, fixed
 *     viewport-height bound, never a lower bound like min-h-screen/
 *     min-h-[85vh]).
 *   - header: `shrink-0` — genuinely outside the scrollable region, so
 *     it can never scroll away — opaque (`bg-background`, the app's own
 *     solid canvas colour, never a translucent/blurred surface real
 *     content could show through), safe-area-aware top padding, a
 *     journey-tinted `border-b` divider, and its own stacking context
 *     (`relative z-10`) above the scrollable body.
 *   - body: `flex-1 min-h-0 overflow-y-auto` — the one and only scroll
 *     owner on the page; its own bottom padding still clears the home
 *     indicator safe area.
 *
 * `journeyTone` selects the header's own divider tint only. Each caller
 * keeps rendering its own `<JourneyGlow journey="..." />` exactly where
 * it already did (journeyGlowWiring.test.js enforces this per-page,
 * source-level) - this shell does not render it, so nothing is ever
 * rendered twice. Placement doesn't matter visually (JourneyGlow is
 * `fixed inset-0`), so callers may render it as the first element inside
 * `children` unchanged. Evening's own screens keep using
 * EveningSceneShell/AtmosphereManager instead of this component entirely
 * - never both.
 */
const HEADER_DIVIDER = Object.freeze({
  morning: 'border-morning-accent-tint/25',
  evening: 'border-evening-accent-tint/25',
  anytime: 'border-tertiary-tint/25',
});

export const ExerciseScreenShell = ({
  journeyTone = 'morning',
  header,
  children,
  bodyClassName = '',
  maxWidthClassName = 'max-w-xl',
  // MeditationActiveSession.jsx's own documented exception (Nested-
  // scroll-trap correction) - Evening embeds that component inside
  // EveningSceneShell's own outer `fixed inset-0 overflow-y-auto`
  // container, so leftover scroll delta once THIS body's own scroll room
  // runs out must keep chaining up into that outer container rather than
  // being absorbed here. Every other caller (Morning/Anytime standalone,
  // with no outer scrollable ancestor) keeps the default 'contain'.
  bodyOverscrollBehaviorY = 'contain'
}) => (
  <div className="h-dvh overflow-hidden flex flex-col">
    {/* Safe-area header — shrink-0, never part of the scrollable body
        below, so Back/Close/progress can never scroll out from under the
        user mid-exercise, and real content can never scroll up behind
        the status bar where this header sits. */}
    <div
      className={`relative z-10 shrink-0 bg-background border-b ${HEADER_DIVIDER[journeyTone] ?? HEADER_DIVIDER.morning}`}
      style={{
        paddingTop: 'calc(1rem + env(safe-area-inset-top))',
        paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
        paddingRight: 'calc(1rem + env(safe-area-inset-right))'
      }}
    >
      <div className={`${maxWidthClassName} w-full mx-auto pb-3 space-y-3`}>
        {header}
      </div>
    </div>

    {/* Content body — the one real scroll owner. */}
    <div
      className={`flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-hide ${bodyClassName}`}
      style={{ overscrollBehaviorY: bodyOverscrollBehaviorY }}
    >
      <div
        className={`${maxWidthClassName} w-full mx-auto`}
        style={{
          paddingLeft: 'calc(1rem + env(safe-area-inset-left))',
          paddingRight: 'calc(1rem + env(safe-area-inset-right))',
          paddingTop: '1rem',
          paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))'
        }}
      >
        {children}
      </div>
    </div>
  </div>
);
