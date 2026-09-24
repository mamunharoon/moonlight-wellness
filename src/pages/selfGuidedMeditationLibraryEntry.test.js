// Source-level regression guard for Library.jsx's new "Self-Guided
// Meditation" entry point - same "no rendering engine" constraint as
// libraryHomeReturnContext.test.js, which already covers FROM_CONTEXTS in
// depth; this file only covers what that one doesn't: the new entry link
// itself and that it never touches the real guided items around it.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const librarySource = readFileSync(fileURLToPath(new URL('./Library.jsx', import.meta.url)), 'utf-8');

describe('Library.jsx — Self-Guided Meditation entry, rendered only in the Meditation category', () => {
  it('links to the real shared setup screen with the library entry context, not a duplicate implementation', () => {
    expect(librarySource).toMatch(/\{category === MEDITATION_FILTER && \(/);
    expect(librarySource).toMatch(/<Link\s*\n\s*to="\/self-guided-meditation\?from=library"/);
  });

  it('imports Link from react-router-dom to render it', () => {
    expect(librarySource).toMatch(/import \{ Link, useSearchParams \} from 'react-router-dom';/);
  });

  it('carries the 44px touch target and the app\'s standard glass-panel card treatment, matching the real guided items below it', () => {
    const block = librarySource.match(/\{category === MEDITATION_FILTER && \([\s\S]*?\)\}/)?.[0] ?? '';
    expect(block).toMatch(/min-h-\[44px\]/);
    expect(block).toMatch(/glass-panel rounded-2xl p-4/);
  });

  it('is rendered before the real items.map loop, but never replaces or filters it - the genuine guided items are unaffected', () => {
    const entryIdx = librarySource.indexOf('Self-Guided Meditation');
    const itemsMapIdx = librarySource.indexOf('{items.map((entry) => {');
    expect(entryIdx).toBeGreaterThan(-1);
    expect(itemsMapIdx).toBeGreaterThan(entryIdx);
  });
});

describe('Library.jsx — the one new hardcoded allowlist context this feature adds', () => {
  it('meditation-setup resolves to the real setup screen with the exact approved label', () => {
    expect(librarySource).toMatch(/'meditation-setup': \{ fallback: '\/self-guided-meditation', label: 'Back to Meditation Setup' \}/);
  });
});
