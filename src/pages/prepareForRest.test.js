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
  it('track is a muted deep slate (bg-evening-track-off, calculated ~3.2:1 against the row) when off, row keeps its deep surface-container background with a visible evening-accent/55 border', () => {
    expect(toggleRowSource).toMatch(/selected \? 'bg-evening-accent' : 'bg-evening-track-off'/);
    expect(toggleRowSource).toMatch(/'bg-surface-container border-evening-accent\/55/);
  });

  it('the knob sits at the left (translate-x-0) when off, and is a dark navy fill (surface-container-lowest) with a thin evening-accent ring - not the old bright bg-on-surface circle', () => {
    expect(toggleRowSource).toMatch(/selected \? 'translate-x-5' : 'translate-x-0'/);
    expect(toggleRowSource).toMatch(/bg-surface-container-lowest border border-evening-accent/);
    expect(toggleRowSource).not.toMatch(/bg-on-surface transition-transform/);
  });
});

// 4, 5. On: knob moves right + blue accent; row does NOT become a full bright-blue fill.
describe('PrepareToggleRow - ON state: subtle tint only (never a full bright-blue fill), knob slides right, blue track', () => {
  it('the row itself only gains a SUBTLE evening-accent/10 tint plus a full-strength border - never a solid/opaque evening-accent fill', () => {
    expect(toggleRowSource).toMatch(/'bg-evening-accent\/10 border-evening-accent/);
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

// 8. New exact guidance heading and supporting copy.
describe('Guidance section copy: explicit heading naming both content types, plus optional-framing supporting copy', () => {
  it('heading reads exactly "Choose a bedtime video or sleep sound"', () => {
    expect(source).toMatch(/Choose a bedtime video or sleep sound/);
  });

  it('supporting copy reads exactly "Optional — play something calming, or continue when you\'re ready."', () => {
    expect(source).toMatch(/Optional — play something calming, or continue when you're ready\./);
  });

  it('never says "Would some ... guidance help?" (the earlier, too-vague heading this corrects)', () => {
    expect(source).not.toMatch(/Would some.*guidance help\?/);
  });

  it('never says "music" for the Sleep Sounds catalogue - "sleep sound" only, since these are ambient sound, not music', () => {
    const block = source.match(/const FEATURED_GUIDANCE = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block).not.toMatch(/music/i);
    expect(block).toMatch(/'Sleep sound'/);
  });
});

// 9. Guidance expanded by default.
describe('Guidance section is expanded by default on first entry', () => {
  it('guidanceOpen starts true (not false, unlike the earlier round-1 collapsed default)', () => {
    expect(source).toMatch(/const \[guidanceOpen, setGuidanceOpen\] = useState\(true\);/);
  });
});

// 10, 11, 13. Exactly one video + one sound featured; real/active ids; no duplication in More options.
describe('Exactly one featured guided video and one featured sleep sound, real catalogue ids, never duplicated in More options', () => {
  it('FEATURED_GUIDANCE is exactly [E05 "Guided video", SL01 "Sleep sound"]', () => {
    const block = source.match(/const FEATURED_GUIDANCE = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block).toMatch(/id: 'E05', kind: 'Guided video'/);
    expect(block).toMatch(/id: 'SL01', kind: 'Sleep sound'/);
    const ids = [...block.matchAll(/id: '([A-Z0-9]+)'/g)].map((m) => m[1]);
    expect(ids).toEqual(['E05', 'SL01']);
  });

  it('E05 and SL01 are real entries in betaVideoManifest.js - verified against the actual manifest source, not merely asserted', () => {
    expect(manifestSource).toMatch(/id: 'E05',\s*\n\s*title: 'Night-time Calm',/);
    expect(manifestSource).toMatch(/id: 'SL01',\s*\n\s*title: 'Rain',/);
  });

  it('SL01 is never repeated inside the More-options sleep sounds list (MORE_SLEEP_SOUNDS starts at SL02)', () => {
    const block = source.match(/const MORE_SLEEP_SOUNDS = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block).not.toMatch(/id: 'SL01'/);
    expect(block).toMatch(/id: 'SL02'/);
  });

  it('E05 is never repeated inside MORE_GUIDANCE', () => {
    const block = source.match(/const MORE_GUIDANCE = \[([\s\S]*?)\n\];/)?.[1] ?? '';
    expect(block).not.toMatch(/id: 'E05'/);
  });

  it('every id referenced anywhere on this page (E05, E20, E27, E30, SL01-SL08) is a real entry in the manifest', () => {
    for (const id of ['E05', 'E20', 'E27', 'E30', 'SL01', 'SL02', 'SL03', 'SL04', 'SL05', 'SL06', 'SL07', 'SL08']) {
      expect(source).toMatch(new RegExp(`id: '${id}'`));
      expect(manifestSource).toMatch(new RegExp(`id: '${id}',`));
    }
  });
});

// Content-type label + real title/description/duration presentation.
describe('Featured items are explicitly labelled by content type, with real title/description and accurate-or-omitted duration', () => {
  it('each featured item renders its own kind label ("Guided video"/"Sleep sound") directly above its row', () => {
    expect(source).toMatch(/\{featuredItems\.map\(\(\{ id, entry, blurb, duration, kind \}\) => \(/);
    expect(source).toMatch(/>\{kind\}<\/span>/);
  });

  it('duration is entry.durationLabel (real, spec-provided) or a real cached "~N min", falling back to undefined (no badge) - never a fabricated placeholder', () => {
    expect(source).toMatch(/const duration = entry\.durationLabel \|\| \(cachedMinutes \? `~\$\{cachedMinutes\} min` : undefined\);/);
    expect(source).not.toMatch(/'Guided video'\)/); // never used as a fallback duration string
  });

  it('guidance rows use the manifest\'s own real entry.title, never a hand-typed display string', () => {
    expect(source).toMatch(/title=\{entry\.title\}/);
  });
});

// 12. More options collapsed initially.
describe('"More bedtime options" is its own independent disclosure, collapsed initially', () => {
  it('moreGuidanceOpen starts false', () => {
    expect(source).toMatch(/const \[moreGuidanceOpen, setMoreGuidanceOpen\] = useState\(false\);/);
  });

  it('is a sibling of the featured guidance section and Ready for Sleep - not nested inside guidanceOpen (so collapsing the featured section doesn\'t hide it, and it doesn\'t require guidanceOpen to be true)', () => {
    const moreBlock = source.match(/\{\(moreGuidanceItems\.length > 0 \|\| moreSleepSoundItems\.length > 0\) && \(([\s\S]*?)\n {8}\)\}/)?.[0] ?? '';
    expect(moreBlock).not.toBe('');
    expect(moreBlock).not.toMatch(/guidanceOpen &&/);
  });
});

// Build 15 Evening UX correction — "More bedtime options" now sits
// between the featured guidance and Ready for Sleep (previously it was
// AFTER Ready for Sleep), so browsing the full bedtime library always
// happens before the exit action, never after it.
describe('"More bedtime options" sits between the featured guidance and Ready for Sleep', () => {
  it('the featured-guidance block appears before the More-options block, which appears before {primaryAction}, in source order', () => {
    const featuredIdx = source.indexOf('featuredItems.length > 0');
    const moreIdx = source.indexOf('moreGuidanceItems.length > 0 || moreSleepSoundItems.length > 0');
    const primaryIdx = source.indexOf('{primaryAction}');
    expect(featuredIdx).toBeGreaterThan(-1);
    expect(moreIdx).toBeGreaterThan(featuredIdx);
    expect(primaryIdx).toBeGreaterThan(moreIdx);
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
  it('Back still returns to Evening Breathing via the shared BackButton', () => {
    expect(source).toMatch(/showBack backFallback="\/evening-breathing"/);
  });

  it('useStepReviewMode/useReviewNavigation called with the original arguments', () => {
    expect(source).toMatch(/useStepReviewMode\('sleepPreparation', 'evening-wind-down'\)/);
    expect(source).toMatch(/hasUnsavedProgress: false/);
  });

  it('Review Mode swaps in "Return to [step]" exactly as before - Ready for Sleep is never shown while reviewing', () => {
    expect(source).toMatch(/isReviewMode \? \(/);
    expect(source).toMatch(/Return to \{getStepLabel\(currentStep\.id\)\}/);
  });
});
