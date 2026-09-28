// Phase 9 — Truthful Journey Outcomes: the display-stage definitions for
// the Morning and Evening pathway components, each naming the real
// session/sessionConstants.js step id(s) it represents so
// session/stageStatus.js's computeStageStatus() can resolve a genuine
// per-stage status. Lives here (not inside MorningJourneyPathway.jsx/
// EveningJourneyPathway.jsx) so those component files export only their
// one component each - react-refresh/only-export-components (this repo's
// established Fast Refresh guard) rejects a component file that also
// exports a non-primitive constant.
//
// Every icon is pulled from journeyIcons.js's JOURNEY_STAGE_ICONS - the
// one shared canonical mapping - never hardcoded here independently, so
// Morning/Evening/Anytime can never again drift apart on the same
// concept's glyph (see journeyIcons.js's own doc comment for the
// Stretch/Meditate correction this now enforces).
import { JOURNEY_STAGE_ICONS } from './journeyIcons';

export const MORNING_PATHWAY_STAGES = [
  { id: 'focus', label: 'Focus', icon: JOURNEY_STAGE_ICONS.focus, stepIds: ['intention'] },
  { id: 'stretch', label: 'Stretch', icon: JOURNEY_STAGE_ICONS.stretch, stepIds: ['stretch'] },
  { id: 'breathe', label: 'Breathe', icon: JOURNEY_STAGE_ICONS.breathe, stepIds: ['breathe'] },
  { id: 'meditate', label: 'Meditate', icon: JOURNEY_STAGE_ICONS.meditate, stepIds: ['meditate'] },
  { id: 'affirm', label: 'Affirm', icon: JOURNEY_STAGE_ICONS.affirm, stepIds: ['affirmation'] }
];

// 'rest' names both 'sleepPreparation' and 'completion' - Prepare for
// Rest is the real screen for the Rest stage, and reaching the terminal
// 'completion' step still means Rest is the last meaningful stage the
// pathway can point to (mirrors eveningJourneyPathwayStage.js's own
// established mapping).
export const EVENING_PATHWAY_STAGES = [
  { id: 'reflect', label: 'Reflect', icon: JOURNEY_STAGE_ICONS.reflect, stepIds: ['reflection'] },
  { id: 'gratitude', label: 'Gratitude', icon: JOURNEY_STAGE_ICONS.gratitude, stepIds: ['gratitude'] },
  { id: 'breathe', label: 'Breathe', icon: JOURNEY_STAGE_ICONS.breathe, stepIds: ['breathing'] },
  { id: 'meditate', label: 'Meditate', icon: JOURNEY_STAGE_ICONS.meditate, stepIds: ['meditation'] },
  { id: 'rest', label: 'Rest', icon: JOURNEY_STAGE_ICONS.rest, stepIds: ['sleepPreparation', 'completion'] }
];
