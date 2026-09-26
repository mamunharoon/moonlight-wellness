// WakeWise Phase 3A — source-level regression guards for R7 (Morning
// completion CTA fill), R11 (Library scroll-fade affordance), R12
// (Material Symbols font-display), and R13 (Settings subscription label).
// No DOM rendering is available in this repo's Vitest (Node environment) -
// matches this repo's established convention (see confirmDialogSeverity.
// test.js and settingsReducedMotionTapTarget.test.js).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const homeSource = read('./Home.jsx');
const librarySource = read('./Library.jsx');
const settingsSource = read('./Settings.jsx');
const indexHtml = read('../../index.html');

describe('Phase 3A (R7) — Morning completed-card CTA matches Evening/Anytime\'s journey-coloured fill', () => {
  const completedBlock = homeSource.slice(
    homeSource.indexOf("morningCardState === 'completed' && ("),
    homeSource.indexOf("morningCardState === 'completed' && (") + 2000
  );

  it('uses getJourneyPrimaryActionClasses(\'morning\') for the Repeat Morning Routine button, not the old neutral glass-panel treatment', () => {
    expect(completedBlock).toMatch(/\$\{getJourneyPrimaryActionClasses\('morning'\)\} font-bold/);
    expect(completedBlock).not.toMatch(/glass-panel text-on-surface-variant font-semibold/);
  });

  it('Morning in-progress card\'s secondary "Start Over" action is untouched (still the quiet glass-panel treatment, never promoted to look primary)', () => {
    const inProgressBlock = homeSource.slice(
      homeSource.indexOf("morningCardState === 'in-progress' && ("),
      homeSource.indexOf("morningCardState === 'in-progress' && (") + 2000
    );
    expect(inProgressBlock).toMatch(/glass-panel text-on-surface-variant font-semibold[\s\S]*?Start Over/);
  });

  it('Evening\'s own completed-card primary action still uses the identical shared helper, confirming Morning now matches it rather than diverging', () => {
    const eveningCompletedBlock = homeSource.slice(
      homeSource.indexOf("eveningCardState === 'completed' && ("),
      homeSource.indexOf("eveningCardState === 'completed' && (") + 2000
    );
    expect(eveningCompletedBlock).toMatch(/\$\{getJourneyPrimaryActionClasses\('evening'\)\} font-bold/);
  });
});

describe('Phase 3A (R11) — Library category row has a decorative, non-blocking trailing scroll-fade cue', () => {
  it('tracks real scroll position via a ref + onScroll handler, not a static always-on overlay', () => {
    expect(librarySource).toMatch(/const categoryScrollRef = useRef\(null\);/);
    expect(librarySource).toMatch(/const \[showCategoryFade, setShowCategoryFade\] = useState\(false\);/);
    expect(librarySource).toMatch(/onScroll=\{updateCategoryFade\}/);
  });

  it('the fade element is aria-hidden and pointer-events-none, so it never blocks touch/click or appears to assistive tech', () => {
    const fadeBlock = librarySource.slice(librarySource.indexOf('showCategoryFade && ('), librarySource.indexOf('showCategoryFade && (') + 300);
    expect(fadeBlock).toMatch(/aria-hidden="true"/);
    expect(fadeBlock).toMatch(/pointer-events-none/);
  });

  it('every category chip is still a real <button>, unaffected by the fade overlay', () => {
    expect(librarySource).toMatch(/<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => handleSelectCategory\(null\)\}/);
  });
});

describe('Phase 3A (R12) — Material Symbols uses font-display:block, distinct from the text fonts\' swap', () => {
  it('Material Symbols link uses display=block', () => {
    expect(indexHtml).toMatch(/family=Material\+Symbols\+Outlined[^"]*&display=block/);
  });

  it('the text fonts (Plus Jakarta Sans, Newsreader, Playfair Display) keep display=swap - not changed by this fix', () => {
    expect(indexHtml).toMatch(/family=Plus\+Jakarta\+Sans[^"]*&display=swap/);
    expect(indexHtml).toMatch(/family=Newsreader[^"]*&display=swap/);
    expect(indexHtml).toMatch(/family=Playfair\+Display[^"]*&display=swap/);
  });
});

describe('Phase 3A (R13) — Settings subscription row shows the real plan, not a static "WakeWise Plus" label', () => {
  it('imports and reads the real subscription plan via useSubscription', () => {
    expect(settingsSource).toMatch(/import \{ useSubscription \} from '\.\.\/context\/SubscriptionContext';/);
    expect(settingsSource).toMatch(/const \{ subscription \} = useSubscription\(\);/);
  });

  it('the row label itself now reads "Subscription", never the static "WakeWise Plus"', () => {
    const rowBlock = settingsSource.slice(settingsSource.indexOf('<Link to="/subscription"'), settingsSource.indexOf('<Link to="/subscription"') + 400);
    expect(rowBlock).toMatch(/Subscription/);
    expect(rowBlock).not.toMatch(/>\s*WakeWise Plus\s*</);
  });

  it('the actual plan value is shown as the row\'s value text, reusing the same Free/WakeWise Plus labels Subscription.jsx itself uses', () => {
    expect(settingsSource).toMatch(/const PLAN_LABELS = \{ free: 'Free', plus: 'WakeWise Plus' \};/);
    expect(settingsSource).toMatch(/\{PLAN_LABELS\[subscription\.plan\] \?\? subscription\.plan\}/);
  });

  it('does not touch subscription navigation or billing logic - the row still links to /subscription', () => {
    expect(settingsSource).toMatch(/<Link to="\/subscription" className=\{rowClass\}>/);
  });
});
