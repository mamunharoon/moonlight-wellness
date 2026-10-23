// Native TestFlight signup failure ("You appear to be offline" shown while
// the device's own internet worked) — root-caused to index.html's/
// vercel.json's CSP connect-src only ever allowlisting the DEV Supabase
// host. A production-configured build's fetch() to wqpszprbuqdjcfmdqdlv
// was blocked by the WebView's own CSP before the request ever left the
// device, which supabase-js reports as AuthRetryableFetchError -
// authErrorMessages.js's own isNetworkFailure() maps that straight to the
// offline message, regardless of real connectivity. Production's own
// auth.audit_log_entries had zero rows in the prior 7 days, consistent
// with the request never reaching the server at all.
//
// Source-level checks only (this repo's Vitest has no DOM/network
// capability - see libraryCategoryNavigation.test.js's own header comment
// for the established precedent) - reads the real index.html/vercel.json
// content, never a copy, so a future edit to either file is caught here
// too.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = (relativePath) => fileURLToPath(new URL(`../../${relativePath}`, import.meta.url));

const DEV_HTTPS = 'https://kvdxuhyndevrfvsalgnx.supabase.co';
const DEV_WSS = 'wss://kvdxuhyndevrfvsalgnx.supabase.co';
const PROD_HTTPS = 'https://wqpszprbuqdjcfmdqdlv.supabase.co';
const PROD_WSS = 'wss://wqpszprbuqdjcfmdqdlv.supabase.co';

const extractIndexHtmlCsp = () => {
  const html = readFileSync(repoRoot('index.html'), 'utf-8');
  const match = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
  if (!match) throw new Error('index.html has no Content-Security-Policy <meta> tag');
  return match[1];
};

const extractVercelJsonCsp = () => {
  const config = JSON.parse(readFileSync(repoRoot('vercel.json'), 'utf-8'));
  const headerBlock = config.headers.find((h) => h.source === '/(.*)');
  const cspHeader = headerBlock.headers.find((h) => h.key === 'Content-Security-Policy');
  if (!cspHeader) throw new Error('vercel.json has no Content-Security-Policy header');
  return cspHeader.value;
};

// Splits "directive src1 src2 ..." entries into a { directiveName: [sources] }
// map - robust to the exact source ordering within a directive, which the
// fix above deliberately does not need to preserve beyond "both the DEV
// and production hosts are present".
const parseDirectives = (csp) => {
  const map = {};
  for (const part of csp.split(';').map((s) => s.trim()).filter(Boolean)) {
    const [name, ...sources] = part.split(/\s+/);
    map[name] = sources;
  }
  return map;
};

describe('CSP — index.html (native) and vercel.json (web) stay byte-identical', () => {
  it('the two policies are exactly the same string', () => {
    expect(extractIndexHtmlCsp()).toBe(extractVercelJsonCsp());
  });
});

describe.each([
  ['index.html', extractIndexHtmlCsp],
  ['vercel.json', extractVercelJsonCsp],
])('CSP — %s', (_label, getCsp) => {
  const directives = () => parseDirectives(getCsp());

  it('connect-src allows both DEV and production Supabase over https and wss', () => {
    const sources = directives()['connect-src'];
    expect(sources).toContain(DEV_HTTPS);
    expect(sources).toContain(DEV_WSS);
    expect(sources).toContain(PROD_HTTPS);
    expect(sources).toContain(PROD_WSS);
  });

  it('img-src allows both DEV and production Supabase (signed media/avatar URLs)', () => {
    const sources = directives()['img-src'];
    expect(sources).toContain(DEV_HTTPS);
    expect(sources).toContain(PROD_HTTPS);
  });

  it('media-src allows both DEV and production Supabase (signed video/audio URLs)', () => {
    const sources = directives()['media-src'];
    expect(sources).toContain(DEV_HTTPS);
    expect(sources).toContain(PROD_HTTPS);
  });

  it('introduces no wildcard source anywhere in the policy', () => {
    expect(getCsp()).not.toMatch(/[\s:]\*/);
  });

  it('preserves every other pre-existing restriction unchanged', () => {
    const d = directives();
    expect(d['default-src']).toEqual(["'self'"]);
    expect(d['script-src']).toEqual(["'self'", 'https://vercel.live']);
    expect(d['style-src']).toEqual(["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com']);
    expect(d['font-src']).toEqual(["'self'", 'https://fonts.gstatic.com']);
    expect(d['frame-src']).toEqual(['https://vercel.live']);
    expect(d['frame-ancestors']).toEqual(["'none'"]);
    expect(d['base-uri']).toEqual(["'self'"]);
    expect(d['form-action']).toEqual(["'self'"]);
    expect(d['object-src']).toEqual(["'none'"]);
  });

  it('connect-src keeps its pre-existing non-Supabase sources (vercel.live, Pusher)', () => {
    const sources = directives()['connect-src'];
    expect(sources).toContain('https://vercel.live');
    expect(sources).toContain('wss://ws-us3.pusher.com');
  });
});
