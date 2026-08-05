/* eslint-disable no-unused-vars */
/*
 * Stage 3 component preview — internal, unlinked route (MLT-3A-16).
 *
 * Not part of any Stage 2 flow: rendered outside <Layout />, not present
 * in Layout's navItems, not reachable from any existing screen. Exists
 * solely so the additive Stage 3 tokens and components have somewhere to
 * be visually verified as they're built through Phase 3A. Sections below
 * are appended ticket-group by ticket-group as each component lands.
 */

import { useState } from 'react';
import { Gradient, PHASES } from '../components/stage3/Gradient';
import { Moon } from '../components/stage3/Moon';
import { Breathing } from '../components/stage3/Breathing';
import { AtmosphereManager, resolvePerformanceTier } from '../components/stage3/AtmosphereManager';

const phaseLabels = {
  moonlight: 'Moonlight (20:00–05:00)',
  dawn: 'Dawn (05:00–08:00)',
  daylight: 'Daylight (08:00–17:00)',
  dusk: 'Dusk (17:00–20:00)',
};

const moonPhases = ['full', 'waxing', 'waning', 'crescent'];
const glowLevels = ['soft', 'medium', 'strong'];

// Tailwind's JIT scanner needs complete, literal class strings in source —
// a template-built class like `bg-${token}` is invisible to it and would
// silently render with no background at all, so each swatch's class is
// spelled out in full below rather than assembled from `token`.
const swatches = [
  { name: 'Ink', token: 'stage3-ink', bgClass: 'bg-stage3-ink' },
  { name: 'Ink Raised', token: 'stage3-ink-raised', bgClass: 'bg-stage3-ink-raised' },
  { name: 'Dusk', token: 'stage3-dusk', bgClass: 'bg-stage3-dusk' },
  { name: 'Moonlight', token: 'stage3-moonlight', bgClass: 'bg-stage3-moonlight' },
  { name: 'Moonlight Dim', token: 'stage3-moonlight-dim', bgClass: 'bg-stage3-moonlight-dim' },
  { name: 'Dawn', token: 'stage3-dawn', bgClass: 'bg-stage3-dawn' },
  { name: 'Ember', token: 'stage3-ember', bgClass: 'bg-stage3-ember' },
  { name: 'Mist', token: 'stage3-mist', bgClass: 'bg-stage3-mist' },
  { name: 'Mist Dim', token: 'stage3-mist-dim', bgClass: 'bg-stage3-mist-dim' },
];

