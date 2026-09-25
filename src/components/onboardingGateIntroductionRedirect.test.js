// First-Use Welcome redirect-order defect fix — OnboardingGate.jsx wiring.
// The actual decision logic (shouldRedirectToIntroduction/
// buildIntroductionRedirectPath) is real-execution tested directly in
// introductionVersion.test.js; this file proves the component correctly
// wires that logic in - source-level checks, since this repo's Vitest has
// no DOM/component rendering available (plain Node environment - see any
// other test file's own note on this) to actually mount the component.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./OnboardingGate.jsx', import.meta.url)), 'utf-8');

describe('OnboardingGate.jsx — imports the real, shared decision functions, never a second implementation', () => {
  it('imports shouldRedirectToIntroduction/buildIntroductionRedirectPath from introductionVersion.js', () => {
    expect(source).toMatch(/import \{ shouldRedirectToIntroduction, buildIntroductionRedirectPath \} from '\.\.\/lib\/introductionVersion';/);
  });

  it('imports hasPostAuthRedirectBeenHandled/markPostAuthRedirectHandled from the shared guard module Auth.jsx also writes to', () => {
    expect(source).toMatch(/import \{ hasPostAuthRedirectBeenHandled, markPostAuthRedirectHandled \} from '\.\.\/lib\/postAuthRedirectGuard';/);
  });

  it('imports consumePendingJourneyIntent/resolveJourneyResumeTarget from the same dedicated module Auth.jsx uses - never a second, parallel journey-intent mechanism (F5: also imports setPendingJourneyIntent, for the new guest journey-route guard below)', () => {
    expect(source).toMatch(/import \{ consumePendingJourneyIntent, resolveJourneyResumeTarget, setPendingJourneyIntent \} from '\.\.\/lib\/pendingJourneyIntent';/);
  });
});

describe('OnboardingGate.jsx — pending journey intent survives authentication (item 8), guarded to run at most once', () => {
  it('uses a ref (never a lazy useState initializer, which would run before auth ever resolves at this component\'s very first render) to guard a one-shot check', () => {
    expect(source).toMatch(/const hasCheckedJourneyIntentRef = useRef\(false\);/);
  });

  it('the effect bails while loading, once already checked, or for a guest/no-user - only a real, resolved, non-guest account is ever checked', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(loading \|\| hasCheckedJourneyIntentRef\.current\) return;[\s\S]*?\n\s*\}, \[loading, user, isGuest, navigate\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(!user \|\| isGuest\) return;/);
  });

  it('marks the ref BEFORE consuming (never after) - consumePendingJourneyIntent reads-and-clears in one step and must only ever be called once', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(loading \|\| hasCheckedJourneyIntentRef\.current\) return;[\s\S]*?\n\s*\}, \[loading, user, isGuest, navigate\]\);/)?.[0] ?? '';
    const refSetIndex = body.indexOf('hasCheckedJourneyIntentRef.current = true;');
    const consumeIndex = body.indexOf('consumePendingJourneyIntent()');
    expect(refSetIndex).toBeGreaterThan(-1);
    expect(consumeIndex).toBeGreaterThan(refSetIndex);
  });

  it('when a real journey target is resolved, marks the shared post-auth-handled flag and navigates with replace:true - never leaves both the flag unset and the passive Introduction check free to also redirect', () => {
    const body = source.match(/if \(journeyTarget\) \{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    expect(body).toMatch(/markPostAuthRedirectHandled\(\);/);
    expect(body).toMatch(/navigate\(journeyTarget, \{ replace: true \}\);/);
  });
});

describe('OnboardingGate.jsx — passive Introduction redirect (items 1, 2, 5, 6, 9, 11), declarative <Navigate>', () => {
  it('computes needsIntroductionRedirect from the real AuthContext values and the current location, deferring to whatever Auth.jsx already decided (alreadyHandled)', () => {
    const body = source.match(/const needsIntroductionRedirect = shouldRedirectToIntroduction\(\{[\s\S]*?\}\);/)?.[0] ?? '';
    expect(body).toMatch(/user,/);
    expect(body).toMatch(/isGuest,/);
    expect(body).toMatch(/profile,/);
    expect(body).toMatch(/profileLoading,/);
    expect(body).toMatch(/profileError,/);
    expect(body).toMatch(/pathname: location\.pathname,/);
    expect(body).toMatch(/alreadyHandled: hasPostAuthRedirectBeenHandled\(\)/);
  });

  it('marks the shared flag from within an effect, never directly during render (a render that never commits must never mark this handled without an actual redirect having happened)', () => {
    expect(source).toMatch(/useEffect\(\(\) => \{\s*\n\s*if \(needsIntroductionRedirect\) markPostAuthRedirectHandled\(\);\s*\n\s*\}, \[needsIntroductionRedirect\]\);/);
  });

  it('renders a declarative <Navigate>, never an imperative navigate() call during render, built via the shared buildIntroductionRedirectPath - same declarative-redirect pattern already established elsewhere in this app (e.g. ChangeIntention.jsx\'s own guest guard)', () => {
    expect(source).toMatch(/if \(needsIntroductionRedirect\) \{\s*\n\s*return <Navigate to=\{buildIntroductionRedirectPath\(profile\)\} replace \/>;\s*\n\s*\}/);
  });

  it('this check is evaluated (and its effect declared) BEFORE the existing loading/needsWelcome early returns, respecting the Rules of Hooks - no hook in this component is ever called conditionally', () => {
    const introEffectIndex = source.indexOf('if (needsIntroductionRedirect) markPostAuthRedirectHandled();');
    const loadingReturnIndex = source.indexOf('if (loading) {');
    const needsWelcomeReturnIndex = source.indexOf('if (needsWelcome) {');
    const introReturnIndex = source.indexOf('if (needsIntroductionRedirect) {');
    expect(introEffectIndex).toBeGreaterThan(-1);
    expect(loadingReturnIndex).toBeGreaterThan(introEffectIndex);
    expect(needsWelcomeReturnIndex).toBeGreaterThan(loadingReturnIndex);
    expect(introReturnIndex).toBeGreaterThan(needsWelcomeReturnIndex);
  });

  it('destructures isGuest/profile/profileLoading/profileError from useAuth() alongside the existing user/loading', () => {
    expect(source).toMatch(/const \{ user, loading, isGuest, profile, profileLoading, profileError \} = useAuth\(\);/);
  });
});
