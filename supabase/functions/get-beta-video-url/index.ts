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
// One narrow, explicit exception to "verify the caller's JWT": IB01/IS01/
// IM01 (see GUEST_ALLOWED_IDS in ../_shared/betaVideoUrlAccess.ts) may be
// requested with no JWT at all — an approved product decision to let
// guests genuinely hear the three interactive ambient-music beds, never
// anything narrated or protected. The bucket privacy posture, the fixed
// id→path Map, and the service-role signing step are all unchanged; only
// the auth requirement for that one small set is relaxed. The actual
// decision logic (this file's own thin Deno.serve handler just supplies
// real implementations to it) lives in resolveBetaVideoUrlRequest, a
// pure, dependency-injected function extracted specifically so it can be
// genuinely executed by this repo's Vitest suite - see that module's own
// header comment, and GUEST_ALLOWED_IDS's own comment before adding
// anything else to it.
//
// E02-E30, A01-A06, B01-B05, F01-F03, G01-G04, M01-M05, S01-S05 and
// SL01-SL08 no longer require profiles.beta_access: any authenticated,
// non-anonymous user may request a signed URL for a video in
// EXERCISE_PATHS below. That column and its admin_set_beta_access RPC
// still exist and still gate the /beta QA catalogue client-side — this
// function simply no longer checks it, now that these videos are
// approved for general availability in this environment. SL01-SL08
// (Sleep Sounds) were never beta content to begin with - they ship
// straight into the real Prepare for Rest step - and are mapped here
// purely to reuse this same JWT-verification + signing logic rather
// than duplicating it in a second function for no behavioural
// difference. A future
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
//
// Fast Start conversion: every path below points at a losslessly
// remuxed copy (`-map 0 -c copy -movflags +faststart` — moov moved
// before mdat, no re-encode) rather than the original `exercises/`
// object. faststart-v1/ holds the first catalogue-wide pass; five IDs
// (E04, E05, E06, E11, E13) had their source replaced with reduced
// exports after that pass and were remuxed a second time into
// faststart-v2/ from the new bytes — v1/v2 is purely which remux batch
// produced the file, not a quality tier. Every `exercises/` original
// remains in Storage, byte-for-byte, for rollback.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';
import { resolveBetaVideoUrlRequest } from '../_shared/betaVideoUrlAccess.ts';

