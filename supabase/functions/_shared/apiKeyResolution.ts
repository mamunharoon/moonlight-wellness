// DEV service-role credential exposure remediation (tracker SEC-07/E-37).
//
// Pure JSON-key resolution for the new Supabase API key system -
// SUPABASE_SECRET_KEYS/SUPABASE_PUBLISHABLE_KEYS are each injected by the
// platform as a JSON object keyed by name; this project uses only the
// 'default' key of each. Deliberately takes the raw string as a plain
// parameter rather than calling Deno.env.get() itself (that stays in
// supabaseAdmin.ts) - no Deno-specific import or API anywhere in this
// file, so it is directly importable by Vitest (see
// src/lib/apiKeyResolution.test.js), the same cross-boundary pattern
// entitlementResolution.ts's own server/client mirror test already uses.
// Fails closed (returns '') on anything missing or malformed, never
// throws - a caller passing the empty string straight into createClient()
// gets an auth error from Supabase itself, not a crash here.
export const resolveNamedKey = (rawJson: string | undefined | null, name = 'default'): string => {
  if (!rawJson) return '';
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return '';
  }
  if (typeof parsed !== 'object' || parsed === null) return '';
  const value = (parsed as Record<string, unknown>)[name];
  return typeof value === 'string' ? value : '';
};
