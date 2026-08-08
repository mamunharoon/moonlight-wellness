// WakeWise — placeholder hook for the future audio engine.
//
// The audio system is explicitly out of scope for Closed Beta
// Preparation / Notifications & Reminders. This file is an inert
// extension point only: notificationScheduler.js calls
// playReminderSound() when a reminder fires, but it does nothing until
// a real audio engine is implemented here. No sound is produced today.
export const playReminderSound = (categoryId) => {
  console.debug(`[audioEngine] placeholder — would play a sound for "${categoryId}"`);
};
