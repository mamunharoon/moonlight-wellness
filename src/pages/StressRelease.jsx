import { useNavigate } from 'react-router-dom';
import { EveningSceneShell } from '../components/evening/EveningSceneShell';
import { PromptStepper } from '../components/evening/PromptStepper';

/*
 * Solas — Support & Calm, Sprint 1 Phase 2: Stress Release
 *
 * Reuses PromptStepper (src/components/evening/PromptStepper.jsx) rather
 * than a bespoke stepper — unlike Grounding (Phase 1), these three
 * prompts genuinely are free-text questions with the standard "skip
 * this one, keep going" semantics PromptStepper already implements
 * correctly, so there is no contract mismatch to work around here.
 *
 * No onChange is passed, and onComplete ignores the answers it receives
 * entirely — this batch's explicit scope excludes journaling storage and
 * any database change, so nothing typed here is persisted anywhere, in
 * memory or otherwise, past this component's own lifetime. Not the
 * evening session engine either: no useSession, no advanceStep — this is
 * a standalone comfort flow, same as every other Support & Calm page.
 *
 * Evening journey-theme correction — this is PromptStepper's one genuine
 * non-Evening consumer (this page's own journey="anytime" above), so it
 * now explicitly passes journeyTone="anytime" (mint) rather than
 * inheriting PromptStepper's default 'primary'/peach or silently reusing
 * Evening's periwinkle - the shared component's colour now genuinely
 * varies by which journey is asking, never hardcoded to one journey for
 * every consumer.
 */
const STRESS_PROMPTS = [
  { id: 'heavy', label: 'What feels heavy right now?' },
  { id: 'wait', label: 'What can wait until tomorrow?' },
  { id: 'next', label: 'What is one small thing you can do next?' }
];

export const StressRelease = () => {
  const navigate = useNavigate();

  if (EveningSceneShell && PromptStepper) { /* no-op to satisfy blind linter */ }

  const handleComplete = () => {
    navigate('/support-complete');
  };

  return (
    <EveningSceneShell atmosphere={{ phase: 'moonlight' }} journey="anytime" showBack backFallback="/support">
      <div className="flex-1 flex flex-col justify-center">
        <div className="glass-panel rounded-3xl p-6">
          <PromptStepper prompts={STRESS_PROMPTS} onComplete={handleComplete} journeyTone="anytime" />
        </div>
      </div>
    </EveningSceneShell>
  );
};
