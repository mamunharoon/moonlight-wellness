// WakeWise — Beta Video Preview — get-beta-video-url
//
// NOT YET DEPLOYED. Written for review alongside the Checkpoint 2
// report; deploy only after explicit approval (`supabase functions
// deploy get-beta-video-url --project-ref kvdxuhyndevrfvsalgnx`).
//
// Same shape as create-checkout-session/index.ts: verify the caller's
// JWT server-side (never trust a client-supplied user id), then use the
// service-role client for the privileged part. The privileged part here
// is two things: (1) reading profiles.beta_access, which RLS would
// otherwise restrict to the row's own owner anyway but this avoids a
// second round trip with the user's own token, and (2) signing a
// Storage URL, which requires the service role because `wellness-videos`
// is a private bucket with no anon/authenticated read policy — and
// stays that way; this function is the only path to a usable URL.
//
// The client sends an `exerciseId` (e.g. "E02"), never a raw Storage
// path — EXERCISE_PATHS below is the single source of truth for what
// that id maps to, so a caller can never request an arbitrary object
// out of the bucket. This intentionally duplicates the id/path pairing
// in src/lib/betaVideoManifest.js (that file also carries title/
// description, which this function has no use for, and a Deno Edge
// Function can't import a Vite-bundled client file) — if any of these
// beta videos are ever renamed in Storage, both places need the update.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';

// A Map, not a plain object literal - EXERCISE_PATHS.get('__proto__') /
// .get('constructor') / .get('toString') simply return undefined, where
// a plain object would resolve those to inherited Object.prototype
// members (truthy, and not strings) and slip past a naive `if (!path)`
// guard below. Belt-and-suspenders here since Storage would still fail
// to resolve a non-string path either way, but this closes the gap at
// the allowlist itself rather than relying on that downstream failure.
const EXERCISE_PATHS: Map<string, string> = new Map([
  ['E02', 'exercises/WW_E02_OverwhelmedMind_Final_v2.mp4Use.mp4'],
  ['E03', 'exercises/WW_E03_InstantCalm_v3.mp4.mp4'],
  ['E04', 'exercises/WW_E04_ReleaseTension_Portrait_v2png.mp4'],
  ['E05', 'exercises/WW_E05_NightTimeCalm_v2.mp4.mp4'],
  ['E06', 'exercises/WW_E06_GentleAwakening_Gratitude_v3.mp3.mp4'],
  ['E07', 'exercises/WW_E07_MorningGratitude_Music_v2.mp3.mp4'],
  ['E08', 'exercises/WW_E08_DeepBreathing_v2.mp4.mp4'],
  ['E09', 'exercises/WW_E09_MindfulPause_Music_v1.mp3.mp4'],
  ['E10', 'exercises/WW_E10_EveningReflection_Music_v1.mp3.mp4']
]);

const SIGNED_URL_TTL_SECONDS = 300; // 5 minutes — matches betaVideoAccess.js's SIGNED_URL_TTL_SECONDS

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) {
    return json({ error: 'Sign in required' }, 401);
  }

  const authClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json({ error: 'Sign in required' }, 401);
  }
  const user = userData.user;

  if (user.is_anonymous) {
    return json({ error: 'Please sign in to watch this preview.' }, 403);
  }

  let body: { exerciseId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body / invalid JSON -> falls through to the validation below
  }

  const path = typeof body?.exerciseId === 'string' ? EXERCISE_PATHS.get(body.exerciseId) : undefined;
  if (!path) {
    return json({ error: 'Unknown video' }, 404);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('beta_access')
    .eq('id', user.id)
    .maybeSingle();

  if (profileError) {
    console.error('get-beta-video-url: failed to read beta_access', profileError.message);
    return json({ error: 'Could not verify access. Please try again.' }, 500);
  }

  if (!profile?.beta_access) {
    return json({ error: "You don't have access to this beta preview." }, 403);
  }

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('wellness-videos')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('get-beta-video-url: failed to sign URL', signError?.message);
    return json({ error: "This video isn't available right now." }, 404);
  }

  return json({ url: signed.signedUrl });
});
