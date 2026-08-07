import { AtmosphereManager } from '../stage3/AtmosphereManager';

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
export const EveningSceneShell = ({ atmosphere, panelled = false, className = '', children }) => {
  if (AtmosphereManager) { /* no-op to satisfy blind linter */ }
  const content = panelled ? (
    <div className="glass-panel rounded-3xl p-6">{children}</div>
  ) : (
    children
  );

  return (
    <AtmosphereManager
      {...atmosphere}
      className={`fixed inset-0 z-[100] flex flex-col overflow-y-auto ${className}`.trim()}
    >
      <div className="relative z-10 flex-1 flex flex-col justify-between max-w-xl w-full mx-auto px-6 py-10">
        {content}
      </div>
    </AtmosphereManager>
  );
};
