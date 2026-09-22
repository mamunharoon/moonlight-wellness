// WakeWise — Fast Start pilot — get-pilot-video-url
//
// DEV-only, approved for controlled DEV deployment as part of the
// controlled Fast Start remux pilot (3 files: I01, A01, SL01) — see
// docs/fast-start-pilot-comparison.md for the full pilot report. Deployed
// to project kvdxuhyndevrfvsalgnx only; delete this whole directory (and
// run `supabase functions delete get-pilot-video-url`) to remove the
// pilot cleanly (it is never imported by, and shares no code with,
// get-beta-video-url/index.ts).
//
// Deliberately a SEPARATE function rather than an extension of
// get-beta-video-url — this pilot must never be able to affect what that
// function (and therefore Build 13 / any real user) resolves. Its own
// PILOT_PATHS map below is the only thing it can ever sign a URL for: six
// fixed entries, three original + three Fast Start pilot copies, all
// already-audited files. No dynamic path construction anywhere.
//
// Access control: requires a real signed-in, non-anonymous user AND a
// server-verified is_admin() = true (the same SECURITY DEFINER RPC
// AdminRoute.jsx/adminApi.js already trust for the /admin area — reused
// here rather than inventing a second authorization boundary). This is
// intentionally tighter than get-beta-video-url's "any authenticated user"
// policy: this tool is an internal diagnostic, not beta content.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';
import { createSupabaseAdminClient } from '../_shared/supabaseAdmin.ts';

const PILOT_PATHS: Map<string, string> = new Map([
  ['I01-original', 'exercises/WW_I01_WelcomeToWakeWise_v1.mp4'],
  ['I01-faststart', 'pilot-faststart/WW_I01_WelcomeToWakeWise_v1_faststart.mp4'],
  ['A01-original', 'exercises/WW_A01_Confidence_v1.mp4.mp4'],
  ['A01-faststart', 'pilot-faststart/WW_A01_Confidence_v1_faststart.mp4'],
  ['SL01-original', 'exercises/WW_SL01_Rain_v1.mp4'],
  ['SL01-faststart', 'pilot-faststart/WW_SL01_Rain_v1_faststart.mp4']
]);

// Short — this tool is only ever used in one sitting by a tester actively
// comparing two players; no reason to match the real app's 5-minute TTL.
const SIGNED_URL_TTL_SECONDS = 180;

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
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: `Bearer ${jwt}` } } }
  );
  const { data: userData, error: userError } = await authClient.auth.getUser(jwt);
  if (userError || !userData?.user) {
    return json({ error: 'Sign in required' }, 401);
  }
  if (userData.user.is_anonymous) {
    return json({ error: 'Admin access required' }, 403);
  }

  // Server-verified admin check — the actual authorization boundary,
  // exactly as adminApi.js's own comment describes for every other admin
  // RPC: a client-side gate (AdminRoute.jsx) is UX only.
  const { data: isAdmin, error: adminCheckError } = await authClient.rpc('is_admin');
  if (adminCheckError || isAdmin !== true) {
    return json({ error: 'Admin access required' }, 403);
  }

  let body: { pilotId?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body / invalid JSON -> falls through to the validation below
  }

  const path = typeof body?.pilotId === 'string' ? PILOT_PATHS.get(body.pilotId) : undefined;
  if (!path) {
    return json({ error: 'Unknown pilot video' }, 404);
  }

  const supabaseAdmin = createSupabaseAdminClient();

  const { data: signed, error: signError } = await supabaseAdmin.storage
    .from('wellness-videos')
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed?.signedUrl) {
    console.error('get-pilot-video-url: failed to sign URL', signError?.message);
    return json({ error: "This pilot video isn't available right now." }, 404);
  }

  return json({ url: signed.signedUrl });
});
