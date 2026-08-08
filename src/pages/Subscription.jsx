import { Fragment, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSubscription } from '../context/SubscriptionContext';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { getSubscriptionOverride } from '../lib/subscriptionOverride';

/*
 * Subscription Model, Sprint 2 Stage 1 (+ Stage 1A) — Subscription screen
 *
 * Reached from Settings (not a bottom-nav tab), so this page owns its
 * own small back-affordance header — same pattern as Settings.jsx and
 * SettingsInfo.jsx, not a new one.
 *
 * Upgrade/Restore are explicit placeholders this sprint ("No payment
 * processing should be implemented in this batch") — both reuse
 * ConfirmDialog's acknowledge-only mode exactly like Settings.jsx's own
 * Delete account/Edit profile placeholders, rather than being dead
 * buttons or inventing a second placeholder pattern.
 *
 * Stage 1A: the dev-override badge below getSubscriptionOverride()
 * directly (not through useSubscription()) purely to display the raw
 * override value — it's already baked into `subscription` itself via
 * SubscriptionContext, so this is never out of sync with what's shown
 * above, just a visible reminder of *why* Current plan says what it
 * says. Renders nothing outside development (see subscriptionOverride.js).
 */
const PLAN_COMPARISON = [
  { free: 'Morning routines', plus: 'Guided audio' },
  { free: 'Evening routines', plus: 'Advanced insights' },
  { free: 'Support tools', plus: 'Extended reflections' }
];

const PLUS_FEATURES = [
  { id: 'audio', icon: 'graphic_eq', title: 'Guided audio', description: 'Voice-guided sessions for every routine.' },
  { id: 'reflections', icon: 'auto_stories', title: 'Extended reflections', description: 'Deeper evening journaling prompts.' },
  { id: 'insights', icon: 'insights', title: 'Personalised insights', description: 'Patterns in your rhythm over time.' },
  { id: 'premium', icon: 'diamond', title: 'Premium experiences', description: 'Exclusive soundscapes and sessions.' }
];

const PLAN_LABELS = { free: 'Free', plus: 'Solas Plus' };
const STATUS_LABELS = { trial: 'Trial', active: 'Active', cancelled: 'Cancelled', expired: 'Expired' };

const formatRenewalDate = (subscription) => {
  if (subscription.plan === 'free' || !subscription.expires_at) return 'No renewal date';
  return new Date(subscription.expires_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

export const Subscription = () => {
  const navigate = useNavigate();
  const { subscription, loading, error } = useSubscription();
  const [activeDialog, setActiveDialog] = useState(null); // 'upgrade' | 'restore' | null
  const devOverride = getSubscriptionOverride();

  if (ConfirmDialog && Fragment) { /* no-op to satisfy blind linter */ }

  const rowClass = 'flex items-center justify-between p-4 min-h-[56px]';

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          aria-label="Back to Settings"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">Subscription</h2>
      </div>

      {devOverride && (
        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1.5 inline-block">
          Dev override active — plan forced to {devOverride}
        </p>
      )}

      {/* Current plan */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Current plan</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Current plan</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : PLAN_LABELS[subscription.plan] ?? subscription.plan}
            </span>
          </div>
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Status</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : STATUS_LABELS[subscription.status] ?? subscription.status}
            </span>
          </div>
          <div className={rowClass}>
            <span className="text-sm font-semibold text-on-surface-variant">Renewal date</span>
            <span className="text-sm font-bold text-on-surface">
              {loading ? 'Loading…' : formatRenewalDate(subscription)}
            </span>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-[10px] text-red-400 font-medium px-1">{error}</p>
        )}
      </section>

      {/* Stage 1A: short Free vs Plus explainer, separate from the
          detailed Solas Plus feature list below — this answers "what's
          the difference" at a glance before the fuller pitch. */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Free vs Plus</h3>
        <div className="glass-panel rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-2">
            <span className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant border-b border-white/5">Free</span>
            <span className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-primary border-b border-white/5">Plus</span>
            {PLAN_COMPARISON.map((row, i) => (
              <Fragment key={i}>
                <span className="px-4 py-3 text-sm text-on-surface-variant border-t border-white/5">{row.free}</span>
                <span className="px-4 py-3 text-sm font-semibold text-on-surface border-t border-white/5">{row.plus}</span>
              </Fragment>
            ))}
          </div>
        </div>
      </section>

      {/* Solas Plus */}
      <section className="space-y-2">
        <h3 className="text-xs text-on-surface-variant uppercase tracking-wider font-bold px-1">Solas Plus</h3>
        <div className="glass-panel rounded-2xl overflow-hidden divide-y divide-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.02)]">
          {PLUS_FEATURES.map((feature) => (
            <div key={feature.id} className="flex items-center gap-3 p-4 min-h-[56px]">
              <span className="material-symbols-outlined text-primary text-xl shrink-0">{feature.icon}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold text-on-surface">{feature.title}</span>
                <span className="block text-xs text-on-surface-variant">{feature.description}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Actions */}
      <div className="space-y-3">
        <button
          onClick={() => setActiveDialog('upgrade')}
          className="w-full bg-primary text-on-primary py-4 rounded-full font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
        >
          Upgrade to Solas Plus
        </button>
        <button
          onClick={() => setActiveDialog('restore')}
          className="w-full glass-panel text-on-surface-variant py-4 rounded-full font-semibold text-center hover:bg-white/10 active:scale-95 transition-all border-white/10 focus-visible:ring-2 focus-visible:ring-primary"
        >
          Restore purchases
        </button>
      </div>

      <ConfirmDialog
        open={activeDialog === 'upgrade'}
        title="Upgrade to Solas Plus"
        message="Upgrades will be available soon."
        cancelLabel="Got it"
        onDismiss={() => setActiveDialog(null)}
      />

      <ConfirmDialog
        open={activeDialog === 'restore'}
        title="Restore purchases"
        message="Restoring purchases will be available soon."
        cancelLabel="Got it"
        onDismiss={() => setActiveDialog(null)}
      />
    </div>
  );
};
