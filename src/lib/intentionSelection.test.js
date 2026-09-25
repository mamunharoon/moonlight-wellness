import { describe, it, expect } from 'vitest';
import {
  toggleIntention,
  addCustomIntention,
  sanitizeIntentions,
  roleForIndex,
  MAX_INTENTIONS,
  LIMIT_MESSAGE,
  CUSTOM_LIMIT_MESSAGE,
  DUPLICATE_INTENTION_MESSAGE
} from './intentionSelection';

describe('toggleIntention - selection limits, ordering, promotion, custom intention', () => {
  it('selecting from empty adds it as Primary (index 0)', () => {
    const { intentions, limitReached } = toggleIntention([], 'Stay calm');
    expect(intentions).toEqual(['Stay calm']);
    expect(limitReached).toBe(false);
  });

  it('selecting a second, different value appends it as Supporting (index 1)', () => {
    const { intentions, limitReached } = toggleIntention(['Stay calm'], 'Be grateful');
    expect(intentions).toEqual(['Stay calm', 'Be grateful']);
    expect(limitReached).toBe(false);
  });

  it('MAX_INTENTIONS is 2, and tapping a third, not-yet-selected value is rejected with limitReached - the existing pair is never replaced', () => {
    expect(MAX_INTENTIONS).toBe(2);
    const current = ['Stay calm', 'Be grateful'];
    const { intentions, limitReached } = toggleIntention(current, 'Be patient');
    expect(limitReached).toBe(true);
    expect(intentions).toBe(current); // same reference - genuinely untouched
  });

  it('LIMIT_MESSAGE is the exact required copy', () => {
    expect(LIMIT_MESSAGE).toBe('You can choose up to two intentions.');
  });

  it('tapping an already-selected preset deselects it', () => {
    const { intentions, limitReached } = toggleIntention(['Stay calm', 'Be grateful'], 'Stay calm');
    expect(intentions).toEqual(['Be grateful']);
    expect(limitReached).toBe(false);
  });

  it('removing Primary while Supporting remains promotes Supporting to Primary (falls out of a plain filter, not a special case)', () => {
    const { intentions } = toggleIntention(['Stay calm', 'Be grateful'], 'Stay calm');
    expect(intentions[0]).toBe('Be grateful');
    expect(intentions.length).toBe(1);
  });

  it('removing Supporting leaves Primary untouched', () => {
    const { intentions } = toggleIntention(['Stay calm', 'Be grateful'], 'Be grateful');
    expect(intentions).toEqual(['Stay calm']);
  });

  it('a custom intention counts toward the two-item limit exactly like a preset', () => {
    const current = ['Stay calm', 'My own custom thing'];
    const { intentions, limitReached } = toggleIntention(current, 'Be patient');
    expect(limitReached).toBe(true);
    expect(intentions).toBe(current);
  });

  it('a custom intention can be selected as either Primary or Supporting', () => {
    expect(toggleIntention([], 'My custom goal').intentions).toEqual(['My custom goal']);
    expect(toggleIntention(['Stay calm'], 'My custom goal').intentions).toEqual(['Stay calm', 'My custom goal']);
  });

  it('a custom intention can be deselected by tapping it again, promoting whatever remains', () => {
    const { intentions } = toggleIntention(['My custom goal', 'Stay calm'], 'My custom goal');
    expect(intentions).toEqual(['Stay calm']);
  });

  it('swapping order: deselect Primary, then reselect it - it rejoins as Supporting (tap order determines role, not original position)', () => {
    let state = ['Stay calm', 'Be grateful'];
    state = toggleIntention(state, 'Stay calm').intentions; // -> ['Be grateful']
    state = toggleIntention(state, 'Stay calm').intentions; // -> ['Be grateful', 'Stay calm']
    expect(state).toEqual(['Be grateful', 'Stay calm']);
  });

  it('two presets -> custom+preset: deselect one preset, add a custom - the custom takes the freed slot in order', () => {
    let state = ['Stay calm', 'Be grateful'];
    state = toggleIntention(state, 'Be grateful').intentions; // -> ['Stay calm']
    state = toggleIntention(state, 'My own thing').intentions; // -> ['Stay calm', 'My own thing']
    expect(state).toEqual(['Stay calm', 'My own thing']);
  });

  it('duplicate rejection is case-insensitive - "stay calm" matches an existing "Stay calm" and deselects it, never adding a second entry', () => {
    const { intentions } = toggleIntention(['Stay calm'], 'stay calm');
    expect(intentions).toEqual([]);
  });

  it('whitespace is normalised for comparison only - trims for both matching and storage, without altering interior casing/spacing', () => {
    const { intentions } = toggleIntention(['Take one step forward'], '  Take one step forward  ');
    expect(intentions).toEqual([]); // matched and deselected, not treated as a distinct third value

    const added = toggleIntention([], '  My Own Wording  ').intentions;
    expect(added).toEqual(['My Own Wording']); // stored trimmed, casing/interior spacing preserved verbatim
  });

  it('an empty or whitespace-only value is a no-op - never added, never counted, never mistaken for a deselect', () => {
    const current = ['Stay calm'];
    expect(toggleIntention(current, '   ').intentions).toBe(current);
    expect(toggleIntention(current, '').intentions).toBe(current);
  });

  it('never mutates the input array - always returns a new array (or the same reference only when genuinely unchanged)', () => {
    const current = ['Stay calm'];
    const frozen = Object.freeze([...current]);
    expect(() => toggleIntention(frozen, 'Be grateful')).not.toThrow();
    const { intentions } = toggleIntention(frozen, 'Be grateful');
    expect(intentions).not.toBe(frozen);
    expect(frozen).toEqual(['Stay calm']); // original untouched
  });
});

