// Phase 3 (Prepare for Rest subphase, round 2 UX correction) — real
// sliding switches (not a full-bright-fill row) for the four preparation
// actions, and an explicit, expanded-by-default "choose a bedtime video
// or sleep sound" section instead of a vague collapsed "guidance" row.
// No DOM rendering is available in this repo's Vitest - source-level
// checks, matching every other regression guard in this codebase.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relativePath) => readFileSync(fileURLToPath(new URL(relativePath, import.meta.url)), 'utf-8');

const source = read('./PrepareForRest.jsx');
const toggleRowSource = read('../components/evening/PrepareToggleRow.jsx');
const chooserSource = read('../components/evening/BedtimeMediaChooser.jsx');
const manifestSource = read('../lib/betaVideoManifest.js');
const cssSource = read('../index.css');
const tailwindConfigSource = read('../../tailwind.config.js');

const PREP_ITEMS = [
  { id: 'phone', title: 'Put your phone down soon.', support: "Place it face down when you're ready." },
  { id: 'water', title: 'Have a little water.', support: 'Take a small sip if you need one.' },
  { id: 'dim', title: 'Dim the room.', support: 'Create a softer, quieter space.' },
  { id: 'finish', title: 'Let the day finish.', support: 'Everything else can wait until tomorrow.' }
];

