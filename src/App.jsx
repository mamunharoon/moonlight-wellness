/* eslint-disable no-unused-vars */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { SubscriptionProvider } from './context/SubscriptionContext';
import { NotificationProvider } from './context/NotificationContext';
import { AudioProvider } from './context/AudioContext';
import { AlarmProvider } from './context/AlarmContext';
import { MorningReminderProvider } from './context/MorningReminderContext';
import { SessionProvider } from './context/SessionContext';
import { NavigationHistoryProvider } from './context/NavigationHistoryContext';
import { Layout } from './components/Layout';
import { AdminRoute } from './components/AdminRoute';
import { OnboardingGate } from './components/OnboardingGate';
import { RoutineRestoreGuard } from './components/RoutineRestoreGuard';
import { useNativeDeepLinks } from './hooks/useNativeDeepLinks';
import { useMorningReminderNotificationTap } from './hooks/useMorningReminderNotificationTap';

// Mobile navigation repair, Phase 4 (performance): route-level code
// splitting. The audit found a single ~670KB (170KB gzip) JS chunk
// containing nearly the whole app — only the three Audio* pages were
// ever lazy-loaded (`vite.config.js` has no manualChunks, and every
// other ~45 page components were static top-level imports here). That
// one chunk has to be downloaded, parsed and executed before the app is
// interactive at all, which the audit flagged as a real, concrete
// contributor to "taps feel slow" on a real mobile device/network,
// especially on first load. Every page below is now lazy-loaded the same
// way the three Audio* pages already were (named export ->
// `{ default: m.TheExport }`, same shape React.lazy requires) — Layout
// and AdminRoute stay static imports since they're structural wrappers
// needed on essentially every route, not page content themselves.
const Home = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const Breathe = lazy(() => import('./pages/Breathe').then((m) => ({ default: m.Breathe })));
const Journal = lazy(() => import('./pages/Journal').then((m) => ({ default: m.Journal })));
const Onboarding = lazy(() => import('./pages/Onboarding').then((m) => ({ default: m.Onboarding })));
const Introduction = lazy(() => import('./pages/Introduction').then((m) => ({ default: m.Introduction })));
const AlarmActive = lazy(() => import('./pages/AlarmActive').then((m) => ({ default: m.AlarmActive })));
const MorningFlow = lazy(() => import('./pages/MorningFlow').then((m) => ({ default: m.MorningFlow })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
const PrivacyAndAccount = lazy(() => import('./pages/PrivacyAndAccount').then((m) => ({ default: m.PrivacyAndAccount })));
const AccountManagement = lazy(() => import('./pages/AccountManagement').then((m) => ({ default: m.AccountManagement })));
const DeleteAccount = lazy(() => import('./pages/DeleteAccount').then((m) => ({ default: m.DeleteAccount })));
// Remove Routines from the Visible User Flow — Routines.jsx and
// RoutineDetail.jsx are no longer routed (see the /routines and
// /routines/:routineId redirects below), so they are no longer imported
// here either. Both files, routinesCatalog.js, their tests and every
// supporting component remain fully present and unmodified on disk -
// dormant, not deleted. To re-enable: restore these two lazy imports and
// swap the two redirect routes below back to `withFallback(<Routines />)`
// / `withFallback(<RoutineDetail />)`.
const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const Journey = lazy(() => import('./pages/Journey').then((m) => ({ default: m.Journey })));
const SessionComplete = lazy(() => import('./pages/SessionComplete').then((m) => ({ default: m.SessionComplete })));
const IntentionSetup = lazy(() => import('./pages/IntentionSetup').then((m) => ({ default: m.IntentionSetup })));
const ChangeIntention = lazy(() => import('./pages/ChangeIntention').then((m) => ({ default: m.ChangeIntention })));
const Affirmation = lazy(() => import('./pages/Affirmation').then((m) => ({ default: m.Affirmation })));
// Journey Embedding (Self-Guided Meditation) — optional embedded step in
// both Morning and Evening, inserted immediately after Breathe/Breathing.
const MorningMeditate = lazy(() => import('./pages/MorningMeditate').then((m) => ({ default: m.MorningMeditate })));
const Auth = lazy(() => import('./pages/Auth').then((m) => ({ default: m.Auth })));
const ResetPassword = lazy(() => import('./pages/ResetPassword').then((m) => ({ default: m.ResetPassword })));
const SessionRegistryPreview = lazy(() => import('./pages/SessionRegistryPreview').then((m) => ({ default: m.SessionRegistryPreview })));
const SessionEnginePreview = lazy(() => import('./pages/SessionEnginePreview').then((m) => ({ default: m.SessionEnginePreview })));
const EveningWindDown = lazy(() => import('./pages/EveningWindDown').then((m) => ({ default: m.EveningWindDown })));
const EveningComplete = lazy(() => import('./pages/EveningComplete').then((m) => ({ default: m.EveningComplete })));
const Reflection = lazy(() => import('./pages/Reflection').then((m) => ({ default: m.Reflection })));
const Gratitude = lazy(() => import('./pages/Gratitude').then((m) => ({ default: m.Gratitude })));
const EveningBreathing = lazy(() => import('./pages/EveningBreathing').then((m) => ({ default: m.EveningBreathing })));
const EveningMeditate = lazy(() => import('./pages/EveningMeditate').then((m) => ({ default: m.EveningMeditate })));
const PrepareForRest = lazy(() => import('./pages/PrepareForRest').then((m) => ({ default: m.PrepareForRest })));
const ReflectionReview = lazy(() => import('./pages/ReflectionReview').then((m) => ({ default: m.ReflectionReview })));
const GratitudeReview = lazy(() => import('./pages/GratitudeReview').then((m) => ({ default: m.GratitudeReview })));
const EditEveningResponses = lazy(() => import('./pages/EditEveningResponses').then((m) => ({ default: m.EditEveningResponses })));
const Support = lazy(() => import('./pages/Support').then((m) => ({ default: m.Support })));
const PanicMode = lazy(() => import('./pages/PanicMode').then((m) => ({ default: m.PanicMode })));
const Meditate = lazy(() => import('./pages/Meditate').then((m) => ({ default: m.Meditate })));
const SelfGuidedMeditation = lazy(() => import('./pages/SelfGuidedMeditation').then((m) => ({ default: m.SelfGuidedMeditation })));
const SelfGuidedMeditationComplete = lazy(() => import('./pages/SelfGuidedMeditationComplete').then((m) => ({ default: m.SelfGuidedMeditationComplete })));
const AnytimeReset = lazy(() => import('./pages/AnytimeReset').then((m) => ({ default: m.AnytimeReset })));
const MeditationComplete = lazy(() => import('./pages/MeditationComplete').then((m) => ({ default: m.MeditationComplete })));
const Grounding = lazy(() => import('./pages/Grounding').then((m) => ({ default: m.Grounding })));
const SupportComplete = lazy(() => import('./pages/SupportComplete').then((m) => ({ default: m.SupportComplete })));
const StressRelease = lazy(() => import('./pages/StressRelease').then((m) => ({ default: m.StressRelease })));
const QuietBreathing = lazy(() => import('./pages/QuietBreathing').then((m) => ({ default: m.QuietBreathing })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const SettingsInfo = lazy(() => import('./pages/SettingsInfo').then((m) => ({ default: m.SettingsInfo })));
const Subscription = lazy(() => import('./pages/Subscription').then((m) => ({ default: m.Subscription })));
const Beta = lazy(() => import('./pages/Beta').then((m) => ({ default: m.Beta })));
const Feedback = lazy(() => import('./pages/Feedback').then((m) => ({ default: m.Feedback })));
const ReleaseNotes = lazy(() => import('./pages/ReleaseNotes').then((m) => ({ default: m.ReleaseNotes })));
const NotificationSettings = lazy(() => import('./pages/NotificationSettings').then((m) => ({ default: m.NotificationSettings })));
const TimezoneSettings = lazy(() => import('./pages/TimezoneSettings').then((m) => ({ default: m.TimezoneSettings })));
const AdminHome = lazy(() => import('./pages/AdminHome').then((m) => ({ default: m.AdminHome })));
const AdminUsers = lazy(() => import('./pages/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions').then((m) => ({ default: m.AdminSubscriptions })));
// DEV-only Fast Start pilot comparison tool (approved for controlled DEV
// deployment). See docs/fast-start-pilot-comparison.md. Remove this line +
// the route below + src/pages/FastStartPilot.jsx + src/lib/
// pilotVideoAccess.js + supabase/functions/get-pilot-video-url/ to remove
// the pilot cleanly.
const FastStartPilot = lazy(() => import('./pages/FastStartPilot').then((m) => ({ default: m.FastStartPilot })));
const AudioLibrary = lazy(() => import('./pages/AudioLibrary').then((m) => ({ default: m.AudioLibrary })));
const AudioCategory = lazy(() => import('./pages/AudioCategory').then((m) => ({ default: m.AudioCategory })));
const AudioDetails = lazy(() => import('./pages/AudioDetails').then((m) => ({ default: m.AudioDetails })));

// Matches AdminRoute.jsx's existing "Checking access…" loading screen
// exactly (same container classes) — the app's one established
// full-screen loading pattern, reused for every lazy route rather than
// inventing a new one. This is a route-chunk loading state (the page's
// JS hasn't arrived yet), not a data-loading state — each page still
// owns its own in-page loading UI for its own Supabase/media requests,
// exactly as before.
const RouteFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background text-on-surface-variant text-sm">
    Loading…
  </div>
);

// Wraps one lazy element in the shared Suspense fallback — every <Route
// element={...}> below uses this instead of repeating the same
// <Suspense fallback={<RouteFallback />}> boilerplate ~45 times.
const withFallback = (element) => <Suspense fallback={<RouteFallback />}>{element}</Suspense>;

// Capacitor iOS Foundation: routes wakewise:// deep links (native only, see
// useNativeDeepLinks.js) to their matching in-app route. Mounted inside
// <Router> so it can call useNavigate(); renders nothing itself.
function NativeDeepLinkHandler() {
  useNativeDeepLinks();
  return null;
}

// WakeWise iOS Native Morning Reminders: routes a tapped morning-reminder
// notification to its fixed in-app target (native only, see
// useMorningReminderNotificationTap.js). Same isolated pattern as
// NativeDeepLinkHandler above; renders nothing itself.
function MorningReminderTapHandler() {
  useMorningReminderNotificationTap();
  return null;
}

// Remove Routines from the Visible User Flow — safe, deterministic
// destinations for the three known historical Routine Detail URLs, plus
// a Home fallback for anything else. Deliberately NOT a blind 1:1 redirect
// to each routine's own step route: neither IntentionSetup.jsx nor
// EveningWindDown.jsx has any guest-gating of its own (confirmed by
// direct grep - both rely entirely on their caller, Home.jsx/
// RoutineDetail.jsx, having already turned away a guest before ever
// navigating there). A blind redirect straight to /intention-setup or
// /evening-wind-down would let a guest bypass that gate entirely, so
// 'rise-reset' and 'wind-down' redirect to Home instead - the one place
// that still performs the real guest check before genuinely starting
// either routine. 'gentle-reset' has no such gate to bypass
// (requiresAuth: false, a plain stateless navigate), so it redirects
// directly to its real equivalent, /quiet-breathing. Every target is a
// fixed leaf path, never /routines or /routines/:routineId themselves,
// so this can never loop.
const HISTORICAL_ROUTINE_REDIRECTS = {
  'gentle-reset': '/quiet-breathing'
};

function RoutineDetailRedirect() {
  const { routineId } = useParams();
  return <Navigate to={HISTORICAL_ROUTINE_REDIRECTS[routineId] ?? '/'} replace />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Subscription Model, Sprint 2 Stage 1: mounted directly inside
            AuthProvider (SubscriptionContext's only dependency is
            useAuth()) and outside AudioProvider/SessionProvider/
            AlarmProvider — a cross-cutting concern like auth itself, not
            tied to any of that machinery. No page consumes it yet except
            Subscription.jsx; this mount is otherwise inert. */}
        <SubscriptionProvider>
        {/* Notifications & Reminders, Phase B: local-only, no auth/session
            dependency (see NotificationContext.jsx) — mounted as another
            cross-cutting sibling provider, same reasoning as
            SubscriptionProvider above. Inert until a page calls
            useNotifications(); NotificationSettings.jsx is the first
            consumer. */}
        <NotificationProvider>
        <AudioProvider>
          {/* Stage 3C Ticket Group 3A: production SessionProvider mount.
              Wraps AlarmProvider only (AlarmProvider will need useSession in
              a later, separate subgroup) — SessionContext.jsx depends on
              nothing here, so this is the only ordering that avoids a
              circular context dependency. No page consumes useSession yet;
              this insertion is inert until a later subgroup wires a real
              consumer. */}
          <SessionProvider>
            <AlarmProvider>
              {/* Capacitor iOS Native Morning Reminders: mounted inside
                  AlarmProvider (not alongside NotificationProvider near the
                  top of the tree) specifically so it can read the user's
                  real saved wake time via useAlarm(). Wraps <Router> so
                  every route, including /auth, can reach useMorningReminder()
                  as a descendant. */}
              <MorningReminderProvider>
              <Router>
                {/* Back-navigation repair: must be inside <Router> (needs
                    useLocation/useNavigate) and wrap every <Routes> below,
                    since BackButton — used by routes on both sides of the
                    <Layout> split — reads this context. */}
                <NavigationHistoryProvider>
                <NativeDeepLinkHandler />
                <MorningReminderTapHandler />
                {/* Safe backward navigation ("Review Mode") fix: mounted
                    once here, outside <Layout>, so it survives for the
                    whole app session instead of resetting every time
                    Layout unmounts/remounts crossing the Layout/non-Layout
                    route boundary — see RoutineRestoreGuard.jsx's own doc
                    comment. */}
                <RoutineRestoreGuard />
                {/* Guest Onboarding: shows the Welcome screen instead of
                    this whole tree when there's no session and no
                    persisted "Continue as Guest" choice yet — see
                    OnboardingGate.jsx's own doc comment. */}
                <OnboardingGate>
                <Routes>
                {/* Full-Screen flows */}
                <Route path="alarm-trigger" element={withFallback(<AlarmActive />)} />
                <Route path="onboarding" element={withFallback(<Onboarding />)} />
                {/* First-use WakeWise introduction — reached today only via
                    Profile's "About WakeWise" row (see Introduction.jsx's
                    own doc comment for why it isn't yet auto-shown after
                    signup/first login). Full-bleed, same placement as
                    onboarding/auth above. */}
                <Route path="introduction" element={withFallback(<Introduction />)} />
                <Route path="session-complete" element={withFallback(<SessionComplete />)} />
                <Route path="affirmation" element={withFallback(<Affirmation />)} />
                {/* Journey Embedding — Morning's optional embedded meditation
                    step, between Breathe and Affirmation. Full-bleed, same
                    placement as affirmation/intention-setup above (outside
                    <Layout>) - matches the standalone Self-Guided Meditation
                    page's own established chrome, and Breathe's other
                    neighbor (Affirmation) already sits outside <Layout> too. */}
                <Route path="morning-meditate" element={withFallback(<MorningMeditate />)} />
                <Route path="intention-setup" element={withFallback(<IntentionSetup />)} />
                <Route path="change-intention" element={withFallback(<ChangeIntention />)} />
                <Route path="auth" element={withFallback(<Auth />)} />
                <Route path="reset-password" element={withFallback(<ResetPassword />)} />

                {/* Stage 4 Batch F3/F4/F6: evening-wind-down session steps. Full-bleed
                    (fixed inset-0 z-[100], via EveningSceneShell) same as
                    AlarmActive.jsx above, so placed outside <Layout> for the same
                    reason. */}
                <Route path="evening-wind-down" element={withFallback(<EveningWindDown />)} />
                <Route path="reflection" element={withFallback(<Reflection />)} />
                <Route path="gratitude" element={withFallback(<Gratitude />)} />
                <Route path="evening-breathing" element={withFallback(<EveningBreathing />)} />
                {/* Journey Embedding — Evening's optional embedded meditation
                    step, between Evening Breathing and Prepare for Rest.
                    Full-bleed (EveningSceneShell), same placement as every
                    other evening-wind-down step above. */}
                <Route path="evening-meditate" element={withFallback(<EveningMeditate />)} />
                <Route path="prepare-for-rest" element={withFallback(<PrepareForRest />)} />
                <Route path="evening-complete" element={withFallback(<EveningComplete />)} />

                {/* Evening completed-review (Build 15) — read-only, not
                    coupled to the Session Engine. `?q=` is the only
                    allowlisted URL input; see ReflectionReview.jsx/
                    GratitudeReview.jsx's own doc comments. */}
                <Route path="review/reflection" element={withFallback(<ReflectionReview />)} />
                <Route path="review/gratitude" element={withFallback(<GratitudeReview />)} />

                {/* Edit Tonight's Responses (Build 15) — one shared edit
                    session across all six Reflection+Gratitude questions,
                    addressed by a single `?q=1..6` route (never two
                    separate pages - see EditEveningResponses.jsx's own
                    doc comment for why that would lose a Reflection draft
                    the moment navigation crossed into Gratitude). Also
                    not coupled to the Session Engine. */}
                <Route path="edit/evening" element={withFallback(<EditEveningResponses />)} />

                {/* Support & Calm, Sprint 1: lightweight grounding/panic/
                    stress/breathing support flow. Full-bleed (same
                    EveningSceneShell pattern as the evening routes above),
                    placed outside <Layout> for the same reason — no bottom
                    nav chrome during a moment of acute stress. Not a
                    Session Engine session: this is a standalone comfort
                    flow, not a scheduled morning/evening routine, so it
                    uses plain react-router navigation only. Support.jsx's
                    own "How are you feeling?" flow (mobile navigation
                    repair, Phase 3) is the primary path into a
                    recommended exercise now; /panic and /stress-release
                    stay live routes (direct link only) rather than being
                    deleted. */}
                <Route path="support" element={withFallback(<Support />)} />
                <Route path="panic" element={withFallback(<PanicMode />)} />
                <Route path="grounding" element={withFallback(<Grounding />)} />
                <Route path="stress-release" element={withFallback(<StressRelease />)} />
                <Route path="quiet-breathing" element={withFallback(<QuietBreathing />)} />
                <Route path="support-complete" element={withFallback(<SupportComplete />)} />

                {/* Build 15 — standalone Breathe (Home's own Breathe quick
                    action). Reuses QuietBreathing.jsx's own real pattern
                    picker/Begin-gesture design via its additive
                    `standalone` prop - no Session Engine coupling (this
                    file has never imported useSession), returns to Home
                    (not /support-complete), never touches Support's own
                    unchanged, non-standalone route above. */}
                <Route path="breathe-standalone" element={withFallback(<QuietBreathing standalone />)} />

                {/* Meditation experience: Today's "Meditate" quick action
                    and the Library's Meditation filter both route here.
                    Reuses the existing media catalogue/player/guest-access
                    infrastructure entirely - see Meditate.jsx's own doc
                    comment. */}
                <Route path="meditate" element={withFallback(<Meditate />)} />
                <Route path="meditation-complete" element={withFallback(<MeditationComplete />)} />

                {/* Self-Guided Meditation (IM01): Home's "Meditate" tile
                    (repurposed - see Home.jsx's own doc comment) and
                    Library's "Self-Guided Meditation" entry both route
                    here. Non-narrated, timer-authoritative, optional - not
                    a Morning/Evening journey step. Registered outside
                    <Layout>, same placement as /meditate above. */}
                <Route path="self-guided-meditation" element={withFallback(<SelfGuidedMeditation />)} />
                <Route path="self-guided-meditation-complete" element={withFallback(<SelfGuidedMeditationComplete />)} />

                {/* Build 15 UX remediation: Anytime Reset. Home's own
                    quick-action tile (formerly "Need a moment?") routes
                    here. /support remains a separate, untouched route -
                    see AnytimeReset.jsx's own doc comment. */}
                <Route path="anytime-reset" element={withFallback(<AnytimeReset />)} />

                {/* WakeWise Phase 1 correction — the MLT-3A-16 Stage 3
                    internal preview route was removed here (dormant-branding
                    audit): even unlinked from nav, it was still a real,
                    production-accessible route exposing an incorrect
                    product name ("Solas, in progress.") to anyone who
                    guessed the URL. Stage3Preview.jsx and every stage3/*
                    component file are UNCHANGED and still on disk - only
                    this route registration was removed, so the experiment
                    remains available to re-wire later, just not shipped in
                    the meantime. See Stage3Preview.jsx's own doc comment. */}

                {/* Stage 3C Ticket Group 1: read-only Session Engine registry
                    inspection — same unlinked-route pattern as stage3-preview
                    above. Renders outside <Layout />; displays data only. */}
                <Route path="session-registry-preview" element={withFallback(<SessionRegistryPreview />)} />

                {/* Stage 3C Ticket Group 2: Session Engine core preview.
                    <SessionProvider> is ALSO mounted locally inside this page
                    (see SessionEnginePreview.jsx) — that inner provider shadows
                    the production one above for this route only, so the preview
                    keeps its own isolated, independently-resettable state and
                    never reads or writes real production session state. */}
                <Route path="session-engine-preview" element={withFallback(<SessionEnginePreview />)} />

                {/* Subscription Model, Sprint 2 Stage 2: administration
                    foundation. AdminRoute gates every nested route on
                    server-verified admin status (see AdminRoute.jsx and
                    adminApi.js) — guests and non-admin authenticated
                    users are redirected before any admin page renders.
                    Rendered outside <Layout>, same reasoning as the
                    full-bleed routes above: this isn't part of the
                    tabbed app frame and has no use for the bottom nav. */}
                <Route path="admin" element={<AdminRoute />}>
                  <Route index element={withFallback(<AdminHome />)} />
                  <Route path="users" element={withFallback(<AdminUsers />)} />
                  <Route path="subscriptions" element={withFallback(<AdminSubscriptions />)} />
                  <Route path="faststart-pilot" element={withFallback(<FastStartPilot />)} />
                </Route>

                {/* Main Tabbed Frame */}
                <Route path="/" element={<Layout />}>
                  <Route index element={withFallback(<Home />)} />
                  <Route path="today" element={<Navigate to="/" replace />} />
                  {/* Remove Routines from the Visible User Flow — both
                      routes now redirect instead of rendering the Hub/
                      Detail screens (see RoutineDetailRedirect above and
                      HISTORICAL_ROUTINE_REDIRECTS' own doc comment). */}
                  <Route path="routines" element={<Navigate to="/" replace />} />
                  <Route path="routines/:routineId" element={<RoutineDetailRedirect />} />
                  {/* Mobile navigation repair, Phase 3: the fourth bottom-nav
                      destination — every video/sleep-sound id already in
                      BETA_VIDEO_MANIFEST, browsable and filterable, no beta
                      framing. Replaces "Journey" as a bottom-nav tab (moved
                      to a Profile row instead — see Profile.jsx). */}
                  <Route path="library" element={withFallback(<Library />)} />
                  <Route path="journey" element={withFallback(<Journey />)} />
                  <Route path="profile" element={withFallback(<Profile />)} />
                  <Route path="profile/privacy-account" element={withFallback(<PrivacyAndAccount />)} />
                  {/* Safe Account Management and Account Deletion: reached only
                      via Profile -> Privacy and Account -> Account management
                      -> Request account deletion — never a bottom-nav tab, never
                      a shortcut from anywhere else. */}
                  <Route path="profile/account-management" element={withFallback(<AccountManagement />)} />
                  <Route path="profile/delete-account" element={withFallback(<DeleteAccount />)} />

                  {/* Secondary pages */}
                  <Route path="breathe" element={withFallback(<Breathe />)} />
                  <Route path="journal" element={withFallback(<Journal />)} />
                  <Route path="morning-flow" element={withFallback(<MorningFlow />)} />

                  {/* Subscription Model, Stage 1A: /premium retired. It was
                      an orphaned, unwired mock page (fabricated price, dead
                      "Upgrade Now" button, a different feature list than
                      the real /subscription screen) — linked from nowhere
                      in the app, confirmed by grep before removal. Kept as
                      a redirect rather than deleted outright: "do not break
                      existing routes" — any old link/bookmark to /premium
                      still resolves, just to the real screen now. Same
                      pattern already used by the "today" redirect above. */}
                  <Route path="premium" element={<Navigate to="/subscription" replace />} />

                  {/* Settings & Profile Polish, Sprint 1: reached from
                      Profile's gear icon, not a bottom-nav tab — same
                      "secondary page" placement as breathe/journal above,
                      inside <Layout> for the same header/nav chrome. */}
                  <Route path="settings" element={withFallback(<Settings />)} />
                  <Route path="settings/:slug" element={withFallback(<SettingsInfo />)} />

                  {/* Notifications & Reminders, Phase B: reached from
                      Settings' "Notification preferences" row, same
                      "secondary page" placement as settings/:slug above. */}
                  <Route path="settings/notifications" element={withFallback(<NotificationSettings />)} />

                  {/* Global timezone correctness: reached from Profile's
                      "Timezone" row (Daily Rhythm area, alongside Wake
                      time/Bedtime), same "secondary page" placement as
                      settings/notifications above. */}
                  <Route path="settings/timezone" element={withFallback(<TimezoneSettings />)} />

                  {/* Subscription Model, Sprint 2 Stage 1: reached from
                      Settings, same "secondary page" placement as
                      settings/:slug above. */}
                  <Route path="subscription" element={withFallback(<Subscription />)} />

                  {/* Closed Beta Preparation, Phase A: reached from
                      Settings' "Beta Program" section, same "secondary
                      page" placement as settings/:slug above. */}
                  <Route path="beta" element={withFallback(<Beta />)} />
                  <Route path="feedback" element={withFallback(<Feedback />)} />
                  <Route path="release-notes" element={withFallback(<ReleaseNotes />)} />

                  {/* Audio Architecture, Phase C1: reached from Settings'
                      "Audio Library" row, same "secondary page"
                      placement as settings/:slug above. No audio plays
                      yet — see AudioPlayerPlaceholder.jsx. */}
                  <Route path="audio" element={withFallback(<AudioLibrary />)} />
                  <Route path="audio/:categoryId" element={withFallback(<AudioCategory />)} />
                  <Route path="audio/:categoryId/:entryId" element={withFallback(<AudioDetails />)} />
                </Route>

                {/* Fallback to Today */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </OnboardingGate>
              </NavigationHistoryProvider>
              </Router>
              </MorningReminderProvider>
            </AlarmProvider>
          </SessionProvider>
        </AudioProvider>
        </NotificationProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
