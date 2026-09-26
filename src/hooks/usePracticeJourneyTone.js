import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { resolvePracticeJourneyTone, capturePracticeJourneyTone } from '../lib/practiceJourneyContext';
import { currentDaypartJourneyTone } from '../lib/dayPartJourneyTone';

// Context-aware Meditation/Breathing theming — captures the ONE
// journeyTone a standalone practice screen (self-guided Meditation,
// standalone Breathe) uses for its entire lifecycle: setup, countdown,
// active session, completion, Back-to-setup, replay. Read exactly once,
// at first mount (lazy useState initializer) - resolvePracticeJourneyTone
// itself is deliberately not re-run on every render, per the explicit
// requirement not to recalculate the colour from the clock mid-practice
// even if a daypart boundary is crossed while the practice is active.
//
// The resolved value is written straight back via
// capturePracticeJourneyTone so a LATER screen in this same practice on a
// different route (e.g. the completion screen, a separate mount) reads
// the same captured value back out instead of re-resolving (and possibly
// landing on a different daypart fallback, or missing the launch state
// entirely since router state isn't redelivered to an unrelated mount).
//
// `explicitTone` (optional): a caller that already knows its own
// unambiguous journey can short-circuit capture/fallback entirely - none
// of today's standalone screens pass one (Morning/Evening's own embedded
// Breathe/Meditate screens use their literal 'morning'/'evening' directly
// instead of this hook at all), but it's accepted for a future caller.
//
// `enabled` (default true): lets a component that renders BOTH a
// standalone and a non-standalone branch from one function (QuietBreathing.jsx,
// `standalone` prop) call this hook unconditionally on every render -
// required by React's Rules of Hooks - while genuinely skipping
// resolution/capture entirely for the branch that doesn't need it
// (Support's own embedded, non-standalone usage has its own fixed
// journey identity already and must never read or write this key).
// Returns null when disabled.
export const usePracticeJourneyTone = (explicitTone, enabled = true) => {
  const location = useLocation();
  const { effectiveTimezone } = useAlarm();
  const [journeyTone] = useState(() => {
    if (!enabled) return null;
    const resolved = resolvePracticeJourneyTone({
      explicitTone: explicitTone ?? location.state?.journeyTone,
      daypartFallback: currentDaypartJourneyTone(effectiveTimezone)
    });
    capturePracticeJourneyTone(resolved);
    return resolved;
  });
  return journeyTone;
};
