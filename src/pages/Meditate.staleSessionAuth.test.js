// Build 15 Phase B remediation (Task 3) — Meditate.jsx now applies the
// same server-revalidation pattern AnytimeReset.jsx already proved (see
// AnytimeReset.test.js's own "stale session" coverage), closing the gap
// where Meditate only ever checked the locally-cached isGuest before
// opening BetaVideoModal. Source-level checks - this repo's Vitest has no
// rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Meditate.jsx', import.meta.url)), 'utf-8');

describe('Meditate.jsx — server-revalidated auth before ever opening BetaVideoModal', () => {
  it('imports the real supabase client and useRef, matching AnytimeReset.jsx\'s own imports', () => {
    expect(source).toMatch(/import \{ useEffect, useRef, useState \} from 'react';/);
    expect(source).toMatch(/import \{ supabase \} from '\.\.\/lib\/supabaseClient';/);
  });

  it('destructures authLoading (auth resolution state), not just isGuest', () => {
    expect(source).toMatch(/const \{ isGuest, loading: authLoading \} = useAuth\(\);/);
  });

  it('holds both a verifyingAuth state (drives the UI) and a verifyingAuthRef (synchronous re-entrancy guard)', () => {
    expect(source).toMatch(/const \[verifyingAuth, setVerifyingAuth\] = useState\(false\);/);
    expect(source).toMatch(/const verifyingAuthRef = useRef\(false\);/);
  });
});

describe('Meditate.jsx — handleBegin: unresolved auth/loading can never open the video', () => {
  it('bails out while authLoading is true or a verification is already in flight, before ever checking isGuest', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(!current \|\| authLoading \|\| verifyingAuthRef\.current\) return;/);
  });

  it('a guest is still routed straight to the sign-in prompt, never through verification', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isGuest\) \{\s*\n\s*setSignInPromptOpen\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('a non-guest tap goes through verifyAndOpenVideo, never straight to setOpenVideoId any more', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/verifyAndOpenVideo\(current\.id\);/);
    expect(body).not.toMatch(/setOpenVideoId\(current\.id\);/);
  });
});

describe('Meditate.jsx — verifyAndOpenVideo: exactly one supabase.auth.getUser() call per Start/Begin tap', () => {
  it('sets the re-entrancy ref and busy state synchronously before the async call, and clears both in a finally', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/verifyingAuthRef\.current = true;\s*\n\s*setVerifyingAuth\(true\);/);
    expect(body).toMatch(/finally \{\s*\n\s*verifyingAuthRef\.current = false;\s*\n\s*setVerifyingAuth\(false\);\s*\n\s*\}/);
  });

  it('calls the real supabase.auth.getUser() exactly once', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const calls = body.match(/supabase\.auth\.getUser\(\)/g) ?? [];
    expect(calls.length).toBe(1);
  });

  it('a valid, non-anonymous user opens BetaVideoModal via setOpenVideoId', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setOpenVideoId\(id\);/);
  });

  it('an error, missing user, or an anonymous user all show the SignInPromptDialog instead of opening the video', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(error \|\| !data\?\.user \|\| data\.user\.is_anonymous\) \{\s*\n\s*setSignInPromptOpen\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('a thrown/rejected getUser() call also falls back to the sign-in prompt, never a silent failure or a crash', () => {
    const body = source.match(/const verifyAndOpenVideo = async \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/\} catch \{\s*\n\s*setSignInPromptOpen\(true\);\s*\n\s*\}/);
  });
});

describe('Meditate.jsx — Begin button reflects the busy/disabled state, "Checking…" via RecommendationCard\'s own shared copy', () => {
  it('passes startDisabled/startBusy into RecommendationCard, which it never did before this remediation', () => {
    const cardBlock = source.match(/<RecommendationCard[\s\S]*?\/>/)?.[0] ?? '';
    expect(cardBlock).toMatch(/startDisabled=\{authLoading \|\| verifyingAuth\}/);
    expect(cardBlock).toMatch(/startBusy=\{verifyingAuth\}/);
  });
});

describe('Meditate.jsx — Cancel (dismissing the sign-in prompt) preserves the current recommendation', () => {
  it('the SignInPromptDialog dismiss handler only ever closes the prompt - no step/need/duration/optionIndex state is touched', () => {
    const body = source.match(/onDismiss=\{[\s\S]{0,60}\}/)?.[0] ?? '';
    expect(body).toMatch(/setSignInPromptOpen\(false\)/);
  });
});

describe('Meditate.jsx — sign-in restores the exact same allowlisted need/duration state as before, unchanged by this remediation', () => {
  it('setPendingContent still carries the current item id and the same need/duration returnPath', () => {
    expect(source).toMatch(/const returnPath = \(\) => `\/meditate\?need=\$\{needId\}&duration=\$\{durationGroupId\}`;/);
    expect(source).toMatch(/setPendingContent\(\{ id: current\.id, returnPath: returnPath\(\) \}\);/);
  });

  it('the restore-param validation (allowlisted against the real need/duration catalogues) is unchanged', () => {
    expect(source).toMatch(/MEDITATION_NEEDS\.some\(\(n\) => n\.id === restoredNeed\)/);
    expect(source).toMatch(/MEDITATION_DURATION_GROUPS\.some\(\(g\) => g\.id === restoredDuration\)/);
  });
});

describe('Meditate.jsx — server-side security surface is completely untouched by this remediation', () => {
  it('BetaVideoModal is still the same, only component, reused unchanged', () => {
    expect(source).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} onEnded=\{\(\) => setVideoEndedNaturally\(true\)\} \/>/);
  });

  it('this remediation never imports or references get-beta-video-url, storage, or any Supabase table/function beyond the read-only auth.getUser() call', () => {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const supabaseUsages = withoutComments.match(/supabase\.[a-zA-Z.]+\(/g) ?? [];
    expect(supabaseUsages.length).toBeGreaterThan(0);
    for (const usage of supabaseUsages) {
      expect(usage).toMatch(/^supabase\.auth\.getUser\(/);
    }
  });
});

describe('Meditate.jsx — recommendation engine/state stay entirely separate from Anytime Reset\'s', () => {
  it('still imports and uses only its own recommendation engine and catalogue - never AnytimeReset\'s state/data (comments citing AnytimeReset.jsx as a design-pattern precedent are fine; an actual import from its module is not)', () => {
    expect(source).toMatch(/import \{ recommendMeditations \} from '\.\.\/lib\/meditationRecommendations';/);
    expect(source).not.toMatch(/from '\.\.\/lib\/anytimeResetRecommendations'/);
    expect(source).not.toMatch(/ANYTIME_RESET_NEEDS|ANYTIME_RESET_DURATIONS|recommendAnytimeReset/);
  });
});
