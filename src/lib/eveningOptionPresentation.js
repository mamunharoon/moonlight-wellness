// Evening Visual Uplift (Phase 7) — safe presentation mapping for
// Reflection/Gratitude preset options.
//
// STORED-DATA REQUIREMENT: this file never changes a single stored value.
// Every key below is the EXACT, byte-identical option string already
// defined in eveningJourneyQuestions.js (REFLECTION_PROMPTS/
// GRATITUDE_PROMPTS) - the same string PromptStepper.jsx/
// EveningEditQuestion.jsx/EveningReviewQuestion.jsx already compare
// against, upsert, and persist via routineResponses.js. This module only
// ever maps that unchanged string to a concise DISPLAY label, a real
// Material Symbol, and an optional short descriptor - purely a rendering
// concern, read-only, no side effects, no database access. A previously
// saved response is still matched by its own real stored string (the map
// key), so it always resolves to the same presentation whether it was
// just tapped or loaded from history; an unrecognised/legacy value simply
// falls through to `getOptionPresentation`'s own safe fallback (the full
// original string, no icon) rather than ever throwing or hiding it.
export const OPTION_PRESENTATION = Object.freeze({
  'went-well': {
    'Reached a small milestone': { label: 'Small milestone', icon: 'flag', descriptor: 'Made meaningful progress' },
    'Had a peaceful moment': { label: 'Peaceful moment', icon: 'spa', descriptor: 'Quiet stillness & ease' },
    'Had a meaningful conversation': { label: 'Meaningful talk', icon: 'forum', descriptor: 'Connected & felt heard' },
    'Stayed calm in a difficult moment': { label: 'Stayed grounded', icon: 'self_improvement', descriptor: 'Calm amidst friction' },
    'Got outside or moved': { label: 'Moved outdoors', icon: 'park', descriptor: 'Fresh air & footsteps' },
    'Helped someone': { label: 'Helped someone', icon: 'favorite', descriptor: 'Kindness or support' },
    'Handled a difficult task': { label: 'Tackled a hurdle', icon: 'bolt', descriptor: 'Did the uncomfortable' },
    'Simply got through the day': { label: 'Simply showed up', icon: 'bedtime', descriptor: 'Gave what I had today' }
  },
  challenged: {
    'Too much to do': { label: 'Heavy workload', icon: 'checklist', descriptor: 'Too much to carry' },
    'Difficult conversation': { label: 'Tough moment', icon: 'chat_bubble', descriptor: 'Difficult conversation' },
    'Low energy': { label: 'Low energy', icon: 'battery_alert', descriptor: 'Felt drained or tired' },
    'Worry or uncertainty': { label: 'Uncertainty', icon: 'psychology', descriptor: 'Worry or racing mind' },
    'Trouble staying focused': { label: 'Scattered focus', icon: 'blur_on', descriptor: 'Trouble staying present' },
    'Felt rushed': { label: 'Felt rushed', icon: 'timer', descriptor: 'Pressured by time' },
    'Plans changed': { label: 'Plans changed', icon: 'sync', descriptor: 'Unexpected shifts' },
    'Something personal': { label: 'Personal weight', icon: 'person', descriptor: 'Something close to you' }
  },
  release: {
    "Today's stress": { label: "Today's stress", icon: 'air', descriptor: 'Decompress & unwind' },
    "A worry I'm carrying": { label: 'Racing mind', icon: 'cyclone', descriptor: 'Quiet heavy thoughts' },
    "What I can't control": { label: 'Out of control', icon: 'pan_tool', descriptor: 'Surrendering what is' },
    'A mistake I made': { label: 'A mistake made', icon: 'undo', descriptor: 'Forgiving myself' },
    'Comparing myself to others': { label: 'Comparison', icon: 'balance', descriptor: 'Returning to my path' },
    'An unfinished task': { label: 'Unfinished tasks', icon: 'pending_actions', descriptor: 'Saved for tomorrow' },
    "Tension I'm holding": { label: 'Physical tension', icon: 'fitness_center', descriptor: 'Softening the body' },
    'Not sure yet': { label: 'Not sure yet', icon: 'nightlight', descriptor: 'Letting go gently' }
  },
  'appreciated-moment': {
    'Morning stillness': { label: 'Morning stillness', icon: 'wb_twilight', descriptor: 'Peaceful start' },
    'A comforting meal': { label: 'A comforting meal', icon: 'restaurant', descriptor: 'Nourishment & flavor' },
    'Kindness from someone': { label: 'Kindness received', icon: 'favorite', descriptor: 'A warm gesture' },
    'A song that lifted me': { label: 'A song that lifted me', icon: 'music_note', descriptor: 'Sounds that brought joy' },
    'Feeling at home': { label: 'Feeling safe at home', icon: 'home', descriptor: 'Comfort & shelter' },
    'A moment of relief': { label: 'A moment of relief', icon: 'auto_awesome', descriptor: 'Tension lifting away' },
    'Fresh air or movement': { label: 'Fresh air & movement', icon: 'air', descriptor: 'Connecting with nature' },
    'A quiet pause': { label: 'A quiet pause', icon: 'pause_circle', descriptor: 'Space just to be' }
  },
  'who-made-better': {
    'Partner or family': { label: 'Partner or family', icon: 'favorite', descriptor: 'Closeness & love' },
    Friend: { label: 'A dear friend', icon: 'emoji_people', descriptor: 'Laughter & shared time' },
    Colleague: { label: 'A colleague', icon: 'work', descriptor: 'Teamwork & ease' },
    'Someone who helped': { label: 'Someone who helped', icon: 'volunteer_activism', descriptor: 'Kind guidance' },
    'Someone who listened': { label: 'Someone who listened', icon: 'hearing', descriptor: 'Felt understood' },
    'A kind stranger': { label: 'A kind stranger', icon: 'wb_sunny', descriptor: 'Brief warm moment' },
    'My community': { label: 'My community', icon: 'groups', descriptor: 'Shared belonging' },
    'I supported myself': { label: 'I supported myself', icon: 'self_improvement', descriptor: 'My patience & grace' }
  },
  'grateful-now': {
    'This quiet moment': { label: 'This quiet moment', icon: 'nightlight', descriptor: 'Stillness & peace' },
    'Someone who cares about me': { label: 'Someone caring', icon: 'favorite', descriptor: "Knowing I'm supported" },
    'A place where I feel safe': { label: 'A place of safety', icon: 'home', descriptor: 'Warmth & comfort' },
    'Something that made me smile': { label: 'A joyful smile', icon: 'mood', descriptor: 'A lift in my spirits' },
    'A small comfort': { label: 'A small comfort', icon: 'auto_awesome', descriptor: 'Simple daily pleasures' },
    'A fresh start tomorrow': { label: 'A fresh start', icon: 'wb_twilight', descriptor: 'New possibilities' },
    'My own effort today': { label: 'My own effort', icon: 'fitness_center', descriptor: 'Giving what I could' },
    'Simply being here': { label: 'Simply being here', icon: 'self_improvement', descriptor: 'Present in this breath' }
  }
});

// Safe fallback — any promptId/value not present above (a future option,
// a StressRelease.jsx/Anytime prompt using this same lookup by mistake, or
// a genuinely historical value that no longer matches any current preset)
// renders exactly as it always did before this mapping existed: the full
// original string, no icon, no descriptor. Never throws.
export const getOptionPresentation = (promptId, value) =>
  OPTION_PRESENTATION[promptId]?.[value] ?? { label: value, icon: null, descriptor: null };
