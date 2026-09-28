import { computeMomentumTotals } from './momentumQueries';

// "Your Momentum" foundation, Phase 3 — interpretation layer on top of
// momentumQueries.js's raw totals. Returns structured data (strings/
// objects), never JSX - src/components/MomentumPanel.jsx is the one place
// that renders it.
//
// FACTUAL INSIGHT RULES (approved brief) — exactly one short, deterministic
// line per completion, chosen by the CURRENT completion's own journey/
// practiceType, never invented, never a medical claim, never a comparison,
// never "first ever" (Phase 2 did not persist history before it shipped -
// see practiceCompletions.js's own doc comment). Morning/Evening never
// mention minutes (routine duration_seconds is deliberately NULL - see
// practiceCompletions.js). Meditation uses genuine summed duration when
// any exists, otherwise a count-based line - never described as "total
// WakeWise mindful time," only guided-meditation minutes specifically.
export const selectFactualInsight = ({ journey, practiceType, totals }) => {
  if (!totals) return null;
  if (journey === 'morning' && practiceType === 'full_routine') {
    return totals.morningTotal <= 1
      ? 'Morning Reset complete for today.'
      : `${totals.morningTotal} Morning Resets completed.`;
  }
  if (journey === 'evening' && practiceType === 'full_routine') {
    return totals.eveningTotal <= 1
      ? "Tonight's Wind-Down is complete."
      : `${totals.eveningTotal} Evening Wind-Downs completed.`;
  }
  if (practiceType === 'meditation') {
    if (totals.meditationMinutes > 0) {
      return `${totals.meditationMinutes} guided meditation minute${totals.meditationMinutes === 1 ? '' : 's'} completed.`;
    }
    return `${totals.meditationCount} guided meditation${totals.meditationCount === 1 ? '' : 's'} completed.`;
  }
  // An untracked activity (Anytime Reset, standalone/self-guided
  // meditation, Morning Stretch on its own, Support/Grounding/Stress
  // Release/Panic, other guided media) - never fabricate a count for
  // these; the caller simply never asks for an insight here in practice
  // (see each screen's own wiring), this is the honest fallback either way.
  return null;
};

// GENTLE MILESTONES (approved brief) — a small, fixed, config-driven set.
// No streaks, no streak-loss language, no points/levels/rankings/
// leaderboards/competitive badges/medical claims. `metric` names a key
// returned by computeMomentumTotals(); `threshold` is crossed exactly when
// the metric moves from below it to at-or-above it as a direct result of
// the CURRENT completion event (see selectMilestone below) - this is a
// ">=" crossing, not a strict "===", because meditation-minute totals can
// legitimately jump by more than 1 in a single completion (e.g. one long
// session pushing 7 minutes straight to 12) and must still correctly
// register "10 minutes reached" even though the total never equals
// exactly 10. For every purely count-based metric (which can only ever
// increment by exactly 1 per completion event) this is equivalent to a
// strict equality check - see momentumInsights.test.js's own
// threshold-minus-one/exact/plus-one coverage.
//
// PRIORITY ORDER (documented, applied top-to-bottom, first match wins) —
// used only when more than one milestone genuinely crosses on the exact
// same completion event:
//   1. journey-specific to what the user just did (higher threshold before
//      lower, since a single completion can only ever cross one of a
//      pair for the SAME metric anyway - ordering here is for clarity, not
//      because both could fire together)
//   2. cross-journey engagement (distinct active days)
//   3. generic total-practices count (least specific to this moment)
// e.g. a user's 3rd Morning Reset that also happens to be their 3rd
// distinct active day shows "Three mindful mornings," not "Three active
// days" - the message stays about what they just did.
export const MOMENTUM_MILESTONES = Object.freeze([
  {
    id: 'morning-practices-7',
    matchesCompletion: (journey, practiceType) => journey === 'morning' && practiceType === 'full_routine',
    metric: 'morningTotal',
    threshold: 7,
    label: 'Seven mindful mornings',
    supportingLine: 'Small moments can build meaningful momentum.',
    journeyTone: 'morning'
  },
  {
    id: 'morning-practices-3',
    matchesCompletion: (journey, practiceType) => journey === 'morning' && practiceType === 'full_routine',
    metric: 'morningTotal',
    threshold: 3,
    label: 'Three mindful mornings',
    supportingLine: "You're making space for yourself.",
    journeyTone: 'morning'
  },
  {
    id: 'evening-practices-7',
    matchesCompletion: (journey, practiceType) => journey === 'evening' && practiceType === 'full_routine',
    metric: 'eveningTotal',
    threshold: 7,
    label: 'Seven evenings made for rest',
    supportingLine: 'Small moments can build meaningful momentum.',
    journeyTone: 'evening'
  },
  {
    id: 'evening-practices-3',
    matchesCompletion: (journey, practiceType) => journey === 'evening' && practiceType === 'full_routine',
    metric: 'eveningTotal',
    threshold: 3,
    label: 'Three evenings made for rest',
    supportingLine: "You're making space for yourself.",
    journeyTone: 'evening'
  },
  {
    id: 'meditation-minutes-10',
    matchesCompletion: (_journey, practiceType) => practiceType === 'meditation',
    metric: 'meditationMinutes',
    threshold: 10,
    label: 'Ten guided meditation minutes',
    supportingLine: 'Every completed practice counts.',
    journeyTone: 'anytime'
  },
  {
    id: 'active-dates-3',
    matchesCompletion: () => true,
    metric: 'activeDateCount',
    threshold: 3,
    label: 'Three active days',
    supportingLine: "You're making space for yourself.",
    journeyTone: 'anytime'
  },
  {
    id: 'total-practices-7',
    matchesCompletion: () => true,
    metric: 'totalPractices',
    threshold: 7,
    label: 'Seven practices completed',
    supportingLine: 'Small moments can build meaningful momentum.',
    journeyTone: 'anytime'
  },
  {
    id: 'total-practices-3',
    matchesCompletion: () => true,
    metric: 'totalPractices',
    threshold: 3,
    label: 'Three practices completed',
    supportingLine: 'Every completed practice counts.',
    journeyTone: 'anytime'
  }
]);

