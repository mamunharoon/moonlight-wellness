// Phase 2C §11a-iii — AnytimeStretch.jsx previously had NO isGuest/
// entitlement check at all, unlike every other content page. The real
// server-side boundary (get-beta-video-url) was never actually
// bypassable, but the client showed a confusing dead-end error instead
// of SignInPromptDialog/PlusPaywallDialog. Source-level checks, matching
// this codebase's established pattern for pages with no DOM/component
// rendering available in this repo's Vitest (see AnytimeReset.test.js's
// own identical convention).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');
const source = read('./AnytimeStretch.jsx');

describe('AnytimeStretch.jsx — Phase 2C gate, checked before any network call', () => {
  it('imports the same guest/entitlement/paywall machinery every other content page uses', () => {
    expect(source).toMatch(/import \{ useAuth \} from '\.\.\/context\/AuthContext';/);
    expect(source).toMatch(/import \{ useUnifiedEntitlement \} from '\.\.\/context\/SubscriptionContext';/);
    expect(source).toMatch(/import \{ getCatalogEntryById \} from '\.\.\/lib\/mediaCatalog';/);
    expect(source).toMatch(/import \{ PREMIUM_GATE, resolvePremiumGate \} from '\.\.\/lib\/premiumAccess';/);
    expect(source).toMatch(/import \{ PlusPaywallDialog \} from '\.\.\/components\/PlusPaywallDialog';/);
  });

  it('handleSelect checks isGuest and the premium gate BEFORE touching selectedId/audioRef/requestBetaVideoUrl', () => {
    const body = source.match(/const handleSelect = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guestIdx = body.indexOf('if (isGuest)');
    const gateIdx = body.indexOf('resolvePremiumGate(');
    const setSelectedIdx = body.indexOf('setSelectedId(id);');
    expect(guestIdx).toBeGreaterThan(-1);
    expect(gateIdx).toBeGreaterThan(-1);
    expect(setSelectedIdx).toBeGreaterThan(-1);
    // Guest check first, then the premium gate, then (only once allowed)
    // the rest of the selection/playback logic - never the reverse.
    expect(guestIdx).toBeLessThan(gateIdx);
    expect(gateIdx).toBeLessThan(setSelectedIdx);
  });

  it('a LOADING gate defers (no-op) - never guesses, never flashes a paywall before the real read resolves', () => {
    const body = source.match(/const handleSelect = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(gate === PREMIUM_GATE\.LOADING\) return;/);
  });

  it('both SignInPromptDialog and PlusPaywallDialog are rendered, each wired to its own dismiss/retry/view-plus handlers', () => {
    expect(source).toMatch(/<SignInPromptDialog[\s\S]*?\/>/);
    const paywallBlock = source.match(/<PlusPaywallDialog[\s\S]*?\/>/)?.[0] ?? '';
    expect(paywallBlock).toMatch(/open=\{!!paywallState\}/);
    expect(paywallBlock).toMatch(/onViewPlus=\{viewPlusOptions\}/);
    expect(paywallBlock).toMatch(/onRetry=\{retryPaywall\}/);
    expect(paywallBlock).toMatch(/onDismiss=\{dismissPaywall\}/);
  });

  it('retryPaywall re-attempts via handleSelect itself rather than duplicating the gate logic', () => {
    const body = source.match(/const retryPaywall = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/handleSelect\(id\);/);
  });

  it('the mount-time preload effect is untouched by the gate - still fires for every session unconditionally, to preserve the documented iOS-autoplay-timing fix', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*let cancelled = false;\s*\n\s*preloadedRef\.current[\s\S]*?\n {2}\}, \[userId\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).not.toMatch(/isGuest|resolvePremiumGate|PREMIUM_GATE/);
  });

  it('cross-account cache safety: the preload effect is keyed by the resolved userId and resets both caches before re-preloading, so a prior identity\'s signed URLs can never be read after an identity change', () => {
    const body = source.match(/useEffect\(\(\) => \{\s*\n\s*let cancelled = false;\s*\n\s*preloadedRef\.current[\s\S]*?\n {2}\}, \[userId\]\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/preloadedRef\.current = \{\};/);
    expect(body).toMatch(/preloadedCoverRef\.current = \{\};/);
    // The resets happen before any requestBetaVideoUrl call, not after -
    // a prior identity's results must already be gone before this
    // identity's own preload starts writing.
    expect(body.indexOf('preloadedRef.current = {};')).toBeLessThan(body.indexOf('requestBetaVideoUrl'));
  });

  it('userId mirrors the established `user && !user.is_anonymous ? user.id : null` convention (AlarmContext.jsx) rather than inventing a new identity shape', () => {
    expect(source).toMatch(/const userId = user && !user\.is_anonymous \? user\.id : null;/);
  });
});
