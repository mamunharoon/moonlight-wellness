// Regression guard for guest access to IM01/IM02 in Self-Guided Meditation.
// Both are explicitly server-allowlisted interactive ambient beds
// (GUEST_ALLOWED_IDS in supabase/functions/_shared/betaVideoUrlAccess.ts -
// proven to genuinely succeed for a guest by
// src/lib/betaVideoUrlGuestAccess.test.js), so no control anywhere in this
// feature may intercept a guest with a sign-in redirect. Same source-text
// convention as selfGuidedMeditationSetup.test.js - this repo's Vitest has
// no rendering engine (environment: 'node').
//
// Journey Embedding (Phase 2) — the logic this file originally checked all
// lived in one SelfGuidedMeditation.jsx file; it has since moved to
// useMeditationSession.js (handleBegin/handleSelectSound, renamed
// begin/selectSound) and MeditationSetupPanel.jsx/MeditationActiveSession.jsx
// (the two "Choose your sound" radiogroups). This file now checks each in
// its new home. The real controller/audio behaviour (timer/cleanup/
// no-duplicate-instance guarantees, switching between tracks, and the
// truthful revert-on-failure requirement) remains proven by real execution
// in src/lib/meditationSessionController.test.js.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const pageSource = read('./SelfGuidedMeditation.jsx');
const hookSource = read('../hooks/useMeditationSession.js');
const setupPanelSource = read('../components/journey/MeditationSetupPanel.jsx');
const activeSessionSource = read('../components/journey/MeditationActiveSession.jsx');

// Strips /* ... */ and // ... comments before asserting "no real reference
// remains" - several doc comments across these files legitimately mention
// "isGuest"/"auth" as a concept (explaining why no such prop/branch exists),
// which must not itself trip a check for actual code usage.
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

describe('No guest concept left anywhere in this feature (isGuest/useAuth fully removed)', () => {
  it('none of the four files import useAuth or reference isGuest in real code', () => {
    for (const source of [pageSource, hookSource, setupPanelSource, activeSessionSource]) {
      const codeOnly = stripComments(source);
      expect(codeOnly).not.toMatch(/useAuth/);
      expect(codeOnly).not.toMatch(/isGuest/);
    }
  });

  it('the old sign-in-for-music helper and every /auth navigation are gone entirely from all four files', () => {
    for (const source of [pageSource, hookSource, setupPanelSource, activeSessionSource]) {
      const codeOnly = stripComments(source);
      expect(codeOnly).not.toMatch(/confirmSignInForMusic/);
      expect(codeOnly).not.toMatch(/setPendingContent/);
      expect(codeOnly).not.toMatch(/'\/auth'/);
    }
  });
});

describe('Setup screen: a guest can choose any of the three sounds before Begin, no redirect', () => {
  it('MeditationSetupPanel\'s "Choose your sound" radiogroup has no isGuest/onSignIn wiring anywhere in its rows', () => {
    const soundBlock = setupPanelSource.match(/aria-label="Choose your sound">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(soundBlock).not.toBe('');
    expect(soundBlock).not.toMatch(/isGuest/);
    expect(soundBlock).not.toMatch(/onSignIn/);
  });

  it('begin() passes the real selected sound straight through - no guest override, no forced silence', () => {
    const body = hookSource.match(/const begin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/initialSoundId: toControllerSoundId\(soundId\)/);
    expect(body).not.toMatch(/isGuest/);
  });
});

describe('Active session: sound selection never redirects, for anyone', () => {
  it('selectSound has no isGuest branch, no confirmSignInForMusic call, and no navigate call', () => {
    const body = hookSource.match(/const selectSound = \(newSoundId\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/isGuest/);
    expect(body).not.toMatch(/confirmSignInForMusic/);
    expect(body).not.toMatch(/navigate\(/);
  });

  it('MeditationActiveSession\'s "Choose your sound" radiogroup has no isGuest/onSignIn wiring anywhere in its rows', () => {
    const soundBlock = activeSessionSource.match(/aria-label="Choose your sound">[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(soundBlock).not.toBe('');
    expect(soundBlock).not.toMatch(/isGuest/);
    expect(soundBlock).not.toMatch(/onSignIn/);
  });
});

describe('Cleanup is unaffected by any of the above', () => {
  it('unmount/route-change cleanup (now in useMeditationSession.js) still destroys the controller and clears the interval, unchanged', () => {
    expect(hookSource).toMatch(/useEffect\(\(\) => \(\) => cleanupSession\(\), \[\]\);/);
    const cleanupBody = hookSource.match(/const cleanupSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(cleanupBody).toMatch(/stopInterval\(\);/);
    expect(cleanupBody).toMatch(/controllerRef\.current\?\.destroy\(\);/);
  });
});
