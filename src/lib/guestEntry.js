// Guest Onboarding — persisted "I chose to continue as a guest" flag.
//
// A brand-new install (no Supabase session, and this flag unset) sees the
// WakeWise welcome screen before anything else. Tapping "Continue as
// Guest" sets this flag so ordinary future launches skip straight back
// into the app instead of re-showing the welcome screen every time - but
// signing out (AuthContext.jsx's signOut) clears it again, so the next
// person on this device (or the same person after a deliberate sign-out)
// sees the welcome screen fresh rather than silently inheriting the
// previous guest decision. Clearing local app data naturally clears this
// too, since it's plain localStorage - no separate "reset" path needed.
//
// Deliberately a single boolean flag, not a richer object: nothing else
// about "how" someone chose guest access needs to be remembered.
const GUEST_ENTRY_KEY = 'moonlight_guest_entry_chosen';

export const hasChosenGuestEntry = () => {
  try {
    return localStorage.getItem(GUEST_ENTRY_KEY) === 'true';
  } catch {
    return false;
  }
};

export const markGuestEntryChosen = () => {
  try {
    localStorage.setItem(GUEST_ENTRY_KEY, 'true');
  } catch {
    // Storage unavailable - the welcome screen will simply reappear next
    // launch, which is safe (never blocks access, just re-asks).
  }
};

export const clearGuestEntryChoice = () => {
  try {
    localStorage.removeItem(GUEST_ENTRY_KEY);
  } catch {
    // no-op
  }
};
