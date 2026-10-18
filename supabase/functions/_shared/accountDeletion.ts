// Immediate Account Deletion — the real, authoritative deletion core
// (delete-account/index.ts's only real caller; a pure, dependency-
// injected function so it can be genuinely executed by this repo's
// Vitest suite — same pattern betaVideoUrlAccess.ts/
// applyVerifiedAppleTransaction.ts already establish for their own
// functions). Replaces the prior "submit a request, wait 7 days,
// manual processor completes it" model — this is the ONE place that
// model's replacement (verify -> reconcile billing -> delete data ->
// delete the Auth user -> record completion) actually happens, in that
// exact order, for the caller's own account only.
//
// Every write this module performs is scoped to the single, already-
// verified `user` passed in — no id/email is ever read from the request
// body, matching every other server-side function in this app's
// convention of never trusting a client-supplied identity.
//
// Retry safety (requirement: "prevent partial failures from being
// reported as success... make retries safe"): the ONLY outcome that
// means "your account and data are actually gone" is 'deleted'. Every
// OTHER outcome is reported honestly as a failure — but "failure" does
// NOT mean "nothing happened." Exactly what remains differs by stage,
// and a caller/reviewer must never assume "fully intact" without
// checking which one actually occurred:
//
//   unauthenticated / guest_blocked / no_email / phrase_mismatch /
//   password_required / reauth_failed / request_lookup_failed /
//   billing_check_failed / request_lock_failed
//     -> Genuinely untouched. Nothing was written (the request row is
//        only ever locked to 'processing' AFTER the billing read that
//        billing_check_failed/request_lock_failed themselves guard) -
//        "fully intact" is accurate here.
//
//   stripe_cancel_failed
//     -> The request row is already locked to 'processing', but NO
//        user-owned data table and NOT the Stripe subscription itself
//        have been touched yet (cancelStripeSubscriptionIfActive is
//        the very next step, and it's what just failed). Personal data
//        is still fully intact; only the bookkeeping row changed.
//
//   data_delete_failed
//     -> Stripe cancellation (if any) ALREADY SUCCEEDED, and
//        deleteUserOwnedRows failed PARTWAY through its own table-by-
//        table loop (delete-account/index.ts) — every table it
//        processed BEFORE the one that failed is ALREADY GENUINELY,
//        IRREVERSIBLY DELETED. This is explicitly NOT "fully intact":
//        real personal data (journal entries, intentions, rhythm
//        settings, completion history, or the profile itself,
//        depending on exactly where the loop stopped) may already be
//        gone. The Auth user and whatever tables weren't yet reached
//        still exist. The only sane path forward is to finish (retry),
//        never to treat this as "safe to just walk away from."
//
//   auth_delete_failed
//     -> The MOST advanced partial state: every user-owned table AND
//        the profile are confirmed gone (deleteUserOwnedRows fully
//        succeeded) — only deleteAuthUser itself failed. The Auth
//        user/login credential is the ONE thing that still exists;
//        everything that made it a real, usable WakeWise account does
//        not. See AuthContext.jsx's own loadProfile and Auth.jsx's own
//        redirectAfterAuth for the specific, separately-fixed hazard
//        this state creates if the user signs back in or reopens the
//        app without finishing deletion first (both now detect this
//        exact row and route to resume, rather than silently handing
//        the account a fresh, blank profile).
//
// A later call with the same credentials re-enters at
// getExistingRequestRow, finds that same 'processing' row, and resumes
// from the top — every step below (Stripe cancellation, each table
// delete, the Auth user delete itself) is independently idempotent:
// acting on an already-cancelled Stripe subscription, an already-
// deleted row, or an already-deleted Auth user is treated as success,
// never as a new failure, so resuming always converges on 'deleted'
// rather than re-attempting (or re-charging) anything already done. The
// one write that is genuinely best-effort is the final completion-
// record update — by the time it runs, the Auth user is already
// irreversibly gone, which is the real fact; a failure persisting THAT
// fact never changes what already happened and is never surfaced to
// the caller as a deletion failure.
//
// Post-deletion access, verified against this project's real schema
// (not assumed, and never relying on the client's own sign-out, which
// this module has no way to force anyway): three genuinely different
// mechanisms cover three genuinely different access paths, none of
// them a single "the JWT becomes invalid" guarantee —
//   - Edge Functions (every one in this app, including this one) call
//     Supabase Auth's getUser(jwt) — a LIVE, stateful lookup against
//     auth.users, not a local signature check. A deleted user's token,
//     however recently issued, fails this immediately (Supabase's own
//     documented behaviour for `admin.deleteUser()`).
//   - Direct RLS-protected table reads (the browser's own
//     `supabase.from(...)` calls, bypassing any Edge Function) do NOT
//     get this live check — PostgREST verifies a JWT's signature/
//     expiry locally only. A still-unexpired token for a deleted user
//     WOULD pass that check. It returns nothing meaningful anyway:
//     every row this module deletes is gone, so `auth.uid() = user_id`
//     matches zero rows regardless of token validity.
//   - Writing NEW rows with that same stale token is blocked by a
//     DIFFERENT, verified mechanism: every user-owned table's own
//     `user_id`/`id` column is a non-deferrable foreign key referencing
//     `auth.users(id)` (confirmed live via pg_constraint for
//     journal_entries/profiles/user_intentions/rhythms/subscriptions —
//     `condeferrable: false`) — an INSERT naming a user id that no
//     longer exists fails at the database engine itself, independent
//     of RLS, independent of token expiry, and never bypassable from
//     the client.
export const CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

