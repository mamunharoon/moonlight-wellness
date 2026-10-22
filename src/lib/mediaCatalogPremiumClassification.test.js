import { describe, it, expect } from 'vitest';
import { MEDIA_CATALOG, isFreeExerciseId, APPROVED_PLUS_IDS as CLIENT_APPROVED_IDS } from './mediaCatalog';
import {
  isPremiumExerciseId,
  PREVIEW_ONLY_COVER_IDS,
  APPROVED_PLUS_IDS as SERVER_APPROVED_IDS
} from '../../supabase/functions/_shared/premiumExerciseIds.ts';
import { BREATHING_PATTERNS } from './breathingPatterns';

// Phase 2C — mediaCatalog.js's FREE_EXERCISE_IDS (client, UI-convenience
// only) and premiumExerciseIds.ts's FREE_EXERCISE_IDS (server, the real
// get-beta-video-url authorization boundary) are deliberately duplicated
// across the Deno/Vite boundary rather than imported — see both files'
// own header comments. This is the test that keeps them from silently
// drifting apart; a change to one without the other fails here, not in
// production as a mismatched lock icon or (worse) an unintended grant.
describe('Phase 2C — client/server Free-exercise classification stay in sync', () => {
  it('every real MEDIA_CATALOG entry\'s premium flag agrees with the server\'s isPremiumExerciseId', () => {
    for (const entry of MEDIA_CATALOG) {
      expect(entry.premium, `mismatch for ${entry.id}`).toBe(isPremiumExerciseId(entry.id));
    }
  });

  it('isFreeExerciseId (client) and !isPremiumExerciseId (server) agree for every real catalogue id', () => {
    for (const entry of MEDIA_CATALOG) {
      expect(isFreeExerciseId(entry.id), `mismatch for ${entry.id}`).toBe(!isPremiumExerciseId(entry.id));
    }
  });

  it('every §2 breathing pattern explicitly declares premium (never omitted/implicit)', () => {
    for (const pattern of BREATHING_PATTERNS) {
      expect(typeof pattern.premium, `${pattern.id} is missing an explicit premium field`).toBe('boolean');
    }
  });
});

// Post-baseline catalogue additions — the exact 10 ids that were added
// to betaVideoManifest.js AFTER the spec's own baseline commit and were
// never classified in §3b/§3c's tables: 5 parents (M06, S06, S07, S08,
// S09) + their 5 cover images (M06COVER, S06COVER, S07COVER, S08COVER,
// S09COVER). This is deliberately its own describe block, separate from
// the "every MEDIA_CATALOG entry" sync check above, because the 5 covers
// are NOT in MEDIA_CATALOG at all (mediaCatalog.js's own
// INTERACTIVE_ONLY_IDS excludes them) - the loop above would never touch
// them, and a regression there would otherwise go completely untested.
describe('Phase 2C — post-baseline catalogue additions (M06/S06-S09 + their covers)', () => {
  it('the 5 approved-Plus parent ids and the 5 preview-only cover ids are exactly these 10, no more and no fewer', () => {
    expect([...PREVIEW_ONLY_COVER_IDS].sort()).toEqual(['M06COVER', 'S06COVER', 'S07COVER', 'S08COVER', 'S09COVER']);
    expect([...SERVER_APPROVED_IDS].sort()).toEqual(['M06', 'S06', 'S07', 'S08', 'S09']);
  });

  it('client and server agree on which 5 ids are the approved-Plus parents', () => {
    expect([...CLIENT_APPROVED_IDS].sort()).toEqual([...SERVER_APPROVED_IDS].sort());
  });

  it('the 5 parents resolve Plus (§11a-i, owner-approved) - a change here must be a deliberate, reviewed edit, never silent', () => {
    for (const id of SERVER_APPROVED_IDS) {
      expect(isPremiumExerciseId(id), `${id} should resolve Plus (owner-approved)`).toBe(true);
    }
  });

  it('a cover is NEVER independently premium, regardless of FREE_EXERCISE_IDS/parent classification - the exact gap this round\'s review found and fixed', () => {
    for (const coverId of PREVIEW_ONLY_COVER_IDS) {
      expect(isPremiumExerciseId(coverId), `${coverId} must never be independently Plus-gated`).toBe(false);
    }
  });

  it('MEDIA_CATALOG holds exactly 75 real entries today: the spec\'s 73-entry baseline minus the 5 covers (never in MEDIA_CATALOG) plus the 5 approved-Plus M06/S06-S09 parents (= 72), plus the 3 new GR01-GR03 gratitude ids added 2026-10-22 (= 75)', () => {
    expect(MEDIA_CATALOG.length).toBe(75);
  });

  it('none of the 5 cover ids ever appear in MEDIA_CATALOG - confirms they stay excluded, never Library-browsable, never independently selectable', () => {
    const catalogIds = new Set(MEDIA_CATALOG.map((entry) => entry.id));
    for (const coverId of PREVIEW_ONLY_COVER_IDS) {
      expect(catalogIds.has(coverId), `${coverId} must not appear in MEDIA_CATALOG`).toBe(false);
    }
  });
});
