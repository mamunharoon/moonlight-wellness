// Shared on/off switch. Extracted from NotificationSettings.jsx (Welcome
// alarm-status card work) so Onboarding.jsx's new alarm enable/disable
// control reuses the exact same implementation instead of a second one.
export const Toggle = ({ checked, onChange, label }) => (
  <button
    role="switch"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className={`w-12 h-7 rounded-full transition-colors relative shrink-0 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
      checked ? 'bg-primary' : 'bg-white/10'
    }`}
  >
    <span
      className={`absolute left-0.5 top-0.5 w-6 h-6 rounded-full bg-white shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);
