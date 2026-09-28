/* eslint-disable no-unused-vars */
// Anytime Visual Flow and Closing Handoff uplift — Part 9: ONE shared
// closing presentation for every genuinely-completed Anytime practice,
// replacing what were three separate, near-identical hand-rolled
// implementations (QuietBreathing.jsx's own standalone-completed mint
// block, SelfGuidedMeditationComplete.jsx's own anytime branch, and
// AnytimeReset.jsx's own BetaVideoModal completionContext for the
// recommended item/Instant Calm).
//
// Two exports, deliberately split so this one shared vocabulary can be
// reused by hosts with genuinely different structural shells:
//   - `AnytimeClosingHandoffActions` — the three action buttons alone
//     (Continue My Day / Choose Another Reset / Explore More), used
//     directly by BetaVideoModal.jsx's own completion overlay (which
//     already owns its own CompletionReveal wrapper, badge and greeting -
//     nesting a second full CompletionReveal there would be exactly the
//     "stacking another panel beneath it" this pass's own brief forbids).
//   - `AnytimeClosingHandoff` — the FULL self-contained panel (badge +
//     eyebrow + rotating greeting + "What feels right now?" + the same
//     three actions), for the two full-page completion screens
//     (QuietBreathing.jsx's standalone branch, SelfGuidedMeditationComplete.jsx)
//     to render in place of their own former hand-rolled block.
//
// `greeting` is always the CALLER's own already-picked-once value (see
// outcomeMessages.js's own getCompletionGreeting doc comment: side
// effects, must be picked exactly once per completion, e.g. via a lazy
// useState initializer) - this component never picks its own greeting,
// so "select once per completed session and keep it stable while
// mounted" is the caller's responsibility, exactly like every other
// completion-greeting consumer in this app.
//
// Every action here is a plain caller-supplied callback - this component
// never imports react-router or the Session Engine, exactly like
// BetaVideoModal.jsx's own completionContext contract. `onExploreMore` is
// optional (omitting it hides that action) for the one case where no
// live Need/Time selection exists to build a safe Explore destination
// from - in practice, every real Anytime-origin completion has one
// (anytimeOrigin implies real needId/durationId), so this is a defensive
// allowance, not an expected path.
import { CompletionReveal } from './CompletionReveal';
import { getJourneyPrimaryActionClasses } from '../lib/journeyAction';

export const ANYTIME_HANDOFF_EYEBROW = 'RESET COMPLETE';
export const ANYTIME_HANDOFF_PROMPT = 'What feels right now?';

// `primaryButtonRef` (optional): forwarded straight to the "Continue My
// Day" button - BetaVideoModal.jsx's own completion overlay focuses its
// primary action the instant the overlay genuinely becomes visible (see
// that file's own established focus-management doc comment); passing this
// through here is what preserves that exact contract for the Anytime path
// too, instead of silently dropping focus management only for Anytime.
export const AnytimeClosingHandoffActions = ({ onContinueMyDay, onChooseAnotherReset, onExploreMore, primaryButtonRef }) => (
  <div className="flex flex-col gap-2 w-full">
    <button
      ref={primaryButtonRef}
      type="button"
      onClick={onContinueMyDay}
      className={`w-full min-h-[44px] ${getJourneyPrimaryActionClasses('anytime')} py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent`}
    >
      <span>Continue My Day</span>
    </button>
    <button
      type="button"
      onClick={onChooseAnotherReset}
      className="w-full min-h-[44px] glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      Choose Another Reset
    </button>
    {onExploreMore && (
      <button
        type="button"
        onClick={onExploreMore}
        className="w-full min-h-[44px] py-2.5 text-center text-sm font-semibold text-tertiary hover:text-tertiary/80 active:scale-95 transition-all"
      >
        Explore More
      </button>
    )}
  </div>
);

// The badge + eyebrow + rotating greeting + "What feels right now?" block
// alone, with no actions of its own - exported separately so a host that
// needs its OWN action-timing contract (see `AnytimeClosingHandoff` below)
// can render this message half and `AnytimeClosingHandoffActions` as two
// independently-timed pieces, rather than being forced into one
// component's own fixed internal layout.
export const AnytimeClosingHandoffMessage = ({
  active,
  isFresh,
  greeting,
  // Optional extra factual detail (e.g. SelfGuidedMeditationComplete.jsx's
  // own style+duration card) - additive; omitting it renders exactly the
  // badge/eyebrow/greeting/prompt trio, nothing more.
  detail,
  className = 'flex-1 flex flex-col items-center justify-center text-center space-y-8'
}) => (
  <CompletionReveal
    active={active}
    isFresh={isFresh}
    journeyTone="anytime"
    className={className}
    stagger={[
      <div key="badge" className="w-20 h-20 rounded-full bg-tertiary/10 border border-tertiary-tint/25 shadow-mint-glow flex items-center justify-center mx-auto">
        <span className="material-symbols-outlined text-tertiary text-4xl" aria-hidden="true">check_circle</span>
      </div>,
      <div key="message" className="space-y-2">
        <span className="font-label-sm text-xs text-tertiary uppercase tracking-widest font-bold">{ANYTIME_HANDOFF_EYEBROW}</span>
        <h2 className="text-2xl font-bold text-on-surface" role="status">{greeting}</h2>
        <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">{ANYTIME_HANDOFF_PROMPT}</p>
      </div>,
      detail ? <div key="detail">{detail}</div> : null
    ].filter(Boolean)}
  />
);

// Full panel: the message above, plus the three actions rendered as a
// PLAIN, immediately-visible sibling - never delayed behind
// CompletionReveal's own hold/stagger timing. Matches the established,
// pre-existing timing contract both of this component's real hosts
// (QuietBreathing.jsx's standalone branch, SelfGuidedMeditationComplete.jsx)
// already used for their own former hand-rolled action rows: "Actions
// should be visible and tappable promptly" (this pass's own Part 9
// requirement) - genuinely immediate, not merely undelayed-relative-to-
// the-stagger the way CompletionReveal's own optional `actions` prop
// would still be (that prop only renders once `active` flips true, which
// on QuietBreathing.jsx specifically is itself already gated behind
// useCompletionHandoff's brief hold+exit-fade of the outgoing active
// view). BetaVideoModal.jsx's completion overlay, by contrast, has no
// such earlier-visible requirement of its own (the whole overlay only
// ever renders after its own settle delay has already elapsed) - it uses
// `AnytimeClosingHandoffActions` directly instead, passed through its own
// existing CompletionReveal `actions` prop.
export const AnytimeClosingHandoff = ({
  active,
  isFresh,
  greeting,
  detail,
  onContinueMyDay,
  onChooseAnotherReset,
  onExploreMore,
  className
}) => (
  <>
    <AnytimeClosingHandoffMessage active={active} isFresh={isFresh} greeting={greeting} detail={detail} className={className} />
    {active && (
      <div className="space-y-3 w-full">
        <AnytimeClosingHandoffActions
          onContinueMyDay={onContinueMyDay}
          onChooseAnotherReset={onChooseAnotherReset}
          onExploreMore={onExploreMore}
        />
      </div>
    )}
  </>
);
