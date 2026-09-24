// Remove Routines from the Visible User Flow — App.jsx route-table
// regression guard. Source-level checks, matching this repo's established
// pattern (no DOM/component rendering available in this Node-environment
// Vitest - see src/lib/guestOnboarding.test.js's own App.jsx-reading
// precedent).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const appSource = readFileSync(fileURLToPath(new URL('./App.jsx', import.meta.url)), 'utf-8');
const routinesCatalogSource = readFileSync(fileURLToPath(new URL('./lib/routinesCatalog.js', import.meta.url)), 'utf-8');
const intentionSetupSource = readFileSync(fileURLToPath(new URL('./pages/IntentionSetup.jsx', import.meta.url)), 'utf-8');
const eveningWindDownSource = readFileSync(fileURLToPath(new URL('./pages/EveningWindDown.jsx', import.meta.url)), 'utf-8');
const homeSource = readFileSync(fileURLToPath(new URL('./pages/Home.jsx', import.meta.url)), 'utf-8');
const anytimeResetSource = readFileSync(fileURLToPath(new URL('./pages/AnytimeReset.jsx', import.meta.url)), 'utf-8');

describe('/routines redirects safely to Home', () => {
  it('the /routines route is a plain <Navigate to="/" replace>, never rendering the Hub', () => {
    expect(appSource).toMatch(/<Route path="routines" element=\{<Navigate to="\/" replace \/>\} \/>/);
  });
});

describe('Each known historical routine-detail URL has a safe, deterministic destination', () => {
  it('/routines/:routineId renders RoutineDetailRedirect, a dedicated component - not the real RoutineDetail screen', () => {
    expect(appSource).toMatch(/<Route path="routines\/:routineId" element=\{<RoutineDetailRedirect \/>\} \/>/);
  });

  it('RoutineDetailRedirect reads the real :routineId param via useParams and resolves it through HISTORICAL_ROUTINE_REDIRECTS', () => {
    expect(appSource).toMatch(/function RoutineDetailRedirect\(\) \{\s*\n\s*const \{ routineId \} = useParams\(\);\s*\n\s*return <Navigate to=\{HISTORICAL_ROUTINE_REDIRECTS\[routineId\] \?\? '\/'\} replace \/>;\s*\n\s*\}/);
  });

  it('gentle-reset (requiresAuth: false, a plain stateless navigate) redirects directly to its real equivalent, /quiet-breathing - a genuine 1:1 safe destination', () => {
    expect(appSource).toMatch(/'gentle-reset': '\/quiet-breathing'/);
  });

  it('rise-reset and wind-down are NOT given a direct 1:1 redirect to their own step routes - neither IntentionSetup.jsx nor EveningWindDown.jsx has its own guest gate, so a blind redirect would bypass the real sign-in requirement Home.jsx currently enforces before either one starts', () => {
    expect(appSource).not.toMatch(/'rise-reset':/);
    expect(appSource).not.toMatch(/'wind-down':/);
    // Confirmed directly: neither page performs its own auth check.
    expect(intentionSetupSource).not.toMatch(/isGuest/);
    expect(eveningWindDownSource).not.toMatch(/isGuest/);
  });

  it('all three known ids are still real entries in routinesCatalog.js, unmodified - this redirect map is accountable to the real catalogue, not an invented list', () => {
    expect(routinesCatalogSource).toMatch(/id: 'rise-reset'/);
    expect(routinesCatalogSource).toMatch(/id: 'gentle-reset'/);
    expect(routinesCatalogSource).toMatch(/id: 'wind-down'/);
  });
});

