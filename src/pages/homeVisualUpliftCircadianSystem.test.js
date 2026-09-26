// Home Visual Uplift (WakeWise DEV) — consolidated regression coverage for
// treating Morning/Anytime/Evening as one coordinated Home-page system,
// per the delivery brief's two required-coverage lists. Source-level
// checks - this repo's Vitest has no rendering engine (environment:
// 'node' - see vite.config.js), matching every other regression guard in
// this codebase. Coverage that already existed in dedicated files
// (homeMorningUplift.test.js, homeEveningCardUplift.test.js,
// homeAnytimeUplift.test.js, Home.touchTargets.test.js, Home.greeting.test.js,
// activeIntentionCard.test.js, Home.todaysRhythm.test.js) is not repeated
// here - this file covers what is genuinely new in this pass.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const homeSource = read('./Home.jsx');
const activeIntentionCardSource = read('../components/ActiveIntentionCard.jsx');
const indexCssSource = read('../index.css');
const tailwindConfigSource = readFileSync(
  fileURLToPath(new URL('../../tailwind.config.js', import.meta.url)),
  'utf-8'
);

describe('Home Visual Uplift — Home-scoped background is genuinely additive and isolated', () => {
  it('a new --color-home-background token exists, separate from --color-background/--color-surface (never a redefinition of the shared token)', () => {
    expect(indexCssSource).toMatch(/--color-home-background: #0a0f1d;/);
    // The shared token every other page reads is untouched.
    expect(indexCssSource).toMatch(/--color-background: #0b1326;/);
  });

  it('tailwind.config.js adds a second, distinct "home-background" key - "background" itself is untouched', () => {
    expect(tailwindConfigSource).toMatch(/"home-background": "var\(--color-home-background\)"/);
    expect(tailwindConfigSource).toMatch(/"background": "var\(--color-background\)"/);
  });

  it('Home.jsx is the only file in src/pages or src/components that references the home-background token', () => {
    const pagesDir = fileURLToPath(new URL('.', import.meta.url));
    const componentsDir = join(pagesDir, '..', 'components');
    const collect = (dir) => {
      let files = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) files = files.concat(collect(full));
        else if (entry.isFile() && (entry.name.endsWith('.jsx') || entry.name.endsWith('.js'))) files.push(full);
      }
      return files;
    };
    const allFiles = [...collect(pagesDir), ...collect(componentsDir)];
    const filesReferencingToken = allFiles.filter((file) => {
      if (file.endsWith('Home.jsx')) return false;
      if (file.includes('homeVisualUpliftCircadianSystem.test.js')) return false;
      const content = readFileSync(file, 'utf-8');
      return content.includes('home-background');
    });
    expect(filesReferencingToken).toEqual([]);
  });

  it('Home.jsx applies it via a Home-scoped root wrapper (-m-4 p-4 min-h-full bg-home-background), never by touching Layout.jsx or the shared bg-background', () => {
    expect(homeSource).toMatch(/className="relative -m-4 p-4 min-h-full bg-home-background space-y-8 animate-in fade-in duration-500"/);
  });
});

describe('Home Visual Uplift — Active Intention: mint label + restrained, period-aware surface depth', () => {
  it('the "Active Intention" label reuses the existing tertiary (mint) token, not a new colour - the separate, unrelated PRIMARY/SUPPORTING role tags (neutral text-secondary, matching Stitch\'s own neutral slate treatment for those) are untouched (F1: the label text itself now also branches on confirmed, but the mint token styling is unconditional either way)', () => {
    expect(activeIntentionCardSource).toMatch(/<p className="text-xs font-semibold uppercase tracking-wider text-tertiary">\{confirmed \? label : 'Suggested Intention'\}<\/p>/);
    expect(activeIntentionCardSource).toMatch(/text-\[9px\] not-italic font-bold uppercase tracking-wider text-secondary shrink-0/);
  });

  it('the Active Intention wrapper (Home.jsx) gets the SAME period border-colour family as the main card, at a lower, restrained opacity, and no glow - never competing with the primary card', () => {
    const wrapperMatch = homeSource.match(/className=\{`glass-panel p-5 rounded-3xl shadow-sm \$\{[\s\S]*?\}`\}/)?.[0] ?? '';
    expect(wrapperMatch.length).toBeGreaterThan(0);
    expect(wrapperMatch).toMatch(/border-morning-accent-tint\/\[12%\]/);
    expect(wrapperMatch).toMatch(/border-evening-accent-tint\/\[12%\]/);
    expect(wrapperMatch).toMatch(/border-tertiary-tint\/20/);
    // Restrained: no shadow-*-glow class anywhere in this wrapper.
    expect(wrapperMatch).not.toMatch(/shadow-\w+-glow/);
  });

  it('Change intention and the underlying intentions data/actions are completely unchanged', () => {
    expect(activeIntentionCardSource).toMatch(/onClick=\{handleChangeTap\}/);
    expect(activeIntentionCardSource).toMatch(/navigate\('\/change-intention'\)/);
    expect(homeSource).toMatch(/intentions=\{displayIntentions\}/);
    expect(homeSource).toMatch(/onRequireSignIn=\{promptRoutineSignIn\}/);
  });
});

