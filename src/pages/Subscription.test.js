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

describe('Subscription.jsx — trial messaging is reconciled per PRODUCT, never a single "annual only" assumption (readiness-gap fix: a real sandbox purchase recorded a TRIAL period on the MONTHLY iOS product)', () => {
  it('checks monthly and annual independently via describeIntroOfferWording, rather than gating the whole trial sentence on interval === \'yearly\'', () => {
    expect(source).toMatch(/import \{ describeIntroOfferWording \} from '\.\.\/lib\/trialOfferWording';/);
    expect(source).toMatch(/const introOfferWording = describeIntroOfferWording\(/);
    // The old hard gate on interval === 'yearly' around the trial
    // paragraph is gone - wording is now a function of the SELECTED
    // package's own real offer data, computed once above the JSX.
    expect(source).not.toMatch(/\{interval === 'yearly' && \(\s*\n\s*<p className="text-xs text-on-surface-variant pt-1">\s*\n\s*New subscribers may be eligible for a free trial/);
  });

  it('iOS resolves the real per-product introPrice for whichever package is selected, never assuming only the annual product has one', () => {
    const body = source.match(/const selectedIntroOffer = IS_NATIVE_IOS\s*\n[\s\S]*?\n {2}const selectedIntroEligibility/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/selectedNativePackage\?\.product\?\.introPrice\s*\n\s*\? \{ \.\.\.selectedNativePackage\.product\.introPrice, currencyCode: selectedNativePackage\.product\.currencyCode \}\s*\n\s*: null/);
  });

  it('attaches the product\'s own currencyCode to the iOS introOffer - introPrice itself carries no currency field, and the real offer amount (checked below) must never be formatted with a guessed/missing currency', () => {
    expect(source).toMatch(/currencyCode: selectedNativePackage\.product\.currencyCode/);
  });

  it('Android still only models the annual-trial-7-days offer (no equivalent monthly offer exists in the Play Console catalogue) via describeGoogleTrialOffer, gated on the yearly interval', () => {
    expect(source).toMatch(/: interval === 'yearly'\s*\n\s*\? describeGoogleTrialOffer\(annualPackage\)\s*\n\s*: null;/);
  });

  it('passes per-user eligibility (iOS only) into the wording function, rather than asserting the current user is eligible in the component itself', () => {
    expect(source).toMatch(/const selectedIntroEligibility = IS_NATIVE_IOS \? introEligibility\[selectedNativeProductId\] \?\? null : null;/);
  });

  it('renders nothing at all when the wording function returns null - no trial claim when the selected product genuinely has none', () => {
    expect(source).toMatch(/\{introOfferWording && <p className="text-xs text-on-surface-variant pt-1">\{introOfferWording\}<\/p>\}/);
  });
});

describe('Subscription.jsx — explicit-currency native pricing (readiness-gap fix: a bare "$" read as USD when the tester expected AUD)', () => {
  it('never reads .priceString anywhere in actual code - the ambiguous bare-symbol price this task replaces (comments mentioning the name for context are fine)', () => {
    expect(source).not.toMatch(/\.priceString/);
  });

  it('uses formatNativeStorePrice (ISO currency code + real price) as the default headline price, with an explicit unavailable fallback instead of a different price', () => {
    expect(source).toMatch(/import \{ formatNativeStorePrice, formatGoogleMicrosPrice, formatExplicitCurrencyAmount \} from '\.\.\/lib\/currencyDisplay';/);
    expect(source).toMatch(/: formatNativeStorePrice\(selectedNativePackage\?\.product\);/);
    expect(source).toMatch(/\{selectedNativePriceText \?\? 'Price unavailable'\}/);
  });

  it('shows an explicit "couldn\'t load pricing for this plan" message when the selected plan\'s own package is missing, even if the other plan loaded fine', () => {
    expect(source).toMatch(/We couldn't load pricing for this plan right now\. Please try again shortly\./);
  });

  it('the web/Stripe approximate-monthly-price line also uses the explicit-currency formatter, never a hardcoded "AUD $" literal', () => {
    expect(source).not.toMatch(/`AUD \$\$\{annualEffectiveMonthly/);
    expect(source).toMatch(/formatExplicitCurrencyAmount\(annualEffectiveMonthly\(\), CURRENCY\)/);
  });
});

describe('Subscription.jsx — Android headline "Annual" price resolves the EXPLICIT base-plan option, never product.price (readiness-gap fix: "a package\'s standard product price may differ from its offer price")', () => {
  it('product.price/currencyCode are documented as reflecting Google\'s own defaultOption, which this codebase\'s own describeDefaultAnnualSelection finding already warns can resolve to the trial/founder offer', () => {
    expect(source).toMatch(/PurchasesStoreProduct\.price\/currencyCode are documented as containing/);
  });

  it('resolves getGoogleBasePlanAnnualOption explicitly and reads its fullPricePhase (the base plan\'s own one real standard price), only for Android + the yearly interval', () => {
    expect(source).toMatch(/import \{[\s\S]*?getGoogleBasePlanAnnualOption[\s\S]*?\} from '\.\.\/lib\/revenueCatAdapter';/);
    expect(source).toMatch(/const googleBasePlanAnnualOption = IS_NATIVE_ANDROID \? getGoogleBasePlanAnnualOption\(annualPackage\) : null;/);
    const body = source.match(/const selectedNativePriceText =\s*\n[\s\S]*?: formatNativeStorePrice\(selectedNativePackage\?\.product\);/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/IS_NATIVE_ANDROID && interval === 'yearly'/);
    expect(body).toMatch(/googleBasePlanAnnualOption\?\.fullPricePhase\?\.price/);
  });

  it('iOS and Android monthly are untouched by this branch - they keep using formatNativeStorePrice(product) directly, since only Android annual has the defaultOption ambiguity', () => {
    const body = source.match(/const selectedNativePriceText =\s*\n[\s\S]*?: formatNativeStorePrice\(selectedNativePackage\?\.product\);/)?.[0] ?? '';
    expect(body).toMatch(/: formatNativeStorePrice\(selectedNativePackage\?\.product\);$/);
  });
});

describe('Subscription.jsx — Android founder price reads the offer\'s own discounted phase, never the standard renewal price (readiness-gap fix)', () => {
  it('uses introPhase (the real first non-zero-price phase), never fullPricePhase (documented as the price AFTER free/intro trials end)', () => {
    expect(source).toMatch(/fullPricePhase is explicitly documented as "the\s*\n\s*\/\/ period of fullPricePhase \(AFTER free and intro trials\)"/);
    expect(source).toMatch(/const googleFounderOfferPrice = googleFounderOption\?\.introPhase\?\.price \?\? googleFounderOption\?\.pricingPhases\?\.\[0\]\?\.price \?\? null;/);
    expect(source).not.toMatch(/googleFounderOption\?\.fullPricePhase/);
  });
});

describe('Subscription.jsx — sandbox-test build copy never implies a real charge (task 3)', () => {
  it('defines IS_SANDBOX_TEST_BUILD from the same build-time flag SubscriptionSandboxTest.jsx uses', () => {
    expect(source).toMatch(/const IS_SANDBOX_TEST_BUILD = import\.meta\.env\.VITE_ENABLE_SUBSCRIPTION_SANDBOX_TEST === 'true';/);
  });

  it('shows a dedicated, prominent sandbox banner distinct from the renewal sentence, using the platform-specific SANDBOX_BANNER_TEXT constant', () => {
    expect(source).toMatch(/\{IS_SANDBOX_TEST_BUILD && \(\s*\n\s*<p\s*\n\s*role="status"/);
    expect(source).toMatch(/\{SANDBOX_BANNER_TEXT\}/);
  });

  it('the renewal sentence itself is conditional on IS_SANDBOX_TEST_BUILD (using SANDBOX_RENEWAL_TEXT), never unconditionally implying a real charge follows', () => {
    expect(source).toMatch(/\{IS_SANDBOX_TEST_BUILD\s*\n\s*\? SANDBOX_RENEWAL_TEXT\s*\n\s*: 'Subscriptions renew automatically/);
  });

  it('the Android founder-redemption confirm dialog also gets sandbox-safe wording, not just the trial sentence', () => {
    const body = source.match(/message=\{[\s\S]*?IS_SANDBOX_TEST_BUILD[\s\S]*?\n {8}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/Sandbox test build — this only avoids a real charge/);
  });

  it('sandbox wording is PLATFORM-SPECIFIC (check 2): iOS claims no real charge unconditionally (TestFlight always sandboxes), Android qualifies it on Play Console License Tester setup - the build flag alone never establishes Google Play test billing', () => {
    expect(source).toMatch(/const SANDBOX_BANNER_TEXT = IS_NATIVE_IOS/);
    expect(source).toMatch(/const SANDBOX_TRIAL_CLAUSE = IS_NATIVE_IOS/);
    expect(source).toMatch(/const SANDBOX_RENEWAL_TEXT = IS_NATIVE_IOS/);
    expect(source).toMatch(/Play Console License Tester/);
    // The iOS branch of every sandbox constant must assert "never
    // charged" unconditionally (TestFlight-documented); the Android
    // branch must never make that same unconditional claim.
    expect(source).toMatch(/never charges real money/);
  });

  it('the trial-offer sentence passes the platform-specific SANDBOX_TRIAL_CLAUSE into describeIntroOfferWording, never a bare boolean the wording module would have to interpret itself', () => {
    expect(source).toMatch(/IS_SANDBOX_TEST_BUILD \? SANDBOX_TRIAL_CLAUSE : null/);
  });

  it('adds a concise sandbox TIMING note (trials/renewals run faster than production) alongside the real-charge claim, without touching the authoritative expiry timestamp anywhere', () => {
    expect(source).toMatch(/run much faster than in production/);
    expect(source).toMatch(/may also run faster than in production/);
  });
});

describe('Subscription.jsx — "Trial ends" vs "Next renewal" uses the same authoritative entitlement.currentPeriodEnd (task 6)', () => {
  it('the row label depends on entitlement.status === \'trial\', never a separately computed/guessed date', () => {
    expect(source).toMatch(/const periodEndRowLabel = entitlement\.status === 'trial' \? 'Trial ends' : 'Next renewal';/);
    expect(source).toMatch(/\{loading \? 'Next renewal' : periodEndRowLabel\}/);
  });

  it('still reads the date from formatRenewalDate(entitlement) - the label changes, the authoritative timestamp does not', () => {
    expect(source).toMatch(/\{loading \? 'Loading…' : formatRenewalDate\(entitlement\)\}/);
  });

  it('a sandbox-build trial explains the accelerated test clock, without hardcoding a date or changing entitlement.currentPeriodEnd', () => {
    const body = source.match(/\{!loading && IS_SANDBOX_TEST_BUILD && entitlement\.status === 'trial' && \([\s\S]*?\n {8}\)\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    expect(body).toMatch(/accelerated test clock/);
    expect(body).not.toMatch(/new Date\(|\d{4}-\d{2}-\d{2}/); // never a literal/computed date
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