/**
 * Identifies the ONE milestone (if any) genuinely crossed by the CURRENT
 * completion event - never merely "the user currently has a qualifying
 * total" (that would also fire on every later revisit/rerender). `rows`
 * must include every row this user has (as returned by
 * fetchCompletionRows); `currentSessionId` is the exact, already-known
 * Phase 2 session_id/idempotency identity for the event just recorded -
 * used to compute a genuine "before" total by excluding that one row,
 * never by guessing which row is "current" from a timestamp.
 */
export const selectMilestone = ({ rows, currentSessionId, journey, practiceType }) => {
  const safeRows = Array.isArray(rows) ? rows : [];
  const afterTotals = computeMomentumTotals(safeRows);
  const beforeRows = safeRows.filter((row) => row?.session_id !== currentSessionId);
  const beforeTotals = computeMomentumTotals(beforeRows);

  for (const milestone of MOMENTUM_MILESTONES) {
    if (!milestone.matchesCompletion(journey, practiceType)) continue;
    const before = beforeTotals[milestone.metric] ?? 0;
    const after = afterTotals[milestone.metric] ?? 0;
    if (before < milestone.threshold && after >= milestone.threshold) {
      return milestone;
    }
  }
  return null;
};

// SAME-DEVICE ACKNOWLEDGEMENT GUARD — a milestone is a one-time
// acknowledgement, never re-announced once shown. No new migration exists
// for Phase 3 (approved brief: "Do not create another migration"), so
// this is deliberately the smallest safe mechanism available: a plain,
// user-scoped localStorage key (matching dailyCompletion.js's own
// userId-scoping convention exactly - never an unscoped/shared key, never
// an email address). This can only ever guarantee "shown once on this
// device" - if the same account is used on a second device, or this
// device's storage is cleared, the same milestone-crossing event could
// display again. That is an honest, documented limitation of Phase 3's
// scope, not an oversight - guaranteeing true cross-device once-only
// acknowledgement would require a new server-side table, which Phase 3
// explicitly does not add. Profile (a later phase) can independently
// derive every milestone a user has ever achieved directly from
// practice_completion_events at read time - this guard only ever
// controls the IMMEDIATE completion-screen acknowledgement moment.
const acknowledgementStorageKey = (userId) => `moonlight_momentum_milestones_acknowledged:${userId}`;

export const hasAcknowledgedMilestone = (userId, milestoneId) => {
  if (!userId || !milestoneId) return false;
  try {
    const raw = localStorage.getItem(acknowledgementStorageKey(userId));
    if (!raw) return false;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.includes(milestoneId);
  } catch {
    return false;
  }
};

export const acknowledgeMilestone = (userId, milestoneId) => {
  if (!userId || !milestoneId) return;
  try {
    const raw = localStorage.getItem(acknowledgementStorageKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    const set = new Set(Array.isArray(parsed) ? parsed : []);
    set.add(milestoneId);
    localStorage.setItem(acknowledgementStorageKey(userId), JSON.stringify([...set]));
  } catch {
    // localStorage unavailable this session - the milestone may simply
    // reappear later; never blocks showing it now, never throws.
  }
};

/**
 * The one function each eligible completion screen's own hook calls: given
 * the fetched rows and the current completion's own identity, returns
 * `{ insight, milestone }` - `milestone` is null both when nothing was
 * genuinely crossed AND when it was crossed but already acknowledged once
 * on this device (see the guard above). Never mutates anything itself -
 * the caller (useMomentumCompletion) is responsible for calling
 * acknowledgeMilestone() exactly once it actually renders the milestone.
 */
export const computeMomentumForCompletion = ({ rows, currentSessionId, userId, journey, practiceType }) => {
  const totals = computeMomentumTotals(rows);
  const insight = selectFactualInsight({ journey, practiceType, totals });
  let milestone = selectMilestone({ rows, currentSessionId, journey, practiceType });
  if (milestone && hasAcknowledgedMilestone(userId, milestone.id)) {
    milestone = null;
  }
  return { insight, milestone };
};
