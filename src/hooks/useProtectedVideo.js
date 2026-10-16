import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useUnifiedEntitlement } from '../context/SubscriptionContext';
import { getCatalogEntryById } from '../lib/mediaCatalog';
import { setPendingContent } from '../lib/pendingContent';
import { PREMIUM_GATE, resolvePremiumGate } from '../lib/premiumAccess';

/*
 * Guest access repair — useProtectedVideo
 *
 * Single shared hook for "tap a video/sleep-sound row" behaviour, used
 * by every page that lists BetaVideoRow entries (Library, Support,
 * Prepare for Rest, Breathe, Affirmation, MorningStart, MorningFlow,
 * IntentionSetup, Grounding). Replaces two previously-inconsistent
 * patterns: Library's rows were shown locked but tapping one silently
 * did nothing for a guest; every other contextual page hid its rows
 * entirely behind `{!isGuest && ...}`, so a guest never even saw that
 * content existed. Now every row stays visible and tappable for
 * everyone — an authenticated tap opens BetaVideoModal exactly as
 * before; a guest tap opens SignInPromptDialog instead of either
 * silently failing or being hidden.
 *
 * Also owns the post-auth return trip: Sign in / Create account stash
 * the tapped id + this page's own URL (lib/pendingContent.js) before
 * navigating to /auth, and Auth.jsx redirects back here afterward with
 * `?openId=<id>` attached. On mount, a matching openId auto-opens that
 * item's player — never auto-playing it, since BetaVideoModal always
 * requires its own explicit Begin Exercise tap regardless of how it was
 * opened — then the query param is stripped (`replace`) so it can't
 * re-trigger on a later re-render or a browser back/forward.
 *
 * `resolveEntry` (optional, defaults to getCatalogEntryById) lets a caller
 * resolve an id against a different lookup than the general Library
 * catalog - Introduction.jsx passes getBetaVideoById directly, since I01/
 * I02 are deliberately excluded from MEDIA_CATALOG (mediaCatalog.js's
 * INTERACTIVE_ONLY_IDS, same reasoning as IB01/IS01) and would otherwise
 * never resolve here at all.
 *
 * `guestAllowedIds` (Build 16, optional, defaults to an empty Set - every
 * existing caller omits it and keeps its exact original "always prompt a
 * guest" behaviour, byte-for-byte unchanged): a narrow, caller-supplied
 * exception list mirroring the exact same fixed-ID pattern the server
 * already uses (GUEST_ALLOWED_IDS in
 * supabase/functions/_shared/betaVideoUrlAccess.ts) - Introduction.jsx
 * passes a Set containing only 'I01', so a guest can watch the "Why
 * WakeWise" welcome video without signing in first, matching the
 * server's own allowance for that exact id. This is a CLIENT-SIDE
 * convenience only (skips the sign-in prompt so the tap actually opens
 * the player) - the real gate is still, and must always stay, the
 * server's own GUEST_ALLOWED_IDS check; adding an id here without also
 * adding it there would only produce a broken "modal opens then errors"
 * experience, never a security hole (a guest tapping any id NOT in the
 * server's own list still gets rejected server-side regardless of what
 * this hook does).
 */
const EMPTY_GUEST_ALLOWED_IDS = new Set();

