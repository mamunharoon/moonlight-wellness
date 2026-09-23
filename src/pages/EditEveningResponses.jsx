/* eslint-disable no-unused-vars */
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAlarm } from '../context/AlarmContext';
import { useNavigationHistory } from '../context/NavigationHistoryContext';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { EveningEditBanner } from '../components/evening/EveningEditBanner';
import { EveningEditQuestion } from '../components/evening/EveningEditQuestion';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EVENING_EDIT_PROMPTS, computeChangedEntries } from '../lib/eveningJourneyQuestions';
import { loadRoutineResponses, upsertRoutineResponsesBatch } from '../lib/routineResponses';
import { parseActiveIndex } from '../lib/questionStepNavigation';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';
import { getEveningCompletionKey } from '../lib/dailyCompletion';

/*
 * Edit Tonight's Responses (Build 15) — EditEveningResponses
 * (/edit/evening?q=1..6)
 *
 * ONE SHARED EDIT SESSION ACROSS ALL SIX QUESTIONS (approved correction)
 *   A single controller page owns one `draftAnswers` map and one
 *   immutable `originalAnswers` map for all six Reflection+Gratitude
 *   questions, addressed by ONE `?q=` route param (1-6, via the same
 *   allowlisted parseActiveIndex every other journey/review page already
 *   uses) rather than two independently-mounted pages. Since `?q=`
 *   changing is the only thing that varies between questions - this
 *   component itself never unmounts while moving between them - the
 *   draft genuinely survives Reflection->Gratitude navigation, which two
 *   separate page components could not guarantee (each would remount
 *   and lose the other section's in-progress edits). No module-level
 *   mutable store is used - both maps are ordinary component state.
 *
 * LOCAL DRAFT UNTIL SAVE (honest Cancel)
 *   Deliberately NOT wired to upsertRoutineResponse/PromptStepper's own
 *   immediate-write behaviour - every answer change here only calls
 *   setDraftAnswers. Nothing is sent to Supabase until "Save Changes" is
 *   explicitly tapped (handleSave below), so Cancel/Discard can always
 *   truthfully perform zero writes.
 *
 * NO SESSION-ENGINE COUPLING
 *   No useSession import anywhere in this file - nothing here starts,
 *   resumes, advances, or completes a routine, and nothing here can
 *   accidentally create a second completion event or alter session
 *   status. Identical boundary to ReflectionReview.jsx/GratitudeReview.jsx.
 *
 * ELIGIBILITY GUARDS, IN ORDER (mirrors Review exactly)
 *   guest -> neutral message, no query; not completed-Evening today ->
 *   "nothing to edit yet"; only then does this page ever load saved
 *   responses. A direct/bookmarked edit URL is therefore never able to
 *   open an edit session for a guest, another day, or an incomplete
 *   journey.
 *
 * NAVIGATION PROTECTION FOR UNSAVED CHANGES
 *   Question 1's Back is the only shared-BackButton tap that can ever
 *   exit Edit Mode entirely (questions 2-6's Back land on the previous
 *   edit question, still inside this same mounted component - no data
 *   at risk, no confirmation needed there, matching "Back moves between
 *   edit questions"). Question 1 wires BackButton's new, additive
 *   `onBeforeLeave` prop: with no unsaved changes it returns true and
 *   BackButton proceeds exactly as normal; with unsaved changes it opens
 *   this page's own discard-confirmation dialog and returns false,
 *   blocking BackButton's own navigation until the user actually
 *   confirms. The explicit Cancel button below the question card uses
 *   the identical check. `goBack` (not a bare navigate) is used for the
 *   confirmed-discard case too, so it still prefers a genuine previous
 *   in-app entry over the fallback route exactly like every other
 *   back-navigation in this app.
 *
 *   Refresh/tab-close is covered by the browser's own native
 *   `beforeunload` prompt while unsaved changes exist - the one
 *   generic warning every browser already provides, not custom copy.
 *
 *   HONEST LIMITATION (flagged in the Phase 1 report, unresolved by
 *   design): this app uses a plain `<BrowserRouter>` (see App.jsx), not
 *   a react-router v6 data router - `useBlocker`/`unstable_usePrompt`
 *   require a data router and are not available here. A genuine browser
 *   Back/forward-gesture POP that jumps directly out of this route
 *   (rather than through this page's own in-app Back/Cancel controls)
 *   cannot be safely intercepted with a custom dialog in this
 *   architecture. Deliberately not worked around with brittle manual
 *   history manipulation (pushing decoy entries, listening for
 *   popstate and re-pushing forward, etc.) - those patterns fight the
 *   browser's own back button and can strand a user. The native
 *   beforeunload warning is the safest behaviour actually available for
 *   that one specific gesture; every in-app exit this page itself
 *   controls (Back on Q1, Cancel, Save) is still fully protected.
 */
