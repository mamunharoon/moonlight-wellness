import { describe, it, expect, vi, beforeEach } from 'vitest';

// Apple Subscription Architecture task, Phase E.
const mockNativePurchases = {
  getProducts: vi.fn(),
  purchaseProduct: vi.fn(),
  restorePurchases: vi.fn(),
  manageSubscriptions: vi.fn(),
  addListener: vi.fn()
};
vi.mock('@capgo/native-purchases', () => ({
  NativePurchases: mockNativePurchases,
  PURCHASE_TYPE: { INAPP: 'inapp', SUBS: 'subs' }
}));

let nativeFlag = true;
let platformFlag = 'ios';
vi.mock('./platform', () => ({
  isNativePlatform: () => nativeFlag,
  isIOS: () => platformFlag === 'ios'
}));

const mod = await import('./applePurchaseAdapter');
const {
  APPLE_PRODUCT_IDS,
  isAppleIAPSupported,
  getAppleProducts,
  purchaseAppleProduct,
  restoreApplePurchases,
  openAppleManageSubscriptions,
  addAppleTransactionUpdateListener,
  resolveAppleProductDisplay
} = mod;

beforeEach(() => {
  nativeFlag = true;
  platformFlag = 'ios';
  vi.clearAllMocks();
});

describe('isAppleIAPSupported', () => {
  it('is true only when both native and iOS', () => {
    expect(isAppleIAPSupported()).toBe(true);
  });

  it('is false on web', () => {
    nativeFlag = false;
    expect(isAppleIAPSupported()).toBe(false);
  });

  it('is false on a native platform that is not iOS', () => {
    platformFlag = 'android';
    expect(isAppleIAPSupported()).toBe(false);
  });
});

describe('APPLE_PRODUCT_IDS', () => {
  it('matches the proposed identifiers from docs/apple-subscription-architecture.md', () => {
    expect(APPLE_PRODUCT_IDS).toEqual({
      monthly: 'com.zavaraai.wakewise.plus.monthly',
      annual: 'com.zavaraai.wakewise.plus.annual'
    });
  });
});

describe('resolveAppleProductDisplay', () => {
  const products = {
    [APPLE_PRODUCT_IDS.monthly]: { identifier: APPLE_PRODUCT_IDS.monthly, title: 'Monthly', priceString: 'A$7.99' },
    [APPLE_PRODUCT_IDS.annual]: { identifier: APPLE_PRODUCT_IDS.annual, title: 'Annual', priceString: 'A$59.99' }
  };

  it('resolves the monthly product id and its own localised price for interval "monthly"', () => {
    expect(resolveAppleProductDisplay('monthly', products)).toEqual({
      productId: APPLE_PRODUCT_IDS.monthly,
      priceString: 'A$7.99'
    });
  });

  it('resolves the annual product id and its own localised price for interval "yearly"', () => {
    expect(resolveAppleProductDisplay('yearly', products)).toEqual({
      productId: APPLE_PRODUCT_IDS.annual,
      priceString: 'A$59.99'
    });
  });

  it('never mixes up which product\'s price belongs to which interval', () => {
    const monthly = resolveAppleProductDisplay('monthly', products);
    const yearly = resolveAppleProductDisplay('yearly', products);
    expect(monthly.priceString).not.toBe(yearly.priceString);
    expect(monthly.productId).not.toBe(yearly.productId);
  });

  it('returns null (never a hardcoded fallback) when that product has not loaded yet', () => {
    expect(resolveAppleProductDisplay('monthly', {})).toEqual({
      productId: APPLE_PRODUCT_IDS.monthly,
      priceString: null
    });
    expect(resolveAppleProductDisplay('yearly', undefined)).toEqual({
      productId: APPLE_PRODUCT_IDS.annual,
      priceString: null
    });
  });
});

describe('getAppleProducts', () => {
  it('returns only allow-listed products, normalised to the fields this app displays', async () => {
    mockNativePurchases.getProducts.mockResolvedValue({
      products: [
        { identifier: APPLE_PRODUCT_IDS.monthly, title: 'WakeWise Plus (Monthly)', priceString: 'A$7.99', extraNativeField: 'ignored' },
        { identifier: 'com.zavaraai.wakewise.plus.annual', title: 'WakeWise Plus (Annual)', priceString: 'A$59.99' },
        { identifier: 'com.evil.unexpected.product', title: 'Should never appear', priceString: 'A$0.01' }
      ]
    });
    const products = await getAppleProducts();
    expect(Object.keys(products).sort()).toEqual([APPLE_PRODUCT_IDS.annual, APPLE_PRODUCT_IDS.monthly].sort());
    expect(products[APPLE_PRODUCT_IDS.monthly]).toEqual({
      identifier: APPLE_PRODUCT_IDS.monthly,
      title: 'WakeWise Plus (Monthly)',
      priceString: 'A$7.99'
    });
    // The allow-listed request only ever asks for known ids.
    const [{ productIdentifiers }] = mockNativePurchases.getProducts.mock.calls[0];
    expect(productIdentifiers.sort()).toEqual([APPLE_PRODUCT_IDS.annual, APPLE_PRODUCT_IDS.monthly].sort());
  });

  it('returns an empty map, never throws, if the native call fails', async () => {
    mockNativePurchases.getProducts.mockRejectedValue(new Error('boom'));
    await expect(getAppleProducts()).resolves.toEqual({});
  });

  it('returns an empty map on web without calling the plugin', async () => {
    nativeFlag = false;
    await expect(getAppleProducts()).resolves.toEqual({});
    expect(mockNativePurchases.getProducts).not.toHaveBeenCalled();
  });
});

