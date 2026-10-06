// WakeWise — native RevenueCat purchase integration (Subscription.jsx).
// Source-level checks, same convention as applePurchaseAdapter.test.js /
// revenueCatAdapter.test.js / guestOnboarding.test.js's own established
// pattern: this repo's Vitest runs in a plain Node environment with no
// DOM/component-renderer available (vite.config.js `test.environment` is
// 'node', and `include` only picks up `src/**/*.test.js` — not `.jsx` —
// so there is no React Testing Library setup to render this component
// against). These assertions verify the actual source text instead,
// exactly like every other native-SDK-adjacent file in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const source = readFileSync(fileURLToPath(new URL('./Subscription.jsx', import.meta.url)), 'utf-8');

describe('Subscription.jsx — platform routing (readiness-gap item 7: Android must never fall through to Stripe)', () => {
  it('defines IS_NATIVE_IOS, IS_NATIVE_ANDROID, and IS_NATIVE from platform.js, never from the legacy Apple-only isAppleIAPSupported()', () => {
    expect(source).toMatch(/const IS_NATIVE_IOS = isNativePlatform\(\) && isIOS\(\);/);
    expect(source).toMatch(/const IS_NATIVE_ANDROID = isNativePlatform\(\) && isAndroid\(\);/);
    expect(source).toMatch(/const IS_NATIVE = IS_NATIVE_IOS \|\| IS_NATIVE_ANDROID;/);
    expect(source).not.toMatch(/isAppleIAPSupported\(\)\s*;?\s*\n/); // never assigned as the routing flag
  });

  it('the Stripe/web purchase section is gated on !IS_NATIVE, not !IS_NATIVE_IOS - an Android build cannot reach it', () => {
    expect(source).toMatch(/\{!plusActive && !IS_NATIVE && \(/);
    expect(source).not.toMatch(/\{!plusActive && !IS_NATIVE_IOS && \(/);
  });

  it('the native purchase section is gated on IS_NATIVE (covers both iOS and Android), not IS_NATIVE_IOS alone', () => {
    expect(source).toMatch(/\{!plusActive && IS_NATIVE && \(/);
  });

  it('the Stripe-manage-on-native informational section is gated on IS_NATIVE, not IS_NATIVE_IOS alone, so an Android Stripe subscriber also sees it instead of a broken Stripe portal button', () => {
    expect(source).toMatch(/entitlement\.managementDestination === 'stripe_portal' && !IS_NATIVE/);
    expect(source).toMatch(/entitlement\.managementDestination === 'stripe_portal' && IS_NATIVE\b/);
  });
});

describe('Subscription.jsx — never grants entitlement from a client purchase callback (readiness-gap item 9)', () => {
  it('a "purchased" outcome starts the bounded confirmation poll, never sets plan/status itself directly', () => {
    const body = source.match(/const handleNativePurchaseResult = async \(result\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/if \(result\.outcome === 'purchased'\) \{\s*\n\s*await beginConfirmationPoll\(\);/);
    expect(body).not.toMatch(/isEntitled:\s*true|plan:\s*'plus'/);
  });

  it('the confirmation poll only ever confirms access via a real refreshEntitlement() read (refreshed?.isEntitled), never the purchase outcome string itself', () => {
    const body = source.match(/const beginConfirmationPoll = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/const refreshed = await refreshEntitlement\(\);/);
    expect(body).toMatch(/if \(refreshed\?\.isEntitled\) return;/);
  });

  it('restore is fully delegated to useNativeRestore - Subscription.jsx defines no restore outcome-handling logic of its own', () => {
    expect(source).not.toMatch(/const handleNativeRestore = async/);
    expect(source).toMatch(/const \{ state: nativeRestoreState, error: nativeRestoreError, restore: handleNativeRestore \} = useNativeRestore\(\);/);
  });

  it('uses refreshEntitlement (the provider_subscriptions-aware read), never refreshSubscription (the legacy Stripe-only table a native purchase never writes to), anywhere in the native purchase/founder/confirmation-poll paths', () => {
    const nativeHandlers = source.match(/const handleNativePurchaseResult[\s\S]*?const handleAppleManage = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(nativeHandlers).not.toBe('');
    expect(nativeHandlers).not.toMatch(/refreshSubscription\(\)/);
  });
});

describe('Subscription.jsx — handle delayed webhook confirmation with bounded retries and real recovery (readiness-gap item 4)', () => {
  it('the poll is bounded (fixed max attempts) and paced by a real delay between real entitlement re-reads, never a single timeout used to infer failure', () => {
    const body = source.match(/const beginConfirmationPoll = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/for \(let attempt = 0; attempt < CONFIRMATION_MAX_ATTEMPTS; attempt \+= 1\) \{/);
    expect(body).toMatch(/await new Promise\(\(resolve\) => setTimeout\(resolve, CONFIRMATION_RETRY_DELAY_MS\)\);/);
  });

  it('imports the same bounded-retry constants useNativeRestore.js exports, rather than a second, independently-drifting copy', () => {
    expect(source).toMatch(/import \{\s*\n\s*useNativeRestore,\s*\n\s*NEUTRAL_RESTORE_COMPLETION_MESSAGE,\s*\n\s*CONFIRMATION_MAX_ATTEMPTS,\s*\n\s*CONFIRMATION_RETRY_DELAY_MS\s*\n\s*\} from '\.\.\/hooks\/useNativeRestore';/);
  });

  it('exhausting the bound sets an honest confirmation_timeout state, never a false "awaiting" forever or a false failure', () => {
    const body = source.match(/const beginConfirmationPoll = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setNativePurchaseState\('confirmation_timeout'\);/);
  });

  it('offers a manual recovery action that simply restarts the same bounded poll, never fabricating a new outcome', () => {
    expect(source).toMatch(/const handleCheckConfirmationAgain = \(\) => \{\s*\n\s*beginConfirmationPoll\(\);\s*\n\s*\};/);
    expect(source).toMatch(/onClick=\{handleCheckConfirmationAgain\}/);
  });

  it('the confirmation_timeout UI never claims the purchase failed - distinct wording and role from the genuine "failed" state', () => {
    const timeoutBlock = source.match(/\{nativePurchaseState === 'confirmation_timeout' && \([\s\S]*?\n {10}\)\}/)?.[0] ?? '';
    expect(timeoutBlock).not.toBe('');
    expect(timeoutBlock).not.toMatch(/couldn't complete that purchase/i);
  });
});

describe('Subscription.jsx — founder offer is never reachable from the ordinary purchase button (readiness-gap item 5)', () => {
  it('the ordinary purchase handler calls purchaseGoogleOrdinaryAnnual on Android (never purchaseGoogleAnnualTierExplicit with "founder") and a plain purchasePackage on iOS', () => {
    const body = source.match(/const handleNativePurchase = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/purchaseGoogleOrdinaryAnnual\(annualPackage\)/);
    expect(body).not.toMatch(/'founder'/);
  });

  it('the founder offer has its own separate action, gated behind isGuest exactly like the ordinary purchase path', () => {
    expect(source).toMatch(/const handleFounderOfferAction = \(\) => \{\s*\n\s*if \(isGuest\) \{/);
  });

  it('Android founder redemption requires an explicit confirm dialog before calling purchaseGoogleAnnualTierExplicit(..., \'founder\') - never a bare tap-to-purchase', () => {
    expect(source).toMatch(/if \(IS_NATIVE_ANDROID\) \{\s*\n\s*setActiveDialog\('founder-confirm'\);/);
    const confirmBody = source.match(/const confirmGoogleFounderPurchase = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(confirmBody).toMatch(/purchaseGoogleAnnualTierExplicit\(annualPackage, 'founder'\)/);
  });

  it('iOS founder redemption calls the real offer-code redemption sheet, never purchasePackage', () => {
    const body = source.match(/const handleAppleFounderRedemption = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/redeemAppleFounderOfferCode\(\)/);
    expect(body).not.toMatch(/purchasePackage/);
  });

  it('the founder action button only renders for the annual interval - the founder mechanism does not exist on the monthly product', () => {
    expect(source).toMatch(/\{interval === 'yearly' && \(\s*\n\s*<button\s*\n\s*onClick=\{handleFounderOfferAction\}/);
  });
});

describe('Subscription.jsx — account identity (readiness-gap item 3)', () => {
  it('calls the RevenueCat purchase functions with only a package argument - no appAccountToken/user-id second argument, since identity is established app-wide by useRevenueCatIdentity.js before this page mounts', () => {
    expect(source).toMatch(/purchasePackage\(monthlyPackage\)/);
    expect(source).toMatch(/purchasePackage\(annualPackage\)/);
    expect(source).not.toMatch(/purchasePackage\([^)]*,/); // no second argument anywhere
  });

  it('verifies RevenueCat identity is READY for the current user before every purchase/founder action - never attempts a purchase mid-switch or after a failure', () => {
    const purchaseBody = source.match(/const handleNativePurchase = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const founderActionBody = source.match(/const handleFounderOfferAction = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    for (const body of [purchaseBody, founderActionBody]) {
      expect(body).toMatch(/if \(!isRevenueCatIdentityReadyFor\(identityStatus, user\?\.id\)\) \{/);
      expect(body).toMatch(/setNativePurchaseState\('identity_not_ready'\);/);
    }
  });

  it('the identity check happens AFTER the guest check but BEFORE any purchase/redemption call - a guest sees the sign-in prompt, never the identity-not-ready message', () => {
    const body = source.match(/const handleNativePurchase = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const guestIdx = body.indexOf("setActiveDialog('sign-in');");
    const identityIdx = body.indexOf('isRevenueCatIdentityReadyFor');
    const purchaseCallIdx = body.indexOf('purchasePackage(monthlyPackage)');
    expect(guestIdx).toBeGreaterThan(-1);
    expect(identityIdx).toBeGreaterThan(guestIdx);
    expect(purchaseCallIdx).toBeGreaterThan(identityIdx);
  });

  it('imports isRevenueCatIdentityReadyFor/useRevenueCatIdentityStatus from the shared store, never re-implementing the readiness check locally', () => {
    expect(source).toMatch(/import \{ useRevenueCatIdentityStatus, isRevenueCatIdentityReadyFor \} from '\.\.\/lib\/revenueCatIdentityStatus';/);
  });
});

describe('Subscription.jsx — a late purchase/listener callback can never update a different signed-in account (readiness-gap item 5)', () => {
  it('captures the user id a purchase/founder action started for in a ref BEFORE the SDK call, and rechecks it before applying the result', () => {
    const body = source.match(/const handleNativePurchase = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const captureIdx = body.indexOf('startedForUserIdRef.current = user?.id ?? null;');
    const resultHandlingIdx = body.indexOf('await handleNativePurchaseResult(result);');
    const recheckIdx = body.lastIndexOf('if (startedForUserIdRef.current !== (user?.id ?? null)) return;');
    expect(captureIdx).toBeGreaterThan(-1);
    expect(recheckIdx).toBeGreaterThan(captureIdx);
    expect(resultHandlingIdx).toBeGreaterThan(recheckIdx);
  });

  it('the confirmation poll rechecks the started-for user id after every delay and after every real refresh, never just once at the start', () => {
    const body = source.match(/const beginConfirmationPoll = async \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    const recheckCount = (body.match(/if \(startedForUserIdRef\.current !== forUserId\) return;/g) ?? []).length;
    expect(recheckCount).toBeGreaterThanOrEqual(2);
  });

  it('the CustomerInfo listener only reacts when it is for the account a purchase/founder action on THIS page was actually started for', () => {
    const listenerBody = source.match(/addRevenueCatCustomerInfoListener\(\(\) => \{[\s\S]*?\n\s{4}\}\);/)?.[0] ?? '';
    expect(listenerBody).not.toBe('');
    expect(listenerBody).toMatch(/if \(startedForUserIdRef\.current && startedForUserIdRef\.current === user\?\.id\) \{/);
  });

  it('an account switch resets the tracked purchase state entirely, never leaving the previous user\'s purchase status visible to the next signed-in user', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(startedForUserIdRef\.current[\s\S]*?\n {2}\}, \[user\?\.id\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/startedForUserIdRef\.current = null;/);
    expect(effectBody).toMatch(/setNativePurchaseState\('idle'\);/);
  });

  it('the product-loading/listener effect\'s own cleanup removes the listener - never left dangling across unmounts', () => {
    const effectBody = source.match(/useEffect\(\(\) => \{\s*\n\s*if \(!IS_NATIVE\) return undefined;[\s\S]*?\n {2}\}, \[\]\);/)?.[0] ?? '';
    expect(effectBody).not.toBe('');
    expect(effectBody).toMatch(/const removeListener = addRevenueCatCustomerInfoListener/);
    expect(effectBody).toMatch(/removeListener\(\);/);
  });
});

describe('Subscription.jsx — Android subscription management uses verified package/product details (readiness-gap item 2)', () => {
  it('builds the Play Store deep link from the verified package name and the real, server-recorded product id - never a guessed/hardcoded product', () => {
    expect(source).toMatch(/const ANDROID_PACKAGE_NAME = 'com\.zavaraai\.wakewise';/);
    expect(source).toMatch(
      /entitlement\.provider === 'google' && entitlement\.product\s*\n\s*\? `https:\/\/play\.google\.com\/store\/account\/subscriptions\?sku=\$\{encodeURIComponent\(entitlement\.product\)\}&package=\$\{encodeURIComponent\(ANDROID_PACKAGE_NAME\)\}`/
    );
  });

  it('falls back to plain informational text, never a broken link, when the product id is unavailable', () => {
    expect(source).toMatch(/entitlement\.managementDestination === 'google_play' && androidManageSubscriptionUrl && \(/);
    expect(source).toMatch(/entitlement\.managementDestination === 'google_play' && !androidManageSubscriptionUrl && \(/);
  });
});

describe('Subscription.jsx — trial messaging reflects what is actually eligible, never a universal promise', () => {
  it('the trial sentence only renders for the annual interval - the monthly product has no trial offer modelled anywhere in this codebase', () => {
    expect(source).toMatch(/\{interval === 'yearly' && \(\s*\n\s*<p className="text-xs text-on-surface-variant pt-1">\s*\n\s*New subscribers may be eligible for a free trial/);
  });

  it('even for annual, the copy says "may be eligible" and defers the actual determination to the store - never asserts the current user will get a trial', () => {
    expect(source).toMatch(/New subscribers may be eligible for a free trial on the annual plan/);
    expect(source).toMatch(/will show your exact eligibility and terms/);
  });
});

describe('Subscription.jsx — legacy direct-Apple path left intact, not deleted (readiness-gap item 10)', () => {
  it('still imports openAppleManageSubscriptions from the legacy adapter for the OS-level manage screen, but no purchase/restore/verification function from it or appleVerificationApi', () => {
    expect(source).toMatch(/import \{ openAppleManageSubscriptions \} from '\.\.\/lib\/applePurchaseAdapter';/);
    expect(source).not.toMatch(/purchaseAppleProduct|restoreApplePurchases|addAppleTransactionUpdateListener/);
    expect(source).not.toMatch(/appleVerificationApi/);
  });
});

describe('Subscription.jsx — Current Plan reads the unified, provider-aware entitlement (fixes a latent gap: the legacy `subscription` table a native purchase never wrote to)', () => {
  it('derives plusActive from entitlement.isEntitled, never from the legacy subscription.plan/status', () => {
    expect(source).toMatch(/const plusActive = entitlement\.isEntitled;/);
  });

  it('uses entitlement.managementDestination (already built in entitlementResolver.js) to choose which manage-subscription UI to show, rather than re-deriving it from a raw provider string', () => {
    expect(source).toMatch(/entitlement\.managementDestination === 'stripe_portal'/);
    expect(source).toMatch(/entitlement\.managementDestination === 'apple_settings'/);
    expect(source).toMatch(/entitlement\.managementDestination === 'google_play'/);
  });
});