// A Map, not a plain object literal - EXERCISE_PATHS.get('__proto__') /
// .get('constructor') / .get('toString') simply return undefined, where
// a plain object would resolve those to inherited Object.prototype
// members (truthy, and not strings) and slip past a naive `if (!path)`
// guard below. Belt-and-suspenders here since Storage would still fail
// to resolve a non-string path either way, but this closes the gap at
// the allowlist itself rather than relying on that downstream failure.
const EXERCISE_PATHS: Map<string, string> = new Map([
  ['E02', 'faststart-v1/WW_E02_OverwhelmedMind_Final_v2.mp4Use_faststart.mp4'],
  ['E03', 'faststart-v1/WW_E03_InstantCalm_v3.mp4_faststart.mp4'],
  ['E04', 'faststart-v2/WW_E04_ReleaseTension_Portrait_v2png_faststart.mp4'],
  ['E05', 'faststart-v2/WW_E05_NightTimeCalm_v2.mp4_faststart.mp4'],
  ['E06', 'faststart-v2/WW_E06_GentleAwakening_Gratitude_v3.mp3_faststart.mp4'],
  ['E07', 'faststart-v1/WW_E07_MorningGratitude_Music_v2.mp3_faststart.mp4'],
  ['E08', 'faststart-v1/WW_E08_DeepBreathing_v2.mp4_faststart.mp4'],
  ['E09', 'faststart-v1/WW_E09_MindfulPause_Music_v1.mp3_faststart.mp4'],
  ['E10', 'faststart-v1/WW_E10_EveningReflection_Music_v1.mp3_faststart.mp4'],
  ['E11', 'faststart-v2/WW_E11_PositiveEnergy_Music_v1.mp3_faststart.mp4'],
  ['E12', 'faststart-v1/WW_E12_ConfidenceBuilder_Portrait_v1.png_faststart.mp4'],
  ['E13', 'faststart-v2/WW_E13_MorningFocus_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E14', 'faststart-v1/WW_E14_MotivationBoost_BackgroundMusic_v2.mp3_faststart.mp4'],
  ['E15', 'faststart-v1/WW_E15_AFreshStart_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E16', 'faststart-v1/WW_E16_AnxietyRelief_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E17', 'faststart-v1/WW_E17_StressReset_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E18', 'faststart-v1/WW_E18_FindingBalance_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E19', 'faststart-v1/WW_E19_LettingGo_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E20', 'faststart-v1/WW_E20_QuietingTheMind_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E21', 'faststart-v1/WW_E21_SelfCompassion_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E22', 'faststart-v1/WW_E22_InnerStrength_Mobile_Background_v1.png_faststart.mp4'],
  ['E23', 'faststart-v1/WW_E23_Gratitude_Mobile_Background_v1.png_faststart.mp4'],
  ['E24', 'faststart-v1/WW_E24_Confidence_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E25', 'faststart-v1/WW_E25_HopeAndHealing_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E26', 'faststart-v1/WW_E26_SelfAcceptance_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E27', 'faststart-v1/WW_E27_DeepRelaxation_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E28', 'faststart-v1/WW_E28_MindfulBreathing_v2.mp4_faststart.mp4'],
  ['E29', 'faststart-v1/WW_E29_Patience_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['E30', 'faststart-v1/WW_E30_PeacefulSleep_v1.mp4_faststart.mp4'],
  ['A01', 'faststart-v1/WW_A01_Confidence_v1.mp4_faststart.mp4'],
  ['A02', 'faststart-v1/WW_A02_Calmness_v1.mp4_faststart.mp4'],
  ['A03', 'faststart-v1/WW_A03_Focus_v1.mp4_faststart.mp4'],
  ['A04', 'faststart-v1/WW_A04_Motivation_v1.mp4_faststart.mp4'],
  ['A05', 'faststart-v1/WW_A05_Gratitude_v2.mp4_faststart.mp4'],
  ['A06', 'faststart-v1/WW_A06_SelfWorth_BackgroundMusic_v1.mp3_faststart.mp4'],
  ['B01', 'faststart-v1/WW_B01_DeepBreathing_Mobile_Background_v1.png_faststart.mp4'],
  ['B02', 'faststart-v1/WW_B02_BoxBreathing_v1.mp4_faststart.mp4'],
  ['B03', 'faststart-v1/WW_B03_478Breathing_v1.mp4_faststart.mp4'],
  ['B04', 'faststart-v1/WW_B04_CoherentBreathing_v1.mp4_faststart.mp4'],
  ['B05', 'faststart-v1/WW_B05_althernativeNostrilBreathing_v1.mp4_faststart.mp4'],
  // Interactive-ambient-music loops (audio-only .m4a, no video track) -
  // shared background beds for the silent interactive timers on
  // Breathe.jsx/EveningBreathing.jsx/QuietBreathing.jsx (IB01) and
  // MorningFlow.jsx (IS01). Confirmed this Map has no format/extension
  // validation on the key or path, so .m4a works identically to every
  // .mp4 entry here. See src/lib/betaVideoManifest.js's matching entries.
  ['IB01', 'faststart-v1/WW_IB01_InteractiveBreathingLoop_MusicBed_v2_faststart.m4a'],
  // Interactive-ambient-music loop for the Self-Guided Meditation feature -
  // same role as IB01 above. See src/lib/betaVideoManifest.js's matching
  // entry.
  ['IM01', 'faststart-v1/WW_IM01_InteractiveMeditation_MusicBed_v1.m4a'],
  ['F01', 'faststart-v1/WW_F01_DeepWork_v1.mp4_faststart.mp4'],
  ['F02', 'faststart-v1/WW_F02_Study.mp4_faststart.mp4'],
  ['F03', 'faststart-v1/WW_F03_Concentration_v1.mp4_faststart.mp4'],
  ['G01', 'faststart-v1/WW_G01_FiveSenses_v1.mp4_faststart.mp4'],
  ['G02', 'faststart-v1/WW_G02_MuscleRelaxation_v1.mp4_faststart.mp4'],
  ['G03', 'faststart-v1/WW_G03_BodyAwareness_v1.mp4_faststart.mp4'],
  ['G04', 'faststart-v1/WW_G04_SensoryReset_v1.mp4_faststart.mp4'],
  ['M01', 'faststart-v1/WW_M01_MindfulnessMeditation_v1.mp4_faststart.mp4'],
  ['M02', 'faststart-v1/WW_M02_BodyScan_v1.mp4_faststart.mp4'],
  ['M03', 'faststart-v1/WW_M03_LovingKindness_v1.mp4_faststart.mp4'],
  ['M04', 'faststart-v1/WW_M04_GratitudeMeditation_v1.mp4_faststart.mp4'],
  ['M05', 'faststart-v1/WW_M05_GuidedReflection_v1.mp4_faststart.mp4'],
  // S01-MUSIC (the pre-mixed narrated+music variant) removed - that
  // approach no longer represents the approved architecture. The original
  // S01 mapping below is untouched. WW_S01_NeckRelease_MusicBed_v2.mp4
  // itself is left in Storage, unreferenced by any id here.
  ['S01', 'faststart-v1/WW_S01_NeckRelease_v1.mp4_faststart.mp4'],
  ['S02', 'faststart-v1/WW_S02_ShoulderRelease_v1.mp4_faststart.mp4'],
  ['S03', 'faststart-v1/WW_S03_UpperBackStretch_v1.mp4_faststart.mp4'],
  ['S04', 'faststart-v1/WW_S04_MorningFlow_v1.mp4_faststart.mp4'],
  ['S05', 'faststart-v1/WW_S05_EveningFlow_v1.mp4_faststart.mp4'],
  ['IS01', 'faststart-v1/WW_IS01_InteractiveStretchingLoop_MusicBed_v2_faststart.m4a'],
  ['SL01', 'faststart-v1/WW_SL01_Rain_v1_faststart.mp4'],
  ['SL02', 'faststart-v1/WW_SL02_OceanWaves_Preview_v1_faststart.mp4'],
  ['SL03', 'faststart-v1/WW_SL03_ForestAmbience_v1_faststart.mp4'],
  ['SL04', 'faststart-v1/WW_SL04_Fireplace_v1_faststart.mp4'],
  ['SL05', 'faststart-v1/WW_SL05_Wind_v1.mp4_faststart.mp4'],
  ['SL06', 'faststart-v1/WW_SL06_WhiteNoise_v1.mp4_faststart.mp4'],
  ['SL07', 'faststart-v1/WW_SL07_PinkNoise_v1.mp4_faststart.mp4'],
  ['SL08', 'faststart-v1/WW_SL08_BrownNoise_v1.mp4_faststart.mp4'],
  // Introduction guide videos (Introduction.jsx) - verified against
  // storage.objects (name, mimetype video/mp4, size) before adding. Same
  // JWT-required/anonymous-rejected policy as every other id above -
  // Introduction.jsx gates guest taps via useProtectedVideo/
  // SignInPromptDialog before ever calling this function.
  ['I01', 'faststart-v1/WW_I01_WelcomeToWakeWise_v1_faststart.mp4'],
  ['I02', 'faststart-v1/WW_I02_HowToUseWakeWise_v1_faststart.mp4']
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

  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // no body / invalid JSON -> falls through to the validation below
  }

  // All of the auth/allowlist/path-resolution decision-making lives in
  // resolveBetaVideoUrlRequest (../_shared/betaVideoUrlAccess.ts) - a
  // pure, dependency-injected function so it can be genuinely exercised
  // by this repo's Vitest suite, not just source-text matched. This
  // Deno.serve handler is a thin adapter: it supplies the two real,
  // privileged implementations (Supabase Auth's getUser, and the
  // service-role signed-URL call) and the real EXERCISE_PATHS lookup,
  // then translates the returned `{ status, body }` into a Response.
  const result = await resolveBetaVideoUrlRequest({
    authorizationHeader: req.headers.get('Authorization'),
    body,
    resolvePath: (id) => EXERCISE_PATHS.get(id),
    verifyUser: async (jwt) => {
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? ''
      );
      const { data, error } = await authClient.auth.getUser(jwt);
      return { user: data?.user ?? null, error };
    },
    signUrl: async (path) => {
      const supabaseAdmin = createSupabaseAdminClient();
      const { data, error } = await supabaseAdmin.storage
        .from('wellness-videos')
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) {
        console.error('get-beta-video-url: failed to sign URL', error.message);
      }
      return { signedUrl: data?.signedUrl, error };
    }
  });

  return json(result.body, result.status);
});
