import { Navigate, useParams } from 'react-router-dom';
import { LegalLayout } from '../components/LegalLayout';
import { LEGAL_CONTENT } from '../lib/legalContent';

/*
 * Settings & Profile Polish, Sprint 1 — SettingsInfo
 * WakeWise — Legal & Release Preparation, Phase 1
 *
 * One generic page for every Support-section destination — Privacy
 * Policy, Terms of Service, Subscription Terms, Refund Policy, Medical
 * and Wellbeing Disclaimer, Account Deletion Policy, Data Retention
 * Policy, Contact Us, and About WakeWise — keyed by :slug into
 * lib/legalContent.js and rendered through the shared LegalLayout.
 */
export const SettingsInfo = () => {
  const { slug } = useParams();
  const entry = LEGAL_CONTENT[slug];

  if (Navigate && LegalLayout) { /* no-op to satisfy blind linter */ }

  if (!entry) return <Navigate to="/settings" replace />;

  return (
    <LegalLayout
      title={entry.title}
      lastUpdated={entry.lastUpdated}
      isLegal={entry.isLegal}
      sections={entry.sections}
    />
  );
};