// Every table this app's own live schema confirms CASCADEs from
// auth.users (see docs/account-deletion-processor-spec.md's verified-
// schema table, re-confirmed live via pg_constraint for this task) —
// deleted explicitly, in this fixed order, by deleteUserOwnedRowsInOrder
// below, BEFORE the Auth user is ever touched. Filtered by `user_id`;
// `profiles` is the one exception (filtered by `id`, its own PK/FK
// target) and is deliberately deleted LAST, after every row below has
// already succeeded - see that function's own header for why the order
// itself is what makes data_delete_failed's "may be partially deleted"
// disclosure precise rather than vague.
export const USER_OWNED_TABLES = [
  'journal_entries',
  'user_intentions',
  'rhythms',
  'routine_responses',
  'practice_completion_events',
  'checkout_attempts',
  'provider_subscriptions',
  'entitlements',
  'subscriptions'
];

/**
 * Deletes every user-owned table in the fixed order above, then
 * `profiles` last, stopping at the FIRST real failure. Pulled out of
 * delete-account/index.ts specifically so this exact ordering/stop-on-
 * first-failure behaviour — the real mechanism behind "tables processed
 * before the failure point are already genuinely, irreversibly deleted;
 * tables from that point on are not" — can be proven directly with
 * injected fakes (see accountDeletion.test.js), not just asserted in a
 * comment. `deleteFromTable(table, filterColumn)` is the caller's own
 * real Supabase delete call; this function makes no assumption about
 * HOW a table is deleted, only the order and failure handling.
 *
 * @param {(table: string, filterColumn: 'user_id' | 'id') => Promise<{ error }>} deleteFromTable
 * @returns {Promise<{ error, failedTable?: string }>}
 */
export const deleteUserOwnedRowsInOrder = async (deleteFromTable) => {
  for (const table of USER_OWNED_TABLES) {
    const { error } = await deleteFromTable(table, 'user_id');
    if (error) return { error, failedTable: table };
  }
  const { error: profileError } = await deleteFromTable('profiles', 'id');
  if (profileError) return { error: profileError, failedTable: 'profiles' };
  return { error: null };
};

// Mirrors request-account-deletion/index.ts's own identical, independently-
// declared classifier — a short, non-sensitive audit classification only,
// never raw billing detail. Duplicated deliberately rather than imported:
// that function is left completely untouched by this change (see this
// module's own header), matching this codebase's established convention
// of small, independently-declared duplicates across a boundary where one
// side must not depend on code that may change for the other's reasons
// (e.g. FREE_EXERCISE_IDS/premiumExerciseIds.ts's own comment on this).
export const classifyBillingStatus = (row) => {
  if (!row) return 'none';
  const activePlus = row.plan === 'plus' && ['trial', 'active'].includes(row.status);
  if (!activePlus) return 'none';
  return row.provider === 'stripe' ? 'active-stripe' : 'active-manual';
};

// Only a live Stripe subscription needs an explicit cancellation call —
// 'manual' access has nothing in Stripe to cancel, and 'none'/an
// inactive status means there is nothing currently billing. Apple/
// Google are deliberately out of scope here (this app never reaches
// those stores' own billing systems — see DeleteAccount.jsx's own
// provider-specific copy, preserved unchanged by this task).
export const subscriptionNeedsStripeCancellation = (row) =>
  Boolean(row?.provider === 'stripe' && row?.stripe_subscription_id && ['trial', 'active'].includes(row?.status));

// delete-account/index.ts's own cancelStripeSubscriptionIfActive catch
// block treats a Stripe error as a non-failure (idempotent retry) when
// it matches this shape — pulled out as its own pure, duck-typed check
// (never `instanceof Stripe.errors.StripeError`, which would require
// importing the real `npm:stripe` SDK into this module and break its
// own ability to be imported by this repo's Node-based Vitest, the
// same reason planMapping.ts's own Stripe-adjacent pure functions never
// import the SDK either) so it's directly testable with a plain fake
// error object. Safe to check unconditionally - the try block it guards
// contains exactly one call (stripe.subscriptions.update()), so
// anything caught there originates from Stripe's own SDK by
// construction; no separate instanceof narrowing is actually load-
// bearing. `resource_missing` is Stripe's own code for "no such
// subscription" (already cancelled/deleted, or never existed under
// this id); the message regex catches "already canceled" rejections
// that don't carry that exact code.
export const isAlreadyCancelledStripeError = (err) =>
  Boolean(err) && (err.code === 'resource_missing' || /already.*cancel/i.test(err.message ?? ''));

