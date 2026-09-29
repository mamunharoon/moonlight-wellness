// WakeWise DEV — Anytime visual-choice uplift (Home tile redesign + shared
// 7-message "RESET COMPLETE" panel). This file is a consolidated checklist
// guard for this specific pass, pointing to the dedicated coverage that
// already exists elsewhere for most items, and adding real NEW assertions
// only for the two gaps that had no dedicated test yet: the completion
// greeting's "picked once, held stable across rerenders" guarantee for
// SelfGuidedMeditationComplete.jsx/BetaVideoModal.jsx (QuietBreathing.jsx
// already has this in quietBreathingAnytimeCompletionLifecycle.test.js),
// and an explicit Morning/Evening-untouched guard tied to this pass.
//
// No DOM/component rendering is available in this repo's Vitest - source-
// level checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

describe('Anytime visual-choice uplift — checklist cross-references (already covered elsewhere, listed here for one-stop visibility)', () => {
  it('1-2. Home\'s four Anytime tiles are larger/equally-sized with no connectors between them - see homeAnytimeVisualUplift.test.js and pathwayConnectors.test.js', () => {
    const homeSource = read('./Home.jsx');
    expect(homeSource).toMatch(/grid grid-cols-4 gap-1/);
    expect(homeSource).not.toMatch(/aria-label="Includes Breathe, Meditate, Instant Calm, and Explore">[\s\S]*?<JourneyConnector/);
  });

  it('3. "About 1-10 minutes" is removed from the Anytime card\'s live markup - see homeAnytimeVisualUplift.test.js', () => {
    const homeSource = read('./Home.jsx');
    const cardStart = homeSource.indexOf("{activePeriod === 'anytime' && (");
    const cardEnd = homeSource.indexOf('6. Active intentions', cardStart);
    const code = homeSource.slice(cardStart, cardEnd).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/About 1-10 minutes/);
  });

  it('4. The existing Need > Time > Reset flow/recommendation logic is unchanged (same STAGES, same honest badge contract) - see AnytimePathway.test.js/anytimeIntegrityScenarios.test.js', () => {
    const pathwaySource = read('../components/AnytimePathway.jsx');
    expect(pathwaySource).toMatch(/const isSelected = \{ need: needSelected, time: timeSelected, reset: false \};/);
    const resetSource = read('./AnytimeReset.jsx');
    expect(resetSource).toMatch(/needSelected=\{Boolean\(needId\)\}/);
    expect(resetSource).toMatch(/timeSelected=\{Boolean\(durationId\)\}/);
  });

  it('5-7. Natural completion of Breathing/Meditation/eligible guided media all reach the shared "RESET COMPLETE" panel, now with exactly two actions (Explore More removed) - see quietBreathingAnytimeCompletionLifecycle.test.js, selfGuidedMeditationComplete.test.js, betaVideoModalSharedCompletion.test.js, AnytimeClosingHandoff.test.js', () => {
    expect(read('./QuietBreathing.jsx')).toMatch(/isCompleted && anytimeOrigin \? \(\s*\n[\s\S]*?<AnytimeClosingHandoffMessage/);
    expect(read('./SelfGuidedMeditationComplete.jsx')).toMatch(/\{anytimeOrigin \? \(\s*\n[\s\S]*?<AnytimeClosingHandoff/);
    const betaVideoModalSource = read('../components/BetaVideoModal.jsx');
    expect(betaVideoModalSource).toMatch(/completionContext\.journey === 'anytime' \? \(\s*\n[\s\S]*?<AnytimeClosingHandoffActions/);
    const actionsSource = read('../components/AnytimeClosingHandoff.jsx');
    const actionsCode = actionsSource.slice(actionsSource.indexOf('export const AnytimeClosingHandoffActions'), actionsSource.indexOf('export const AnytimeClosingHandoffMessage'));
    expect(actionsCode).not.toMatch(/Explore More|onExploreMore/);
  });

  it('8. Early exits never claim completion or show the rotating message - see quietBreathingAnytimeCompletionLifecycle.test.js/anytimeResetEarlyExitAcknowledgement.test.js/selfGuidedMeditationSetup.test.js', () => {
    const quietBreathingSource = read('./QuietBreathing.jsx');
    const endEarlyBody = quietBreathingSource.match(/const handleEndEarly = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(endEarlyBody).not.toMatch(/isCompleted|completionGreeting|getCompletionGreeting/);
    const anytimeResetSource = read('./AnytimeReset.jsx');
    const closeBody = anytimeResetSource.match(/const handleVideoClose = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(closeBody).not.toMatch(/setIsComplete\(true\)/);
  });

  it('9. The exact 7-message "reset" pool exists, shared by every eligible activity - see outcomeMessages.test.js\'s own dedicated "anytime/reset pool" coverage', () => {
    const outcomeMessagesSource = read('../lib/outcomeMessages.js');
    const poolBlock = outcomeMessagesSource.match(/const ANYTIME_RESET_GREETINGS = \[([\s\S]*?)\];/)?.[1] ?? '';
    const messages = [...poolBlock.matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(messages).toEqual([
      'You made space for yourself in a busy moment.',
      'A small pause can change the shape of your day.',
      'You gave your mind a moment to reset.',
      'That was time well spent on yourself.',
      'You paused, breathed and created a little more space.',
      'Even a brief reset can help you move forward gently.',
      'You listened to what you needed in this moment.'
    ]);
  });

  it('11. "Continue My Day"/"Choose Another Reset" resolve to real, correct destinations - see AnytimeClosingHandoff.test.js for the shared component\'s own action-order/label coverage', () => {
    const source = read('../components/AnytimeClosingHandoff.jsx');
    expect(source).toMatch(/onClick=\{onContinueMyDay\}/);
    expect(source).toMatch(/onClick=\{onChooseAnotherReset\}/);
  });
});

describe('Anytime visual-choice uplift — completion greeting is picked exactly once and held stable across rerenders', () => {
  it('SelfGuidedMeditationComplete.jsx picks completionGreeting via a lazy useState initializer (React only ever invokes this once per mount, immune to re-render) - never a plain call inside the render body that would re-pick on every render', () => {
    const source = read('./SelfGuidedMeditationComplete.jsx');
    expect(source).toMatch(/const \[completionGreeting\] = useState\(\(\) => \(anytimeOrigin \? getCompletionGreeting\(\{ journey: 'anytime', practice: 'reset' \}\) : null\)\);/);
  });

  it('BetaVideoModal.jsx picks completionMessage exactly once inside handleEnded, guarded by the idempotent hasEndedProcessedRef (a second `ended` event for the same instance never re-picks) - held in completionMessage state, never recomputed on ordinary rerenders', () => {
    const source = read('../components/BetaVideoModal.jsx');
    const handleEndedBody = source.match(/const handleEnded = \(\) => \{[\s\S]*?\n {4}\};/)?.[0] ?? '';
    expect(handleEndedBody).toMatch(/if \(hasEndedProcessedRef\.current\) return;/);
    expect(handleEndedBody).toMatch(/setCompletionMessage\(\s*\n\s*completionContext\.journey === 'anytime'\s*\n\s*\? getCompletionGreeting\(\{ journey: 'anytime', practice: 'reset' \}\)/);
    // Rendered directly from state, never re-calling getCompletionGreeting in JSX.
    const overlayBlock = source.slice(source.indexOf('{overlayVisible && ('), source.indexOf('{/* Returned-to-preview state'));
    expect(overlayBlock).toMatch(/\{completionMessage\}/);
    expect(overlayBlock).not.toMatch(/getCompletionGreeting\(/);
  });
});

describe('Anytime visual-choice uplift — Morning and Evening are completely untouched by this pass', () => {
  it('Morning/Evening completion-greeting pools keep their own exact original wording and keys - only Anytime\'s own pool was consolidated', () => {
    const source = read('../lib/outcomeMessages.js');
    expect(source).toMatch(/morning: \{\s*\n\s*breathing: \[/);
    expect(source).toMatch(/stretching: \[/);
    expect(source).toMatch(/evening: \{\s*\n\s*breathing: \[/);
    expect(source).toMatch(/'Rest gently\. You’ve done enough today\.'/);
  });

  it('the Morning/Evening pathway and completion components this pass could have touched (MorningJourneyPathway.jsx/EveningJourneyPathway.jsx/MorningFlow.jsx/EveningBreathing.jsx/EveningMeditate.jsx) never reference anything from this pass\'s own new Anytime vocabulary', () => {
    for (const path of [
      '../components/MorningJourneyPathway.jsx',
      '../components/EveningJourneyPathway.jsx',
      './MorningFlow.jsx',
      './EveningBreathing.jsx',
      './EveningMeditate.jsx'
    ]) {
      const source = read(path);
      expect(source).not.toMatch(/ANYTIME_RESET_GREETINGS|AnytimeClosingHandoff|anytimeOrigin/);
    }
  });
});
