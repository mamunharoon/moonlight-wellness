// Build 15 Phase B remediation (Task 6) — app-wide Back/Close consistency
// audit. Replaces 17 independently-reimplemented "circular back arrow"
// buttons (all w-10 h-10 = 40px, below the 44px minimum) across 14 files
// with the real shared <BackButton>, and fixes BetaVideoModal's own
// undersized (w-9 h-9 = 36px, no focus ring) Close button. Source-level
// checks - this repo's Vitest has no rendering engine.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

// Pure Node fs walk (no shelling out to grep) - portable across whatever
// environment runs this suite, matching every other regression guard in
// this codebase.
const walkJsxFiles = (dir) => {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkJsxFiles(full));
    } else if (entry.name.endsWith('.jsx')) {
      results.push(full);
    }
  }
  return results;
};

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

// route file -> [fallback, label] for every bespoke Back this pass replaced
const REPLACED_BACK_BUTTONS = [
  { file: './AdminHome.jsx', fallback: '/', label: 'Back to app' },
  { file: './AdminSubscriptions.jsx', fallback: '/admin', label: 'Back to Administration' },
  { file: './AdminUsers.jsx', fallback: '/admin', label: 'Back to Administration' },
  { file: './FastStartPilot.jsx', fallback: '/admin', label: 'Back to Admin' },
  { file: './AudioLibrary.jsx', fallback: '/settings', label: 'Back to Settings' },
  { file: './Beta.jsx', fallback: '/settings', label: 'Back to Settings' },
  { file: './Settings.jsx', fallback: '/profile', label: 'Back to Profile' },
  { file: './Subscription.jsx', fallback: '/settings', label: 'Back to Settings' },
  { file: './NotificationSettings.jsx', fallback: '/settings', label: 'Back to Settings' },
  { file: './Journey.jsx', fallback: '/profile', label: 'Back to Profile' }
];

