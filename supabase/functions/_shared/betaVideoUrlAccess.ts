// get-beta-video-url's auth-decision core, extracted as a pure, dependency-
// injected module (no Deno global, no `npm:` import) purely so it can be
// imported and genuinely executed by this repo's Vitest suite - same
// pattern entitlementResolution.ts already establishes for its own edge
// function. get-beta-video-url/index.ts is the only real caller in
// production; it supplies real `verifyUser`/`signUrl`/`resolvePath`
// implementations backed by Supabase Auth and the service-role Storage
// client. Tests supply fakes and assert on the returned `{ status, body }`
// shape - genuine behavioural coverage of the actual auth/allowlist
// branching, not a source-text regex guess at it.

// Guest-accessible interactive ambient-music beds — a narrow, explicit,
// server-side exception to the sign-in/non-anonymous requirement every
// other id in EXERCISE_PATHS still enforces, approved as a deliberate
// product decision (not a default posture). Every id here is a short
// (~5 minute), non-narrated, non-personalized instrumental loop with no
// protected/paid content behind it - IB01/IS01 (breathing/stretching
// ambient beds) and IM01/IM02 (Self-Guided Meditation's two selectable
// sound choices, "Gentle Ambient" and "Soft Piano" - see
// src/lib/meditationSounds.js). This does NOT relax anything else: every
// guided/narrated video, every Sleep Soundscape, every affirmation track
// still requires the full sign-in + non-anonymous check exactly as before.
// The bucket stays private and the id still resolves through the caller's
// own fixed id→path map either way, signed with the service role either
// way; the ONLY thing this set changes is whether a caller must present a
// real user JWT first. Adding an id here - especially anything narrated,
// personalized, or otherwise not a shared ambient loop - is a deliberate
// security/product decision requiring the same explicit approval this set
// itself required, never a default extension by analogy.
export const GUEST_ALLOWED_IDS: ReadonlySet<string> = new Set(['IB01', 'IS01', 'IM01', 'IM02']);

export const isGuestAllowedId = (exerciseId: unknown): boolean =>
  typeof exerciseId === 'string' && GUEST_ALLOWED_IDS.has(exerciseId);

export interface VerifyUserResult {
  user: { is_anonymous?: boolean } | null;
  error?: unknown;
}

export interface SignUrlResult {
  signedUrl?: string;
  error?: unknown;
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
  signUrl
}: ResolveBetaVideoUrlArgs): Promise<ResolveBetaVideoUrlResult> => {
  const exerciseId =
    typeof (body as { exerciseId?: unknown })?.exerciseId === 'string'
      ? (body as { exerciseId: string }).exerciseId
      : undefined;

  // Membership check happens BEFORE any auth bypass, and only ever against
  // the exact `exerciseId` string the caller sent - never a path, bucket,
  // or URL, none of which this function ever reads from `body` at all.
  const guestAllowed = Boolean(exerciseId) && isGuestAllowedId(exerciseId);

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
  }

  // Same fixed-map lookup regardless of the branch above - a guest-allowed
  // id still only ever resolves to the exact path already registered for
  // it in the caller's own map; nothing about the allowlist changes how
  // (or whether) an id maps to a real object, and no other field of
  // `body` is ever consulted.
  const path = exerciseId ? resolvePath(exerciseId) : undefined;
  if (!path) {
    return { status: 404, body: { error: 'Unknown video' } };
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