describe('addCustomIntention - ADD-ONLY custom-intention defect fix (ChangeIntention.jsx "Add your own"), never a toggle', () => {
  it('zero existing selections: a valid custom value is added as Primary', () => {
    const { intentions, status } = addCustomIntention([], 'My own goal');
    expect(status).toBe('added');
    expect(intentions).toEqual(['My own goal']);
  });

  it('one existing selection: a valid, distinct custom value is added as Supporting', () => {
    const { intentions, status } = addCustomIntention(['Stay calm'], 'My own goal');
    expect(status).toBe('added');
    expect(intentions).toEqual(['Stay calm', 'My own goal']);
  });

  it('two existing selections: a new, distinct custom value is rejected as limit-reached - the existing pair is never replaced or silently dropped', () => {
    const current = ['Stay calm', 'Be grateful'];
    const { intentions, status } = addCustomIntention(current, 'My own goal');
    expect(status).toBe('limit-reached');
    expect(intentions).toBe(current); // same reference - genuinely untouched
  });

  it('typing an already-selected value (exact case) is rejected as a duplicate - it does NOT toggle/deselect the existing entry, unlike toggleIntention', () => {
    const current = ['Stay calm'];
    const { intentions, status } = addCustomIntention(current, 'Stay calm');
    expect(status).toBe('duplicate');
    expect(intentions).toBe(current); // still there - never removed
  });

  it('duplicate rejection is case-insensitive, same as toggleIntention\'s own comparison rule', () => {
    const current = ['Stay calm'];
    const { intentions, status } = addCustomIntention(current, 'STAY CALM');
    expect(status).toBe('duplicate');
    expect(intentions).toBe(current);
  });

  it('a duplicate match against a CUSTOM (non-preset) existing value is also rejected, not just against presets', () => {
    const current = ['My own goal'];
    const { intentions, status } = addCustomIntention(current, '  my own goal  ');
    expect(status).toBe('duplicate');
    expect(intentions).toBe(current);
  });

  it('blank/whitespace-only input is a no-op status, never added and never mistaken for a duplicate or limit-reached', () => {
    const current = ['Stay calm'];
    expect(addCustomIntention(current, '').status).toBe('blank');
    expect(addCustomIntention(current, '   ').status).toBe('blank');
    expect(addCustomIntention(current, '').intentions).toBe(current);
  });

  it('a genuinely new value is stored trimmed, with interior casing/spacing preserved verbatim', () => {
    const { intentions, status } = addCustomIntention([], '  My Own Wording  ');
    expect(status).toBe('added');
    expect(intentions).toEqual(['My Own Wording']);
  });

  it('never mutates the input array - always returns a new array on success, the same reference on any rejection', () => {
    const current = Object.freeze(['Stay calm']);
    expect(() => addCustomIntention(current, 'Be grateful')).not.toThrow();
    const added = addCustomIntention(current, 'Be grateful');
    expect(added.intentions).not.toBe(current);
    expect(current).toEqual(['Stay calm']); // original untouched
  });

  it('CUSTOM_LIMIT_MESSAGE and DUPLICATE_INTENTION_MESSAGE are the exact required copy, distinct from the shared chip-tap LIMIT_MESSAGE', () => {
    expect(CUSTOM_LIMIT_MESSAGE).toBe('You can choose up to two intentions. Remove one before adding your own.');
    expect(DUPLICATE_INTENTION_MESSAGE).toBe('That intention is already selected.');
    expect(CUSTOM_LIMIT_MESSAGE).not.toBe(LIMIT_MESSAGE);
  });
});

