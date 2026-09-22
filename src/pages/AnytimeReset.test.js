// Anytime Reset — component regression guard (Build 15). Source-level
// checks, matching this codebase's established pattern for pages with no
// DOM/component rendering available in this repo's Vitest (see
// Meditate.jsx's own sibling and Auth.mobileSafeArea.test.js's note).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AnytimeReset.jsx');

describe('AnytimeReset.jsx — single-select, no typing, no custom field', () => {
  it('imports ANYTIME_RESET_NEEDS/ANYTIME_RESET_DURATIONS, never INTENTION_PRESETS or ACTIVITY_PRESETS', () => {
    expect(source).toMatch(/ANYTIME_RESET_DURATIONS, ANYTIME_RESET_NEEDS/);
    expect(source).not.toMatch(/INTENTION_PRESETS|ACTIVITY_PRESETS/);
  });

  it('need selection sets exactly one needId (handleSelectNeed), never toggles/appends to an array', () => {
    const body = source.match(/const handleSelectNeed = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setNeedId\(id\)/);
    expect(body).not.toMatch(/toggleIntention|push|concat|\.\.\.need/);
  });

  it('no <input> element anywhere in the file - a genuinely tap-only flow', () => {
    expect(source).not.toMatch(/<input\b/);
  });

  it('no "Something else" chip and no custom-text state', () => {
    expect(source).not.toMatch(/Something else/i);
    expect(source).not.toMatch(/customIntention|customActivity|customValue/);
  });

  it('never imports saveIntentionsToCloud, and never calls setIntentions - no code path can write user_intentions', () => {
    expect(source).not.toMatch(/import \{[^}]*saveIntentionsToCloud/);
    expect(source).not.toMatch(/setIntentions\(/);
  });

  it('never imports supabase directly and never calls localStorage.setItem/getItem (no persistence beyond React state)', () => {
    expect(source).not.toMatch(/from ['"]\.\.\/lib\/supabaseClient['"]/);
    expect(source).not.toMatch(/localStorage\.(setItem|getItem|removeItem)/);
  });
});

describe('AnytimeReset.jsx — step order and copy', () => {
  it('need selection is step 1 (initial state), duration is step 2', () => {
    expect(source).toMatch(/useState\(\(\) => \(restoredIsValid \? 'recommend' : 'need'\)\)/);
  });

  it('the approved intro heading and supporting copy are present verbatim', () => {
    expect(source).toMatch(/Take an Anytime Reset/);
    expect(source).toMatch(/Choose what you need and how much time you have\./);
  });

  it('the approved step headings are present verbatim', () => {
    expect(source).toMatch(/What do you need right now\?/);
    expect(source).toMatch(/How much time do you have\?/);
  });
});

describe('AnytimeReset.jsx — required navigation controls and Back semantics', () => {
  it('handleStepBack: recommend -> duration -> need (never need -> anywhere, that is BackButton\'s job)', () => {
    const body = source.match(/const handleStepBack = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(step === 'duration'\) setStep\('need'\);/);
    expect(body).toMatch(/else if \(step === 'recommend'\) setStep\('duration'\);/);
  });

  it('step 1 (need) uses the shared BackButton with fallback="/" - Home is the real exit from step 1', () => {
    expect(source).toMatch(/step === 'need' \? \(\s*<BackButton fallback="\/" \/>/);
  });

  it('a dedicated Close control navigates to Home directly', () => {
    const body = source.match(/const handleClose = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/navigate\('\/'\)/);
    expect(source).toMatch(/aria-label="Close"[\s\S]{0,60}onClick=\{handleClose\}|onClick=\{handleClose\}[\s\S]{0,120}aria-label="Close"/);
  });

  it('Change need and Change time controls exist and route to the correct steps', () => {
    expect(source).toMatch(/const handleChangeNeed = \(\) => setStep\('need'\);/);
    expect(source).toMatch(/const handleChangeTime = \(\) => setStep\('duration'\);/);
  });

  it('Choose another only renders when more than one item is available, and advances without ever resetting need/duration', () => {
    expect(source).toMatch(/items\.length > 1 &&/);
    const body = source.match(/const handleChooseAnother = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/setOptionIndex\(\(i\) => i \+ 1\)/);
    expect(body).not.toMatch(/setNeedId|setDurationId/);
  });

  it('closing the video (handleVideoClose) only clears openVideoId - it stays on the recommendation step, never exits the journey', () => {
    const body = source.match(/const handleVideoClose = \(\) => [\s\S]*?;/)?.[0] ?? '';
    expect(body).toMatch(/setOpenVideoId\(null\)/);
    expect(body).not.toMatch(/navigate\(/);
  });
});

describe('AnytimeReset.jsx — 44x44 touch targets', () => {
  it('need chips carry min-h-[44px]', () => {
    const body = source.match(/aria-label="What do you need right now\?"[\s\S]*?<\/div>\s*<\/div>\s*\)\}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
  });

  it('duration options carry min-h-[44px]', () => {
    const body = source.match(/aria-label="How much time do you have\?"[\s\S]*?<\/div>\s*<\/div>\s*\)\}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
  });

  it('Change need / Change time controls carry min-h-[44px]', () => {
    const body = source.match(/Change need[\s\S]*?Change time[\s\S]{0,80}/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
  });

  it('the step-back and Close controls are explicit 44x44 (w-11 h-11)', () => {
    const backBtn = source.match(/onClick=\{handleStepBack\}[\s\S]{0,300}/)?.[0] ?? '';
    expect(backBtn).toMatch(/w-11 h-11/);
    const closeBtn = source.match(/onClick=\{handleClose\}[\s\S]{0,300}/)?.[0] ?? '';
    expect(closeBtn).toMatch(/w-11 h-11/);
  });
});

describe('AnytimeReset.jsx — selected state visible beyond colour alone', () => {
  it('need chips use aria-pressed reflecting selection', () => {
    expect(source).toMatch(/aria-pressed=\{needId === need\.id\}/);
  });

  it('duration options use aria-pressed reflecting selection', () => {
    expect(source).toMatch(/aria-pressed=\{durationId === duration\.id\}/);
  });

  it('selected chips/options carry a border-primary class, not color/background alone', () => {
    expect(source).toMatch(/isSelected[\s\S]*?border-primary|needId === need\.id[\s\S]{0,40}\n[\s\S]{0,120}border-primary/);
    expect(source).toMatch(/durationId === duration\.id \? 'border-primary/);
  });
});

describe('AnytimeReset.jsx — guest / post-sign-in restore, allowlisted and stripped', () => {
  it('restoredIsValid checks the tapped need/duration ids against the real approved lists, never trusts the URL blindly', () => {
    const body = source.match(/const restoredIsValid =[\s\S]*?ANYTIME_RESET_DURATIONS\.some\(\(d\) => d\.id === restoredDuration\);/)?.[0] ?? '';
    expect(body).toMatch(/ANYTIME_RESET_NEEDS\.some\(\(n\) => n\.id === restoredNeed\)/);
    expect(body).toMatch(/ANYTIME_RESET_DURATIONS\.some\(\(d\) => d\.id === restoredDuration\)/);
  });

  it('openId is only ever trusted for a real, currently-active catalogue entry, and never for a guest', () => {
    expect(source).toMatch(/openId && !isGuest && getCatalogEntryById\(openId\)/);
  });

  it('restore params (need/duration/openId) are stripped immediately after being read, so they can never re-trigger on reload/back-forward', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*const hasOpenId[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/next\.delete\('openId'\);/);
    expect(body).toMatch(/next\.delete\('need'\);/);
    expect(body).toMatch(/next\.delete\('duration'\);/);
    expect(body).toMatch(/replace: true/);
  });

  it('signed-in-only Begin - a guest tapping Start sees the sign-in prompt, never an immediate video open', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isGuest\) \{\s*\n\s*setSignInPromptOpen\(true\);\s*\n\s*return;\s*\n\s*\}/);
  });

  it('reuses the exact same setPendingContent + SignInPromptDialog mechanism as Meditate.jsx (no second guest-auth path invented)', () => {
    expect(source).toMatch(/import \{ setPendingContent \} from '\.\.\/lib\/pendingContent';/);
    expect(source).toMatch(/import \{ SignInPromptDialog \} from '\.\.\/components\/SignInPromptDialog';/);
  });
});

describe('AnytimeReset.jsx — BetaVideoModal integration, unchanged component', () => {
  it('reuses BetaVideoModal directly - never a second/alternate player', () => {
    expect(source).toMatch(/import \{ BetaVideoModal \} from '\.\.\/components\/BetaVideoModal';/);
    expect(source).toMatch(/<BetaVideoModal entry=\{openVideo\} onClose=\{handleVideoClose\} \/>/);
  });
});

describe('AnytimeReset.jsx — actual duration always shown, closest-match always labelled', () => {
  it('renders the item\'s own real duration via formatDuration, never a hardcoded label', () => {
    expect(source).toMatch(/\{formatDuration\(current\.anytimeReset\.durationSeconds\)\}/);
  });

  it('shows "Closest match" whenever matchQuality is not exact', () => {
    expect(source).toMatch(/recommendation\.matchQuality === 'closest'[\s\S]{0,200}Closest match/);
  });
});
