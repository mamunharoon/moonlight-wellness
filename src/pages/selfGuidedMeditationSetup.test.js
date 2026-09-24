// Source-level regression guard for SelfGuidedMeditation.jsx's JSX-bound
// structure (routing, defaults, control wiring) - this repo's Vitest has no
// rendering engine (environment: 'node', see vite.config.js), matching
// every comparable existing regression guard (libraryHomeReturnContext.
// test.js, meditateBackNavigation.test.js, Home.quickActionTiles.test.js).
// The actual timer/audio/prompt BEHAVIOUR this page wires together is
// covered by real-execution tests in src/lib/meditationSessionController.
// test.js, meditationSession.test.js and meditationStyles.test.js - this
// file only checks that the page uses those real modules correctly and
// exposes the required controls.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./SelfGuidedMeditation.jsx');
const appSource = read('../App.jsx');

describe('App.jsx — routes are registered outside <Layout>, same placement as /meditate', () => {
  it('registers both self-guided-meditation and self-guided-meditation-complete', () => {
    expect(appSource).toMatch(/<Route path="self-guided-meditation" element=\{withFallback\(<SelfGuidedMeditation \/>\)\} \/>/);
    expect(appSource).toMatch(/<Route path="self-guided-meditation-complete" element=\{withFallback\(<SelfGuidedMeditationComplete \/>\)\} \/>/);
  });
});

