// Regression guard for guest access to IM01/IM02 in Self-Guided Meditation.
// Both are explicitly server-allowlisted interactive ambient beds
// (GUEST_ALLOWED_IDS in supabase/functions/_shared/betaVideoUrlAccess.ts -
// proven to genuinely succeed for a guest by
// src/lib/betaVideoUrlGuestAccess.test.js), so no control in this file may
// intercept a guest with a sign-in redirect. Same source-text convention as
// selfGuidedMeditationSetup.test.js - this repo's Vitest has no rendering
// engine (environment: 'node'). The real controller/audio behaviour
// (timer/cleanup/no-duplicate-instance guarantees, switching between
// tracks, and the truthful revert-on-failure requirement) is proven by
// real execution in src/lib/meditationSessionController.test.js, which
// replaced this file's own former real-execution section once the single
// boolean Music toggle became the three-way "Choose your sound" model.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SelfGuidedMeditation.jsx');

// Strips /* ... */ and // ... comments before asserting "no real reference
// remains" - several of this file's own doc comments legitimately mention
// "isGuest"/"auth" as a concept (explaining why no such prop/branch exists
// any more), which must not itself trip a check for actual code usage.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
const codeOnly = stripComments(source);

const activeScreenBlock = source.slice(source.indexOf("if (phase === 'active' && snapshot)"), source.indexOf('\n  return (\n'));
const setupScreenBlock = source.slice(source.indexOf('\n  return (\n'));

describe('SelfGuidedMeditation.jsx — no guest concept left anywhere in this file (isGuest/useAuth fully removed)', () => {
  it('does not import useAuth, and never references isGuest in real code (comments explaining its removal are fine)', () => {
    expect(codeOnly).not.toMatch(/useAuth/);
    expect(codeOnly).not.toMatch(/isGuest/);
  });

  it('the old sign-in-for-music helper and every /auth navigation are gone entirely', () => {
    expect(codeOnly).not.toMatch(/confirmSignInForMusic/);
    expect(codeOnly).not.toMatch(/setPendingContent/);
    expect(codeOnly).not.toMatch(/'\/auth'/);
  });
});

describe('SelfGuidedMeditation.jsx — setup screen: a guest can choose any of the three sounds before Begin, no redirect', () => {
  it('the setup screen\'s "Choose your sound" radiogroup has no isGuest/onSignIn wiring anywhere in its rows', () => {
    const soundBlock = setupScreenBlock.match(/aria-label="Choose your sound">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(soundBlock).not.toBe('');
    expect(soundBlock).not.toMatch(/isGuest/);
    expect(soundBlock).not.toMatch(/onSignIn/);
  });

  it('handleBegin passes the real selected sound straight through - no guest override, no forced silence', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/initialSoundId: toControllerSoundId\(soundId\)/);
    expect(body).not.toMatch(/isGuest/);
  });
});

describe('SelfGuidedMeditation.jsx — active session: sound selection never redirects, for anyone', () => {
  it('handleSelectSound has no isGuest branch, no confirmSignInForMusic call, and no navigate call', () => {
    const body = source.match(/const handleSelectSound = \(newSoundId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/isGuest/);
    expect(body).not.toMatch(/confirmSignInForMusic/);
    expect(body).not.toMatch(/navigate\(/);
  });

  it('the active screen\'s "Choose your sound" radiogroup has no isGuest/onSignIn wiring anywhere in its rows', () => {
    const soundBlock = activeScreenBlock.match(/aria-label="Choose your sound">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(soundBlock).not.toBe('');
    expect(soundBlock).not.toMatch(/isGuest/);
    expect(soundBlock).not.toMatch(/onSignIn/);
  });
});

describe('SelfGuidedMeditation.jsx — cleanup is unaffected by any of the above', () => {
  it('unmount/route-change cleanup still destroys the controller and clears the interval, unchanged', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => cleanupSession\(\), \[\]\);/);
    const cleanupBody = source.match(/const cleanupSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(cleanupBody).toMatch(/stopInterval\(\);/);
    expect(cleanupBody).toMatch(/controllerRef\.current\?\.destroy\(\);/);
  });
});
