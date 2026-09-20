/* global process */
import { describe, it, expect, afterEach, vi } from 'vitest';

const CONFIG_PATH = '../../capacitor.config.ts';
const originalEnv = process.env.CAPACITOR_WEB_DEBUG;

describe('capacitor.config.ts — release-build WebView debugging guard', () => {
  afterEach(() => {
    if (originalEnv === undefined) delete process.env.CAPACITOR_WEB_DEBUG;
    else process.env.CAPACITOR_WEB_DEBUG = originalEnv;
    vi.resetModules();
  });

  it('defaults webContentsDebuggingEnabled to false when CAPACITOR_WEB_DEBUG is unset - the state every CI/TestFlight build gets, since nothing there sets it', async () => {
    delete process.env.CAPACITOR_WEB_DEBUG;
    vi.resetModules();
    const { default: config } = await import(CONFIG_PATH);
    expect(config.ios.webContentsDebuggingEnabled).toBe(false);
  });

  it('enables webContentsDebuggingEnabled only via an explicit CAPACITOR_WEB_DEBUG=true opt-in, for local Xcode/device debugging', async () => {
    process.env.CAPACITOR_WEB_DEBUG = 'true';
    vi.resetModules();
    const { default: config } = await import(CONFIG_PATH);
    expect(config.ios.webContentsDebuggingEnabled).toBe(true);
  });

  it('never enables it for any value other than the exact string "true" - guards against an accidental truthy-looking env value silently enabling it', async () => {
    process.env.CAPACITOR_WEB_DEBUG = '1';
    vi.resetModules();
    const { default: config } = await import(CONFIG_PATH);
    expect(config.ios.webContentsDebuggingEnabled).toBe(false);
  });
});
