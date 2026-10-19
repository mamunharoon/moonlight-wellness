/*
 * WakeWise — Beta Program hub, retired.
 *
 * The in-app Settings entry point to this page was removed (see
 * Settings.jsx's own comment at that section). This route (`/beta`) is
 * still registered in App.jsx — removing it there would be a routing
 * change beyond this task's scope — but is no longer publicly reachable
 * in any practical sense: it renders nothing but this stub, for every
 * caller, regardless of how the URL is reached (in-app link, a bookmark,
 * or typed directly). Same established pattern as
 * SubscriptionSandboxTest.jsx's own "Not available in this build." stub,
 * just unconditional here rather than flag-gated — this page's public
 * reachability is being removed outright, not toggled by a build-time
 * flag that still defaults to visible.
 *
 * Nothing this page used to read or write is touched by this change:
 * profiles.beta_access tester records are untouched (a later authorised
 * surface — the Admin Foundation's own admin_set_beta_access/AdminUsers.jsx
 * path, or a future properly-gated DEV diagnostic — can still read/act on
 * them without this page existing). BetaChecklist.jsx, betaAccess.js's
 * fetchOwnBetaAccess, and BETA_VIDEO_MANIFEST are left in place,
 * deliberately not deleted, even though this was their one caller for
 * fetchOwnBetaAccess/BetaChecklist specifically — BETA_VIDEO_MANIFEST
 * itself is still used elsewhere (mediaCatalog.js,
 * backgroundMusicSelection.js) and must not be touched.
 */
export const Beta = () => <div style={{ padding: 16 }}>Not available in this build.</div>;