export const Stage3Preview = () => {
  // QA narration only, for the Ticket Group 2 section below — reads the
  // same APIs AtmosphereManager.jsx reads internally, once, purely to
  // display them as text. Not live-updating (a real reduced-motion QA
  // pass already requires a reload after toggling the OS setting, per
  // Phase 3A's own established practice), so a lazy one-time read is
  // enough here — AtmosphereManager's own panels below remain fully live
  // via their own internal listener regardless.
  const [hardwareInfo] = useState(() => ({
    hardwareConcurrency: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
    deviceMemory: typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined,
  }));
  const [prefersReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
  const detectedTier = resolvePerformanceTier(hardwareInfo);

  return (
    <div className="min-h-screen bg-stage3-ink text-stage3-mist px-6 py-10">
      <div className="max-w-2xl mx-auto space-y-14">

        <header>
          <p className="text-[11px] uppercase tracking-[0.14em] text-stage3-moonlight-dim font-bold">
            Stage 3 Preview — internal only, not linked from navigation
          </p>
          <h1 className="font-serif italic text-3xl mt-3">Solas, in progress.</h1>
        </header>

        {/* Ticket Group 1 — Design Token System (MLT-3A-01, 02, 03, 14, 15) */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            01 — Colour tokens
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
            {swatches.map((s) => (
              <div key={s.token} className="rounded-md overflow-hidden border border-stage3-dusk-line">
                <div className={`h-16 ${s.bgClass}`}></div>
                <div className="bg-stage3-ink-raised px-3 py-2">
                  <p className="text-xs font-semibold">{s.name}</p>
                  <p className="text-[10px] text-stage3-mist-dim font-mono">--{s.token}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            02 — Typography
          </h2>
          <div className="space-y-6">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
                Felt — font-serif italic
              </p>
              <p className="font-serif italic text-3xl">Waking gently at 7:30, holding Calm.</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
                Structural — font-sans semibold
              </p>
              <p className="font-sans font-semibold text-xl">Begin wind-down</p>
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
                Body — font-sans
              </p>
              <p className="font-sans text-base text-stage3-mist-dim max-w-md">
                Type sizes stay large and lines stay short, because reading effort is exactly what Stage 3 is designed to remove.
              </p>
            </div>
          </div>
        </section>

        {/* Ticket Group 2 — Gradient Foundation (MLT-3A-04, 05) */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            03 — Gradient
          </h2>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Automatic — resolves from local device time right now
          </p>
          <Gradient className="h-40 rounded-lg mb-8">
            <div className="h-40 flex items-end p-5">
              <p className="font-serif italic text-xl">Sample text over the automatic phase.</p>
            </div>
          </Gradient>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            All four anchors — via the phase override prop, device clock unaffected
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PHASES.map((p) => (
              <div key={p}>
                <Gradient phase={p} className="h-32 rounded-lg">
                  <div className="h-32 flex flex-col justify-between p-4">
                    <span className="text-[10px] uppercase tracking-[0.08em] font-bold font-mono text-stage3-mist opacity-80">
                      phase=&quot;{p}&quot;
                    </span>
                    <p className="font-serif italic text-lg">Waking gently, holding Calm.</p>
                  </div>
                </Gradient>
                <p className="text-[11px] text-stage3-mist-dim mt-1.5">{phaseLabels[p]}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] text-stage3-mist-dim mt-6 max-w-lg leading-relaxed">
            <strong className="text-stage3-mist">Reduced-motion test:</strong> enable &quot;Reduce motion&quot;
            in OS accessibility settings (or emulate <code className="font-mono">prefers-reduced-motion: reduce</code> in
            browser DevTools → Rendering), then reload this page. Each panel above should still show
            the correct phase; only the cross-fade speed on the automatic panel changes (from a slow
            atmospheric fade to a near-instant swap) if you catch it right at a phase boundary.
          </p>
        </section>

        {/* Ticket Group 3 — Moon Component (MLT-3A-06, 07) */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            04 — Moon
          </h2>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Four phases — decorative, size 96 (default)
          </p>
          <div className="flex flex-wrap gap-8 mb-8">
            {moonPhases.map((p) => (
              <div key={p} className="text-center">
                <Moon phase={p} />
                <p className="text-[11px] text-stage3-mist-dim mt-2">{p}</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Two sizes
          </p>
          <div className="flex items-end gap-8 mb-8">
            <div className="text-center">
              <Moon phase="full" size={56} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">size=56</p>
            </div>
            <div className="text-center">
              <Moon phase="full" size={140} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">size=140</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Glow levels — restrained by design, but distinct
          </p>
          <div className="flex flex-wrap gap-8 mb-8">
            {glowLevels.map((g) => (
              <div key={g} className="text-center bg-stage3-ink-raised rounded-lg p-4">
                <Moon phase="full" glow={g} />
                <p className="text-[11px] text-stage3-mist-dim mt-2">glow=&quot;{g}&quot;</p>
              </div>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Animated vs static
          </p>
          <div className="flex flex-wrap gap-8 mb-8">
            <div className="text-center">
              <Moon phase="full" animated />
              <p className="text-[11px] text-stage3-mist-dim mt-2">animated (slow drift, ~14s loop)</p>
            </div>
            <div className="text-center">
              <Moon phase="full" animated={false} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">static (default)</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Decorative vs labelled
          </p>
          <div className="flex flex-wrap gap-8 mb-8 items-center">
            <div className="text-center">
              <Moon phase="waning" decorative />
              <p className="text-[11px] text-stage3-mist-dim mt-2">decorative (aria-hidden, default)</p>
            </div>
            <div className="text-center">
              <Moon phase="waning" decorative={false} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">decorative=&#123;false&#125; (role=&quot;img&quot;, labelled)</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Over the Gradient, all four sky phases
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {PHASES.map((p) => (
              <Gradient key={p} phase={p} className="h-36 rounded-lg">
                <div className="h-36 flex items-center justify-center">
                  <Moon phase="waxing" glow="medium" size={64} />
                </div>
              </Gradient>
            ))}
          </div>

          <p className="text-[11px] text-stage3-mist-dim max-w-lg leading-relaxed">
            <strong className="text-stage3-mist">Reduced-motion test:</strong> with &quot;Reduce motion&quot;
            enabled (OS setting, or DevTools → Rendering → emulate <code className="font-mono">prefers-reduced-motion: reduce</code>),
            the animated Moon above should hold perfectly still — same glow, same phase shape, no drift.
          </p>
        </section>

        {/* Ticket Group 4 — Breathing Component (MLT-3A-08, 09, 10) */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            05 — Breathing
          </h2>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Default rhythm — 4s inhale / 6s exhale, moonlight theme
          </p>
          <div className="mb-8">
            <Breathing />
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Theme — moonlight vs dawn
          </p>
          <div className="flex flex-wrap gap-10 mb-8">
            <Breathing theme="moonlight" />
            <Breathing theme="dawn" />
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Active vs paused
          </p>
          <div className="flex flex-wrap gap-10 mb-8">
            <div className="text-center">
              <Breathing active showLabel={false} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">active</p>
            </div>
            <div className="text-center">
              <Breathing active={false} showLabel={false} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">active=&#123;false&#125; (paused, calm rest state)</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Two sizes
          </p>
          <div className="flex items-end gap-10 mb-8">
            <Breathing size={64} showLabel={false} />
            <Breathing size={160} showLabel={false} />
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Labels on vs off
          </p>
          <div className="flex flex-wrap gap-10 mb-8">
            <Breathing showLabel />
            <Breathing showLabel={false} />
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Decorative vs labelled
          </p>
          <div className="flex flex-wrap gap-10 mb-8">
            <div className="text-center">
              <Breathing decorative showLabel={false} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">decorative (aria-hidden, default)</p>
            </div>
            <div className="text-center">
              <Breathing decorative={false} showLabel={false} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">decorative=&#123;false&#125; (role=&quot;img&quot;, stable label)</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Over the Gradient
          </p>
          <Gradient phase="dusk" className="h-48 rounded-lg mb-8 flex items-center justify-center">
            <Breathing theme="dawn" />
          </Gradient>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Composed — Moon and Breathing together
          </p>
          <Gradient phase="moonlight" className="h-56 rounded-lg mb-6 flex flex-col items-center justify-center gap-4">
            <Moon phase="waxing" size={56} glow="soft" />
            <Breathing theme="moonlight" size={88} />
          </Gradient>

          <p className="text-[11px] text-stage3-mist-dim max-w-lg leading-relaxed">
            <strong className="text-stage3-mist">Reduced-motion test:</strong> with &quot;Reduce motion&quot;
            enabled (OS setting, or DevTools → Rendering → emulate <code className="font-mono">prefers-reduced-motion: reduce</code>),
            the orb above should stop scaling and hold a fixed calm size, while the halo keeps a slow,
            subtle glow pulse on the same 4s/6s pacing — never a fully static, dead circle.
          </p>
        </section>

        {/* Ticket Group 5 — Navigation & Layout Specification (MLT-3A-11, 12, 13)
            Static and non-functional: no click handlers, no navigation, no
            real routing. Illustrates the rules recorded in
            docs/stage-3-implementation-blueprint.md Appendix A — it does
            not imitate or replace the live Layout component. */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            06 — Navigation &amp; Layout Specimen <span className="normal-case font-normal text-stage3-mist-dim opacity-70">(static, non-functional)</span>
          </h2>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Content shell — ~420px, 24–32px margins
          </p>
          <div className="border border-dashed border-stage3-dusk-line rounded-lg p-2 mb-8 overflow-x-auto">
            <div className="max-w-[420px] mx-auto bg-stage3-ink-raised rounded-lg px-6 py-6 border border-stage3-dusk-line">
              <p className="text-[11px] text-stage3-mist-dim">max-w-[420px], px-6 (24px) margins shown</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Thumb zone — one primary action, lower third
          </p>
          <div className="max-w-[420px] border border-stage3-dusk-line rounded-lg h-64 relative mb-8 overflow-hidden" role="presentation">
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-stage3-dusk border-t border-stage3-dusk-line" />
            <span className="absolute top-2 left-3 text-[10px] font-mono text-stage3-mist-dim">upper 2/3 — content, never primary action</span>
            <div
              aria-hidden="true"
              className="absolute bottom-6 left-6 right-6 h-16 rounded-full bg-stage3-dawn flex items-center justify-center text-[11px] font-bold uppercase tracking-wider text-stage3-ink"
            >
              one dominant action · 64px
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Touch targets — 56px minimum, 64px+ preferred primary
          </p>
          <div className="flex items-end gap-6 mb-8">
            <div className="text-center">
              <div aria-hidden="true" className="rounded-full bg-stage3-ink-raised border border-stage3-dusk-line" style={{ width: 56, height: 56 }} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">56px minimum</p>
            </div>
            <div className="text-center">
              <div aria-hidden="true" className="rounded-full bg-stage3-dawn" style={{ width: 64, height: 64 }} />
              <p className="text-[11px] text-stage3-mist-dim mt-2">64px preferred primary</p>
            </div>
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Full-screen ritual exception — bypasses the shell and chrome entirely
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="text-center">
              <div className="max-w-[420px] mx-auto bg-stage3-ink-raised rounded-lg p-4 border border-stage3-dusk-line">
                <div className="h-20 rounded bg-stage3-dusk" />
              </div>
              <p className="text-[11px] text-stage3-mist-dim mt-2">normal screen — shell + margins</p>
            </div>
            <div className="text-center">
              <div className="rounded-lg overflow-hidden">
                <Gradient phase="dusk" className="h-28" />
              </div>
              <p className="text-[11px] text-stage3-mist-dim mt-2">ritual screen — full-bleed, no shell</p>
            </div>
          </div>

          <p className="text-[11px] text-stage3-mist-dim max-w-lg leading-relaxed">
            <strong className="text-stage3-mist">Safe-area guidance:</strong> a full-bleed ritual screen must pad
            against <code className="font-mono">env(safe-area-inset-top/bottom/left/right)</code> on real devices with
            notches or home indicators. Not demonstrable in a desktop browser — recorded as a known gap in
            <code className="font-mono"> docs/stage-3-implementation-blueprint.md</code> Appendix A.1 for future
            integration, not implemented here.
          </p>
        </section>

        {/* Ticket Groups 1-2 — AtmosphereManager (MLT-3B-18, 13, 14, 15)
            Group 1: phase detection, reduced-motion detection,
            performance-tier detection, compositing order, extension
            points. Group 2: hardens tier + reduced-motion into a gating
            contract every future layer registers against. No atmospheric
            layers exist yet — Gradient is the only thing any of these
            panels render. */}
        <section>
          <h2 className="text-xs uppercase tracking-[0.1em] text-stage3-mist-dim font-bold mb-4">
            07 — Atmosphere Manager <span className="normal-case font-normal text-stage3-mist-dim opacity-70">(Phase 3B, Ticket Group 2 — tiering &amp; reduced-motion foundation)</span>
          </h2>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Automatic — detected hardware and resolved tier
          </p>
          <AtmosphereManager className="h-40 rounded-lg mb-4 flex items-center justify-center">
            <p className="font-serif italic text-stage3-mist">Gradient only — no atmospheric layers mounted yet.</p>
          </AtmosphereManager>
          <p className="text-[11px] font-mono text-stage3-mist-dim mb-8 leading-relaxed">
            navigator.hardwareConcurrency: {hardwareInfo.hardwareConcurrency ?? 'unavailable'} · navigator.deviceMemory: {hardwareInfo.deviceMemory ?? 'unavailable (Safari/Firefox)'} · resolvePerformanceTier(): {detectedTier} · prefers-reduced-motion: {prefersReducedMotion ? 'on' : 'off'}
            {(hardwareInfo.hardwareConcurrency === undefined || hardwareInfo.deviceMemory === undefined) && (
              <> — conservative fallback applied: an unavailable API is never treated as evidence of high capability, so this resolves to Tier 1 rather than assuming the device is capable.</>
            )}
          </p>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Phase override — same override contract as Gradient
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {PHASES.map((p) => (
              <AtmosphereManager key={p} phase={p} className="h-24 rounded-lg flex items-center justify-center">
                <p className="text-[11px] font-mono text-stage3-mist-dim">phase=&quot;{p}&quot;</p>
              </AtmosphereManager>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Tier override — forced Tier 0 / 1 / 2 / 3 (readable live via each panel&apos;s own <code className="font-mono normal-case">data-atmosphere-tier</code>)
          </p>
          <div className="grid grid-cols-4 gap-3 mb-8">
            {[0, 1, 2, 3].map((t) => (
              <AtmosphereManager key={t} phase="moonlight" tier={t} className="h-20 rounded-lg flex items-center justify-center">
                <p className="text-[11px] font-mono text-stage3-mist-dim">tier={t}</p>
              </AtmosphereManager>
            ))}
          </div>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Reduced motion vs. a forced Tier 3 — reduced motion always wins
          </p>
          <AtmosphereManager phase="moonlight" tier={3} className="h-24 rounded-lg mb-2 flex items-center justify-center">
            <p className="text-[11px] font-mono text-stage3-mist-dim">tier=3 requested</p>
          </AtmosphereManager>
          <p className="text-[11px] text-stage3-mist-dim mb-8 leading-relaxed">
            Requested tier 3, current prefers-reduced-motion: <strong className="text-stage3-mist">{prefersReducedMotion ? 'on' : 'off'}</strong> — resolved
            tier is <strong className="text-stage3-mist">{prefersReducedMotion ? 0 : 3}</strong>, also readable live on this panel&apos;s own <code className="font-mono">data-atmosphere-tier</code> attribute.
            To see the override actually get overruled, enable OS-level reduced motion and reload this page.
          </p>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Invalid override — falls back to automatic detection, never throws
          </p>
          <AtmosphereManager phase="moonlight" tier={99} className="h-20 rounded-lg mb-8 flex items-center justify-center">
            <p className="text-[11px] font-mono text-stage3-mist-dim">tier=99 (invalid) → falls back to automatic (tier={detectedTier})</p>
          </AtmosphereManager>

          <p className="text-[11px] uppercase tracking-[0.1em] text-stage3-moonlight-dim font-bold mb-2">
            Phase and tier resolve independently
          </p>
          <AtmosphereManager phase="dusk" tier={2} className="h-24 rounded-lg mb-8 flex items-center justify-center">
            <p className="text-[11px] font-mono text-stage3-mist-dim">phase=&quot;dusk&quot; + tier=2 simultaneously — both resolve correctly, neither affects the other</p>
          </AtmosphereManager>

          <p className="text-[11px] text-stage3-mist-dim max-w-lg leading-relaxed">
            <strong className="text-stage3-mist">Scope:</strong> this group hardens phase detection, reduced-motion
            detection, and performance-tier detection into a gating contract (<code className="font-mono">canRenderTier</code>)
            every future layer registers against — it adds no visual layer. Every panel above still renders Gradient
            alone, by design.
          </p>
        </section>

      </div>
    </div>
  );
};
