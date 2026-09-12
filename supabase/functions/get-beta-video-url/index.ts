// WakeWise — Beta Video Preview — get-beta-video-url
//
// Deployed to project kvdxuhyndevrfvsalgnx via
// `supabase functions deploy get-beta-video-url --project-ref kvdxuhyndevrfvsalgnx`
// after each change to this file passes lint/build.
//
// Same shape as create-checkout-session/index.ts: verify the caller's
// JWT server-side (never trust a client-supplied user id), then use the
// service-role client for the privileged part — signing a Storage URL,
// which requires the service role because `wellness-videos` is a private
// bucket with no anon/authenticated read policy — and stays that way;
// this function is the only path to a usable URL.
//
// E02-E30 and A01-A06 no longer require profiles.beta_access: any authenticated,
// non-anonymous user may request a signed URL for a video in
// EXERCISE_PATHS below. That column and its admin_set_beta_access RPC
// still exist and still gate the /beta QA catalogue client-side — this
// function simply no longer checks it, now that these videos are
// approved for general availability in this environment. A future
// exercise that should stay beta-only would need its own check here;
// nothing currently in EXERCISE_PATHS does.
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
  ['E10', 'exercises/WW_E10_EveningReflection_Music_v1.mp3.mp4'],
  ['E11', 'exercises/WW_E11_PositiveEnergy_Music_v1.mp3.mp4'],
  ['E12', 'exercises/WW_E12_ConfidenceBuilder_Portrait_v1.png.mp4'],
  ['E13', 'exercises/WW_E13_MorningFocus_BackgroundMusic_v1.mp3.mp4'],
  ['E14', 'exercises/WW_E14_MotivationBoost_BackgroundMusic_v2.mp3.mp4'],
  ['E15', 'exercises/WW_E15_AFreshStart_BackgroundMusic_v1.mp3.mp4'],
  ['E16', 'exercises/WW_E16_AnxietyRelief_BackgroundMusic_v1.mp3.mp4'],
  ['E17', 'exercises/WW_E17_StressReset_BackgroundMusic_v1.mp3.mp4'],
  ['E18', 'exercises/WW_E18_FindingBalance_BackgroundMusic_v1.mp3.mp4'],
  ['E19', 'exercises/WW_E19_LettingGo_BackgroundMusic_v1.mp3.mp4'],
  ['E20', 'exercises/WW_E20_QuietingTheMind_BackgroundMusic_v1.mp3.mp4'],
  ['E21', 'exercises/WW_E21_SelfCompassion_BackgroundMusic_v1.mp3.mp4'],
  ['E22', 'exercises/WW_E22_InnerStrength_Mobile_Background_v1.png.mp4'],
  ['E23', 'exercises/WW_E23_Gratitude_Mobile_Background_v1.png.mp4'],
  ['E24', 'exercises/WW_E24_Confidence_BackgroundMusic_v1.mp3.mp4'],
  ['E25', 'exercises/WW_E25_HopeAndHealing_BackgroundMusic_v1.mp3.mp4'],
  ['E26', 'exercises/WW_E26_SelfAcceptance_BackgroundMusic_v1.mp3.mp4'],
  ['E27', 'exercises/WW_E27_DeepRelaxation_BackgroundMusic_v1.mp3.mp4'],
  ['E28', 'exercises/WW_E28_MindfulBreathing_v2.mp4.mp4'],
  ['E29', 'exercises/WW_E29_Patience_BackgroundMusic_v1.mp3.mp4'],
  ['E30', 'exercises/WW_E30_PeacefulSleep_v1.mp4.mp4'],
  ['A01', 'exercises/WW_A01_Confidence_v1.mp4.mp4'],
  ['A02', 'exercises/WW_A02_Calmness_v1.mp4.mp4'],
  ['A03', 'exercises/WW_A03_Focus_v1.mp4.mp4'],
  ['A04', 'exercises/WW_A04_Motivation_v1.mp4.mp4'],
  ['A05', 'exercises/WW_A05_Gratitude_v2.mp4.mp4'],
  ['A06', 'exercises/WW_A06_SelfWorth_BackgroundMusic_v1.mp3.mp4']
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

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('wellness-videos')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('get-beta-video-url: failed to sign URL', signError?.message);
    return json({ error: "This video isn't available right now." }, 404);
  }

  return json({ url: signed.signedUrl });
});