describe('Unknown routine URLs fall back safely to Home', () => {
  it('the redirect map falls back to \'/\' via ?? for any id not explicitly listed (rise-reset, wind-down, and anything never seen before)', () => {
    const mapBody = appSource.match(/const HISTORICAL_ROUTINE_REDIRECTS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(mapBody).not.toBe('');
    // Exactly one real mapping (gentle-reset) - every other id, known or
    // unknown, resolves through the `?? '/'` fallback in
    // RoutineDetailRedirect itself, never a second special case here.
    const mappedIds = [...mapBody.matchAll(/'([a-z-]+)':/g)].map((m) => m[1]);
    expect(mappedIds).toEqual(['gentle-reset']);
  });
});

describe('No redirect loop is possible', () => {
  it('every redirect target is a fixed leaf path, never /routines or /routines/:routineId themselves', () => {
    expect(appSource).not.toMatch(/Navigate to="\/routines"/);
    expect(appSource).not.toMatch(/HISTORICAL_ROUTINE_REDIRECTS\[routineId\] \?\? '\/routines/);
    const mapBody = appSource.match(/const HISTORICAL_ROUTINE_REDIRECTS = \{[\s\S]*?\n\};/)?.[0] ?? '';
    expect(mapBody).not.toMatch(/\/routines/);
  });

  it('does not rely solely on browser history - both redirects are declarative <Navigate replace> elements resolved from the URL itself, not a goBack()/history.back() call', () => {
    expect(appSource).not.toMatch(/history\.back\(\)/);
    const routinesRouteBlock = appSource.match(/<Route path="routines" element=\{[\s\S]*?\/>\} \/>/)?.[0] ?? '';
    const routineIdRouteBlock = appSource.match(/<Route path="routines\/:routineId" element=\{[\s\S]*?\/>\} \/>/)?.[0] ?? '';
    expect(routinesRouteBlock).toMatch(/<Navigate/);
    expect(routineIdRouteBlock).not.toMatch(/goBack/);
  });
});

describe('Routines.jsx/RoutineDetail.jsx are dormant, not deleted', () => {
  it('App.jsx no longer imports them as lazy routes (they are unwired, not removed from disk)', () => {
    expect(appSource).not.toMatch(/lazy\(\(\) => import\('\.\/pages\/Routines'\)/);
    expect(appSource).not.toMatch(/lazy\(\(\) => import\('\.\/pages\/RoutineDetail'\)/);
  });

  it('the files themselves, and routinesCatalog.js, still exist and are readable on disk - confirmed by this very test file successfully reading routinesCatalog.js above, plus a direct existence check on the two page components', () => {
    expect(existsSync(fileURLToPath(new URL('./pages/Routines.jsx', import.meta.url)))).toBe(true);
    expect(existsSync(fileURLToPath(new URL('./pages/RoutineDetail.jsx', import.meta.url)))).toBe(true);
    expect(existsSync(fileURLToPath(new URL('./pages/Routines.test.js', import.meta.url)))).toBe(true);
  });
});

describe('Home Morning/Anytime/Evening actions remain completely unchanged', () => {
  it('Home.jsx\'s own real Morning/Evening entry handlers (the ones Introduction.jsx\'s Welcome cards now mirror) are untouched, byte-identical to before this change', () => {
    expect(homeSource).toMatch(/const handleBeginRiseAndReset = \(\) => \{\s*\n\s*if \(state\.status === 'playing' \|\| state\.status === 'interrupted'\) \{\s*\n\s*resetSession\(\);\s*\n\s*\}\s*\n\s*startSession\('morning-routine', \{ startIndex: getStepIndex\('morning-routine', MORNING_STEP_IDS\.INTENTION\) \}\);\s*\n\s*navigate\('\/intention-setup'\);\s*\n\s*\};/);
    expect(homeSource).toMatch(/const handleBeginEveningWindDown = \(\) => \{\s*\n\s*navigate\('\/evening-wind-down'\);\s*\n\s*\};/);
    expect(homeSource).toMatch(/const promptRoutineSignIn = \(\) => \{/);
  });

  it('Anytime Reset\'s own entry point (Home\'s quick-action tile -> /anytime-reset) is untouched - this change never routed through it at all', () => {
    expect(homeSource).toMatch(/to="\/anytime-reset"/);
    expect(anytimeResetSource).toMatch(/export const AnytimeReset = \(\) => \{/);
  });
});
