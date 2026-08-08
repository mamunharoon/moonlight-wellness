import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEEDBACK_CATEGORIES } from '../lib/feedbackCategories';
import { recordFeedbackSubmission, getFeedbackHistory } from '../lib/feedbackStorage';
import { trackEvent } from '../lib/analyticsEvents';
import { CONTACT_INFO } from '../lib/legalContent';

/*
 * WakeWise — Closed Beta Preparation, Phase A — Feedback
 *
 * Delivery is a mailto link, not a new backend table — see
 * lib/feedbackStorage.js's own header comment for why. The "bug
 * report" category shows an extra steps-to-reproduce field, doubling
 * this single flow as the bug-report mechanism rather than building a
 * separate page for it.
 */
const buildMailtoUrl = ({ category, message, reproSteps }) => {
  const categoryLabel = FEEDBACK_CATEGORIES.find((c) => c.id === category)?.label ?? category;
  const subject = `WakeWise feedback: ${categoryLabel}`;
  const bodyLines = [message, reproSteps ? `\nSteps to reproduce:\n${reproSteps}` : null]
    .filter(Boolean)
    .join('\n');
  return `mailto:${CONTACT_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines)}`;
};

export const Feedback = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState(FEEDBACK_CATEGORIES[0].id);
  const [message, setMessage] = useState('');
  const [reproSteps, setReproSteps] = useState('');
  const [history, setHistory] = useState(getFeedbackHistory);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = message.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const mailtoUrl = buildMailtoUrl({ category, message: message.trim(), reproSteps: reproSteps.trim() });
    setHistory(recordFeedbackSubmission({ category, message: message.trim(), reproSteps: reproSteps.trim() }));
    trackEvent('feedback_submitted', { category });

    window.location.href = mailtoUrl;

    setMessage('');
    setReproSteps('');
    setSubmitted(true);
  };

  const rowClass = 'flex items-center justify-between p-4 min-h-[56px]';

  if (submitted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/beta')}
            aria-label="Back to Beta Program"
            className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </button>
          <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Send Feedback</h2>
        </div>

        <div className="glass-panel rounded-2xl p-6 text-center space-y-3 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <span className="material-symbols-outlined text-primary text-4xl">check_circle</span>
          <h3 className="text-lg font-bold text-on-surface">Thank you for your feedback</h3>
          <p className="text-sm text-on-surface-variant">
            Your email app should have opened with your message ready to send. We read every submission.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <button
              onClick={() => setSubmitted(false)}
              className="w-full bg-primary text-on-primary py-3 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all"
            >
              Send another
            </button>
            <button
              onClick={() => navigate('/beta')}
              className="w-full glass-panel border-white/10 text-on-surface-variant py-3 rounded-full font-bold hover:bg-white/5 active:scale-95 transition-all"
            >
              Back to Beta Program
            </button>
          </div>
        </div>

        {history.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Your feedback history (this device)</h3>
            <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
              {history.map((entry) => (
                <div key={entry.id} className={rowClass}>
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-bold text-primary uppercase tracking-wider">
                      {FEEDBACK_CATEGORIES.find((c) => c.id === entry.category)?.label ?? entry.category}
                    </span>
                    <span className="block text-sm text-on-surface truncate">{entry.message}</span>
                  </span>
                  <span className="text-[10px] text-on-surface-variant shrink-0 ml-2">
                    {new Date(entry.submittedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/beta')}
          aria-label="Back to Beta Program"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Send Feedback</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Category</h3>
          <div className="grid grid-cols-2 gap-2">
            {FEEDBACK_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategory(cat.id)}
                className={`flex items-center gap-2 p-3 rounded-xl border text-sm font-semibold transition-all ${
                  category === cat.id
                    ? 'bg-primary text-on-primary border-primary'
                    : 'glass-panel text-on-surface-variant border-white/10 hover:bg-white/5'
                }`}
              >
                <span className="material-symbols-outlined text-lg">{cat.icon}</span>
                {cat.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">What's on your mind?</h3>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us what happened, or what you'd like to see…"
            rows={5}
            className="w-full glass-panel rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 border-white/10 focus-visible:ring-2 focus-visible:ring-primary resize-none"
          />
        </section>

        {category === 'bug-report' && (
          <section className="space-y-2">
            <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Steps to reproduce (optional)</h3>
            <textarea
              value={reproSteps}
              onChange={(e) => setReproSteps(e.target.value)}
              placeholder="1. Open Settings&#10;2. Tap…"
              rows={3}
              className="w-full glass-panel rounded-2xl p-4 text-sm text-on-surface placeholder:text-on-surface-variant/50 border-white/10 focus-visible:ring-2 focus-visible:ring-primary resize-none"
            />
          </section>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:opacity-40"
        >
          Send via email
        </button>
        <p className="text-[10px] text-on-surface-variant text-center px-4">
          Opens your email app addressed to {CONTACT_INFO.email} — nothing is sent until you do.
        </p>
      </form>

      {history.length > 0 && (
        <section className="space-y-2">
          <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Your feedback history (this device)</h3>
          <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
            {history.map((entry) => (
              <div key={entry.id} className={rowClass}>
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold text-primary uppercase tracking-wider">
                    {FEEDBACK_CATEGORIES.find((c) => c.id === entry.category)?.label ?? entry.category}
                  </span>
                  <span className="block text-sm text-on-surface truncate">{entry.message}</span>
                </span>
                <span className="text-[10px] text-on-surface-variant shrink-0 ml-2">
                  {new Date(entry.submittedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
