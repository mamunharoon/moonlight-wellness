// WakeWise — native iOS background-audio configuration (Sleep
// Soundscapes, investigated/implemented 2026-10-20). No Vitest/DOM
// environment can execute Swift or parse a real .plist, so - matching
// every other regression guard in this codebase for native config this
// repo can't otherwise exercise - these are source-text checks against
// the real, shipped files, not a build or compile check. Confirms the
// two files this fix touches, and nothing else, carry the intended
// change.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const infoPlistSource = read('../../ios/App/App/Info.plist');
const appDelegateSource = read('../../ios/App/App/AppDelegate.swift');

describe('ios/App/App/Info.plist — UIBackgroundModes declares audio', () => {
  it('declares the UIBackgroundModes key with an audio entry - required for playback to persist once the device locks', () => {
    const block = infoPlistSource.match(/<key>UIBackgroundModes<\/key>\s*\n\s*<array>[\s\S]*?<\/array>/)?.[0] ?? '';
    expect(block).not.toBe('');
    expect(block).toMatch(/<string>audio<\/string>/);
  });

  it('is still well-formed: exactly one plist/dict root pair, balanced array tags', () => {
    const count = (tag) => ({
      open: (infoPlistSource.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g')) ?? []).length,
      close: (infoPlistSource.match(new RegExp(`</${tag}>`, 'g')) ?? []).length
    });
    expect(count('plist')).toEqual({ open: 1, close: 1 });
    expect(count('dict')).toEqual({ open: 2, close: 2 });
    const arrayCount = count('array');
    expect(arrayCount.open).toBe(arrayCount.close);
    expect(infoPlistSource.trim().endsWith('</plist>')).toBe(true);
  });
});

describe('ios/App/App/AppDelegate.swift — AVAudioSession category set once at launch', () => {
  it('imports AVFoundation', () => {
    expect(appDelegateSource).toMatch(/import AVFoundation/);
  });

  it('sets the category to .playback inside didFinishLaunchingWithOptions, before returning true', () => {
    const body = appDelegateSource.match(/func application\(_ application: UIApplication, didFinishLaunchingWithOptions[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(body).not.toBe('');
    const categoryIndex = body.indexOf('AVAudioSession.sharedInstance().setCategory(.playback');
    const returnIndex = body.lastIndexOf('return true');
    expect(categoryIndex).toBeGreaterThan(-1);
    expect(returnIndex).toBeGreaterThan(categoryIndex);
  });

  it('never CALLS setActive (the comment explaining why it is deliberately omitted is fine and expected) - the smallest correction claims only the category, never session activation lifecycle (a documented source of a separate activation-timing failure)', () => {
    expect(appDelegateSource).not.toMatch(/\.setActive\(/);
  });

  it('failure is caught and logged, never fatal - a missing category falls back to the pre-existing (no background audio) behaviour, not a crash', () => {
    const body = appDelegateSource.match(/func application\(_ application: UIApplication, didFinishLaunchingWithOptions[\s\S]*?\n {4}\}/)?.[0] ?? '';
    expect(body).toMatch(/do \{\s*\n\s*try AVAudioSession\.sharedInstance\(\)\.setCategory\(\.playback, mode: \.default, options: \[\]\)\s*\n\s*\} catch \{/);
  });

  it('every other AppDelegate lifecycle method is byte-for-byte unchanged - only didFinishLaunchingWithOptions was touched', () => {
    expect(appDelegateSource).toMatch(/func applicationWillResignActive\(_ application: UIApplication\) \{\s*\n\s*\/\/ Sent when the application is about to move from active to inactive state/);
    expect(appDelegateSource).toMatch(/func applicationDidEnterBackground\(_ application: UIApplication\) \{\s*\n\s*\/\/ Use this method to release shared resources/);
    expect(appDelegateSource).toMatch(/func applicationWillEnterForeground\(_ application: UIApplication\) \{\s*\n\s*\/\/ Called as part of the transition from the background/);
    expect(appDelegateSource).toMatch(/func applicationDidBecomeActive\(_ application: UIApplication\) \{\s*\n\s*\/\/ Restart any tasks that were paused/);
  });
});
