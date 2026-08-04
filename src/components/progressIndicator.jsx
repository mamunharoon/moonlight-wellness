export const ProgressIndicator = ({ activeStep }) => {
  const steps = [
    { key: 'alarm', label: 'Alarm' },
    { key: 'affirmation', label: 'Affirm' },
    { key: 'stretch', label: 'Stretch' },
    { key: 'breathe', label: 'Breathe' },
    { key: 'intention', label: 'Intend' },
    { key: 'complete', label: 'Done' }
  ];

  const activeIndex = steps.findIndex(step => step.key === activeStep);

  return (
    <div className="w-full flex justify-between items-center px-2 py-4 border-b border-white/5 select-none shrink-0 z-50 text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/40">
      {steps.map((step, idx) => {
        const isCompleted = idx < activeIndex;
        const isActive = idx === activeIndex;

        return (
          <div key={step.key} className="flex items-center gap-1">
            <span className={`transition-all duration-300 ${
              isActive 
                ? 'text-primary font-bold scale-105' 
                : isCompleted 
                ? 'text-secondary' 
                : 'text-on-surface-variant/30'
            }`}>
              {isCompleted ? '✓' : ''} {step.label}
            </span>
            {idx < steps.length - 1 && <span className="text-on-surface-variant/20 mx-0.5">·</span>}
          </div>
        );
      })}
    </div>
  );
};
