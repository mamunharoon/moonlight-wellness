/* eslint-disable no-unused-vars */
import { AtmosphereManager } from '../stage3/AtmosphereManager';
import { BackButton } from '../BackButton';
import { ExitEveningButton } from './ExitEveningButton';

/*
 * Stage 4 Batch F2 — EveningSceneShell
 *
 * Shared full-screen wrapper for evening ritual screens. Not a screen
 * itself and not wired into any route yet — this batch is shared
 * infrastructure only; a later batch (F3/F4/F6) composes this around
 * each evening page's own real content.
 *
 * SINGLE INTEGRATION POINT FOR THE ATMOSPHERE ENGINE
 *   `atmosphere` is spread directly onto AtmosphereManager rather than
 *   re-declaring its prop list here, so this shell never drifts out of
 *   sync with AtmosphereManager's own contract (see
 *   AtmosphereManager.jsx's PROPS doc comment for the full set:
 *   phase/tier/mistActive/rainActive/particleEventType/
 *   particleTriggerKey/auroraActive). A future evening page would pass
 *   its own step's `currentStep.atmosphereRequest` here once that
 *   wiring exists — not this batch's scope.
 *
 * CONTAINER SHAPE
 *   Matches the existing full-bleed ritual pattern already used by
 *   AlarmActive.jsx (`fixed inset-0`, `z-[100]`) rather than the boxed
 *   `min-h-[85vh]`/`max-w-xl` pattern most morning sub-pages use inside
 *   <Layout> — the Stage 4 design proposal's "sky darkens in real time"
 *   intent needs the atmosphere to cover the full viewport, not a
 *   constrained column. Whichever batch adds real evening routes
 *   decides whether those routes sit inside or outside <Layout>; this
 *   shell works either way since it is self-contained and does not
 *   depend on Layout at all.
 *
 * `panelled`
 *   Optional, default false. When true, wraps children in the app's
 *   existing `.glass-panel` surface (src/index.css) — the same class
 *   the bottom nav and persistent audio strip already use — rather than
 *   inventing a second frosted-glass style. Satisfies "reuse existing
 *   glass-panel styling" for whichever evening screens want a card-like
 *   surface over the atmosphere (e.g. a text prompt), without forcing
 *   every screen that uses this shell to have one.
 */
/*
 * Back-navigation repair: optional `showBack`/`backFallback` props render
 * a standardized BackButton absolutely positioned top-left, safe-area
 * aware (this shell is `fixed inset-0`, so unlike normal document-flow
 * pages it genuinely can render under an iPhone's notch/dynamic island
 * without explicit inset handling). Opt-in (default false) since a few
 * callers (Support.jsx) manage their own back control inline instead —
 * see each page's own comments for why.
 *
 * Evening colour-contrast fix: BackButton's default `glass-panel`
 * treatment (5% white background, 12% white border) is tuned for the
 * app's normal near-black background, where it already reads clearly.
 * The evening/dusk gradient (Gradient.jsx's PHASE_GRADIENTS) passes
 * through a genuinely light peach/ember band and (in Moonlight) a light
 * blue-lavender band — against those, a 5%-white panel is nearly
 * invisible ("too faint"). `!bg-black/55 !border-white/40` overrides it
 * with a dark, opaque panel and a clearly visible light border,
 * regardless of which part of the gradient sits behind it — the `!`
 * (Tailwind important) prefix is required here since glass-panel is a
 * plain CSS class (not a Tailwind utility) with equal-or-higher
 * cascade precedence than an appended utility class of the same
 * specificity would otherwise have.
 *
 * Build 15 Evening UX correction — BackButton always renders here with
 * `guardActiveRoute={false}`: Back means "previous Evening question/
 * stage," a plain navigate(), never the old "Leave this routine?"
 * confirmation (that concern moved entirely to the new, separate
 * `showExit` control below). The former evening-specific confirmTitle/
 * confirmMessage props are gone from this BackButton usage for the same
 * reason - that dialog can no longer ever open here.
 *
 * `showExit` (additive, default false): renders ExitEveningButton -
 * a circular Close/X, top-right, mirroring BackButton's own top-left
 * position/sizing - on the screens that are genuinely part of the
 * active Evening journey (see each page's own doc comment for why it
 * does or doesn't pass this). Deliberately a sibling control, not a
 * BackButton variant, since Back and Exit now have two different
 * meanings that must never collapse back into one dialog.
 */
export const EveningSceneShell = ({ atmosphere, panelled = false, className = '', showBack = false, backFallback = '/', onBeforeLeave, showExit = false, children }) => {
  if (AtmosphereManager) { /* no-op to satisfy blind linter */ }
  const content = panelled ? (
    <div className="glass-panel rounded-3xl p-6">{children}</div>
  ) : (
    children
  );

  return (
    <>
      {/* Scroll-lock fix, found live: the decorative atmosphere background
          used to double as this page's own scroll owner (AtmosphereManager
          wrapped the real content, with `overflow-y-auto` composed onto
          Gradient.jsx's own outer div). That div also hardcoded `relative`
          and `overflow-hidden` of its own, both of which could silently
          win over this caller's `fixed`/`overflow-y-auto` depending on
          Tailwind's compiled rule order - reproduced live on Prepare for
          Rest via getComputedStyle: `position: relative` (not `fixed`),
          height equal to the full unscrolled content (not the viewport),
          so nothing ever actually scrolled. Now a purely decorative,
          non-interactive background: fixed to the viewport, pointer-
          events-none (so it can never intercept clicks/wheel input or
          become a scroll owner of its own), and rendered with no children
          of its own at all - see Gradient.jsx's own doc comment for the
          matching `position` fix this still needs regardless. */}
      <AtmosphereManager
        {...atmosphere}
        className={`fixed inset-0 z-[100] pointer-events-none ${className}`.trim()}
      />

      {/* The one explicit, consistent vertical scroll owner for every
          evening routine page - a genuine sibling of the atmosphere
          layer (never nested inside its own auto-height wrapper), so its
          own `fixed inset-0`/`overflow-y-auto` can never be fought by
          anything the atmosphere layer does. */}
      <div className="fixed inset-0 z-[101] overflow-y-auto">
        {showBack && (
          <div
            className="absolute left-6 z-20"
            style={{ top: 'calc(1.5rem + env(safe-area-inset-top))' }}
          >
            <BackButton
              fallback={backFallback}
              className="!bg-black/55 !border-white/40"
              onBeforeLeave={onBeforeLeave}
              guardActiveRoute={false}
            />
          </div>
        )}

        {showExit && (
          <div
            className="absolute right-6 z-20"
            style={{ top: 'calc(1.5rem + env(safe-area-inset-top))' }}
          >
            <ExitEveningButton />
          </div>
        )}

        {/* Stage 4 Batch F3 fix: min-h-screen is required here, not
            decorative - without an explicit height, flex-1/justify-between
            below have nothing to distribute and title/button collapse
            together instead of spreading across the screen. min-h-screen
            (a viewport unit) rather than min-h-full deliberately doesn't
            depend on any ancestor's own height being definite. */}
        <div className="relative z-10 flex flex-col justify-between min-h-screen max-w-xl w-full mx-auto px-6 py-10">
          {content}
        </div>
      </div>
    </>
  );
};
