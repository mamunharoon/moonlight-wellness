#!/usr/bin/env node
// WakeWise — real MP4 fast-start (moov-before-mdat) verification.
//
// WHY THIS SCRIPT EXISTS (read this before touching fastStartMapping.test.js):
// the offline unit test suite (src/lib/fastStartMapping.test.js) can only
// ever check the FILENAME string ends in "_faststart.mp4" - that check
// caught nothing when a batch of newly-uploaded SL01-SL10 objects turned
// out to have `moov` at ~99% of the file despite carrying that exact
// filename marker (see the SL01-SL10 Storage audit). A filename has never
// proven anything about real MP4 box order, and no automated offline test
// ever should claim it does - see fastStartMapping.test.js's own
// "filename suffix alone never proves fast-start" test for the assertion
// that keeps this honest.
//
// This script is the actual proof: it downloads a small initial byte range
// of each real Storage object (not the whole file) via a short-lived
// signed URL, and checks two things directly:
//   1. `moov` appears inside that initial range at all (a broken file has
//      it at ~99% of the object, never in the first couple of MB);
//   2. ffprobe can read a real `duration` from just that partial range
//      (this is the actual thing that matters - can a player start
//      progressive playback without the whole file?).
//
// DELIBERATELY NOT part of `npm test`: it needs real network access to a
// live Supabase project and a service-role key, neither of which belong in
// an offline, deterministic, CI-safe unit test run. Run it by hand (or in
// a delivery/release checklist step) whenever new "fast-start" media is
// registered - see the README usage note below.
//
// USAGE:
//   SUPABASE_URL=https://<ref>.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key, never committed> \
//   node scripts/verify-faststart.mjs [id1 id2 ...]
//
// With no ids given, verifies every SL-prefixed id in betaVideoManifest.js
// (the set this script was written for). Pass explicit ids to check any
// other subset (e.g. `node scripts/verify-faststart.mjs IM01 IM02`).
//
// Exits non-zero if any id fails either check, so it can be wired into a
// manual release checklist or an opt-in CI job without being part of the
// default fast/offline suite.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, unlink, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BETA_VIDEO_MANIFEST } from '../src/lib/betaVideoManifest.js';

const execFileAsync = promisify(execFile);

const BUCKET = 'wellness-videos';
const PARTIAL_RANGE_BYTES = 2 * 1024 * 1024; // 2MB - generous for a moov box this app's media ever produces
const SIGNED_URL_TTL_SECONDS = 120;

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (never hardcode them here or commit them).');
  process.exit(2);
}

const requestedIds = process.argv.slice(2);
const targetIds = requestedIds.length > 0 ? requestedIds : BETA_VIDEO_MANIFEST.filter((e) => e.id.startsWith('SL')).map((e) => e.id);

const getPath = (id) => {
  const entry = BETA_VIDEO_MANIFEST.find((e) => e.id === id);
  if (!entry) throw new Error(`Unknown id in betaVideoManifest.js: ${id}`);
  return entry.storagePath;
};

const signUrl = async (path) => {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS })
  });
  if (!res.ok) throw new Error(`sign failed (${res.status}): ${await res.text()}`);
  const { signedURL } = await res.json();
  if (!signedURL) throw new Error('sign response had no signedURL');
  return `${supabaseUrl}/storage/v1${signedURL}`;
};

const fetchPartialRange = async (url) => {
  const res = await fetch(url, { headers: { Range: `bytes=0-${PARTIAL_RANGE_BYTES - 1}` } });
  if (!res.ok && res.status !== 206) throw new Error(`range fetch failed (${res.status})`);
  return Buffer.from(await res.arrayBuffer());
};

const findBoxOffset = (buf, tag) => buf.indexOf(Buffer.from(tag, 'ascii'));

const verifyOne = async (id) => {
  const path = getPath(id);
  const url = await signUrl(path);
  const partial = await fetchPartialRange(url);

  const ftypOffset = findBoxOffset(partial, 'ftyp');
  const moovOffset = findBoxOffset(partial, 'moov');
  const mdatOffset = findBoxOffset(partial, 'mdat');

  const moovFoundEarly = moovOffset !== -1;
  // A genuinely fast-start file has moov appear before mdat within this
  // same early buffer; if mdat also appears early (right after ftyp, as
  // this app's media always does) but moov never shows up in the same
  // range, that's the exact broken pattern this script exists to catch.
  const orderOk = moovFoundEarly && (mdatOffset === -1 || moovOffset < mdatOffset);

  let partialDuration = null;
  let ffprobeError = null;
  const tmpDir = await mkdtemp(join(tmpdir(), 'wakewise-faststart-'));
  const tmpFile = join(tmpDir, `${id}.mp4`);
  try {
    await writeFile(tmpFile, partial);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      tmpFile
    ]);
    const parsed = parseFloat(stdout.trim());
    partialDuration = Number.isFinite(parsed) ? parsed : null;
  } catch (err) {
    ffprobeError = err.message;
  } finally {
    await unlink(tmpFile).catch(() => {});
  }

  const pass = orderOk && partialDuration !== null;
  return {
    id,
    path,
    ftypOffset,
    moovOffset,
    mdatOffset,
    orderOk,
    partialDuration,
    ffprobeError,
    pass
  };
};

const main = async () => {
  console.log(`Verifying real fast-start (moov-before-mdat) box order for: ${targetIds.join(', ')}\n`);
  const results = [];
  for (const id of targetIds) {
    try {
      results.push(await verifyOne(id));
    } catch (err) {
      results.push({ id, pass: false, error: err.message });
    }
  }

  for (const r of results) {
    if (r.error) {
      console.log(`FAIL  ${r.id}  ERROR: ${r.error}`);
      continue;
    }
    const status = r.pass ? 'PASS' : 'FAIL';
    console.log(
      `${status}  ${r.id}  ${r.path}\n` +
        `      ftyp@${r.ftypOffset} moov@${r.moovOffset} mdat@${r.mdatOffset}  ` +
        `moov-before-mdat=${r.orderOk}  partial-duration=${r.partialDuration ?? 'unreadable'}${r.ffprobeError ? `  ffprobe-error=${r.ffprobeError}` : ''}`
    );
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed.`);
  if (failed.length > 0) {
    console.error(`FAILED: ${failed.map((r) => r.id).join(', ')}`);
    process.exit(1);
  }
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
