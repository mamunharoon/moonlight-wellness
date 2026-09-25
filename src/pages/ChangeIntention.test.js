// Build 15 Phase B remediation — ChangeIntention.jsx (the dedicated
// /change-intention screen) regression guard. Source-level checks - this
// repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ChangeIntention.jsx', import.meta.url)), 'utf-8');

describe('ChangeIntention.jsx — reuses existing business logic, never a parallel implementation', () => {
  it('imports the exact same selection/persistence helpers IntentionSetup.jsx uses, plus the custom-intention defect fix\'s add-only helper and messages', () => {
    expect(source).toMatch(/import \{\s*\n\s*toggleIntention,\s*\n\s*addCustomIntention,\s*\n\s*roleForIndex,\s*\n\s*LIMIT_MESSAGE,\s*\n\s*CUSTOM_LIMIT_MESSAGE,\s*\n\s*DUPLICATE_INTENTION_MESSAGE\s*\n\s*\} from '\.\.\/lib\/intentionSelection';/);
    expect(source).toMatch(/import \{ saveIntentionsToCloud \} from '\.\.\/lib\/intentionPersistence';/);
    expect(source).toMatch(/import \{ INTENTION_PRESETS \} from '\.\.\/lib\/intentionAffirmations';/);
  });

  it('never imports or references the Session Engine or routine start/resume/reset', () => {
    expect(source).not.toMatch(/useSession|startSession|resumeRoutine|resetRoutine|abandonSession/);
  });

  it('Save calls setIntentions then saveIntentionsToCloud with the full draft array - the exact same two-call mechanism as the old inline editor/IntentionSetup.jsx', () => {
    const body = source.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIntentions\(draftSelection\);/);
    expect(body).toMatch(/await saveIntentionsToCloud\(userId, draftSelection\);/);
  });
});

describe('ChangeIntention.jsx — preload from the current Primary/Supporting intentions, derived during render (never a setState-in-effect)', () => {
  it('draftSelection is a plain derived value - manualDraft (null until the first edit) falls back to the live intentions context, same default only when genuinely empty', () => {
    expect(source).toMatch(/const \[manualDraft, setManualDraft\] = useState\(null\);/);
    expect(source).toMatch(/const draftSelection = manualDraft \?\? \(intentions\.length > 0 \? intentions : \['Stay calm'\]\);/);
  });

  it('never uses useEffect to sync the draft - deriving during render means a slow Supabase fetch resolving after mount is picked up automatically on the next render, without the setState-in-effect anti-pattern', () => {
    expect(source).not.toMatch(/useEffect/);
  });

  it('once the user\'s first edit sets manualDraft, a later change to the live intentions context can never clobber it (manualDraft, not intentions, wins via ??)', () => {
    const body = source.match(/const applySelection = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setManualDraft\(next\);/);
  });

  it('a preset\'s selected index (and so its role/checkmark) is derived from the draft, never the original intentions array', () => {
    expect(source).toMatch(/const selectedIndex = draftSelection\.findIndex\(\(item\) => item\.toLowerCase\(\) === preset\.toLowerCase\(\)\);/);
  });
});