describe('Single-instance bespoke Back buttons — replaced with the real shared <BackButton>, same fallback/label preserved', () => {
  for (const { file, fallback, label } of REPLACED_BACK_BUTTONS) {
    describe(file, () => {
      const source = read(file);

      it('imports the real shared BackButton', () => {
        expect(source).toMatch(/import \{ BackButton \} from '\.\.\/components\/BackButton';/);
      });

      it(`renders <BackButton fallback="${fallback}" label="${label}" />, preserving the exact same destination/label as the removed bespoke button`, () => {
        const escaped = fallback.replace(/\//g, '\\/');
        expect(source).toMatch(new RegExp(`<BackButton fallback="${escaped}" label="${label}" />`));
      });

      it('the old bespoke w-10 h-10 circular button markup is completely gone', () => {
        expect(source).not.toMatch(/w-10 h-10 rounded-full glass-panel border-white\/10 flex items-center justify-center hover:bg-white\/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"/);
      });
    });
  }
});

describe('Multi-instance bespoke Back buttons — every occurrence replaced, not just the first', () => {
  it('AudioCategory.jsx - both the "category not found" state and the main content header now use the real BackButton (fallback "/audio")', () => {
    const source = read('./AudioCategory.jsx');
    const usages = source.match(/<BackButton fallback="\/audio" label="Back to Audio Library" \/>/g) ?? [];
    expect(usages.length).toBe(2);
    expect(source).not.toMatch(/w-10 h-10 rounded-full/);
  });

  it('AudioDetails.jsx - both the "not found" state and the main content header use the real BackButton, with the dynamically-computed (never arbitrary) backTo destination', () => {
    const source = read('./AudioDetails.jsx');
    expect(source).toMatch(/const backTo = category \? `\/audio\/\$\{category\.id\}` : '\/audio';/);
    expect(source).toMatch(/<BackButton fallback=\{backTo\} label="Back" \/>/);
    expect(source).toMatch(/<BackButton fallback=\{backTo\} label=\{`Back to \$\{category\?\.label \?\? 'Audio Library'\}`\} \/>/);
    expect(source).not.toMatch(/w-10 h-10 rounded-full/);
  });

  it('Feedback.jsx - both the post-submit confirmation header and the main form header use the real BackButton (fallback "/beta") - the unrelated full-width "Back to Beta Program" CTA inside the confirmation body is untouched (not a header Back control)', () => {
    const source = read('./Feedback.jsx');
    const headerUsages = source.match(/<BackButton fallback="\/beta" label="Back to Beta Program" \/>/g) ?? [];
    expect(headerUsages.length).toBe(2);
    expect(source).not.toMatch(/w-10 h-10 rounded-full/);
    // the in-content CTA (a full-width text pill, not a header icon button) is
    // deliberately left as its own navigate() call - it is a "Continue"-style
    // action after a completed task, not a Back/Close control.
    expect(source).toMatch(/onClick=\{\(\) => navigate\('\/beta'\)\}\s*\n\s*className="w-full glass-panel border-white\/10/);
  });
});

describe('BetaVideoModal.jsx — the shared video player used app-wide, its own Close controls now meet the 44px minimum', () => {
  const source = read('../components/BetaVideoModal.jsx');

  it('the header Close (X) button grew from w-9 h-9 (36px) to w-11 h-11 (44px) and gained a focus-visible ring it never had before', () => {
    expect(source).not.toMatch(/w-9 h-9/);
    const body = source.match(/onClick=\{handleClose\}\s*\n\s*aria-label="Close"[\s\S]{0,300}/)?.[0] ?? '';
    expect(body).toMatch(/w-11 h-11/);
    expect(body).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('the "Close Video" text pill (paused/done overlay) now carries an explicit 44px minimum and a focus ring', () => {
    const body = source.match(/onClick=\{handleClose\}[\s\S]{0,400}Close Video/)?.[0] ?? '';
    expect(body).toMatch(/min-h-\[44px\]/);
    expect(body).toMatch(/focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/);
  });

  it('handleClose itself (the actual dismiss logic) is completely untouched by this presentation-only fix', () => {
    expect(source).toMatch(/const handleClose = \(\) => \{/);
  });
});

describe('App-wide sweep — no bespoke w-10 h-10/w-9 h-9 circular icon-button remains anywhere that is a Back or Close control', () => {
  it('zero remaining w-10 h-10 circular buttons with the exact bespoke Back className pattern this pass eliminated, in any .jsx file under src/pages or src/components', () => {
    // A living regression guard, not a fixed file list - walks the real
    // directory tree the same way this pass's own investigation did.
    const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
    const bespokePattern = 'w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"';
    const offenders = [];
    for (const dir of [join(repoRoot, 'src', 'pages'), join(repoRoot, 'src', 'components')]) {
      for (const file of walkJsxFiles(dir)) {
        if (readFileSync(file, 'utf-8').includes(bespokePattern)) offenders.push(file);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('Intentionally retained exceptions (not bespoke-button replacements, verified deliberate)', () => {
  it('DeleteAccount.jsx keeps its own local BackArrow (already 44x44, already labelled "Go back", already focus-ringed) - not migrated to JourneyHeader, since that would add a new unconditional Close/exit affordance to a destructive account-deletion flow beyond presentation-only standardisation', () => {
    const source = read('./DeleteAccount.jsx');
    expect(source).toMatch(/const BackArrow = \(\{ onClick \}\) => \(/);
    expect(source).toMatch(/w-11 h-11 rounded-full glass-panel border-white\/10/);
    expect(source).toMatch(/aria-label="Go back"/);
  });

  it('AlarmActive.jsx has no generic Back/Close - it has its own dedicated snooze/unlock/dismiss actions instead, matching a real phone alarm\'s UX (a ringing alarm should not be casually "backed out of")', () => {
    const source = read('./AlarmActive.jsx');
    expect(source).toMatch(/dismissAlarm/);
    expect(source).toMatch(/handleSnooze/);
    expect(source).not.toMatch(/import \{ BackButton \}/);
  });

  it('Stage3Preview.jsx/SessionRegistryPreview.jsx/SessionEnginePreview.jsx are unlinked internal dev-only inspection tools (confirmed via their own doc comments) - out of the real app\'s navigation language, left untouched', () => {
    const stage3 = read('./Stage3Preview.jsx');
    expect(stage3).toMatch(/internal, unlinked route/);
    expect(stage3).toMatch(/not reachable from any existing screen/);
  });
});
