// First-use welcome screen for NEW guests (Build 16) — regression guard.
// No DOM/component rendering is available in this repo's Vitest (see
// Home.routineState.test.js's own note) - source-level checks, matching
// every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./OnboardingGate.jsx');

describe('OnboardingGate — a brand-new guest is sent straight to /introduction the moment they tap Continue as Guest', () => {
  it('imports useNavigate/Navigate alongside the existing useLocation', () => {
    expect(source).toMatch(/import \{ useLocation, useNavigate, Navigate \} from 'react-router-dom';/);
  });

  it('calls navigate() with replace:true and the ?auto=1 first-use marker inside the same handler as the existing guest-entry persistence - never a ref/state flag consumed on a later render', () => {
    const handler = source.match(/onContinueAsGuest=\{\(\) => \{[\s\S]*?\n {8}\}\}/)?.[0] ?? '';
    expect(handler).toMatch(/markGuestEntryChosen\(\);/);
    expect(handler).toMatch(/setGuestEntryChosen\(true\);/);
    expect(handler).toMatch(/navigate\('\/introduction\?auto=1', \{ replace: true \}\);/);
    // No ref-during-render pattern for THIS handler specifically (React's
    // react-hooks/refs rule forbids reading/writing a ref during render -
    // this handler deliberately avoids that entire class of bug by using
    // an imperative navigate() call instead of a "consume once" ref/state
    // flag). useRef itself is now legitimately used elsewhere in this file
    // for a genuinely different, one-shot-per-app-lifetime purpose (the
    // pending-journey-intent check, inside a real useEffect - see
    // onboardingGateIntroductionRedirect.test.js for that piece's own
    // coverage) - this assertion only proves this ONE handler is
    // untouched by that, not that useRef is absent from the whole file.
    expect(handler).not.toMatch(/useRef|\.current/);
  });

  it('this does not change needsWelcome\'s own decision logic - only what happens the moment guest entry is chosen', () => {
    expect(source).toMatch(/const needsWelcome = !user && !guestEntryChosen && !isAllowedPreEntryPath;/);
  });

  it('replace:true means this redirect does not leave an extra Welcome/pre-entry entry in browser history', () => {
    expect(source).toMatch(/navigate\('\/introduction\?auto=1', \{ replace: true \}\);/);
  });

  it('?auto=1 is the exact same first-use marker Auth.jsx\'s own redirectAfterAuth uses - one shared convention, not two', () => {
    const authSource = read('../pages/Auth.jsx');
    // Build 16 (Personalised Welcome copy): Auth.jsx's own navigate call is
    // now a template literal (it also appends &existing=1 conditionally -
    // see authIntroductionGate.test.js for that piece's own coverage), but
    // the literal `/introduction?auto=1` prefix is unchanged.
    expect(authSource).toMatch(/navigate\(`\/introduction\?auto=1\$\{existingParam\}`, \{ replace: true \}\);/);
  });
});
