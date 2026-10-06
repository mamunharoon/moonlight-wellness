// WakeWise — explicit-currency price display (readiness-gap fix).
// Real-execution tests (framework-free, no SDK/DOM dependency), exactly
// like entitlementResolution.test.js's own established pattern.
import { describe, it, expect } from 'vitest';
import { formatExplicitCurrencyAmount, formatNativeStorePrice, formatGoogleMicrosPrice } from './currencyDisplay';

describe('formatExplicitCurrencyAmount — explicit ISO currency code, never a bare ambiguous symbol', () => {
  it('renders the ISO code and amount for the examples the task itself specified', () => {
    expect(formatExplicitCurrencyAmount(6.99, 'USD')).toBe('USD 6.99');
    expect(formatExplicitCurrencyAmount(9.99, 'AUD')).toBe('AUD 9.99');
    expect(formatExplicitCurrencyAmount(4.99, 'GBP')).toBe('GBP 4.99');
    expect(formatExplicitCurrencyAmount(7.99, 'EUR')).toBe('EUR 7.99');
  });

  it('never embeds a bare currency symbol ($/€/£) in the output - the whole point of this module', () => {
    const result = formatExplicitCurrencyAmount(6.99, 'USD');
    expect(result).not.toMatch(/[$€£]/);
  });

  it('returns null (never a guessed price) for a non-numeric or missing amount', () => {
    expect(formatExplicitCurrencyAmount(null, 'AUD')).toBeNull();
    expect(formatExplicitCurrencyAmount(undefined, 'AUD')).toBeNull();
    expect(formatExplicitCurrencyAmount(Number.NaN, 'AUD')).toBeNull();
    expect(formatExplicitCurrencyAmount('9.99', 'AUD')).toBeNull();
  });

  it('returns null (never a guessed currency) for a missing/empty currency code', () => {
    expect(formatExplicitCurrencyAmount(9.99, null)).toBeNull();
    expect(formatExplicitCurrencyAmount(9.99, undefined)).toBeNull();
    expect(formatExplicitCurrencyAmount(9.99, '')).toBeNull();
  });

  it('falls back to a plain "CODE amount" string rather than throwing for an unrecognised currency string', () => {
    expect(formatExplicitCurrencyAmount(9.99, 'notacode')).toBe('notacode 9.99');
  });

  it('never infers currency from a locale argument - currency is always the explicit second argument', () => {
    // Intl.NumberFormat's first argument only ever affects number
    // formatting conventions (grouping/decimal separator) in this
    // module's own implementation, never which currency is shown.
    expect(formatExplicitCurrencyAmount(1000.5, 'AUD')).toMatch(/^AUD/);
  });
});

describe('formatNativeStorePrice — native (RevenueCat) product price, never priceString\'s ambiguous symbol', () => {
  it('reads price + currencyCode off the real StoreProduct shape', () => {
    expect(formatNativeStorePrice({ price: 9.99, currencyCode: 'AUD', priceString: '$6.99' })).toBe('AUD 9.99');
  });

  it('never reads priceString at all, even when price/currencyCode are missing', () => {
    expect(formatNativeStorePrice({ priceString: '$6.99' })).toBeNull();
  });

  it('returns null for a missing product (caller must show an explicit unavailable state)', () => {
    expect(formatNativeStorePrice(null)).toBeNull();
    expect(formatNativeStorePrice(undefined)).toBeNull();
  });
});

describe('formatGoogleMicrosPrice — Google Play\'s amountMicros Price shape (founder-offer display)', () => {
  it('divides amountMicros by 1,000,000 before formatting - never shows the raw micros number', () => {
    expect(formatGoogleMicrosPrice({ amountMicros: 49990000, currencyCode: 'AUD' })).toBe('AUD 49.99');
  });

  it('returns null for a missing/non-numeric amountMicros', () => {
    expect(formatGoogleMicrosPrice(null)).toBeNull();
    expect(formatGoogleMicrosPrice({ currencyCode: 'AUD' })).toBeNull();
    expect(formatGoogleMicrosPrice({ amountMicros: 'not-a-number', currencyCode: 'AUD' })).toBeNull();
  });
});