describe('ChangeIntention.jsx — guest guard (direct URL/refresh safety, second layer behind Home\'s own gate)', () => {
  it('redirects home via the declarative <Navigate> pattern (never an imperative navigate() call during render)', () => {
    expect(source).toMatch(/import \{ Navigate, useNavigate \} from 'react-router-dom';/);
    expect(source).toMatch(/if \(!authLoading && isGuest\) \{\s*\n\s*return <Navigate to="\/" replace \/>;\s*\n\s*\}/);
  });

  it('is gated on !authLoading, so a genuinely signed-in user refreshing this route is never bounced home mid-resolve', () => {
    expect(source).toMatch(/const \{ isGuest, loading: authLoading \} = useAuth\(\);/);
  });

  it('every hook is declared before the guard\'s early return, respecting the Rules of Hooks', () => {
    const guardIndex = source.indexOf('if (!authLoading && isGuest)');
    const lastHookIndex = source.lastIndexOf('useState(');
    expect(lastHookIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(lastHookIndex);
  });
});

describe('ChangeIntention.jsx — existing WakeWise choices as large tap cards, Primary/Supporting clearly distinguished', () => {
  it('renders all six shared presets via the shared SelectionChip component in "large" mode, two columns', () => {
    expect(source).toMatch(/\{INTENTION_PRESETS\.map\(\(preset\) => \{/);
    expect(source).toMatch(/<SelectionChip\s*\n\s*key=\{preset\}\s*\n\s*large\s*\n\s*label=\{preset\}\s*\n\s*selected=\{isSelected\}\s*\n\s*roleLabel=\{roleForIndex\(selectedIndex\)\}\s*\n\s*onClick=\{\(\) => applySelection\(preset\)\}/);
    expect(source).toMatch(/className="grid grid-cols-2 gap-3"/);
  });

  it('the currently-selected summary strip labels each item with its role (Primary/Supporting) - the only place a selected CUSTOM intention is shown at all', () => {
    expect(source).toMatch(/\{draftSelection\.length > 0 && \(/);
    expect(source).toMatch(/\{roleForIndex\(idx\)\}/);
  });

  it('the summary chips let any selected item (preset or custom) be removed via the same applySelection toggle path', () => {
    expect(source).toMatch(/onClick=\{\(\) => applySelection\(item\)\}/);
  });
});

describe('ChangeIntention.jsx — optional collapsed "Add your own"; typing is never required', () => {
  it('the custom input is collapsed by default (showCustomInput starts false) behind an explicit "Add your own" affordance', () => {
    expect(source).toMatch(/const \[showCustomInput, setShowCustomInput\] = useState\(false\);/);
    expect(source).toMatch(/onClick=\{\(\) => setShowCustomInput\(true\)\}[\s\S]{0,500}Add your own/);
  });

  it('the six preset cards render unconditionally, regardless of showCustomInput - the screen is always completable without ever opening the custom field', () => {
    const presetGridIndex = source.indexOf('INTENTION_PRESETS.map');
    const customToggleIndex = source.indexOf('setShowCustomInput(true)');
    expect(presetGridIndex).toBeGreaterThan(-1);
    expect(presetGridIndex).toBeLessThan(customToggleIndex);
  });

  // Custom-intention defect fix (found live: with two intentions already
  // selected, "Add your own" silently cleared the typed text and showed
  // no reliably-visible feedback; typing a value matching an existing
  // selection silently deselected it instead of being rejected as a
  // duplicate).
  it('handleAddCustom uses addCustomIntention (ADD-only), never the chip-tap toggleIntention/applySelection path', () => {
    const body = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const \{ intentions: next, status \} = addCustomIntention\(draftSelection, customIntention\);/);
    expect(body).not.toMatch(/applySelection/);
  });

  it('blank is a silent no-op; duplicate and limit-reached each show their own message and are handled as distinct statuses', () => {
    const body = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(status === 'blank'\) return;/);
    expect(body).toMatch(/if \(status === 'duplicate'\) \{\s*\n\s*setLimitMessage\(DUPLICATE_INTENTION_MESSAGE\);/);
    expect(body).toMatch(/if \(status === 'limit-reached'\) \{\s*\n\s*setLimitMessage\(CUSTOM_LIMIT_MESSAGE\);/);
  });

  it('customIntention (the typed text) is cleared ONLY on a genuine add - every rejection (duplicate/limit-reached) preserves it, since the user might want to edit or copy it rather than watch it vanish', () => {
    const body = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    // setCustomIntention('') appears exactly once, in the final success
    // branch (after both early-return rejection branches) - never inside
    // the 'duplicate'/'limit-reached' blocks above it.
    const clears = body.match(/setCustomIntention\(''\);/g) ?? [];
    expect(clears.length).toBe(1);
    const lastStatementIndex = body.lastIndexOf("setCustomIntention('');");
    const duplicateBranchIndex = body.indexOf("status === 'duplicate'");
    const limitBranchIndex = body.indexOf("status === 'limit-reached'");
    expect(lastStatementIndex).toBeGreaterThan(duplicateBranchIndex);
    expect(lastStatementIndex).toBeGreaterThan(limitBranchIndex);
  });

  it('the chip-tap path (applySelection, preset chips and the removable summary chips) is completely untouched - still the original toggle/LIMIT_MESSAGE behaviour', () => {
    const body = source.match(/const applySelection = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const \{ intentions: next, limitReached \} = toggleIntention\(draftSelection, value\);/);
    expect(body).toMatch(/setLimitMessage\(LIMIT_MESSAGE\);\s*\n\s*setTimeout\(\(\) => setLimitMessage\(''\), 2500\);/);
  });

  it('the limit/duplicate message is rendered a second time, directly beside the custom-input row - not only in the top-of-page banner, which can be scrolled out of view or hidden behind the on-screen keyboard once the input has focus (found live)', () => {
    const customInputBlock = source.match(/\{showCustomInput \? \([\s\S]*?\) : \(/)?.[0] ?? '';
    expect(customInputBlock.length).toBeGreaterThan(0);
    expect(customInputBlock).toMatch(/\{limitMessage && \(\s*\n\s*<p className="text-xs text-secondary font-semibold px-1" role="status">\{limitMessage\}<\/p>\s*\n\s*\)\}/);
  });

  it('the original top-of-page banner is still present too (both copies share the same limitMessage state, so they always agree)', () => {
    const matches = source.match(/\{limitMessage && \(/g) ?? [];
    expect(matches.length).toBe(2);
  });
});

describe('ChangeIntention.jsx — custom-intention defect fix: remaining regression items (removal-then-add, ordering, Home display)', () => {
  it('applySelection (the chip-removal path) never touches customIntention/setCustomIntention, so a value preserved by a prior rejection survives a chip removal untouched - once the removal drops the count below the limit, the retained text becomes addable on the very next Add tap (item: remove one selection and add the retained custom value)', () => {
    const body = source.match(/const applySelection = \(value\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/customIntention/);
  });

  it('a custom addition is appended to the existing order (addCustomIntention\'s own pure-function contract: [...current, value] - see intentionSelection.test.js), and Save persists that same draftSelection array, order intact (item: Primary/Supporting ordering preserved through Save)', () => {
    const handleAddCustomBody = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleAddCustomBody).toMatch(/setManualDraft\(next\);/);
    const handleSaveBody = source.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleSaveBody).toMatch(/setIntentions\(draftSelection\);/);
  });

  it('Save writes into the exact same AlarmContext `intentions` that Home.jsx/ActiveIntentionCard render (see activeIntentionCard.test.js\'s own cross-file wiring proof) - so a saved custom intention reaches Home through the same, already-proven path (item: saved custom intention appears on Home)', () => {
    // F1: also destructures setIntentionsConfirmed - this screen only ever
    // represents a deliberate, explicit change, so Save always confirms.
    expect(source).toMatch(/const \{ userId, intentions, setIntentions, setIntentionsConfirmed \} = useAlarm\(\);/);
    const handleSaveBody = source.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleSaveBody).toMatch(/setIntentions\(draftSelection\);\s*\n[\s\S]*?setIntentionsConfirmed\(true\);\s*\n\s*await saveIntentionsToCloud\(userId, draftSelection\);/);
  });
});

describe('ChangeIntention.jsx — Save/Cancel/Back/Close all return Home; only Save persists', () => {
  it('Save navigates home only after the context update, the F1 confirm flag, and the cloud save have all completed', () => {
    const body = source.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIntentions\(draftSelection\);\s*\n[\s\S]*?setIntentionsConfirmed\(true\);\s*\n\s*await saveIntentionsToCloud\(userId, draftSelection\);\s*\n\s*setIsSaving\(false\);\s*\n\s*navigate\('\/'\);/);
  });

  it('Save is disabled while empty or already saving, and shows a "Saving..." busy label', () => {
    expect(source).toMatch(/disabled=\{isSaving \|\| draftSelection\.length === 0\}/);
    expect(source).toMatch(/\{isSaving \? 'Saving\.\.\.' : 'Save'\}/);
  });

  it('Cancel and Close both simply navigate home, discarding the local draft for free (nothing was ever committed to AlarmContext)', () => {
    expect(source).toMatch(/const handleClose = \(\) => navigate\('\/'\);/);
    const cancelButton = source.match(/onClick=\{handleClose\}[\s\S]{0,300}Cancel/);
    expect(cancelButton).not.toBeNull();
  });

  it('JourneyHeader\'s own Back control (BackButton, fallback="/") covers the "missing navigation history falls back to Home" requirement, and Close is wired to the same handler', () => {
    expect(source).toMatch(/<JourneyHeader showBackButton backFallback="\/" onClose=\{handleClose\} \/>/);
  });
});

describe('ChangeIntention.jsx — mobile frame, safe-area, touch targets', () => {
  it('bounded max-w-md desktop frame with the Phase B clamp()-based safe-area margin, matching AnytimeReset.jsx/Meditate.jsx', () => {
    expect(source).toMatch(/max-w-md w-full mx-auto/);
    expect(source).toMatch(/paddingLeft: 'calc\(clamp\(1rem, 4vw, 1\.25rem\) \+ env\(safe-area-inset-left\)\)'/);
  });

  it('every interactive control on this screen carries an explicit min-h-[44px]', () => {
    // Matches up to the newline-then-`>`/`/>` that actually closes the JSX
    // opening tag - a naive "first `>` anywhere" would wrongly stop inside
    // an inline arrow function's own `=>`.
    const buttonBlocks = source.match(/<(button|input)[\s\S]*?\n\s*(\/>|>)/g) ?? [];
    expect(buttonBlocks.length).toBe(6);
    for (const block of buttonBlocks) {
      expect(block).toMatch(/min-h-\[44px\]/);
    }
  });

  it('no emoji literal appears anywhere in this file (typographic punctuation in prose comments is not an emoji)', () => {
    const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, '');
    // eslint-disable-next-line no-control-regex
    const hasNonAscii = /[^\x00-\x7F]/.test(withoutComments.replace(/[’…—–“”‘]/g, ''));
    expect(hasNonAscii).toBe(false);
  });
});