const SESSION_ID = 'evening-wind-down';

const backFallbackForIndex = (activeIndex) => (activeIndex === 0 ? '/evening-complete' : `/edit/evening?q=${activeIndex}`);

export const EditEveningResponses = () => {
  const navigate = useNavigate();
  const { goBack } = useNavigationHistory();
  const [searchParams] = useSearchParams();
  const activeIndex = parseActiveIndex(searchParams, EVENING_EDIT_PROMPTS.length);
  const { isGuest } = useAuth();
  const { effectiveTimezone, userId } = useAlarm();

  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const isEveningDoneToday = !isGuest && localStorage.getItem(getEveningCompletionKey(userId)) === today;

  // null = still loading (both sections). Once loaded, originalAnswers is
  // never mutated again - it exists purely as the "what Cancel/Discard
  // restores to" and "what changed" comparison baseline.
  const [originalAnswers, setOriginalAnswers] = useState(null);
  const [draftAnswers, setDraftAnswers] = useState({});
  const [loadError, setLoadError] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);

  useEffect(() => {
    if (isGuest || !isEveningDoneToday) return;
    let cancelled = false;
    Promise.all([
      loadRoutineResponses({ userId, sessionId: SESSION_ID, stepId: 'reflection', localDate: today }),
      loadRoutineResponses({ userId, sessionId: SESSION_ID, stepId: 'gratitude', localDate: today })
    ])
      .then(([reflection, gratitude]) => {
        if (cancelled) return;
        const combined = { ...reflection, ...gratitude };
        setOriginalAnswers(combined);
        setDraftAnswers(combined);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isGuest, isEveningDoneToday, userId, today]);

  const changedEntries = originalAnswers ? computeChangedEntries(originalAnswers, draftAnswers, EVENING_EDIT_PROMPTS) : [];
  const hasUnsavedChanges = changedEntries.length > 0;

  // Native browser warning for refresh/tab-close - see this file's own
  // doc comment above for why this is the one honest option available
  // for that specific exit path in this app's routing architecture.
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const requestDiscardConfirmation = () => {
    setDiscardDialogOpen(true);
    return false;
  };

  const handleQ1BeforeLeave = () => (hasUnsavedChanges ? requestDiscardConfirmation() : true);

  const handleCancelTap = () => {
    if (!hasUnsavedChanges) {
      navigate('/evening-complete');
      return;
    }
    setDiscardDialogOpen(true);
  };

  const handleConfirmDiscard = () => {
    setDiscardDialogOpen(false);
    goBack(backFallbackForIndex(0));
  };

  const handleSelectPreset = (promptId, value) => {
    setDraftAnswers((prev) => ({ ...prev, [promptId]: value }));
    setSaveError(null);
  };

  const handleCustomChange = (promptId, value) => {
    setDraftAnswers((prev) => ({ ...prev, [promptId]: value }));
    setSaveError(null);
  };

  // One atomic batch across BOTH sections (approved correction: the
  // Reflection/Gratitude boundary is not a reason to split the save -
  // upsertRoutineResponsesBatch's own rows may carry different step_id
  // values within the same single .upsert() call). On failure, the
  // draft/original state is untouched, the user stays on this exact
  // screen, and a friendly retry-by-tapping-Save-again state is shown -
  // never a silent or false success.
  const handleSave = async () => {
    if (saving) return;
    if (changedEntries.length === 0) {
      navigate('/review/reflection?q=1');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const result = await upsertRoutineResponsesBatch({
      userId,
      sessionId: SESSION_ID,
      localDate: today,
      entries: changedEntries
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError("Couldn't save your changes. Please try again.");
      return;
    }
    navigate('/review/reflection?q=1');
  };

  if (isGuest) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">lock</span>
          <h1 className="font-serif italic text-2xl text-on-surface">Sign in to edit your journey</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Guest reflections aren't saved, so there's nothing here to edit yet.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Return Home
        </button>
      </EveningSceneShell>
    );
  }

  if (!isEveningDoneToday) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">nightlight</span>
          <h1 className="font-serif italic text-2xl text-on-surface">Nothing to edit yet</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Complete tonight's Evening Wind-Down before editing your responses.
          </p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Return Home
        </button>
      </EveningSceneShell>
    );
  }

  if (loadError) {
    return (
      <EveningSceneShell atmosphere={{ phase: 'moonlight' }} showBack backFallback="/evening-complete">
        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">error</span>
          <h1 className="font-serif italic text-2xl text-on-surface">Couldn't load your journey</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            Something went wrong loading tonight's saved answers. Please try again shortly.
          </p>
        </div>
        <button
          onClick={() => navigate('/evening-complete')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          Return to Evening Summary
        </button>
      </EveningSceneShell>
    );
  }

  const activePrompt = EVENING_EDIT_PROMPTS[activeIndex];
  const isLast = activeIndex === EVENING_EDIT_PROMPTS.length - 1;
  const sectionLabel = activePrompt.stepId === 'gratitude' ? 'Gratitude' : 'Reflection';
  const handleNext = () => navigate(`/edit/evening?q=${activeIndex + 2}`);

  return (
    <EveningSceneShell
      atmosphere={{ phase: 'moonlight' }}
      showBack
      backFallback={backFallbackForIndex(activeIndex)}
      onBeforeLeave={activeIndex === 0 ? handleQ1BeforeLeave : undefined}
    >
      <span className="block text-center text-[10px] text-primary uppercase font-bold tracking-wider">{sectionLabel}</span>
      <EveningEditBanner />

      <div className="flex-1 flex flex-col justify-center space-y-6">
        <div className="glass-panel rounded-3xl p-6">
          {originalAnswers === null ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-on-surface-variant/60 text-3xl animate-pulse">hourglass_top</span>
              <p className="text-xs text-on-surface-variant mt-2">Loading tonight's journey…</p>
            </div>
          ) : (
            <EveningEditQuestion
              key={activePrompt.id}
              prompt={activePrompt}
              questionNumber={activeIndex + 1}
              totalQuestions={EVENING_EDIT_PROMPTS.length}
              value={draftAnswers[activePrompt.id] ?? ''}
              accent={activePrompt.accent}
              groupName={`edit-${activePrompt.id}`}
              onSelectPreset={(value) => handleSelectPreset(activePrompt.id, value)}
              onCustomChange={(value) => handleCustomChange(activePrompt.id, value)}
            />
          )}
        </div>

        {originalAnswers !== null && (
          <div className="space-y-3">
            {saveError && (
              <div className="glass-panel rounded-2xl p-4 border-red-400/30 bg-red-500/10">
                <p className="text-sm text-on-surface">{saveError}</p>
              </div>
            )}

            {!isLast && (
              <button
                onClick={handleNext}
                className="w-full glass-panel text-on-surface py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:bg-white/10 active:scale-95 transition-all border-white/10"
              >
                <span>Next</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-60"
            >
              <span>{saving ? 'Saving…' : 'Save Changes'}</span>
            </button>

            <button
              onClick={handleCancelTap}
              disabled={saving}
              className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={discardDialogOpen}
        title="Discard your changes?"
        message="Your changes have not been saved."
        confirmLabel="Discard Changes"
        cancelLabel="Keep Editing"
        destructive
        onConfirm={handleConfirmDiscard}
        onDismiss={() => setDiscardDialogOpen(false)}
      />
    </EveningSceneShell>
  );
};