describe('Home Visual Uplift — greeting: reduced size, personalisation and long-name safety unchanged', () => {
  it('the greeting element carries break-words (new long-name overflow guard) alongside the existing getGreeting-driven text', () => {
    expect(homeSource).toMatch(/<h2 className="text-3xl font-extrabold text-on-surface tracking-tight break-words">\{greetingText\}<\/h2>/);
  });

  it('greeting personalisation logic itself (getGreeting, profile/user precedence) is untouched by this pass, now with the local-day rotation dateKey', () => {
    expect(homeSource).toMatch(/getGreeting\('morning', \{ profile, user, dateKey: today \}\)/);
    expect(homeSource).toMatch(/getGreeting\('afternoon', \{ profile, user, dateKey: today \}\)/);
    expect(homeSource).toMatch(/getGreeting\('evening', \{ profile, user, dateKey: today \}\)/);
  });

  it('no fixed-width class is introduced on the greeting or its wrapper (would break long-name safety)', () => {
    const greetingBlock = homeSource.match(/<div className="space-y-2">\s*\{greetingText[\s\S]*?<\/div>\s*<\/div>/)?.[0] ?? '';
    expect(greetingBlock.length).toBeGreaterThan(0);
    expect(greetingBlock).not.toMatch(/\bw-\[\d/);
    expect(greetingBlock).not.toMatch(/\bwhitespace-nowrap\b/);
  });
});

describe('Home Visual Uplift — compaction reaches every card, not only Morning/Evening', () => {
  it('every journey/Anytime/Active-Intention card shell uses the compact p-5 (never the old p-6)', () => {
    expect(homeSource).not.toMatch(/glass-panel p-6 rounded-3xl/);
    const compactShells = homeSource.match(/glass-panel p-5 rounded-3xl/g) ?? [];
    // 3 morning (not-started/in-progress/completed) + 1 morning stale-choice
    // + 4 evening (stale-choice/not-started/in-progress/completed) + 1
    // anytime + 1 Active Intention wrapper = 10.
    expect(compactShells.length).toBe(10);
  });

  it('every primary CTA uses the compact py-3.5 (never the old py-4) while keeping an explicit min-h-[44px] wherever it was already present', () => {
    expect(homeSource).not.toMatch(/py-4 rounded-xl/);
    expect(homeSource).toMatch(/min-h-\[44px\] py-3\.5 rounded-xl/);
  });
});

describe('Home Visual Uplift — Anytime: no invented completion state, no Stitch-invented quick actions', () => {
  it('the Anytime block still has exactly one, single "available anytime" render path - no cardState branching was added', () => {
    const anytimeStart = homeSource.indexOf("{activePeriod === 'anytime' && (");
    const anytimeEnd = homeSource.indexOf('{/* 6. Active intentions', anytimeStart);
    const anytimeBlock = anytimeStart > -1 && anytimeEnd > -1 ? homeSource.slice(anytimeStart, anytimeEnd) : '';
    expect(anytimeBlock.length).toBeGreaterThan(0);
    expect(anytimeBlock).not.toMatch(/anytimeCardState|'not-started'|'in-progress'|'completed'/);
  });

  it('the real quick actions are still exactly Breathe/Meditate/Sleep & Unwind - Stitch\'s own invented "Stretch"/"Unwind" tiles were never adopted', () => {
    expect(homeSource).toMatch(/to="\/breathe-standalone"/);
    expect(homeSource).toMatch(/to="\/self-guided-meditation\?from=home"/);
    expect(homeSource).toMatch(/to="\/library\?category=sleep-soundscapes&from=home"/);
    expect(homeSource).not.toMatch(/>Stretch</);
    expect(homeSource).not.toMatch(/>Unwind</);
  });
});

describe('Home Visual Uplift — no forbidden Stitch chrome, no functional/auth/session changes', () => {
  it('no settings gear, sync indicator, or decorative status bar was introduced into Home.jsx', () => {
    expect(homeSource).not.toMatch(/aria-label="Settings"/);
    expect(homeSource).not.toMatch(/Synced/);
    expect(homeSource).not.toMatch(/9:41/);
  });

  it('no Routines nav item or Explore Library tile was reintroduced', () => {
    // Comments stripped first - this file's own doc comment legitimately
    // names "Explore Library" in prose, explaining that the tile was
    // already removed in prior work.
    const codeOnly = homeSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(codeOnly).not.toMatch(/Explore Library/);
    expect(codeOnly).not.toMatch(/to="\/routines"/);
  });

  it('every routine-launching handler and guest gate is byte-identical in name/shape to before this pass', () => {
    expect(homeSource).toMatch(/const handleMorningAction = \(\) => \{/);
    expect(homeSource).toMatch(/const handleEveningAction = \(\) => \{/);
    expect(homeSource).toMatch(/if \(isGuest\) \{ promptRoutineSignIn\(\); return; \}/);
    expect(homeSource).toMatch(/const isOtherRoutineActivelyRunning = \(targetSessionId\) =>/);
  });

  it('no Supabase/session-engine call was added - startSession/resumeRoutine call sites are unchanged in count', () => {
    // Comments stripped first - a doc comment above handleBeginEveningWindDown
    // legitimately names "startSession('evening-wind-down')" in prose,
    // describing OLD, already-removed behaviour, not a real call site.
    const codeOnly = homeSource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect((codeOnly.match(/startSession\(/g) ?? []).length).toBe(1);
    expect((codeOnly.match(/resumeRoutine\(/g) ?? []).length).toBe(2);
  });
});
