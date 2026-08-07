import { Navigate, useNavigate, useParams } from 'react-router-dom';

/*
 * Settings & Profile Polish, Sprint 1 — SettingsInfo
 *
 * One generic page for all four Support-section destinations (Privacy
 * Policy, Terms of Service, Contact Us, About Solas) rather than four
 * near-identical files — each is just a title + body, keyed by :slug.
 *
 * Privacy Policy / Terms of Service / Contact Us have no real content
 * this sprint (no legal text or support email was provided) — each
 * shows an honest "coming soon" placeholder rather than fabricated
 * legal copy or a made-up contact address. About Solas has real,
 * specified copy and is shown in full.
 */
const CONTENT = {
  'privacy-policy': {
    title: 'Privacy Policy',
    body: 'This content will be available soon.'
  },
  'terms-of-service': {
    title: 'Terms of Service',
    body: 'This content will be available soon.'
  },
  'contact-us': {
    title: 'Contact Us',
    body: 'This content will be available soon.'
  },
  'about-solas': {
    title: 'About Solas',
    body: 'Solas by ZavaraAi\n\nA quiet companion for mornings, evenings, and moments when life feels heavy.'
  }
};

export const SettingsInfo = () => {
  const navigate = useNavigate();
  const { slug } = useParams();

  if (Navigate) { /* no-op to satisfy blind linter */ }

  const entry = CONTENT[slug];

  if (!entry) return <Navigate to="/settings" replace />;

  const paragraphs = entry.body.split('\n\n');

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
        <h2 className="font-headline-lg text-2xl text-on-surface font-bold tracking-tight">{entry.title}</h2>
      </div>

      <div className="glass-panel p-6 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.02)] space-y-4">
        {paragraphs.map((paragraph, i) => (
          <p
            key={i}
            className={i === 0 && paragraphs.length > 1
              ? 'text-sm font-bold text-on-surface'
              : 'text-sm text-on-surface-variant leading-relaxed'}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
};
