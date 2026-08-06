import { SESSION_DEFINITIONS } from './sessionDefinitions';

/*
 * Stage 3C — Session Engine, registry accessors (Ticket Group 1)
 *
 * Pure read-only functions over the static SESSION_DEFINITIONS data in
 * sessionDefinitions.js — see IMPORTANT RULES in the Group 1 task brief.
 * No navigation, no localStorage, no Supabase, no React context, no
 * timers, no mutation of the underlying data (every function here reads,
 * never writes). This is the layer a future Session Engine reducer
 * (Group 2) or any read-only inspection tool queries, instead of
 * importing sessionDefinitions.js directly.
 */

export const getAllSessions = () => SESSION_DEFINITIONS;

export const getSessionById = (sessionId) =>
  SESSION_DEFINITIONS.find((session) => session.id === sessionId) ?? null;

export const getSessionsByCategory = (category) =>
  SESSION_DEFINITIONS.filter((session) => session.category === category);

export const getStepById = (sessionId, stepId) => {
  const session = getSessionById(sessionId);
  if (!session) return null;
  return session.steps.find((step) => step.id === stepId) ?? null;
};

export const getStepIndex = (sessionId, stepId) => {
  const session = getSessionById(sessionId);
  if (!session) return -1;
  return session.steps.findIndex((step) => step.id === stepId);
};

// Reverse lookup: given a route path (e.g. from useLocation()), find the
// session + step that owns it, if any. Exists so a future engine or
// harness can answer "what session step is the current route" without
// hand-maintaining a second stepPaths-style map — the exact duplication
// named in the Stage 3C execution plan §7/§24. Not consumed by anything
// yet in Group 1.
export const findStepByRoute = (route) => {
  for (const session of SESSION_DEFINITIONS) {
    const step = session.steps.find((s) => s.route === route);
    if (step) return { session, step };
  }
  return null;
};
