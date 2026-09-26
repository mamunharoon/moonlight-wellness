import { useState, useRef, useEffect } from 'react';
import { useAudio } from '../context/AudioContext';
import { useAlarm } from '../context/AlarmContext';
import { ALARM_SOUNDS } from '../lib/alarmSounds';
import { isNativePlatform } from '../lib/platform';

const ALARM_SOUND_PREVIEW_MS = 3000;

// WakeWise DEV — alarm wake-up sound picker. Extracted from
// NotificationSettings.jsx (Welcome alarm-status card work) so the exact
// same tested picker can also be embedded in Onboarding.jsx's alarm
// setup step - one real implementation, not a second one duplicated for
// the Welcome flow. Fully self-contained (own hooks, own local preview
// state) - no props needed from either caller.
//
// Was a single "Test alarm sound" button (see git history) confirming
// WakeWise's one bundled foreground chime actually plays on this
// device/browser; now a real picker across the 5 intended sounds
// (alarmSounds.js), keeping every safety property that button already
// had - previewActiveRef (not just component state) is still the real
// ownership flag, checked before ever calling stopTrack(), so this
// section only ever stops audio IT started, never an unrelated track
// already playing elsewhere in the app. This foreground chime is the
// same in-page mechanism on both web and native - the picker changes
// ONLY this foreground alarm (see alarmSounds.js's own top doc comment
// for the native background-notification limit this cannot cross).
//
// Selecting a row (tapping anywhere on it) sets that sound as the real
// alarm choice via useAlarm().setAlarmSoundId - persisted immediately
// (alarmSounds.js's own scoped localStorage), and is what AlarmContext.jsx
// actually plays when the alarm rings. Previewing (the separate play/stop
// icon, available sounds only) never changes the selection - a user can
// audition a sound without committing to it. Only `available` sounds
// (today: Gentle Chimes alone) can be selected or previewed at all - the
// other four show a "Coming soon" badge and are inert, never silently
// mapped to an unrelated existing track.
export const AlarmSoundPicker = () => {
  const { playTrack, stopTrack, playbackError } = useAudio();
  const { isRinging, alarmSoundId, setAlarmSoundId } = useAlarm();
  const native = isNativePlatform();
  // previewingId: the sound id currently playing a preview, or null.
  // previewResult: { id, status: 'success' | 'error' } for the most
  // recently finished preview, cleared the moment a new preview starts.
  const [previewingId, setPreviewingId] = useState(null);
  const [previewResult, setPreviewResult] = useState(null);
  const previewActiveRef = useRef(false);
  const previewTimeoutRef = useRef(null);

  const stopCurrentPreview = () => {
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
      previewTimeoutRef.current = null;
    }
    if (previewActiveRef.current) {
      previewActiveRef.current = false;
      stopTrack();
    }
    setPreviewingId(null);
  };

  const handlePreview = (sound) => {
    if (!sound.available) return;
    const wasPreviewingThisRow = previewActiveRef.current && previewingId === sound.id;
    // Always stop whatever is currently previewing first - a different
    // row's preview, or this same row's - so exactly one preview can
    // ever be in flight, the same guarantee the original single-button
    // version had.
    stopCurrentPreview();
    if (wasPreviewingThisRow) {
      // Tapping the currently-previewing row again is the compact "stop
      // early" control - same as the original single-button behaviour.
      setPreviewResult(null);
      return;
    }
    previewActiveRef.current = true;
    setPreviewingId(sound.id);
    setPreviewResult(null);
    const playPromise = playTrack({ title: `${sound.title} Preview`, url: sound.url });
    Promise.resolve(playPromise)
      .then(() => {
        if (!previewActiveRef.current) return; // stopped/unmounted already
        if (isRinging) {
          // A real alarm started ringing while the preview was starting -
          // leave it playing rather than have the preview's own auto-stop
          // cut a genuine alarm short. The preview simply hands off.
          previewActiveRef.current = false;
          return;
        }
        previewTimeoutRef.current = setTimeout(() => {
          if (!previewActiveRef.current || isRinging) return;
          previewActiveRef.current = false;
          setPreviewingId(null);
          setPreviewResult({ id: sound.id, status: 'success' });
        }, ALARM_SOUND_PREVIEW_MS);
      })
      .catch(() => {
        if (!previewActiveRef.current) return;
        previewActiveRef.current = false;
        setPreviewingId(null);
        setPreviewResult({ id: sound.id, status: 'error' });
      });
  };

  // Stop on navigation/unmount - but only a preview this component
  // itself started (see previewActiveRef's own comment above).
  useEffect(
    () => () => {
      if (previewTimeoutRef.current) clearTimeout(previewTimeoutRef.current);
      if (previewActiveRef.current) {
        previewActiveRef.current = false;
        stopTrack();
      }
    },
    [stopTrack]
  );

  // Selecting is independent of previewing - a user can pick a sound
  // without ever tapping preview, and previewing a different sound never
  // changes which one is actually selected.
  const handleSelectSound = (sound) => {
    if (!sound.available) return;
    setAlarmSoundId(sound.id);
  };

  return (
    <section id="alarm-sound" className="space-y-2 scroll-mt-4">
      <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Alarm sound</h3>
      <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
        <div className="p-4 space-y-3">
          <p className="text-xs text-on-surface-variant">
            Choose the sound WakeWise plays when your alarm goes off, and preview it before you pick.
          </p>
          <div className="space-y-2" role="radiogroup" aria-label="Alarm sound">
            {ALARM_SOUNDS.map((sound) => {
              const isSelected = alarmSoundId === sound.id;
              const isPreviewingThis = previewingId === sound.id;
              return (
                <div
                  key={sound.id}
                  className={`flex items-center gap-2 rounded-xl border transition-all ${
                    sound.available
                      ? isSelected
                        ? 'border-primary bg-primary/10'
                        : 'border-white/10 hover:bg-white/5'
                      : 'border-white/5 opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    disabled={!sound.available}
                    onClick={() => handleSelectSound(sound)}
                    className="flex-1 flex items-center gap-3 text-left min-h-[44px] px-3 py-2.5 disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded-xl"
                  >
                    <span
                      aria-hidden="true"
                      className={`relative w-4 h-4 rounded-full border-2 shrink-0 ${
                        isSelected ? 'border-primary bg-primary' : 'border-outline bg-surface-container-lowest'
                      }`}
                    >
                      {isSelected && <span className="absolute inset-0 m-auto w-1.5 h-1.5 rounded-full bg-on-primary" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-on-surface">{sound.label}</span>
                      {!sound.available && (
                        <span className="block text-[10px] text-on-surface-variant/70 font-semibold uppercase tracking-wider">
                          Coming soon
                        </span>
                      )}
                    </span>
                  </button>
                  {sound.available && (
                    <button
                      type="button"
                      onClick={() => handlePreview(sound)}
                      aria-label={isPreviewingThis ? `Stop ${sound.label} preview` : `Preview ${sound.label}`}
                      className="shrink-0 min-h-[44px] min-w-[44px] mr-1 flex items-center justify-center rounded-full text-primary hover:bg-white/10 active:scale-95 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                    >
                      <span className="material-symbols-outlined text-lg" aria-hidden="true">
                        {isPreviewingThis ? 'stop_circle' : 'play_circle'}
                      </span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {!native && (
            <p className="text-[11px] text-on-surface-variant">
              Keep WakeWise open and allow site sound for browser alarms.
            </p>
          )}
          <p role="status" aria-live="polite" className="text-[11px] min-h-[14px] font-semibold text-on-surface-variant">
            {previewingId && 'Playing preview…'}
            {!previewingId && previewResult?.status === 'success' && 'Alarm sound played successfully.'}
            {!previewingId && previewResult?.status === 'error' &&
              (playbackError
                ? `Couldn't play the alarm sound (${playbackError.name}). Check that site sound is allowed for WakeWise and try again.`
                : "Couldn't play the alarm sound. Check that site sound is allowed for WakeWise and try again.")}
          </p>
        </div>
      </div>
    </section>
  );
};
