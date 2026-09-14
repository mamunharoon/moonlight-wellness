/* eslint-disable no-unused-vars */
import { useMemo, useState } from 'react';
import { useAlarm } from '../context/AlarmContext';
import { BackButton } from '../components/BackButton';
import { COMMON_TIMEZONES, detectDeviceTimezone, isValidTimezone } from '../lib/timezone';

/*
 * Global timezone correctness — Profile → Daily Rhythm → Timezone.
 *
 * Lets the user review their confirmed timezone (falls back to the
 * device-detected zone while unconfirmed) and change it explicitly.
 * Detection is Intl-only (Intl.DateTimeFormat().resolvedOptions().timeZone)
 * - no GPS permission is ever requested here or anywhere else in this
 * feature. A free-text field lets a user type any valid IANA identifier
 * not in the curated list (e.g. a less common city); it's validated with
 * the same Intl.DateTimeFormat check before Save is enabled, so nothing
 * invalid can ever be written to rhythms.timezone.
 */
export const TimezoneSettings = () => {
  const { effectiveTimezone, updateRhythm, alarmTime, bedTime } = useAlarm();
  const [selected, setSelected] = useState(effectiveTimezone);
  const [customInput, setCustomInput] = useState('');
  const [query, setQuery] = useState('');
  const [saved, setSaved] = useState(false);

  const deviceTimezone = useMemo(() => detectDeviceTimezone(), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COMMON_TIMEZONES;
    return COMMON_TIMEZONES.filter(
      (tz) => tz.id.toLowerCase().includes(q) || tz.label.toLowerCase().includes(q)
    );
  }, [query]);

  const handleSelectCommon = (id) => {
    setSelected(id);
    setCustomInput('');
    setSaved(false);
  };

  const handleCustomChange = (value) => {
    setCustomInput(value);
    setSaved(false);
    if (isValidTimezone(value)) setSelected(value);
  };

  const handleSave = () => {
    if (!isValidTimezone(selected)) return;
    updateRhythm(alarmTime, bedTime, selected);
    setSaved(true);
  };

  const customIsInvalid = customInput.trim().length > 0 && !isValidTimezone(customInput.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" />
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Timezone</h2>
      </div>

      <div className="glass-panel p-5 rounded-2xl space-y-2">
        <p className="text-xs text-on-surface-variant">
          Your wake and bed times are stored as local wall-clock times. This timezone is what
          tells WakeWise which local day and hour those times mean — so your reminders always
          fire at the right moment for you, wherever you are.
        </p>
        <div className="flex items-center justify-between pt-2 text-sm">
          <span className="text-on-surface-variant">Currently used</span>
          <span className="font-semibold text-on-surface">{effectiveTimezone}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-on-surface-variant">Detected on this device</span>
          <span className="font-semibold text-on-surface">{deviceTimezone}</span>
        </div>
      </div>

      <div className="space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a city or region..."
          className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-on-surface-variant/40 outline-none"
        />

        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 max-h-80 overflow-y-auto">
          {filtered.map((tz) => (
            <button
              key={tz.id}
              type="button"
              onClick={() => handleSelectCommon(tz.id)}
              className={`w-full flex items-center justify-between p-4 min-h-[48px] text-left hover:bg-white/5 active:scale-[0.99] transition-all ${
                selected === tz.id ? 'bg-primary/10' : ''
              }`}
            >
              <span className="text-sm text-on-surface">
                <span className="font-semibold">{tz.label}</span>
                <span className="text-on-surface-variant text-xs ml-2">{tz.id}</span>
              </span>
              {selected === tz.id && (
                <span className="material-symbols-outlined text-primary text-lg">check</span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="p-4 text-xs text-on-surface-variant/60 italic">No match in the common list — try the exact IANA name below.</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant font-medium" htmlFor="tz-custom">
            Or enter an exact IANA timezone (e.g. Asia/Kolkata)
          </label>
          <input
            id="tz-custom"
            type="text"
            value={customInput}
            onChange={(e) => handleCustomChange(e.target.value)}
            placeholder="Region/City"
            className={`w-full bg-white/5 border rounded-2xl p-4 text-sm focus:ring-2 focus:border-transparent transition-all placeholder:text-on-surface-variant/40 outline-none ${
              customIsInvalid ? 'border-red-400/60 focus:ring-red-400' : 'border-white/10 focus:ring-primary'
            }`}
          />
          {customIsInvalid && (
            <p className="text-[10px] text-red-400 font-medium">Not a recognised timezone name.</p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!isValidTimezone(selected)}
        className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg disabled:opacity-40"
      >
        <span>{saved ? 'Saved' : 'Save timezone'}</span>
        <span className="material-symbols-outlined text-sm">{saved ? 'check' : 'arrow_forward'}</span>
      </button>
    </div>
  );
};
