# Fast Start pilot — controlled comparison

**Status: approved for controlled DEV deployment and physical-device testing; full-catalogue conversion still not decided.** This documents a 3-file, DEV-only
experiment testing whether losslessly remuxing WakeWise videos to put the
MP4 `moov` atom before `mdat` ("Fast Start") measurably improves startup
time, before any decision to convert the rest of the catalogue or to
evaluate HLS. Full evidence and measurements are in the pilot report
delivered alongside this commit-free change set — this file is a pointer
for anyone reading the code, not a duplicate of that report.

## What exists because of this pilot

All of the below is new/additive. Nothing in the live playback path
(`get-beta-video-url`, `EXERCISE_PATHS`, `BetaVideoModal.jsx`,
`betaVideoAccess.js`) was touched.

- **New Storage objects** (DEV project `kvdxuhyndevrfvsalgnx`, bucket
  `wellness-videos`, path prefix `pilot-faststart/`): three remuxed
  copies of `WW_I01_WelcomeToWakeWise_v1.mp4`,
  `WW_A01_Confidence_v1.mp4.mp4`, and `WW_SL01_Rain_v1.mp4`. Originals are
  untouched — verified byte-identical (etag/size) before and after.
- **`supabase/functions/get-pilot-video-url/index.ts`** — a separate Edge
  Function, deployed to DEV project `kvdxuhyndevrfvsalgnx` only. Signs a
  short-lived (3 min) URL for exactly
  six hardcoded paths (the three originals above + their pilot copies).
  Requires a signed-in, non-anonymous, server-verified admin
  (`is_admin()` RPC — the same one `AdminRoute.jsx` already trusts).
- **`src/lib/pilotVideoAccess.js`** — thin client wrapper around that
  function, sibling to `betaVideoAccess.js`.
- **`src/pages/FastStartPilot.jsx`** — comparison UI at
  `/admin/faststart-pilot` (nested under the existing `AdminRoute` guard,
  no nav link). Lists the three pairs, each with an "Original" and a
  "Fast Start pilot" button; one player open at a time; a user-gesture
  "Begin" gate and pause/release cleanup on close, matching
  `BetaVideoModal.jsx`'s own contract without reusing that component
  directly (kept isolated so this pilot can never add risk to the real
  playback path).
- One `<Route>` line and one `lazy()` import added to `src/App.jsx`
  inside the existing `admin` route block.

## To remove this pilot entirely

1. Delete `supabase/functions/get-pilot-video-url/` (if ever deployed,
   also run `supabase functions delete get-pilot-video-url --project-ref
   kvdxuhyndevrfvsalgnx`).
2. Delete `src/pages/FastStartPilot.jsx` and `src/lib/pilotVideoAccess.js`.
3. Remove the one `lazy()` import and one `<Route path="faststart-pilot">`
   line from `src/App.jsx`.
4. Delete the three `pilot-faststart/*` objects from Storage (originals
   are never touched by this cleanup).
5. Delete this file.

## To move forward instead

See the full pilot report's rollback/full-catalogue-conversion plan. In
short: nothing here should be deployed or the pilot objects treated as
permanent until that plan is explicitly approved.