describe('SelfGuidedMeditation.jsx — no autoplay before Begin', () => {
  it('createMeditationSessionController is only ever constructed inside handleBegin, never at module/mount time', () => {
    const outsideHandleBegin = source.replace(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/, '');
    expect(outsideHandleBegin).not.toMatch(/createMeditationSessionController\(/);
    const handleBeginBody = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(handleBeginBody).toMatch(/createMeditationSessionController\(/);
  });

  it('no effect calls begin()/start() on mount - the controller is only ever begun from handleBegin', () => {
    expect(source).not.toMatch(/useEffect\(\(\) => \{[\s\S]{0,200}\.begin\(\)/);
  });
});

describe('SelfGuidedMeditation.jsx — repeated Begin taps cannot create duplicates', () => {
  it('handleBegin is guarded by a ref, checked and set before any controller work happens', () => {
    const body = source.match(/const handleBegin = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(beganRef\.current\) return;/);
    expect(body).toMatch(/beganRef\.current = true;/);
  });
});

describe('SelfGuidedMeditation.jsx — cleanup on unmount/route change', () => {
  it('a mount effect with an empty dependency array returns a cleanup that destroys the controller and clears the interval', () => {
    expect(source).toMatch(/useEffect\(\(\) => \(\) => cleanupSession\(\), \[\]\);/);
    const cleanupBody = source.match(/const cleanupSession = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(cleanupBody).toMatch(/stopInterval\(\);/);
    expect(cleanupBody).toMatch(/controllerRef\.current\?\.destroy\(\);/);
  });
});

describe('SelfGuidedMeditation.jsx — five styles, three durations, correct defaults', () => {
  it('imports the real MEDITATION_STYLES/MEDITATION_DURATIONS data modules rather than inlining a second copy', () => {
    expect(source).toMatch(/from '\.\.\/lib\/meditationStyles';/);
    expect(source).toMatch(/from '\.\.\/lib\/meditationDurations';/);
  });

  it('defaults styleId to Quiet Meditation and durationId to 5 minutes when there is no Meditate Again/Choose Another preset', () => {
    expect(source).toMatch(/DEFAULT_MEDITATION_STYLE_ID/);
    expect(source).toMatch(/DEFAULT_MEDITATION_DURATION_ID/);
  });

  it('background music defaults On for everyone, guest included - IM01 is server-allowlisted for guest access, so there is no guest-specific default any more', () => {
    expect(source).toMatch(/useState\(\(\) => preset\?\.musicOn \?\? true\);/);
  });
});

describe('SelfGuidedMeditation.jsx — allowlisted entry context, never a raw returnTo', () => {
  it('resolves `from` through the allowlisted resolver, captured once via a lazy initializer', () => {
    expect(source).toMatch(/const \[context\] = useState\(\(\) => resolveSelfGuidedMeditationContext\(searchParams\.get\('from'\)\)\);/);
  });
});

describe('SelfGuidedMeditation.jsx — Explore Guided Meditations opens the real Library category', () => {
  it('navigates to the real Library Meditation category with the meditation-setup context marker', () => {
    expect(source).toMatch(/navigate\('\/library\?category=meditation&from=meditation-setup'\);/);
  });

  it('never invents guided content - no hardcoded video/exercise id list is added here', () => {
    expect(source).not.toMatch(/getCatalogEntryById|BETA_VIDEO_MANIFEST/);
  });
});

describe('SelfGuidedMeditation.jsx — Back/Close controls on both setup and active screens', () => {
  it('setup renders JourneyHeader with a real Back button (step 1 shape) falling back to the resolved context', () => {
    expect(source).toMatch(/<JourneyHeader showBackButton backFallback=\{context\.fallback\} onClose=\{\(\) => navigate\(context\.fallback\)\}\s*\/>/);
  });

  it('the active screen renders JourneyHeader with Back/Close both routed through the leave-confirmation gate, never a silent direct navigate', () => {
    expect(source).toMatch(/<JourneyHeader showBackButton=\{false\} onStepBack=\{handleRequestLeave\} onClose=\{handleRequestLeave\}\s*\/>/);
  });
});

describe('SelfGuidedMeditation.jsx — leave-confirmation dialog, exact approved copy', () => {
  it('title, message and both action labels match exactly', () => {
    expect(source).toMatch(/title="Leave meditation\?"/);
    expect(source).toMatch(/message="Your current meditation will end\."/);
    expect(source).toMatch(/confirmLabel="End and Leave"/);
    expect(source).toMatch(/cancelLabel="Continue Meditation"/);
  });

  it('uses the established mild-destructive severity, never the strong/red destructive one - "should not appear alarming"', () => {
    const block = source.match(/<ConfirmDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(block).toMatch(/mildDestructive/);
    expect(block).not.toMatch(/\bdestructive\b(?!\s*=\s*\{false\})/);
  });
});

describe('SelfGuidedMeditation.jsx — End Session uses quiet caution styling, not alarming bright red', () => {
  it('the End Session button reuses the existing mild-destructive colour token (#b3555f, same as ConfirmDialog.jsx), never Tailwind red/bg-red', () => {
    const block = source.match(/aria-label="End meditation session"[\s\S]{0,20}className="([^"]+)"/)?.[1] ?? '';
    expect(block).toMatch(/#b3555f/);
    expect(block).not.toMatch(/bg-red/);
  });
});

describe('SelfGuidedMeditation.jsx — accessible radios for style and duration', () => {
  it('both groups use role="radiogroup" with a real native <input type="radio">', () => {
    expect(source).toMatch(/role="radiogroup" aria-label="Meditation style"/);
    expect(source).toMatch(/role="radiogroup" aria-label="Duration"/);
    expect(source).toMatch(/<input type="radio" name=\{groupName\}/);
  });

  it('styles render in the approved order via a single map over MEDITATION_STYLES (never a hand-duplicated list)', () => {
    expect(source).toMatch(/\{MEDITATION_STYLES\.map\(\(s\) => \(/);
  });

  it('durations render via a single map over MEDITATION_DURATIONS, with the recommended sublabel driven by data, not hardcoded per row', () => {
    expect(source).toMatch(/\{MEDITATION_DURATIONS\.map\(\(d\) => \(/);
    expect(source).toMatch(/sublabel=\{d\.recommended \? 'Recommended' : null\}/);
  });
});

describe('SelfGuidedMeditation.jsx — touch targets and no fixed-width overflow at 320px', () => {
  it('every interactive row/button/toggle carries the 44px minimum', () => {
    const minHeightMatches = source.match(/min-h-\[44px\]/g) ?? [];
    expect(minHeightMatches.length).toBeGreaterThanOrEqual(5);
  });

  it('no element uses a fixed pixel width wider than a 320px viewport (w-[###px]) - only relative/max-w utilities', () => {
    expect(source).not.toMatch(/w-\[\d{3,}px\]/);
  });

  it('safe-area insets are respected the same way Meditate.jsx already establishes', () => {
    expect(source).toMatch(/env\(safe-area-inset-left\)/);
    expect(source).toMatch(/env\(safe-area-inset-right\)/);
  });
});

describe('SelfGuidedMeditation.jsx — reduced motion', () => {
  it('reads both the manual override and the OS-level media query, matching this app\'s one established pattern', () => {
    expect(source).toMatch(/getReducedMotionPreference\(\)/);
    expect(source).toMatch(/prefers-reduced-motion: reduce/);
  });

  it('passes reducedMotion through to the progress ring rather than animating unconditionally', () => {
    expect(source).toMatch(/reducedMotion=\{reducedMotion\}/);
  });
});

describe('SelfGuidedMeditation.jsx — this feature never touches Morning/Evening/Meditate completion state', () => {
  it('never imports dailyCompletion.js or the Session Engine', () => {
    expect(source).not.toMatch(/from '\.\.\/lib\/dailyCompletion'/);
    expect(source).not.toMatch(/from '\.\.\/context\/SessionContext'/);
    expect(source).not.toMatch(/useSession/);
  });
});