// delete-account/index.ts's own deleteAuthUser treats a GoTrue
// admin.deleteUser() error as a non-failure (idempotent retry, the user
// already being gone) exactly when this matches — pulled out for the
// same directly-testable reason as isAlreadyCancelledStripeError above.
export const isUserAlreadyDeletedError = (err) => Boolean(err) && /not.?found/i.test(err.message ?? '');

/**
 * @param {{ user: {id, email, is_anonymous}, password: string, confirmationPhrase: string }} input
 * @param {{
 *   reauthenticate: (email, password) => Promise<{ error }>,
 *   getBillingRow: () => Promise<{ data, error }>,
 *   getExistingRequestRow: () => Promise<{ data, error }>,
 *   upsertProcessingRow: ({ existingId, billingStatusAtRequest }) => Promise<{ data, error }>,
 *   cancelStripeSubscriptionIfActive: (billingRow) => Promise<{ error }>,
 *   deleteUserOwnedRows: () => Promise<{ error }>,
 *   deleteAuthUser: () => Promise<{ error }>,
 *   markRequestCompleted: (requestId) => Promise<{ error }>
 * }} io
 * @returns {Promise<{ outcome: string, requestId?: string }>}
 */
export const resolveAccountDeletionRequest = async (
  { user, password, confirmationPhrase },
  {
    reauthenticate,
    getBillingRow,
    getExistingRequestRow,
    upsertProcessingRow,
    cancelStripeSubscriptionIfActive,
    deleteUserOwnedRows,
    deleteAuthUser,
    markRequestCompleted
  }
) => {
  if (!user) return { outcome: 'unauthenticated' };
  if (user.is_anonymous) return { outcome: 'guest_blocked' };
  if (!user.email) return { outcome: 'no_email' };

  // Server-side re-check of the exact phrase — the disabled-until-exact-
  // match button on the client is a UX affordance, never the real gate.
  if (confirmationPhrase !== CONFIRMATION_PHRASE) return { outcome: 'phrase_mismatch' };
  if (!password) return { outcome: 'password_required' };

  // Recent authentication — the authoritative check (a stolen, merely-
  // valid session token is not enough on its own), identical requirement
  // to the prior request-account-deletion flow.
  const { error: reauthError } = await reauthenticate(user.email, password);
  if (reauthError) return { outcome: 'reauth_failed' };

  const { data: existing, error: existingError } = await getExistingRequestRow();
  if (existingError) return { outcome: 'request_lookup_failed' };

  // Defensive only — unreachable in practice, since a 'completed' row
  // means the Auth user was already removed, and this function could
  // never have been reached with a live JWT for that user in that case.
  // Included so this is an explicit, tested outcome rather than an
  // assumption.
  if (existing?.status === 'completed') return { outcome: 'already_deleted' };

  const { data: billingRow, error: billingError } = await getBillingRow();
  if (billingError) return { outcome: 'billing_check_failed' };

  const billingStatusAtRequest = classifyBillingStatus(billingRow);

  // Reconciling a pre-existing request row: ANY row already in
  // ('pending', 'processing') for this user — 'pending' being the OLD
  // 7-day-model's own state, never produced by this function — is
  // reused (updated in place), never left orphaned and never
  // duplicated. This is what safely retires the old model's own
  // outstanding requests the moment their owner uses the new immediate
  // flow: the exact same row that used to mean "scheduled for a future
  // date, cancellable" becomes this request's own 'processing' row,
  // continuing on to 'completed' below like any other. A 'cancelled' or
  // 'completed' historical row is left untouched — getExistingRequestRow's
  // own real implementation (delete-account/index.ts) only ever looks
  // up a row in ('pending','processing'), so a resolved historical row
  // never reaches this function as `existing` at all; a fresh request
  // starts its own new row instead.
  const { data: processingRow, error: upsertError } = await upsertProcessingRow({
    existingId: existing?.id ?? null,
    billingStatusAtRequest
  });
  if (upsertError || !processingRow?.id) return { outcome: 'request_lock_failed' };

  // Billing BEFORE data deletion, data deletion BEFORE the Auth user —
  // the same ordering docs/account-deletion-processor-spec.md's steps
  // 3/5/8 already establish, and for the same reason: stripe_subscription_id
  // must still exist to be cancelled, and the Auth user's cascade must
  // never be the first place any of this is attempted.
  const { error: stripeError } = await cancelStripeSubscriptionIfActive(billingRow);
  if (stripeError) return { outcome: 'stripe_cancel_failed', requestId: processingRow.id };

  const { error: dataDeleteError } = await deleteUserOwnedRows();
  if (dataDeleteError) return { outcome: 'data_delete_failed', requestId: processingRow.id };

  const { error: authDeleteError } = await deleteAuthUser();
  if (authDeleteError) return { outcome: 'auth_delete_failed', requestId: processingRow.id };

  // Best-effort only — see this module's own header. The Auth user is
  // already irreversibly gone at this point; this call's own success or
  // failure is never allowed to change the outcome returned below.
  await markRequestCompleted(processingRow.id).catch(() => {});

  return { outcome: 'deleted' };
};
