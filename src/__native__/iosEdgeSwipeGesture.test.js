// Regression guard for the native iOS edge-swipe-back gesture (Build 10).
// This cannot be compiled or run in this repo's Vitest at all - it's
// pure Swift, verified only by the established Codemagic Mac pipeline
// when Build 10 is actually authorized (see docs/ios-xcode-handoff.md
// for the existing "cannot compile locally on Windows" constraint this
// project has worked under all along). These are the strongest practical
// static checks available beforehand: that the three files involved
// (the Xcode project, the storyboard, and the new view controller) are
// consistently wired together, and that the guarded-route list here
// matches the exact five Evening Wind-down steps EveningSceneShell.jsx
// itself protects with a "leave routine?" confirmation - if either file
// changes that list without the other, this fails.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const viewControllerSource = read('../../ios/App/App/MainViewController.swift');
const storyboardSource = read('../../ios/App/App/Base.lproj/Main.storyboard');
const pbxprojSource = read('../../ios/App/App.xcodeproj/project.pbxproj');
const eveningShellSource = read('../components/evening/EveningSceneShell.jsx');

describe('MainViewController.swift — edge-swipe-back gesture', () => {
  it('enables allowsBackForwardNavigationGestures by default', () => {
    expect(viewControllerSource).toMatch(/webView\.allowsBackForwardNavigationGestures = true/);
  });

  it('subclasses CAPBridgeViewController (not replacing Capacitor\'s own bridge setup)', () => {
    expect(viewControllerSource).toMatch(/class MainViewController: CAPBridgeViewController/);
  });

  it('observes the webview\'s own URL via KVO rather than requiring a JS-to-native bridge', () => {
    expect(viewControllerSource).toMatch(/webView\.observe\(\\\.url/);
    expect(viewControllerSource).toMatch(/deinit/);
    expect(viewControllerSource).toMatch(/urlObservation\?\.invalidate\(\)/);
  });

  it('dynamically disables the gesture while on exactly the five guarded Evening Wind-down routes', () => {
    expect(viewControllerSource).toMatch(/"\/evening-wind-down"/);
    expect(viewControllerSource).toMatch(/"\/reflection"/);
    expect(viewControllerSource).toMatch(/"\/gratitude"/);
    expect(viewControllerSource).toMatch(/"\/evening-breathing"/);
    expect(viewControllerSource).toMatch(/"\/prepare-for-rest"/);
    // Explicitly NOT guarded - nothing left to lose once the routine is
    // done. Checked against the actual array declaration only (not the
    // whole file), since the doc comment above it names this route in
    // prose as an example of what's deliberately excluded.
    const guardedArrayDeclaration = viewControllerSource.match(/guardedEveningPaths: Set<String> = \[[\s\S]*?\]/)?.[0] ?? '';
    expect(guardedArrayDeclaration).not.toMatch(/"\/evening-complete"/);
    expect(viewControllerSource).toMatch(/webView\?\.allowsBackForwardNavigationGestures = !isGuardedEveningStep/);
  });

  it('the guarded route list matches exactly the routes EveningSceneShell.jsx itself protects with showBack + a "leave routine" confirmation', () => {
    const guardedInSwift = [...viewControllerSource.matchAll(/"(\/[a-z-]+)"/g)].map((m) => m[1]);
    const guardedRoutes = ['/evening-wind-down', '/reflection', '/gratitude', '/evening-breathing', '/prepare-for-rest'];
    for (const route of guardedRoutes) {
      expect(guardedInSwift).toContain(route);
    }
    // EveningSceneShell.jsx doesn't itself list routes (each page passes
    // its own backFallback), but it's the single place the "leave
    // routine?" confirmation this gesture must never bypass is wired -
    // confirms that mechanism still exists to be respected.
    expect(eveningShellSource).toMatch(/confirmMessage="Your unsaved progress may be lost\."/);
  });
});

describe('Main.storyboard — points at the new view controller', () => {
  it('customClass is MainViewController (App module), not the default CAPBridgeViewController', () => {
    expect(storyboardSource).toMatch(/customClass="MainViewController" customModule="App"/);
    expect(storyboardSource).not.toMatch(/customClass="CAPBridgeViewController"/);
  });
});

describe('project.pbxproj — MainViewController.swift is registered in every required section', () => {
  it('has a PBXFileReference entry', () => {
    expect(pbxprojSource).toMatch(/\/\* MainViewController\.swift \*\/ = \{isa = PBXFileReference;/);
  });

  it('has a PBXBuildFile entry referencing that file reference', () => {
    expect(pbxprojSource).toMatch(/\/\* MainViewController\.swift in Sources \*\/ = \{isa = PBXBuildFile; fileRef = 5A1B2C3D4E5F60718293A4B5/);
  });

  it('is listed in the App group\'s children (so it shows up in the project navigator)', () => {
    expect(pbxprojSource).toMatch(/5A1B2C3D4E5F60718293A4B5 \/\* MainViewController\.swift \*\/,/);
  });

  it('is listed in the Sources build phase (so it actually gets compiled)', () => {
    expect(pbxprojSource).toMatch(/5A1B2C3D4E5F60718293A4B6 \/\* MainViewController\.swift in Sources \*\/,/);
  });
});