describe('Four exact approved preparation actions, in order, with their exact supporting text', () => {
  it('PREP_ITEMS matches the approved id/title/support list exactly', () => {
    const block = source.match(/const PREP_ITEMS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    for (const item of PREP_ITEMS) {
      expect(block).toMatch(new RegExp(`id: '${item.id}'`));
      expect(block).toMatch(new RegExp(`title: '${item.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`));
    }
  });

  it('no nervous-system, melatonin, medical, or "must/required" mandatory-health wording anywhere in the checklist copy', () => {
    const block = source.match(/const PREP_ITEMS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block).not.toMatch(/nervous system|melatonin|medical|treat(s|ment)?\b|cure|diagnos/i);
  });
});

describe('Checklist state: initially all unselected, genuinely multi-select', () => {
  it('selectedPrep starts as an empty Set - nothing pre-checked', () => {
    expect(source).toMatch(/const \[selectedPrep, setSelectedPrep\] = useState\(\(\) => new Set\(\)\);/);
  });

  it('togglePrep adds/removes from the Set independently - never clears the others (no single-select exclusivity), so multiple switches can be On at once', () => {
    const body = source.match(/const togglePrep = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/const next = new Set\(prev\);/);
    expect(body).toMatch(/if \(next\.has\(id\)\) next\.delete\(id\);/);
    expect(body).toMatch(/else next\.add\(id\);/);
    expect(body).not.toMatch(/next\.clear\(\)/);
  });
});

// 1, 2. Every row contains a switch; role="switch"/aria-checked.
describe('PrepareToggleRow - a real switch (role="switch"/aria-checked), never role="button"/aria-pressed', () => {
  it('the control carries role="switch" and aria-checked driven by `selected`', () => {
    expect(toggleRowSource).toMatch(/role="switch"/);
    expect(toggleRowSource).toMatch(/aria-checked=\{selected\}/);
    const code = toggleRowSource.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toMatch(/aria-pressed/);
  });

  it('the whole row is one real <button> (accessible action label is the title text inside it) - the entire surface, not just the switch glyph, toggles it', () => {
    expect(toggleRowSource).toMatch(/<button\s*\n\s*type="button"\s*\n\s*role="switch"/);
    expect(toggleRowSource).toMatch(/onClick=\{onToggle\}/);
  });

  it('meets the 56px minimum height, comfortably exceeding the 44x44 minimum effective target', () => {
    expect(toggleRowSource).toMatch(/min-h-\[56px\]/);
  });
});

// 3. Off knob/track state.
describe('PrepareToggleRow - OFF state: muted track, knob on the left, no full colour (Build 15 visual refinement)', () => {
  // Context-aware Meditation/Breathing theming consistency audit — found
  // live: this pinned assertion had actually been encoding the opacity-
  // on-plain-hex-var bug (a /<n> modifier directly on the plain-hex
  // evening-accent token resolves to fully transparent - see
  // JourneyGlow.jsx's own doc comment) - the unselected row's own border
  // was almost certainly invisible in production. Fixed with the alpha-
  // safe -tint RGB-triplet token.
  it('track is a muted deep slate (bg-evening-track-off, calculated ~3.2:1 against the row) when off, row keeps its deep surface-container background with a visible border (the alpha-safe evening-accent-tint/55 form)', () => {
    expect(toggleRowSource).toMatch(/selected \? 'bg-evening-accent' : 'bg-evening-track-off'/);
    expect(toggleRowSource).toMatch(/'bg-surface-container border-evening-accent-tint\/55/);
  });

  it('the knob sits at the left (translate-x-0) when off, and is a dark navy fill (surface-container-lowest) with a thin evening-accent ring - not the old bright bg-on-surface circle', () => {
    expect(toggleRowSource).toMatch(/selected \? 'translate-x-5' : 'translate-x-0'/);
    expect(toggleRowSource).toMatch(/bg-surface-container-lowest border border-evening-accent/);
    expect(toggleRowSource).not.toMatch(/bg-on-surface transition-transform/);
  });
});

// 4, 5. On: knob moves right + blue accent; row does NOT become a full bright-blue fill.
describe('PrepareToggleRow - ON state: subtle tint only (never a full bright-blue fill), knob slides right, blue track', () => {
  it('the row itself only gains a SUBTLE tint (the alpha-safe evening-accent-tint/10 form) plus a full-strength border - never a solid/opaque evening-accent fill', () => {
    expect(toggleRowSource).toMatch(/'bg-evening-accent-tint\/10 border-evening-accent/);
    expect(toggleRowSource).not.toMatch(/'bg-evening-accent border-evening-accent/);
  });

  it('the switch track itself fills solid evening-accent blue when on - the strong colour lives in the switch, not the row - and the knob stays dark navy in both states (only the track colour and position change)', () => {
    expect(toggleRowSource).toMatch(/selected \? 'bg-evening-accent' : 'bg-evening-track-off'/);
    // The knob's own className has no selected-conditional colour branch at
    // all - the same dark-navy-plus-ring fill renders in both states.
    const knobClassMatch = toggleRowSource.match(/className=\{`absolute top-0\.5 left-0\.5 w-5 h-5 rounded-full ([^$]+?) transition-transform/);
    expect(knobClassMatch?.[1]).toBe('bg-surface-container-lowest border border-evening-accent');
  });

  it('the title becomes bold and accent-coloured when on (never colour alone) - the support text/icon stay as they were, keeping the row itself visually calm', () => {
    expect(toggleRowSource).toMatch(/selected \? 'text-evening-accent font-bold' : 'text-on-surface font-medium'/);
  });
});

// Build 15 selectable-control visual refinement - new evening-track-off
// token, and real, computed WCAG contrast for every new colour pairing
// this refinement introduces (row border, switch track/knob) - genuinely
// calculated, not merely asserted, matching this repo's own established
// precedent (see AnswerOptionButton.test.js's gratitude-accent contrast
// test).
describe('evening-track-off - new additive token, contrast-verified', () => {
  it('index.css defines it without touching evening-accent/gratitude-accent/primary', () => {
    expect(cssSource).toMatch(/--color-evening-track-off: #686d7a;/);
    expect(cssSource).toMatch(/--color-evening-accent: #9fb4f0;/); // unchanged
  });

  it('tailwind.config.js exposes it as a real utility-generating colour', () => {
    expect(tailwindConfigSource).toMatch(/"evening-track-off": "var\(--color-evening-track-off\)"/);
  });

  const relLum = (hex) => {
    const c = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255);
    const lin = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  };
  const contrast = (a, b) => {
    const [l1, l2] = [relLum(a), relLum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const surfaceContainer = '#171f33';
  const surfaceContainerLowest = '#060e20';
  const trackOff = '#686d7a';
  const eveningAccent = '#9fb4f0';

  it('track (off) vs row background clears the 3:1 AA non-text boundary', () => {
    expect(contrast(trackOff, surfaceContainer)).toBeGreaterThanOrEqual(3);
  });

  it('knob fill (surface-container-lowest) vs track (off) clears the 3:1 AA non-text boundary - the knob stays clearly distinguishable from its own track', () => {
    expect(contrast(surfaceContainerLowest, trackOff)).toBeGreaterThanOrEqual(3);
  });

  it('knob fill (surface-container-lowest) vs track (on, evening-accent) clears the 3:1 AA non-text boundary by a wide margin', () => {
    expect(contrast(surfaceContainerLowest, eveningAccent)).toBeGreaterThanOrEqual(3);
  });

  it('evening-accent/55 row border vs row background clears the 3:1 AA non-text boundary', () => {
    const blend = (fgHex, alpha, bgHex) => {
      const fg = fgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
      const bg = bgHex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
      const out = fg.map((c, i) => Math.round(alpha * c + (1 - alpha) * bg[i]));
      return '#' + out.map((c) => c.toString(16).padStart(2, '0')).join('');
    };
    const blended = blend(eveningAccent, 0.55, surfaceContainer);
    expect(contrast(blended, surfaceContainer)).toBeGreaterThanOrEqual(3);
  });
});

// 6. Multiple switches can be On - already covered by the togglePrep test above; this checks the rendering side.
describe('Multiple switches can be On simultaneously', () => {
  it('each row\'s selected state is derived independently from selectedPrep.has(item.id) - no shared/exclusive selection variable', () => {
    expect(source).toMatch(/selected=\{selectedPrep\.has\(item\.id\)\}/);
  });
});

// 7. No tick/checkmark.
describe('No tick/checkmark anywhere on the preparation rows', () => {
  it('PrepareToggleRow never renders check_circle/check or a navigation chevron', () => {
    expect(toggleRowSource).not.toMatch(/check_circle|chevron_right|chevron_left/);
  });
});

// New colour tokens (unchanged by this round - still additive).
describe('evening-accent/on-evening-accent - additive, contrast-verified tokens', () => {
  it('index.css defines them without touching gratitude-accent/primary', () => {
    expect(cssSource).toMatch(/--color-evening-accent: #9fb4f0;/);
    expect(cssSource).toMatch(/--color-on-evening-accent: #0b1326;/);
  });

  it('tailwind.config.js exposes them as real utility-generating colours', () => {
    expect(tailwindConfigSource).toMatch(/"evening-accent": "var\(--color-evening-accent\)"/);
    expect(tailwindConfigSource).toMatch(/"on-evening-accent": "var\(--color-on-evening-accent\)"/);
  });
});

// Build 16 physical-iPhone correction (F10) — "Choose a bedtime video or
// sleep sound" no longer expands the whole catalogue in-page (that made
// this screen substantially longer, pushing the checklist and Ready for
// Sleep off-screen together with the whole catalogue). It's now a single
// compact control that opens a dedicated BedtimeMediaChooser overlay -
// see that component's own test coverage below and its own doc comment.
describe('Bedtime media control: compact heading, no in-page catalogue expansion', () => {
  it('heading reads exactly "Choose a bedtime video or sleep sound" on the compact control', () => {
    expect(source).toMatch(/Choose a bedtime video or sleep sound/);
  });

  it('never says "Would some ... guidance help?" (the earlier, too-vague heading this corrects)', () => {
    expect(source).not.toMatch(/Would some.*guidance help\?/);
  });

  it('never says "music" anywhere in the GUIDED_VIDEOS/SLEEP_SOUNDS catalogue data - these are ambient sound, not music', () => {
    const videosBlock = source.match(/const GUIDED_VIDEOS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    const soundsBlock = source.match(/const SLEEP_SOUNDS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(videosBlock).not.toMatch(/music/i);
    expect(soundsBlock).not.toMatch(/music/i);
  });

  it('the compact control opens the chooser (setChooserOpen(true)) - it no longer renders any catalogue rows itself, only when nothing is yet selected', () => {
    const bodyMatch = source.match(/\) : \(\s*<button\s*\n\s*type="button"\s*\n\s*onClick=\{\(\) => setChooserOpen\(true\)\}[\s\S]*?<\/button>\s*\n\s*\)\}/);
    expect(bodyMatch).not.toBeNull();
    expect(source).not.toMatch(/aria-controls="prepare-for-rest-guidance"/);
    expect(source).not.toMatch(/aria-controls="prepare-for-rest-more-guidance"/);
  });
});

// Every real catalogue id (4 guided videos, 10 sleep sounds) is still
// available somewhere on this page - now inside GUIDED_VIDEOS/
// SLEEP_SOUNDS (passed to the chooser), not split into featured/more.
describe('Complete bedtime catalogue: all 4 guided videos and all 10 sleep sounds, real manifest ids, no duplicates', () => {
  it('GUIDED_VIDEOS has exactly the 4 real guided-video ids, each appearing once', () => {
    const block = source.match(/const GUIDED_VIDEOS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    const ids = [...block.matchAll(/id: '([A-Z0-9]+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['E05', 'E30', 'E20', 'E27']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('SLEEP_SOUNDS has exactly the 10 real sleep-sound ids (SL01-SL10), each appearing once', () => {
    const block = source.match(/const SLEEP_SOUNDS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    const ids = [...block.matchAll(/id: '([A-Z0-9]+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['SL01', 'SL02', 'SL03', 'SL04', 'SL05', 'SL06', 'SL07', 'SL08', 'SL09', 'SL10']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('E05 and SL01 are real entries in betaVideoManifest.js - verified against the actual manifest source, not merely asserted', () => {
    expect(manifestSource).toMatch(/id: 'E05',\s*\n\s*title: 'Night-time Calm',/);
    expect(manifestSource).toMatch(/id: 'SL01',\s*\n\s*title: 'Rain',/);
  });

  it('every id referenced anywhere on this page (E05, E20, E27, E30, SL01-SL10) is a real entry in the manifest', () => {
    for (const id of ['E05', 'E20', 'E27', 'E30', 'SL01', 'SL02', 'SL03', 'SL04', 'SL05', 'SL06', 'SL07', 'SL08', 'SL09', 'SL10']) {
      expect(source).toMatch(new RegExp(`id: '${id}'`));
      expect(manifestSource).toMatch(new RegExp(`id: '${id}',`));
    }
  });

  it('duration is entry.durationLabel (real, spec-provided) or a real cached "~N min", falling back to undefined (no badge) - never a fabricated placeholder', () => {
    expect(source).toMatch(/const duration = entry\.durationLabel \|\| \(cachedMinutes \? `~\$\{cachedMinutes\} min` : undefined\);/);
  });
});

// BedtimeMediaChooser - the dedicated overlay itself (F10).
describe('BedtimeMediaChooser: full catalogue, clearly separated categories, select-only (never auto-plays), real Close/Escape', () => {
  it('renders two clearly separated, correctly labelled sections - "Guided video" and "Sleep sounds"', () => {
    expect(chooserSource).toMatch(/>Guided video<\/h3>/);
    expect(chooserSource).toMatch(/>Sleep sounds<\/h3>/);
  });

  it('every row calls onSelect(id) on tap - it never calls a play/open-video handler itself', () => {
    expect(chooserSource).toMatch(/onClick=\{\(\) => onSelect\(id\)\}/g);
    expect(chooserSource).not.toMatch(/handleSelect|openVideo/);
  });

  it('reuses BetaVideoRow for every catalogue item, never a hand-rolled row', () => {
    expect(chooserSource).toMatch(/<BetaVideoRow key=\{id\} title=\{entry\.title\} description=\{blurb\} duration=\{duration\} onClick=\{\(\) => onSelect\(id\)\} \/>/g);
  });

  it('has a real 44px+ Close control with an accessible name, and closes on Escape', () => {
    expect(chooserSource).toMatch(/aria-label="Close"/);
    expect(chooserSource).toMatch(/w-11 h-11 rounded-full/);
    expect(chooserSource).toMatch(/if \(e\.key === 'Escape'\) onClose\(\);/);
  });

  it('the catalogue body is its own independent scroll owner (overflow-y-auto), separate from the backdrop', () => {
    expect(chooserSource).toMatch(/overflow-y-auto/);
  });

  it('a tap on the backdrop closes the chooser, but a tap inside the header or catalogue body does not (stopPropagation on both)', () => {
    const stopPropCount = (chooserSource.match(/onClick=\{\(e\) => e\.stopPropagation\(\)\}/g) ?? []).length;
    expect(stopPropCount).toBe(2);
    // z-[110], not z-[100] - see BedtimeMediaChooser.jsx's own doc comment
    // for the real stacking-context bug this deliberately avoids.
    expect(chooserSource).toMatch(/className="fixed inset-0 z-\[110\][^"]*"\s*\n\s*role="dialog"\s*\n\s*aria-modal="true"\s*\n\s*aria-label="[^"]*"\s*\n\s*onClick=\{onClose\}/);
  });

  it('renders as a sibling of EveningSceneShell in PrepareForRest.jsx, never nested inside its children - the real fix for the stacking-context bug (see BedtimeMediaChooser.jsx\'s own doc comment)', () => {
    const shellCloseIdx = source.indexOf('</EveningSceneShell>');
    const chooserRenderIdx = source.indexOf('{chooserOpen && (');
    expect(shellCloseIdx).toBeGreaterThan(-1);
    expect(chooserRenderIdx).toBeGreaterThan(shellCloseIdx);
  });
});

// Selecting vs playing are two distinct actions (F10's own required test
// matrix: "select a guided video" and "play the selected item" are
// separate steps).
describe('Choosing a bedtime item is distinct from playing it', () => {
  it('handleChooseBedtimeMedia (passed to the chooser as onSelect) only sets state and closes the chooser - it never calls handleSelect/opens BetaVideoModal itself', () => {
    const body = source.match(/const handleChooseBedtimeMedia = \(id\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/setSelectedBedtimeId\(id\);/);
    expect(body).toMatch(/setChooserOpen\(false\);/);
    expect(body).not.toMatch(/handleSelect/);
  });

  it('the compact summary card (once something is selected) is what actually plays it, via the same handleSelect(id) every other BetaVideoRow tap in this app already uses', () => {
    expect(source).toMatch(/onClick=\{\(\) => handleSelect\(selectedBedtimeId\)\}/);
  });

  it('the summary card is explicitly labelled by content type ("Guided video selected" / "Sleep sound selected")', () => {
    expect(source).toMatch(/\{selectedBedtimeIsSound \? 'Sleep sound' : 'Guided video'\} selected/);
  });

  it('a "Change selection" control reopens the chooser without clearing the existing selection (setChooserOpen(true) only, no setSelectedBedtimeId call nearby)', () => {
    const changeBlock = source.match(/Change selection[\s\S]{0,20}/)?.[0] ?? '';
    expect(source).toMatch(/onClick=\{\(\) => setChooserOpen\(true\)\}\s*\n\s*className="text-xs font-semibold[^"]*"\s*\n\s*>\s*\n\s*Change selection/);
    expect(changeBlock).not.toBe('');
  });
});

// The chooser and the compact control/summary appear before Ready for
// Sleep, in source order, matching the required layout (checklist ->
// bedtime chooser/summary -> primary action).
describe('Bedtime chooser control sits between the checklist and Ready for Sleep', () => {
  it('the compact control/summary block appears after the checklist and before {primaryAction}, in source order', () => {
    const checklistIdx = source.indexOf('PREP_ITEMS.map');
    const bedtimeIdx = source.indexOf('selectedBedtimeItem ?');
    const primaryIdx = source.indexOf('{primaryAction}');
    expect(checklistIdx).toBeGreaterThan(-1);
    expect(bedtimeIdx).toBeGreaterThan(checklistIdx);
    expect(primaryIdx).toBeGreaterThan(bedtimeIdx);
  });
});

// 15, 17, 18. Ready for Sleep works regardless of guidance/checklist state, fires once, double-tap guarded.
describe('Ready for Sleep: works with or without guidance played or checklist selections, fires the one real transition exactly once, double-tap guarded', () => {
  it('handleReadyForSleep never reads selectedPrep or any guidance-open state - identical behaviour regardless', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).not.toMatch(/selectedPrep|guidanceOpen|moreGuidanceOpen/);
  });

  it('advanceStep is guarded exactly like every other Session-Engine page before navigating to the existing /evening-complete route', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(state\.status === 'playing' && currentStep\?\.id === 'sleepPreparation'\) \{\s*\n\s*advanceStep\(\);\s*\n\s*\}/);
    expect(body).toMatch(/navigate\('\/evening-complete'\);/);
  });

  it('advanceStep is called from nowhere except handleReadyForSleep', () => {
    const allAdvanceStepCalls = source.match(/advanceStep\(\);/g) ?? [];
    expect(allAdvanceStepCalls.length).toBe(1);
  });

  it('isAdvancing guards against a rapid double tap, and disables the button while advancing', () => {
    const body = source.match(/const handleReadyForSleep = \(\) => \{[\s\S]*?\n {2}\};/)?.[0] ?? '';
    expect(body).toMatch(/if \(isAdvancing\) return;\s*\n\s*setIsAdvancing\(true\);/);
    expect(source).toMatch(/disabled=\{isAdvancing\}/);
  });
});

// 14. Video/sound Close returns with switch state preserved.
describe('Guidance video/sound open and close never touch checklist state - same mounted page throughout', () => {
  it('closeVideo/handleSelect are never wired to setSelectedPrep', () => {
    expect(source).not.toMatch(/handleSelect[\s\S]{0,60}setSelectedPrep/);
    expect(source).not.toMatch(/closeVideo[\s\S]{0,60}setSelectedPrep/);
  });
});

// 16. No alarm/background-playback/medical claims introduced.
describe('No fabricated claims anywhere on this page', () => {
  it('no "plays in background" (unimplemented/unverified), medical, melatonin, or nervous-system wording in the page\'s actual copy (comments describing the safety rule itself are not user-facing copy)', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/plays? in (the )?background/i);
    expect(code).not.toMatch(/background playback/i);
    expect(code).not.toMatch(/melatonin|nervous system/i);
  });

  it('no wake-time/rest-calculation or alarm wording (out of this page\'s scope, not something this subphase adds)', () => {
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/wake.?up time|calculate.*rest|alarm/i);
  });
});

// Layout: no truncation, no sticky action (unchanged by this round).
describe('Layout: full labels always visible, no sticky action area', () => {
  it('no truncate/line-clamp/overflow-hidden on any checklist or guidance label', () => {
    expect(toggleRowSource).not.toMatch(/truncate|line-clamp|overflow-hidden/);
  });

  it('Ready for Sleep is a normal flow element (not position: sticky/fixed) - reachable, never covering content', () => {
    const buttonBlock = source.match(/onClick=\{handleReadyForSleep\}[\s\S]*?<\/button>/)?.[0] ?? '';
    expect(buttonBlock).not.toMatch(/sticky|fixed/);
  });
});

// Back/Review Mode wiring - unchanged by this round.
describe('Back and Review Mode wiring are unchanged from the previous subphase', () => {
  it('Back now returns to Evening Meditate (Journey Embedding\'s optional step, the real immediately-preceding step) rather than skipping over it to Evening Breathing', () => {
    expect(source).toMatch(/showBack backFallback="\/evening-meditate"/);
  });

  it('useStepReviewMode/useReviewNavigation called with the original arguments', () => {
    expect(source).toMatch(/useStepReviewMode\('sleepPreparation', 'evening-wind-down'\)/);
    expect(source).toMatch(/hasUnsavedProgress: false/);
  });

  // Duplicate-return-action fix, found live: this used to render its own
  // second "Return to X" button here AND the ReviewModeBanner (rendered
  // separately, further down in this same file) - two identical controls
  // at once. primaryAction is now null while reviewing; Ready for Sleep is
  // still never shown while reviewing either way.
  it('Review Mode sets primaryAction to null (the ReviewModeBanner alone covers the return action) - Ready for Sleep is never shown while reviewing', () => {
    expect(source).toMatch(/const primaryAction = isReviewMode \? null : \(/);
    expect(source).not.toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
    expect(source).toMatch(/<ReviewModeBanner/);
  });
});
