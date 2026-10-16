// get-beta-video-url's auth-decision core, extracted as a pure, dependency-
// injected module (no Deno global, no `npm:` import) purely so it can be
// imported and genuinely executed by this repo's Vitest suite - same
// pattern entitlementResolution.ts already establishes for its own edge
// function. get-beta-video-url/index.ts is the only real caller in
// production; it supplies real `verifyUser`/`signUrl`/`resolvePath`/
// `checkPremiumAccess` implementations backed by Supabase Auth, the
// service-role Storage client, and the service-role DB read
// (entitlementRecords.ts). Tests supply fakes and assert on the returned
// `{ status, body }` shape - genuine behavioural coverage of the actual
// auth/allowlist/premium branching, not a source-text regex guess at it.
import { isPremiumExerciseId } from './premiumExerciseIds.ts';
import { isAuthorizedForPremiumAccess } from './entitlementResolution.ts';

// Guest-accessible media — a narrow, explicit, server-side exception to
// the sign-in/non-anonymous requirement every other id in EXERCISE_PATHS
// still enforces, approved as a deliberate product decision (not a
// default posture) for each id individually, never by analogy. This does
// NOT relax anything else: every other guided/narrated video, every
// Sleep Soundscape, every affirmation track still requires the full
// sign-in + non-anonymous check exactly as before. The bucket stays
// private and the id still resolves through the caller's own fixed
// id→path map either way, signed with the service role either way; the
// ONLY thing this set changes is whether a caller must present a real
// user JWT first.
//
// IB01/IS01 (breathing/stretching ambient beds) and IM01/IM02
// (Self-Guided Meditation's two selectable sound choices, "Gentle
// Ambient" and "Soft Piano" - see src/lib/meditationSounds.js): short
// (~5 minute), non-narrated, non-personalized instrumental loops with no
// protected/paid content behind them.
//
// I01 ("Why WakeWise", Build 16) - a genuine exception to "never
// narrated": this is the app's own first-use welcome video, ~57s,
// verified real duration (see betaVideoManifest.js), explicitly approved
// for guest access because its entire product purpose - helping someone
// who hasn't signed up yet decide whether to - is defeated if watching it
// requires the exact commitment it exists to help with. Still not
// personalized, still not protected/paid content. I02 ("How to Use
// WakeWise") is deliberately NOT included here - it has no first-use
// welcome-screen role and stays behind the normal sign-in requirement.
export const GUEST_ALLOWED_IDS: ReadonlySet<string> = new Set(['IB01', 'IS01', 'IM01', 'IM02', 'I01']);

export const isGuestAllowedId = (exerciseId: unknown): boolean =>
  typeof exerciseId === 'string' && GUEST_ALLOWED_IDS.has(exerciseId);

export interface VerifyUserResult {
  user: { id: string; is_anonymous?: boolean } | null;
  error?: unknown;
}

export interface SignUrlResult {
  signedUrl?: string;
  error?: unknown;
}

export interface CheckPremiumAccessResult {
  records: { provider: string; status: string; currentPeriodExpiresAt: string | null }[];
  error: string | null;
}

export interface ResolveBetaVideoUrlArgs {
  authorizationHeader: string | null;
  body: unknown;
  // The caller's own fixed id→path map lookup (EXERCISE_PATHS.get in
  // production) - never anything derived from the request itself, so a
  // caller-supplied bucket/path/URL can never reach signUrl.
  resolvePath: (exerciseId: string) => string | undefined;
  verifyUser: (jwt: string) => Promise<VerifyUserResult>;
  signUrl: (path: string) => Promise<SignUrlResult>;
  // Phase 2C §6/§7 — the real, unweakened Plus authorization boundary,
  // injected the same way verifyUser/signUrl are so it stays genuinely
  // testable (see entitlementRecords.ts's own header). Called ONLY for a
  // non-guest-allowed id that isPremiumExerciseId() classifies as Plus —
  // never for a Free or §3a out-of-scope id, and never before the
  // caller's own identity has already been verified above. Required, not
  // optional — a missing dependency must never silently fall through to
  // "allowed"; every real/test caller supplies it explicitly.
  checkPremiumAccess: (userId: string) => Promise<CheckPremiumAccessResult>;
}

