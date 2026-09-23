// Build 15 Phase B remediation — ChangeIntention.jsx (the dedicated
// /change-intention screen) regression guard. Source-level checks - this
// repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./ChangeIntention.jsx', import.meta.url)), 'utf-8');

describe('ChangeIntention.jsx — reuses existing business logic, never a parallel implementation', () => {
  it('imports the exact same selection/persistence helpers IntentionSetup.jsx uses', () => {
    expect(source).toMatch(/import \{ toggleIntention, roleForIndex, LIMIT_MESSAGE \} from '\.\.\/lib\/intentionSelection';/);
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

  it('existing custom-intention validation is preserved - trims, rejects empty, reuses the shared toggle/limit path', () => {
    const body = source.match(/const handleAddCustom = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const trimmed = customIntention\.trim\(\);/);
    expect(body).toMatch(/if \(!trimmed\) return;/);
    expect(body).toMatch(/applySelection\(trimmed\);/);
  });

  it('the limit message uses the exact shared LIMIT_MESSAGE constant and self-clears', () => {
    expect(source).toMatch(/setLimitMessage\(LIMIT_MESSAGE\);\s*\n\s*setTimeout\(\(\) => setLimitMessage\(''\), 2500\);/);
  });
});

describe('ChangeIntention.jsx — Save/Cancel/Back/Close all return Home; only Save persists', () => {
  it('Save navigates home only after both the context update and the cloud save have completed', () => {
    const body = source.match(/const handleSave = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setIntentions\(draftSelection\);\s*\n\s*await saveIntentionsToCloud\(userId, draftSelection\);\s*\n\s*setIsSaving\(false\);\s*\n\s*navigate\('\/'\);/);
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
