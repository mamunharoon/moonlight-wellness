// Build 15 Phase A — Meditate.jsx bounded-frame regression guard. Applies
// the identical max-w-md/safe-area fix already shipped for
// AnytimeReset.jsx (see AnytimeReset.test.js's own sibling describe
// block) so desktop no longer stretches Meditate full-bleed. Source-level
// checks - this repo's Vitest has no rendering engine (see
// Layout.safeArea.test.js's own header comment for why).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Meditate.jsx', import.meta.url)), 'utf-8');

describe('Meditate.jsx — desktop layout: bounded/centred container, never full-bleed (Phase A)', () => {
  const rootOpenTag = source.match(/return \(\s*\n\s*<div\s*\n?([\s\S]*?)>/)?.[0] ?? '';

  it('the root element is bounded to max-w-md and centred, matching AnytimeReset.jsx\'s own fix and the app\'s existing mobile-simulating shell width', () => {
    expect(rootOpenTag).toMatch(/max-w-md/);
    expect(rootOpenTag).toMatch(/mx-auto/);
  });

  it('horizontal/top padding is applied via safe-area-aware calc(), never a bare fixed px value that could double up with a safe-area inset elsewhere', () => {
    expect(rootOpenTag).toMatch(/paddingLeft:\s*'calc\(1rem \+ env\(safe-area-inset-left\)\)'/);
    expect(rootOpenTag).toMatch(/paddingRight:\s*'calc\(1rem \+ env\(safe-area-inset-right\)\)'/);
    expect(rootOpenTag).toMatch(/paddingTop:\s*'calc\(1rem \+ env\(safe-area-inset-top\)\)'/);
  });

  it('width stays fluid (max-w-md + w-full), never a fixed pixel width that could overflow a narrow mobile viewport', () => {
    expect(rootOpenTag).toMatch(/w-full/);
    expect(rootOpenTag).not.toMatch(/w-\[\d+px\]/);
  });
});

describe('Meditate.jsx — Phase A is a container-only change: recommendation logic, routes, and behaviour are untouched', () => {
  it('still imports and uses the real recommendation engine and catalogue - no data/logic file swapped', () => {
    expect(source).toMatch(/import \{ recommendMeditations \} from '\.\.\/lib\/meditationRecommendations';/);
    expect(source).toMatch(/import \{\s*\n\s*MEDITATION_DURATION_GROUPS,\s*\n\s*MEDITATION_NEEDS,\s*\n\s*getCatalogEntryById\s*\n\s*\} from '\.\.\/lib\/mediaCatalog';/);
  });

  it('the three-step wizard (duration -> need -> recommend) and guest sign-in gate are still exactly as before', () => {
    expect(source).toMatch(/const \[step, setStep\] = useState\(\(\) => \(restoredIsValid \? 'recommend' : 'duration'\)\)/);
    expect(source).toMatch(/if \(isGuest\) \{\s*\n\s*setSignInPromptOpen\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('BetaVideoModal is still reused unchanged - no second/alternate player introduced', () => {
    expect(source).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} \/>/);
  });
});
