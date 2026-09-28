import { useEffect, useRef, useState } from 'react';
import { MEDITATION_SOUNDS, getMeditationSoundById } from '../../lib/meditationSounds';
import { getJourneyToneTokens } from '../../lib/journeyTone';

/*
 * Meditation ↔ Breathing alignment correction — a compact, header-scale
 * Sound control for Meditation's setup screen, matching the position and
 * visual weight of CompactSoundControl.jsx (Breathing's own top-right
 * toggle). Unlike Breathing's plain on/off switch, Meditation's sound is a
 * real 3-way choice (Gentle Ambient / Soft Piano / No Music) - this button
 * opens a small anchored popover exposing all three, rather than cycling
 * or hiding any of them. `soundId`/`onSelectSound` are always the SAME
 * state/handler the caller already threads through useMeditationSession -
 * this component holds no audio state of its own and never touches
 * playback directly.
 *
 * Replaces the old full three-card "Choose your sound" section that used
 * to live inline in MeditationSetupPanel.jsx - same three genuine options,
 * same stored preference, same default, just presented compactly.
 */
export const MeditationSoundControl = ({ soundId, onSelectSound, journeyTone = 'primary' }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const tokens = getJourneyToneTokens(journeyTone);
  const isOn = soundId !== 'none';
  const selectedSound = getMeditationSoundById(soundId);

  useEffect(() => {
    if (!open) return undefined;
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) setOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Sound: ${selectedSound ? selectedSound.label : 'No Music'}`}
        onClick={() => setOpen((value) => !value)}
        className={`min-w-[44px] min-h-[44px] flex items-center gap-1.5 px-3 rounded-full border transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 ${tokens.focusRing} focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
          isOn ? tokens.selectedRow : 'bg-white/5 text-on-surface-variant border-white/10'
        }`}
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">{isOn ? 'volume_up' : 'volume_off'}</span>
        <span className="text-[11px] font-bold uppercase tracking-wide">Sound</span>
      </button>
      {open && (
        <div
          role="listbox"
          aria-label="Choose your sound"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-64 max-w-[80vw] glass-panel rounded-2xl p-2 space-y-1 shadow-lg"
        >
          {MEDITATION_SOUNDS.map((sound) => (
            <button
              key={sound.id}
              type="button"
              role="option"
              aria-selected={soundId === sound.id}
              onClick={() => {
                onSelectSound(sound.id);
                setOpen(false);
              }}
              className={`w-full flex items-center justify-between gap-2 min-h-[44px] px-3 py-2 rounded-xl text-left transition-colors focus-visible:outline-none focus-visible:ring-2 ${tokens.focusRing} ${
                soundId === sound.id ? tokens.selectedRow : 'hover:bg-white/5 text-on-surface'
              }`}
            >
              <span className="min-w-0">
                <span className="block text-xs font-medium leading-snug">{sound.label}</span>
                <span className="block text-[10px] text-on-surface-variant leading-snug">{sound.description}</span>
              </span>
              {soundId === sound.id && <span className="material-symbols-outlined text-sm shrink-0" aria-hidden="true">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
