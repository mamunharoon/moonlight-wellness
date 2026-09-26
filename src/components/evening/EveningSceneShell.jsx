/* eslint-disable no-unused-vars */
import { AtmosphereManager } from '../stage3/AtmosphereManager';
import { BackButton } from '../BackButton';
import { ExitEveningButton } from './ExitEveningButton';
import { JourneyGlow } from '../JourneyGlow';

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
 * Build 15 Evening UX correction — BackButton's `guardActiveRoute` prop
 * defaults to false here: Back means "previous Evening question/
 * stage," a plain navigate(), never the old "Leave this routine?"
 * confirmation (that concern moved entirely to the new, separate
 * `showExit` control below). This exists because Reflection/Gratitude/
 * Evening Breathing/Prepare for Rest each share ONE route across multiple
 * internal questions/stages, so `activeRoute === location.pathname` is
 * true for the entire time any of them is the live step - guarding would
 * wrongly show "Leave this routine?" on, say, Reflection Q2 instead of
 * simply returning to Q1. The former evening-specific confirmTitle/
 * confirmMessage props are gone from this BackButton usage for the same
 * reason - that dialog can no longer open on those screens.
 *
 * `guardActiveRoute` (release-candidate verification fix, additive -
 * default false so every existing caller above keeps the exact behaviour
 * just described): EveningWindDown.jsx is the one exception - it has no
 * internal sub-questions and its own unique route
 * (sessionDefinitions.js's WIND_DOWN step), so `activeRoute ===
 * location.pathname` is true only for the genuine duration Wind-Down
 * itself is the live step, exactly when the canonical Evening map
 * requires Back to show the same whole-routine confirmation Exit already
 * shows at that first step - confirmed live: Back previously navigated
 * straight Home with no confirmation at all while Exit correctly showed
 * one, a real mismatch against "first Wind-Down Back/Exit retains the
 * existing whole-routine confirmation." EveningWindDown.jsx now passes
 * `guardActiveRoute` explicitly; every other caller is unaffected.
 *
 * `showExit` (additive, default false): renders ExitEveningButton -
 * a circular Close/X, top-right, mirroring BackButton's own top-left
 * position/sizing - on the screens that are genuinely part of the
 * active Evening journey (see each page's own doc comment for why it
 * does or doesn't pass this). Deliberately a sibling control, not a
 * BackButton variant, since Back and Exit now have two different
 * meanings that must never collapse back into one dialog.
 *
 * `alwaysFallback` (Back-navigation repair, canonical Morning/Evening map
 * — additive, default false, every existing caller unaffected): forwarded
 * straight to the inner BackButton. Used only by EveningComplete.jsx,
 * mirroring SessionComplete.jsx's identical Morning fix — that screen's
 * real in-app history always has the just-finished Prepare for Rest step
 * behind it, and BackButton's normal goBack would otherwise navigate(-1)
 * straight back into that completed step ("do not re-enter a completed
 * journey using browser Back").
 *
 * `journey` (WakeWise DEV — colour glow extension, additive: default
 * `'evening'`, every existing caller omits it and renders byte-identical
 * to before). This shell is reused by several screens that are NOT
 * actually part of the Evening wind-down journey (QuietBreathing's shared
 * Gentle Reset/Support "calming breath" experience, Support.jsx's own
 * mood picker/recommendation, PanicMode/Grounding/StressRelease,
 * SupportComplete) - they only ever reused it for its scroll/Back/Exit
 * plumbing, never for Evening's own identity, and previously had no way
 * to opt out of the moonlight/periwinkle atmosphere that came bundled
 * with it. `journey="anytime"` swaps AtmosphereManager out for the exact
 * same mint JourneyGlow every other Anytime screen already uses
 * (AnytimeReset.jsx) - never both at once (a page renders exactly one
 * atmosphere layer, whichever this resolves to), so there is never a
 * "two competing atmospheres" case. Every real Evening route
 * (EveningWindDown/Reflection/Gratitude/EveningBreathing/EveningMeditate/
 * PrepareForRest/EveningComplete/the Review and Edit screens) keeps
 * calling this with no `journey` prop at all, so nothing about their own
 * rendering changes. No `'morning'` case exists yet - no current caller
 * of this shell is a Morning screen (Morning's own screens don't use this
 * shell at all); add one here if that ever changes, rather than
 * elsewhere.
 */
export const EveningSceneShell = ({ atmosphere, panelled = false, className = '', showBack = false, backFallback = '/', onBeforeLeave, alwaysFallback = false, showExit = false, guardActiveRoute = false, journey = 'evening', children }) => {
  if (AtmosphereManager) { /* no-op to satisfy blind linter */ }
  const isAnytime = journey === 'anytime';
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
      {isAnytime ? (
        // WakeWise DEV — colour glow extension: an Anytime-flavoured
        // caller must not inherit Evening's moonlight/periwinkle
        // atmosphere just because it happens to reuse this shell - see
        // the `journey` prop's own doc comment above. JourneyGlow is
        // self-contained (own `fixed inset-0`) - no wrapping element or
        // extra classes needed here.
        <JourneyGlow journey="anytime" />
      ) : (
        <AtmosphereManager
          {...atmosphere}
          className={`fixed inset-0 z-[100] pointer-events-none ${className}`.trim()}
        />
      )}

      {/* The one explicit, consistent vertical scroll owner for every
          evening routine page - a genuine sibling of the atmosphere
          layer (never nested inside its own auto-height wrapper), so its
          own `fixed inset-0`/`overflow-y-auto` can never be fought by
          anything the atmosphere layer does. */}
      <div className="fixed inset-0 z-[101] overflow-y-auto">
        {/* Build 16 physical-iPhone correction (F9) — one shared min-h-screen
            column now owns BOTH the nav row and the content below it (the
            nav row is `shrink-0`, content is `flex-1`), rather than two
            independent min-h-screen blocks stacked in the scroll owner -
            that would have added the nav row's own height as pure extra
            scroll on every single page using this shell, on top of a full
            viewport of content, directly fighting F9's own "primary action
            visible without scrolling where the choices permit" requirement.
            This way the combined total stays exactly one viewport tall at
            minimum, exactly as it always was - the nav row simply now
            takes a small real slice of that one viewport instead of
            floating (absolutely positioned, zero flow height) over the
            content's own top edge. */}
        <div className="flex flex-col min-h-screen max-w-xl w-full mx-auto">
          {/* Back/Exit are now a genuine in-flow nav row (real flex
              children, safe-area-aware via this row's own top padding),
              not two independently absolutely-positioned circles floating
              over the content. Found live: Back's own `top` offset already
              added env(safe-area-inset-top), but the content container
              below it (ProgressIndicator's own first child on every real
              consumer) only ever had a flat `py-10` with no safe-area
              awareness at all - on a notched/Dynamic-Island device, Back
              sat LOWER (safe-area + 24px) than content started (a fixed
              40px), so content rendered above/into Back's own row,
              crowding it. A genuine document-flow nav row above the
              content makes that overlap structurally impossible,
              regardless of the actual safe-area value on any given
              device - nothing below this row can ever render above it. */}
          {(showBack || showExit) && (
            <div className="px-6 flex items-center justify-between shrink-0 relative z-20" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
              {showBack ? (
                <BackButton
                  fallback={backFallback}
                  className="!bg-black/55 !border-white/40"
                  onBeforeLeave={onBeforeLeave}
                  guardActiveRoute={guardActiveRoute}
                  alwaysFallback={alwaysFallback}
                />
              ) : (
                <span aria-hidden="true" />
              )}
              {showExit ? <ExitEveningButton /> : <span aria-hidden="true" />}
            </div>
          )}

          {/* Stage 4 Batch F3 fix: flex-1 is required here, not decorative -
              without it, this container has no distributable height and
              title/button collapse together instead of spreading across
              the remaining screen (justify-between needs a definite space
              to distribute within). Build 16 physical-iPhone correction
              (F9) — top padding is now conditional: a small gap below the
              nav row (pt-2) when one renders, or this container's own full
              safe-area top padding when neither Back nor Exit is shown at
              all (a shell used with no nav row still needs to clear the
              notch on its own). */}
          <div
            className="relative z-10 flex-1 flex flex-col justify-between px-6 pb-10"
            style={(showBack || showExit) ? { paddingTop: '0.5rem' } : { paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
          >
            {content}
          </div>
        </div>
      </div>
    </>
  );
};