export interface ResolveBetaVideoUrlResult {
  status: number;
  body: Record<string, unknown>;
}

export const resolveBetaVideoUrlRequest = async ({
  authorizationHeader,
  body,
  resolvePath,
  verifyUser,
  signUrl,
  checkPremiumAccess
}: ResolveBetaVideoUrlArgs): Promise<ResolveBetaVideoUrlResult> => {
  const exerciseId =
    typeof (body as { exerciseId?: unknown })?.exerciseId === 'string'
      ? (body as { exerciseId: string }).exerciseId
      : undefined;

  // Membership check happens BEFORE any auth bypass, and only ever against
  // the exact `exerciseId` string the caller sent - never a path, bucket,
  // or URL, none of which this function ever reads from `body` at all.
  const guestAllowed = Boolean(exerciseId) && isGuestAllowedId(exerciseId);

  let verifiedUserId: string | null = null;

  if (!guestAllowed) {
    const jwt = (authorizationHeader ?? '').replace(/^Bearer\s+/i, '');
    if (!jwt) {
      return { status: 401, body: { error: 'Sign in required' } };
    }

    const { user, error: userError } = await verifyUser(jwt);
    if (userError || !user) {
      return { status: 401, body: { error: 'Sign in required' } };
    }

    if (user.is_anonymous) {
      return { status: 403, body: { error: 'Please sign in to watch this preview.' } };
    }

    verifiedUserId = user.id;
  }

  // Same fixed-map lookup regardless of the branch above - a guest-allowed
  // id still only ever resolves to the exact path already registered for
  // it in the caller's own map; nothing about the allowlist changes how
  // (or whether) an id maps to a real object, and no other field of
  // `body` is ever consulted. Resolved BEFORE the premium check below,
  // per premiumExerciseIds.ts's own usage contract: isPremiumExerciseId
  // must only ever be asked about an id already confirmed real — an
  // unrecognised id falls straight through to the 404 here, never into
  // the premium branch (isPremiumExerciseId's "every id not in the Free
  // set is Plus" rule would otherwise misclassify a bogus id as Plus).
  const path = exerciseId ? resolvePath(exerciseId) : undefined;
  if (!path) {
    return { status: 404, body: { error: 'Unknown video' } };
  }

  // Phase 2C §6/§7 — the real, unweakened Plus authorization boundary.
  // Checked only once the caller's identity is already verified above AND
  // the id is already confirmed to resolve to a real object (the `path`
  // check above), only for a non-guest-allowed id (guest-allowed ids are
  // never Plus by premiumExerciseIds.ts's own contract), and only when
  // that id is actually classified Plus — a Free id skips this entirely
  // and falls straight through to signUrl below, completely unaffected
  // by this addition. §6's fail-closed rule: a failed read
  // (checkPremiumAccess's own `error`) returns an error here, never a
  // signed URL and never a silent "treat as Free."
  if (!guestAllowed && isPremiumExerciseId(exerciseId as string)) {
    const { records, error: entitlementError } = await checkPremiumAccess(verifiedUserId as string);
    if (entitlementError) {
      return {
        status: 503,
        body: { error: 'VERIFICATION_UNAVAILABLE', message: "We couldn't verify your subscription right now. Please try again." }
      };
    }
    if (!isAuthorizedForPremiumAccess(records)) {
      return { status: 403, body: { error: 'SUBSCRIPTION_REQUIRED', message: 'This session requires WakeWise Plus.' } };
    }
  }

  const { signedUrl, error: signError } = await signUrl(path);
  // Never echo signError/path details back to the caller - a guest-facing
  // error stays generic either way (see index.ts's own console.error for
  // where the real detail is actually logged, server-side only).
  if (signError || !signedUrl) {
    return { status: 404, body: { error: "This video isn't available right now." } };
  }

  return { status: 200, body: { url: signedUrl } };
};