describe('roleForIndex - purely positional, never a stored field', () => {
  it('index 0 is Primary, index 1 is Supporting, anything else is null', () => {
    expect(roleForIndex(0)).toBe('Primary');
    expect(roleForIndex(1)).toBe('Supporting');
    expect(roleForIndex(-1)).toBe(null);
    expect(roleForIndex(2)).toBe(null);
  });
});

describe('sanitizeIntentions - legacy single-value loading and defensive normalisation', () => {
  it('a legacy single-item array loads unchanged as a one-item collection', () => {
    expect(sanitizeIntentions(['Stay calm'])).toEqual(['Stay calm']);
  });

  it('a valid two-item array loads unchanged, order preserved', () => {
    expect(sanitizeIntentions(['Stay calm', 'Be grateful'])).toEqual(['Stay calm', 'Be grateful']);
  });

  it('drops case-insensitive duplicates, keeping the first occurrence (order-preserving dedup)', () => {
    expect(sanitizeIntentions(['Stay calm', 'stay calm', 'Be grateful'])).toEqual(['Stay calm', 'Be grateful']);
  });

  it('caps at MAX_INTENTIONS even if more were somehow stored', () => {
    expect(sanitizeIntentions(['Stay calm', 'Be grateful', 'Be patient'])).toEqual(['Stay calm', 'Be grateful']);
  });

  it('drops blank/whitespace-only and non-string entries', () => {
    expect(sanitizeIntentions(['Stay calm', '   ', 42, null, 'Be grateful'])).toEqual(['Stay calm', 'Be grateful']);
  });

  it('trims each entry', () => {
    expect(sanitizeIntentions(['  Stay calm  '])).toEqual(['Stay calm']);
  });

  it('returns an empty array for anything not an array (null, undefined, a string, an object)', () => {
    expect(sanitizeIntentions(null)).toEqual([]);
    expect(sanitizeIntentions(undefined)).toEqual([]);
    expect(sanitizeIntentions('Stay calm')).toEqual([]);
    expect(sanitizeIntentions({ 0: 'Stay calm' })).toEqual([]);
  });

  it('returns an empty array for an empty array', () => {
    expect(sanitizeIntentions([])).toEqual([]);
  });

  it('never mutates the input array', () => {
    const input = Object.freeze(['Stay calm', 'Be grateful']);
    expect(() => sanitizeIntentions(input)).not.toThrow();
    expect(sanitizeIntentions(input)).not.toBe(input);
  });
});