describe('purchaseAppleProduct', () => {
  it('rejects a product id outside the allow-list before ever calling the plugin', async () => {
    const result = await purchaseAppleProduct('com.attacker.free-access');
    expect(result).toEqual({ outcome: 'unavailable' });
    expect(mockNativePurchases.purchaseProduct).not.toHaveBeenCalled();
  });

  it('returns a purchased outcome with only the non-sensitive fields on success', async () => {
    mockNativePurchases.purchaseProduct.mockResolvedValue({
      transactionId: '2000001043762129',
      productIdentifier: APPLE_PRODUCT_IDS.monthly,
      jwsRepresentation: 'header.payload.signature',
      receipt: 'legacy-receipt-should-not-leak-through',
      appAccountToken: 'should-not-be-echoed-back'
    });
    const result = await purchaseAppleProduct(APPLE_PRODUCT_IDS.monthly, { appAccountToken: 'user-uuid' });
    expect(result).toEqual({
      outcome: 'purchased',
      transactionId: '2000001043762129',
      productIdentifier: APPLE_PRODUCT_IDS.monthly,
      jwsRepresentation: 'header.payload.signature'
    });
    expect(result).not.toHaveProperty('receipt');
    expect(result).not.toHaveProperty('appAccountToken');
  });

  it('passes appAccountToken through to the plugin call', async () => {
    mockNativePurchases.purchaseProduct.mockResolvedValue({ transactionId: '1', productIdentifier: APPLE_PRODUCT_IDS.monthly });
    await purchaseAppleProduct(APPLE_PRODUCT_IDS.monthly, { appAccountToken: 'user-uuid-123' });
    const [{ appAccountToken }] = mockNativePurchases.purchaseProduct.mock.calls[0];
    expect(appAccountToken).toBe('user-uuid-123');
  });

  it('reports a user cancellation as "cancelled", not "failed"', async () => {
    const error = new Error('User cancelled the purchase flow');
    error.code = 'userCancelled';
    mockNativePurchases.purchaseProduct.mockRejectedValue(error);
    await expect(purchaseAppleProduct(APPLE_PRODUCT_IDS.monthly)).resolves.toEqual({ outcome: 'cancelled' });
  });

  it('reports a genuine failure as "failed" with a plain message, never throwing', async () => {
    mockNativePurchases.purchaseProduct.mockRejectedValue(new Error('Network unavailable'));
    await expect(purchaseAppleProduct(APPLE_PRODUCT_IDS.monthly)).resolves.toEqual({
      outcome: 'failed',
      message: 'Network unavailable'
    });
  });

  it('reports unavailable on web without calling the plugin', async () => {
    nativeFlag = false;
    await expect(purchaseAppleProduct(APPLE_PRODUCT_IDS.monthly)).resolves.toEqual({ outcome: 'unavailable' });
    expect(mockNativePurchases.purchaseProduct).not.toHaveBeenCalled();
  });
});

describe('restoreApplePurchases', () => {
  it('reports restored on success', async () => {
    mockNativePurchases.restorePurchases.mockResolvedValue(undefined);
    await expect(restoreApplePurchases()).resolves.toEqual({ outcome: 'restored' });
  });

  it('reports failed, never throws, on native failure', async () => {
    mockNativePurchases.restorePurchases.mockRejectedValue(new Error('boom'));
    await expect(restoreApplePurchases()).resolves.toEqual({ outcome: 'failed', message: 'boom' });
  });

  it('reports unavailable on web without calling the plugin', async () => {
    nativeFlag = false;
    await expect(restoreApplePurchases()).resolves.toEqual({ outcome: 'unavailable' });
    expect(mockNativePurchases.restorePurchases).not.toHaveBeenCalled();
  });
});

describe('openAppleManageSubscriptions', () => {
  it('reports opened on success', async () => {
    mockNativePurchases.manageSubscriptions.mockResolvedValue(undefined);
    await expect(openAppleManageSubscriptions()).resolves.toEqual({ outcome: 'opened' });
  });

  it('reports unavailable on web without calling the plugin', async () => {
    nativeFlag = false;
    await expect(openAppleManageSubscriptions()).resolves.toEqual({ outcome: 'unavailable' });
    expect(mockNativePurchases.manageSubscriptions).not.toHaveBeenCalled();
  });
});

describe('addAppleTransactionUpdateListener', () => {
  it('registers a listener and only forwards allow-listed, non-sensitive updates', async () => {
    let capturedCallback;
    mockNativePurchases.addListener.mockImplementation((eventName, cb) => {
      capturedCallback = cb;
      return Promise.resolve({ remove: vi.fn() });
    });

    const received = [];
    addAppleTransactionUpdateListener((result) => received.push(result));
    expect(mockNativePurchases.addListener).toHaveBeenCalledWith('transactionUpdated', expect.any(Function));

    capturedCallback({
      transactionId: 't1',
      productIdentifier: APPLE_PRODUCT_IDS.annual,
      jwsRepresentation: 'jws',
      receipt: 'should-not-leak'
    });
    capturedCallback({ transactionId: 't2', productIdentifier: 'com.unexpected.product' });

    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({
      outcome: 'purchased',
      transactionId: 't1',
      productIdentifier: APPLE_PRODUCT_IDS.annual,
      jwsRepresentation: 'jws'
    });
  });

  it('returns a no-op cleanup and never registers on web', () => {
    nativeFlag = false;
    const cleanup = addAppleTransactionUpdateListener(() => {});
    expect(mockNativePurchases.addListener).not.toHaveBeenCalled();
    expect(() => cleanup()).not.toThrow();
  });
});
