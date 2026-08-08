import { useNavigate } from 'react-router-dom';
import { CONTACT_INFO } from '../lib/legalContent';

/*
 * WakeWise — Legal & Release Preparation, Phase 1 — LegalLayout
 *
 * Single reusable renderer for every /settings/:slug legal and support
 * page (see lib/legalContent.js for the data). Header matches the exact
 * back-button + title pattern already used by SettingsInfo.jsx,
 * Settings.jsx, and Subscription.jsx — no new visual language, only
 * existing tokens (glass-panel, text-on-surface[-variant], font-headline-lg).
 *
 * Shared typography is expressed as plain class-string constants below
 * rather than new CSS — this project's styling system (Tailwind
 * utilities + the glass-panel utility class) is left untouched.
 *
 * isLegal pages get a visible "draft, not yet reviewed by a lawyer"
 * notice and a contact footer — see legalContent.js's own header
 * comment for why that notice exists and must not be quietly removed.
 */
const sectionHeadingClass = 'text-sm font-bold text-on-surface';
const bodyTextClass = 'text-sm text-on-surface-variant leading-relaxed';
const listItemClass = 'text-sm text-on-surface-variant leading-relaxed pl-4 relative before:content-["\\2022"] before:absolute before:left-0 before:text-primary';

export const LegalLayout = ({ title, lastUpdated, isLegal, sections, backTo = '/settings' }) => {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(backTo)}
          aria-label="Back to Settings"
          className="w-10 h-10 rounded-full glass-panel border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </button>
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">{title}</h2>
      </div>

      {isLegal && (
        <p className="text-[10px] uppercase tracking-wider font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-3 py-1.5 inline-block">
          Draft — not yet reviewed by a lawyer
        </p>
      )}

      <div className="glass-panel p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] space-y-5">
        {lastUpdated && (
          <p className="text-xs text-on-surface-variant/70">Last updated: {lastUpdated}</p>
        )}

        {sections.map((section, i) => (
          <div key={i} className="space-y-2">
            {section.heading && <h3 className={sectionHeadingClass}>{section.heading}</h3>}
            {section.paragraphs?.map((paragraph, j) => (
              <p key={j} className={bodyTextClass}>{paragraph}</p>
            ))}
            {section.list && (
              <ul className="space-y-1.5 list-none">
                {section.list.map((item, j) => (
                  <li key={j} className={listItemClass}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {isLegal && (
        <p className="text-xs text-on-surface-variant text-center px-4">
          Questions about this page? Contact {CONTACT_INFO.company} at{' '}
          <a href={`mailto:${CONTACT_INFO.email}`} className="text-primary font-semibold">
            {CONTACT_INFO.email}
          </a>
        </p>
      )}
    </div>
  );
};
