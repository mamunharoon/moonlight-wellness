import { useNavigate } from 'react-router-dom';
import { useAlarm } from '../context/AlarmContext';
import { ProgressIndicator } from '../components/ProgressIndicator';

export const MorningStart = () => {
  const navigate = useNavigate();
  const { routineDuration, setJourneyStep } = useAlarm();

  const getDurationDetails = () => {
    switch (routineDuration) {
      case 'quick':
        return { mins: 2, steps: ['Positive Affirmation', '60-Second Breathing'] };
      case 'extended':
        return { mins: 10, steps: ['Morning Affirmation', 'Stretching Exercises', 'Grounding Breathing', 'Set Intention'] };
      default:
        return { mins: 5, steps: ['Morning Affirmation', 'Stretching Exercises', 'Grounding Breathing', 'Set Intention'] };
    }
  };

  const details = getDurationDetails();

  const handleBegin = () => {
    setJourneyStep('affirmation');
    navigate('/affirmation');
  };

  const handleSkip = () => {
    setJourneyStep('');
    navigate('/');
  };

  return (
    <div className="min-h-[85vh] flex flex-col justify-between py-6 max-w-xl mx-auto space-y-10">
      <ProgressIndicator activeStep="alarm" />

      <div className="space-y-6 text-center my-auto">
        <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
          <span className="material-symbols-outlined text-3xl">wb_sunny</span>
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold text-white tracking-tight leading-tight">Begin your morning.</h2>
          <p className="text-sm text-on-surface-variant max-w-xs mx-auto">
            Take a few minutes to connect with yourself and set a peaceful tone for your day.
          </p>
        </div>

        <div className="glass-panel p-5 rounded-2xl max-w-sm mx-auto text-left space-y-4">
          <div className="flex justify-between items-center text-xs font-semibold text-primary">
            <span>{routineDuration.toUpperCase()} ROUTINE</span>
            <span>~ {details.mins} Minutes</span>
          </div>
          <ul className="space-y-2 text-xs text-on-surface-variant">
            {details.steps.map((step, idx) => (
              <li key={idx} className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-3 w-full">
        <button 
          onClick={handleBegin}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold flex items-center justify-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg"
        >
          <span>Begin</span>
          <span className="material-symbols-outlined text-sm">arrow_forward</span>
        </button>
        <button 
          onClick={handleSkip}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10"
        >
          Skip Routine
        </button>
      </div>
    </div>
  );
};
