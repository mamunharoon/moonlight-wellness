import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { OUTCOME, JOURNEY, getOutcomeMessage } from '../lib/outcomeMessages';
import { useAlarm } from '../context/AlarmContext';
import { getZonedParts } from '../lib/timezone';
import { now as devNow } from '../lib/devClock';

const CHECK_IN_OPTIONS = [
  { id: 'better', label: 'Better' },
  { id: 'same', label: 'About the same' },
  { id: 'worse', label: 'Worse' }
];

/*
 * Solas — Support & Calm, Sprint 1 Phase 1: Completion screen
 *
 * Terminal screen for every Support & Calm flow reached this batch
 * (Panic Mode's Skip goes straight Home instead — see PanicMode.jsx —
 * since nothing was completed in that case). Deliberately stateless: no
 * Session Engine, no Supabase, no localStorage — the check-in below is a
 * purely in-the-moment, ephemeral acknowledgment (not persisted; no
 * table exists for it and none was requested), not a mood-tracking
 * feature. This batch's explicit exclusions rule out any database
 * change or analytics event on arrival here.
 *
 * Daily Journey repair: added the required "How do you feel now?"
 * check-in (Better / About the same / Worse) above the existing
 * Return-Home / Try-another-exercise actions. Deliberately not framed
 * as medical/clinical — a quiet, supportive check-in, matching this
 * flow's existing calm wording throughout, not a screening tool.
 *
 * Mobile navigation repair, Phase 3: "Choose Another" (renamed here to
 * "Try another exercise" per this batch's exact wording) is distinct
 * from the recommendation screen's own "Choose Another" (which cycles
 * between a mood's two options without leaving Support.jsx) — this one
 * returns to feeling selection so the user can pick a different feeling
 * entirely.
 *
 * Outcome-aware messaging correction — this is the one shared terminal
 * screen for three real entry paths (Grounding's finish vs. Skip;
 * StressRelease's finish; Support.jsx's own video path including the
 * "Instant Calm" video), and it previously showed the identical
 * "You made it through this moment." regardless of whether the user
 * genuinely finished or left early/skipped - unlike its sibling
 * completion screens (SessionComplete.jsx/EveningComplete.jsx/
 * MeditationComplete.jsx), which all already reuse this same Phase 2
 * outcome model. Reuses it here too rather than a second one:
 * `location.state?.outcome` ('skipped'|'ended_early', optional) lets an
 * updated caller say what actually happened; any caller that doesn't
 * pass it (including any not yet updated) defaults to 'completed',
 * preserving this screen's original, always-completed-flavoured
 * behaviour exactly. The genuine-completion copy itself is intentionally
 * left as its own bespoke, already-on-tone line (crafted for this
 * specific emotionally-supportive context) rather than swapped for the
 * more generic rotating Anytime set - only the two outcomes that were
 * genuinely indistinguishable from it before gain real, honest copy.
 */
export const SupportComplete = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { effectiveTimezone } = useAlarm();
  const [checkIn, setCheckIn] = useState(null);

  if (EveningSceneShell) { /* no-op to satisfy blind linter */ }

  const outcome = location.state?.outcome === 'skipped' || location.state?.outcome === 'ended_early'
    ? location.state.outcome
    : 'completed';
  const today = getZonedParts(effectiveTimezone, devNow()).dateKey;
  const { headline, body } = outcome === 'skipped'
    ? getOutcomeMessage(OUTCOME.SKIPPED, JOURNEY.ANYTIME, today)
    : outcome === 'ended_early'
      ? getOutcomeMessage(OUTCOME.ENDED_EARLY, JOURNEY.ANYTIME, today)
      : { headline: 'You made it through this moment.', body: 'Be gentle with yourself.' };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} journey="anytime" showBack backFallback="/">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6">
        <div className="space-y-4">
          <span className="material-symbols-outlined text-on-surface-variant/70 text-4xl">self_improvement</span>
          <h1 className="font-serif italic text-3xl text-on-surface">{headline}</h1>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto leading-relaxed">
            {body}
          </p>
        </div>

        <div className="w-full max-w-xs space-y-3">
          <p className="text-xs text-on-surface-variant uppercase tracking-wider font-bold">How do you feel now?</p>
          <div className="flex gap-2">
            {CHECK_IN_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCheckIn(option.id)}
                aria-pressed={checkIn === option.id}
                className={`flex-1 py-3 px-2 rounded-2xl text-xs font-semibold transition-all min-h-[44px] focus-visible:ring-2 focus-visible:ring-primary ${
                  checkIn === option.id
                    ? 'bg-primary text-on-primary'
                    : 'glass-panel text-on-surface-variant hover:bg-white/10'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <button
          onClick={() => navigate('/')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          <span>Return to Today</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button
          onClick={() => navigate('/support')}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Try another exercise
        </button>
      </div>
    </EveningSceneShell>
  );
};
