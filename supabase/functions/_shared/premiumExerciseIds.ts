// Phase 2C — Free vs. WakeWise Plus Access Specification
// (docs/phase-2c-access-specification.md §3) — the server's own
// independently-declared copy of which exercise ids are Free. Mirrors
// src/lib/mediaCatalog.js's FREE_EXERCISE_IDS exactly, but kept as a
// separate, independently-declared constant here rather than imported
// across the Deno/Vite boundary — the same established convention this
// project already uses for KNOWN_APPLE_PLUS_PRODUCT_IDS (see
// planMapping.ts's own comment on this) — so the real authorization
// boundary (get-beta-video-url) can never be silently widened by a
// change to the client-side catalogue file alone.
// mediaCatalogPremiumClassification.test.js asserts the two sets stay
// identical.
//
// Every id NOT in this set, and not one of §3a's six out-of-scope ids
// (I01/I02/IB01/IS01/IM01/IM02 — guest/sign-in rules only, never
// Plus-gated, see betaVideoUrlAccess.ts's own GUEST_ALLOWED_IDS and
// EXERCISE_PATHS in get-beta-video-url/index.ts), is Plus.
export const FREE_EXERCISE_IDS: ReadonlySet<string> = new Set([
  'S04', 'S05', 'S01', 'E03', 'E04', 'E11', 'E23', 'E30', 'B02',
  'M01', 'M02', 'M03', 'M04', 'F01', 'SL01', 'SL04', 'SL06', 'G01', 'A02'
]);

// Still cover images for M06/S06-S09 (mediaCatalog.js's own
// INTERACTIVE_ONLY_IDS already excludes these five client-side, for the
// identical reason: a non-narrated, non-selectable PNG sidecar fetched
// automatically alongside its parent audio entry via that entry's own
// `coverId` field — see betaVideoManifest.js and BetaVideoModal.jsx/
// AnytimeStretch.jsx's own coverId-driven requestBetaVideoUrl calls —
// never tapped directly by a user, never a Library row, never
// independently narrated/paid content. Found as a real server-side gap
// in this round's review: without this exclusion, isPremiumExerciseId's
// own "every id not in the Free set is Plus" rule would silently
// classify a cover as an independent paid activity, requiring a Plus
// check for a static image regardless of its parent's own
// classification (so a cover could still 403 even if its parent were
// ever classified Free) — exactly the "treated as an independent paid
// activity" failure mode this phase's own review explicitly ruled out.
// A cover's access must always mirror "harmless preview asset," the same
// treatment GUEST_ALLOWED_IDS's own header already gives IB01/IS01/IM01/
// IM02 ("not standalone narrated content... no protected/paid content
// behind them") — never re-derived from its parent's premium flag
// (there is no parent-lookup mechanism here, and building one would be
// more machinery than a static image warrants). This exclusion is
// independent of, and must not be confused with, §3/this file's own
// (now owner-approved) M06/S06-S09 PARENT classification below — a
// cover's Free-ness is never derived from its parent's, in either
// direction.
export const PREVIEW_ONLY_COVER_IDS: ReadonlySet<string> = new Set(['M06COVER', 'S06COVER', 'S07COVER', 'S08COVER', 'S09COVER']);

// M06 (Mindful Listening) and S06-S09 (Anytime Stretch: Chest & Shoulder/
// Hands & Wrists/Feet & Ankles/Gentle Side) were added to the live
// catalogue (`2026-10-05 stretching content refresh` / the Library
// expansion that made them Library-browsable, see betaVideoManifest.js's
// own comments on both) AFTER this specification's own baseline commit
// (ecef8bf..., see docs/phase-2c-access-specification.md's header) and
// were never classified in §3b/§3c's original tables — a genuine gap in
// the original spec, not an oversight in this code. APPROVED Plus
// classification for these five (§11a-i, owner-confirmed — see the spec
// doc's own addendum for the full reasoning). Deliberately NOT added to
// FREE_EXERCISE_IDS above: every id not listed there already defaults to
// Plus via isPremiumExerciseId's own rule below, so this comment exists
// purely to make that default explicit and traceable for these five
// specifically, rather than leaving them an invisible, undocumented side
// effect of "not in the Free list." Approval changes nothing about
// runtime behaviour — these five already resolved Plus before this
// decision; this only removes the "pending" label.
export const APPROVED_PLUS_IDS: ReadonlySet<string> = new Set(['M06', 'S06', 'S07', 'S08', 'S09']);

// Usage contract (enforced by the caller, not this function): only ever
// call this for an exerciseId that has ALREADY been confirmed (a) to
// resolve to a real path via the caller's own fixed id→path map, and (b)
// NOT to be one of GUEST_ALLOWED_IDS (betaVideoUrlAccess.ts) — those six
// §3a ids are out of scope for this specification entirely, never
// classified Plus by this function, and must be excluded by the caller
// BEFORE this check runs (see resolveBetaVideoUrlRequest's own
// `guestAllowed` ordering). Given that contract, every other known
// exercise id is Plus unless it's one of the 19 approved Free ids above,
// or one of the five preview-only cover ids above — a plain `false`
// here is never itself the thing standing between a caller and an
// unknown/unresolved id; resolvePath's own 404 already is.
export const isPremiumExerciseId = (exerciseId: unknown): boolean =>
  typeof exerciseId === 'string' && !FREE_EXERCISE_IDS.has(exerciseId) && !PREVIEW_ONLY_COVER_IDS.has(exerciseId);
