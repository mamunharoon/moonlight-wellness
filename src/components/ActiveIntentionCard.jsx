import { useNavigate } from 'react-router-dom';
import { roleForIndex } from '../lib/intentionSelection';

/*
 * WakeWise — Home.jsx's "Active Intention" display, shared by both places
 * Home shows the user's own Morning intentions.
 *
 * Build 15 Phase B remediation — the large expanded-inline editor
 * (formerly this component's own `isEditing` mode: a full preset grid,
 * custom input, Save/Cancel, all rendered inline inside Home's own
 * scroll) is replaced by navigation to a dedicated screen
 * (ChangeIntention.jsx, at /change-intention) - this component is now
 * display-only plus one navigation action. All the selection/save logic
 * that used to live here (toggleIntention, roleForIndex, LIMIT_MESSAGE,
 * saveIntentionsToCloud) now lives entirely in that screen instead -
 * never duplicated between the two.
 *
 * Guests: `onRequireSignIn` is Home's own existing promptRoutineSignIn
 * (the same SignInPromptDialog every other restricted action on this page
 * already uses) - tapping "Change intention" as a guest opens that prompt
 * instead of ever navigating, so a guest can never reach the editing
 * screen from here (ChangeIntention.jsx itself also re-checks this for a
 * direct URL visit).
 */
export const ActiveIntentionCard = ({ label, intentions, isGuest, onRequireSignIn }) => {
  const navigate = useNavigate();

  const handleChangeTap = () => {
    if (isGuest) {
      onRequireSignIn();
      return;
    }
    navigate('/change-intention');
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-secondary">{label}</p>
        <button
          type="button"
          onClick={handleChangeTap}
          className="min-h-[44px] min-w-[44px] flex items-center justify-end text-[11px] font-bold text-primary hover:opacity-80 active:scale-95 transition-all shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
        >
          Change intention
        </button>
      </div>
      <div className="space-y-1">
        {intentions.map((item, idx) => (
          <p key={item.toLowerCase()} className="text-lg italic font-medium text-on-surface flex items-baseline gap-2">
            {intentions.length > 1 && (
              <span className="text-[9px] not-italic font-bold uppercase tracking-wider text-secondary shrink-0">{roleForIndex(idx)}</span>
            )}
            <span>"{item}"</span>
          </p>
        ))}
      </div>
    </div>
  );
};
