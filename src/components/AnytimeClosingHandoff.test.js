// Anytime Visual Flow and Closing Handoff uplift (Part 9) —
// AnytimeClosingHandoff. No DOM rendering available in this repo's
// Vitest - source-level checks, matching this codebase's own established
// precedent, plus real-execution checks for the two exported string
// constants (genuinely pure, no React/DOM dependency).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { ANYTIME_HANDOFF_EYEBROW, ANYTIME_HANDOFF_PROMPT } from './AnytimeClosingHandoff';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AnytimeClosingHandoff.jsx');

describe('AnytimeClosingHandoff - exported copy constants (real execution)', () => {
  it('the approved eyebrow and "what feels right now" prompt, exactly as specified', () => {
    expect(ANYTIME_HANDOFF_EYEBROW).toBe('RESET COMPLETE');
    expect(ANYTIME_HANDOFF_PROMPT).toBe('What feels right now?');
  });

  it('never contains a 100%/percentage claim - Anytime never shows a 100% indicator', () => {
    expect(ANYTIME_HANDOFF_EYEBROW).not.toMatch(/100|%/);
    expect(ANYTIME_HANDOFF_PROMPT).not.toMatch(/100|%/);
  });
});

describe('AnytimeClosingHandoffActions - exactly three actions, in the approved order', () => {
  const actionsSource = source.slice(source.indexOf('export const AnytimeClosingHandoffActions'), source.indexOf('export const AnytimeClosingHandoffMessage'));

  it('renders Continue My Day (primary), Choose Another Reset (secondary), and Explore More (tertiary, optional) - in exactly this order', () => {
    const continueIdx = actionsSource.indexOf('Continue My Day');
    const chooseIdx = actionsSource.indexOf('Choose Another Reset');
    const exploreIdx = actionsSource.indexOf('Explore More');
    expect(continueIdx).toBeGreaterThan(-1);
    expect(chooseIdx).toBeGreaterThan(continueIdx);
    expect(exploreIdx).toBeGreaterThan(chooseIdx);
  });

  it('Continue My Day and Choose Another Reset are always rendered (never optional); Explore More is the ONLY conditional action, gated on the caller supplying onExploreMore', () => {
    expect(actionsSource).toMatch(/onClick=\{onContinueMyDay\}/);
    expect(actionsSource).toMatch(/onClick=\{onChooseAnotherReset\}/);
    expect(actionsSource).toMatch(/\{onExploreMore && \(/);
  });

  it('Continue My Day resolves the mint (anytime) primary action classes - never a different journey tone', () => {
    expect(actionsSource).toMatch(/getJourneyPrimaryActionClasses\('anytime'\)/);
  });

  it('every action meets the 44x44 minimum touch target', () => {
    const buttonBlocks = actionsSource.match(/<button[\s\S]*?<\/button>/g) ?? [];
    expect(buttonBlocks.length).toBeGreaterThanOrEqual(2);
    for (const block of buttonBlocks) {
      expect(block).toMatch(/min-h-\[44px\]/);
    }
  });

  it('forwards an optional primaryButtonRef to the Continue My Day button, preserving BetaVideoModal.jsx\'s own established focus-management contract', () => {
    expect(actionsSource).toMatch(/ref=\{primaryButtonRef\}/);
  });

  it('this component never imports react-router or the Session Engine - every action is a plain caller-supplied callback, exactly like BetaVideoModal.jsx\'s own completionContext contract', () => {
    expect(source).not.toMatch(/from 'react-router-dom'/);
    expect(source).not.toMatch(/useSession|SessionContext/);
  });
});

describe('AnytimeClosingHandoffMessage - badge, eyebrow, rotating greeting, prompt', () => {
  const messageSource = source.slice(source.indexOf('export const AnytimeClosingHandoffMessage'), source.indexOf('export const AnytimeClosingHandoff = ('));

  it('reuses the shared CompletionReveal transition with journeyTone="anytime" - never a bespoke animation, never a different journey tone', () => {
    expect(messageSource).toMatch(/<CompletionReveal/);
    expect(messageSource).toMatch(/journeyTone="anytime"/);
  });

  it('the badge uses only existing mint (tertiary) tokens - bg-tertiary/10, border-tertiary-tint/25, shadow-mint-glow - never a new colour, never Morning gold or Evening periwinkle', () => {
    expect(messageSource).toMatch(/bg-tertiary\/10 border border-tertiary-tint\/25 shadow-mint-glow/);
    expect(messageSource).not.toMatch(/morning-accent|evening-accent/);
  });

  it('renders the eyebrow and prompt via the exported constants, never a second hardcoded literal copy of the same strings', () => {
    expect(messageSource).toMatch(/\{ANYTIME_HANDOFF_EYEBROW\}/);
    expect(messageSource).toMatch(/\{ANYTIME_HANDOFF_PROMPT\}/);
    expect(messageSource).not.toMatch(/>RESET COMPLETE</);
    expect(messageSource).not.toMatch(/>What feels right now\?</);
  });

  it('never picks its own greeting - `greeting` is always a plain prop, this component never calls getCompletionGreeting itself (the caller must pick exactly once, per outcomeMessages.js\'s own doc comment)', () => {
    expect(messageSource).not.toMatch(/getCompletionGreeting/);
    expect(messageSource).toMatch(/\{greeting\}/);
  });

  it('accepts an optional `detail` slot for extra factual information (e.g. SelfGuidedMeditationComplete.jsx\'s own style+duration card), rendered as a genuine fourth stagger item only when supplied', () => {
    expect(messageSource).toMatch(/detail \? <div key="detail">\{detail\}<\/div> : null/);
  });

  it('never shows a 100%/percentage indicator anywhere in the rendered markup', () => {
    const code = messageSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/100%/);
  });
});

describe('AnytimeClosingHandoff - the full, self-contained panel used by QuietBreathing.jsx/SelfGuidedMeditationComplete.jsx', () => {
  const fullSource = source.slice(source.indexOf('export const AnytimeClosingHandoff = ('));

  it('renders the message half, then the three actions as a plain, immediately-visible sibling - never delayed behind CompletionReveal\'s own hold/stagger timing (Part 9: "Actions should be visible and tappable promptly")', () => {
    expect(fullSource).toMatch(/<AnytimeClosingHandoffMessage active=\{active\} isFresh=\{isFresh\} greeting=\{greeting\} detail=\{detail\} className=\{className\} \/>/);
    expect(fullSource).toMatch(/\{active && \(/);
    expect(fullSource).toMatch(/<AnytimeClosingHandoffActions/);
  });

  it('the actions sibling is gated on the same `active` flag as the message, never rendered before the caller says so', () => {
    const actionsGate = fullSource.match(/\{active && \(([\s\S]*?)\)\}/)?.[0] ?? '';
    expect(actionsGate).not.toBe('');
    expect(actionsGate).toMatch(/onContinueMyDay=\{onContinueMyDay\}/);
    expect(actionsGate).toMatch(/onChooseAnotherReset=\{onChooseAnotherReset\}/);
    expect(actionsGate).toMatch(/onExploreMore=\{onExploreMore\}/);
  });
});
