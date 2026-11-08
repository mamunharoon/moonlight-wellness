// Phase 2C — Free vs. WakeWise Plus Access Specification
// (docs/phase-2c-access-specification.md) — the one client-side decision
// every premium-lock call site (useProtectedVideo.js, Meditate.jsx,
// AnytimeReset.jsx, Support.jsx, QuietBreathing.jsx, Library.jsx) shares,
// so none of them re-derive this logic independently and drift apart.
//
// Reads the UNIFIED, provider-aware entitlement (entitlementResolver.js's
// resolveUnifiedEntitlement, exposed via useUnifiedEntitlement() —
// cross-provider-aware, unlike the legacy Stripe/manual-only
// useEntitlements()), never the legacy table alone — a native Apple/
// Google subscriber must be recognised here exactly like a Stripe one.
//
// This is a UI CONVENIENCE ONLY (§6/§7 of the spec): it decides whether to
// show a paywall prompt INSTEAD of opening BetaVideoModal, nothing more.
// The real, unweakened access boundary is get-beta-video-url's own
// server-side authorization check — a client that skips this gate
// entirely (or a race where this resolves 'allowed' incorrectly) can
// never obtain a working signed URL for premium content it isn't actually
// entitled to; this file has no bearing on that server decision.
//
// Loading is handled as its own, distinct outcome rather than folded into
// "locked" — per the spec's explicit requirement to "avoid briefly
// showing purchase prompts before an existing subscriber is recognised."
// A caller must never show a paywall while PREMIUM_GATE.LOADING; the
// established convention for that instant (see AudioDetails.jsx's own
// `locked = !subscriptionLoading && entry.premium && !canUseAudio`, and
// every verifyAndOpenVideo-style handler in this codebase) is to simply
// defer/no-op the action until the next tap or the next render, never to
// guess.
export const PREMIUM_GATE = Object.freeze({
  // Not premium, or premium and genuinely entitled — proceed normally.
  ALLOWED: 'allowed',
  // The unified entitlement read is still in flight — never render a
  // paywall; the caller should defer (no-op) rather than guess.
  LOADING: 'loading',
  // Genuinely not entitled — show the Plus paywall.
  LOCKED: 'locked',
  // The entitlement read itself failed (network/permission/unexpected
  // error) — per §6, this must never be silently treated as "Free"/
  // locked-forever, and must never silently grant access either. Shown
  // as its own distinct "can't verify right now" state, never the
  // ordinary upsell paywall.
  VERIFICATION_UNAVAILABLE: 'verification_unavailable'
});

/**
 * @param {{premium?: boolean}|null|undefined} entry - a mediaCatalog.js
 *   entry or a breathingPatterns.js pattern; anything without a truthy
 *   `premium` field is always ALLOWED (free content, or no entry yet).
 * @param {{state: string, isEntitled: boolean}} entitlement - the exact
 *   shape useUnifiedEntitlement()/resolveUnifiedEntitlement() returns.
 * @returns {string} one of PREMIUM_GATE's values.
 */
export const resolvePremiumGate = (entry, entitlement) => {
  if (!entry?.premium) return PREMIUM_GATE.ALLOWED;
  if (entitlement?.isEntitled) return PREMIUM_GATE.ALLOWED;
  if (entitlement?.state === 'loading') return PREMIUM_GATE.LOADING;
  if (entitlement?.state === 'verification_unavailable') return PREMIUM_GATE.VERIFICATION_UNAVAILABLE;
  return PREMIUM_GATE.LOCKED;
};

// Thin, named convenience for the common "should I render a lock badge
// right now" question — distinct from resolvePremiumGate's full result,
// since a badge should never render while LOADING either (the same
// "never show a premium cue before the subscriber is recognised" rule,
// applied to a passive badge rather than an action gate).
export const isPremiumLocked = (entry, entitlement) => resolvePremiumGate(entry, entitlement) === PREMIUM_GATE.LOCKED;