export const useProtectedVideo = (returnPathOverride, resolveEntry = getCatalogEntryById, guestAllowedIds = EMPTY_GUEST_ALLOWED_IDS) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isGuest } = useAuth();
  const entitlement = useUnifiedEntitlement();
  const [promptId, setPromptId] = useState(null);
  // Phase 2C — the premium paywall prompt, a sibling of promptId above but
  // deliberately independent: a guest always sees the sign-in prompt first
  // (promptId) regardless of whether the tapped id is premium — this one
  // only ever opens for an already signed-in, non-guest user who tapped a
  // premium id they aren't currently entitled to. `paywallState` carries
  // which of PREMIUM_GATE.LOCKED/VERIFICATION_UNAVAILABLE applies, so the
  // dialog can tell a genuine lock apart from a failed verification read
  // (see premiumAccess.js's own header for why those must never be
  // conflated).
  const [paywallId, setPaywallId] = useState(null);
  const [paywallState, setPaywallState] = useState(null);

  const returnPath = returnPathOverride ?? `${location.pathname}${location.search}`;

  // Consumed as the initial state value (computed once, on mount) rather
  // than via setState inside an effect — by the time this component
  // mounts from Auth.jsx's post-sign-in redirect, isGuest has already
  // settled to false, so there's no race with auth still resolving.
  const [openVideoId, setOpenVideoId] = useState(() => {
    const openId = searchParams.get('openId');
    return openId && (!isGuest || guestAllowedIds.has(openId)) && resolveEntry(openId) ? openId : null;
  });

  // Strips the now-consumed openId param so it can't re-trigger on a
  // later re-render or a browser back/forward — this effect only ever
  // touches router state, never this hook's own video-open state.
  useEffect(() => {
    if (!searchParams.get('openId')) return;
    const next = new URLSearchParams(searchParams);
    next.delete('openId');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id) => {
    if (isGuest && !guestAllowedIds.has(id)) {
      setPromptId(id);
      return;
    }
    // Phase 2C — premium gate, checked only once the guest check above has
    // already passed (a guest is always routed to sign-in first, never to
    // this paywall, regardless of the tapped id's premium flag). Resolved
    // against the resolved entry, not a bare id, so a free id is always
    // PREMIUM_GATE.ALLOWED without needing its own lookup here.
    const gate = resolvePremiumGate(resolveEntry(id), entitlement);
    if (gate === PREMIUM_GATE.LOADING) return; // defer — never guess, never flash a paywall before the real read resolves
    if (gate !== PREMIUM_GATE.ALLOWED) {
      setPaywallId(id);
      setPaywallState(gate);
      return;
    }
    setOpenVideoId(id);
  };

  const closeVideo = () => setOpenVideoId(null);
  const dismissPrompt = () => setPromptId(null);
  const dismissPaywall = () => {
    setPaywallId(null);
    setPaywallState(null);
  };
  // Re-checks the same id's gate on demand (the paywall's own "Try Again"
  // action, for the VERIFICATION_UNAVAILABLE case) — never auto-retries on
  // a timer, only on an explicit user action. Opens the video directly if
  // the retry now resolves ALLOWED, so a genuinely-recovered connection
  // doesn't make the user tap the row a second time.
  const retryPaywall = () => {
    if (!paywallId) return;
    const gate = resolvePremiumGate(resolveEntry(paywallId), entitlement);
    if (gate === PREMIUM_GATE.ALLOWED) {
      const id = paywallId;
      dismissPaywall();
      setOpenVideoId(id);
      return;
    }
    if (gate !== PREMIUM_GATE.LOADING) setPaywallState(gate);
  };

  const confirmSignIn = () => {
    setPendingContent({ id: promptId, returnPath });
    setPromptId(null);
    navigate('/auth');
  };

  const confirmCreateAccount = () => {
    setPendingContent({ id: promptId, returnPath });
    setPromptId(null);
    navigate('/auth?tab=signup');
  };

  const viewPlusOptions = () => {
    dismissPaywall();
    navigate('/subscription');
  };

  return {
    openVideo: openVideoId ? resolveEntry(openVideoId) : null,
    handleSelect,
    closeVideo,
    promptOpen: !!promptId,
    dismissPrompt,
    confirmSignIn,
    confirmCreateAccount,
    // Phase 2C — the premium paywall's own open/state/actions, a sibling
    // set to promptOpen/dismissPrompt/confirmSignIn/confirmCreateAccount
    // above. Every existing caller that destructures only the original
    // fields is completely unaffected; Library.jsx (and any future
    // caller) renders <PlusPaywallDialog> with these.
    paywallOpen: !!paywallId,
    paywallState,
    dismissPaywall,
    retryPaywall,
    viewPlusOptions
  };
};
