/* eslint-disable no-unused-vars */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { AlarmProvider } from './context/AlarmContext';
import { SessionProvider } from './context/SessionContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Breathe } from './pages/Breathe';
import { Journal } from './pages/Journal';
import { Onboarding } from './pages/Onboarding';
import { AlarmActive } from './pages/AlarmActive';
import { MorningFlow } from './pages/MorningFlow';
import { Profile } from './pages/Profile';
import { Premium } from './pages/Premium';
import { Routines } from './pages/Routines';
import { Journey } from './pages/Journey';
import { SessionComplete } from './pages/SessionComplete';
import { IntentionSetup } from './pages/IntentionSetup';
import { MorningStart } from './pages/MorningStart';
import { Affirmation } from './pages/Affirmation';
import { Auth } from './pages/Auth';
import { ResetPassword } from './pages/ResetPassword';
import { Stage3Preview } from './pages/Stage3Preview';
import { SessionRegistryPreview } from './pages/SessionRegistryPreview';
import { SessionEnginePreview } from './pages/SessionEnginePreview';
import { EveningWindDown } from './pages/EveningWindDown';
import { EveningComplete } from './pages/EveningComplete';
import { Reflection } from './pages/Reflection';
import { Gratitude } from './pages/Gratitude';
import { EveningBreathing } from './pages/EveningBreathing';
import { PrepareForRest } from './pages/PrepareForRest';
import { Support } from './pages/Support';
import { PanicMode } from './pages/PanicMode';
import { Grounding } from './pages/Grounding';
import { SupportComplete } from './pages/SupportComplete';
import { StressRelease } from './pages/StressRelease';
import { QuietBreathing } from './pages/QuietBreathing';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
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
              <Router>
                <Routes>
                {/* Full-Screen flows */}
                <Route path="alarm-trigger" element={<AlarmActive />} />
                <Route path="onboarding" element={<Onboarding />} />
                <Route path="session-complete" element={<SessionComplete />} />
                <Route path="morning-start" element={<MorningStart />} />
                <Route path="affirmation" element={<Affirmation />} />
                <Route path="intention-setup" element={<IntentionSetup />} />
                <Route path="auth" element={<Auth />} />
                <Route path="reset-password" element={<ResetPassword />} />

                {/* Stage 4 Batch F3/F4/F6: evening-wind-down session steps. Full-bleed
                    (fixed inset-0 z-[100], via EveningSceneShell) same as
                    AlarmActive.jsx above, so placed outside <Layout> for the same
                    reason. */}
                <Route path="evening-wind-down" element={<EveningWindDown />} />
                <Route path="reflection" element={<Reflection />} />
                <Route path="gratitude" element={<Gratitude />} />
                <Route path="evening-breathing" element={<EveningBreathing />} />
                <Route path="prepare-for-rest" element={<PrepareForRest />} />
                <Route path="evening-complete" element={<EveningComplete />} />

                {/* Support & Calm, Sprint 1: lightweight grounding/panic/
                    stress/breathing support flow. Full-bleed (same
                    EveningSceneShell pattern as the evening routes above),
                    placed outside <Layout> for the same reason — no bottom
                    nav chrome during a moment of acute stress. Not a
                    Session Engine session: this is a standalone comfort
                    flow, not a scheduled morning/evening routine, so it
                    uses plain react-router navigation only. Phase 2 adds
                    Stress Release and Quiet Breathing alongside Phase 1's
                    Support Hub, Panic Mode, Grounding, and Completion. */}
                <Route path="support" element={<Support />} />
                <Route path="panic" element={<PanicMode />} />
                <Route path="grounding" element={<Grounding />} />
                <Route path="stress-release" element={<StressRelease />} />
                <Route path="quiet-breathing" element={<QuietBreathing />} />
                <Route path="support-complete" element={<SupportComplete />} />

                {/* MLT-3A-16: Stage 3 internal preview — not linked from any
                    nav, not part of any Stage 2 flow. Renders outside
                    <Layout /> so it never touches existing navigation chrome. */}
                <Route path="stage3-preview" element={<Stage3Preview />} />

                {/* Stage 3C Ticket Group 1: read-only Session Engine registry
                    inspection — same unlinked-route pattern as stage3-preview
                    above. Renders outside <Layout />; displays data only. */}
                <Route path="session-registry-preview" element={<SessionRegistryPreview />} />

                {/* Stage 3C Ticket Group 2: Session Engine core preview.
                    <SessionProvider> is ALSO mounted locally inside this page
                    (see SessionEnginePreview.jsx) — that inner provider shadows
                    the production one above for this route only, so the preview
                    keeps its own isolated, independently-resettable state and
                    never reads or writes real production session state. */}
                <Route path="session-engine-preview" element={<SessionEnginePreview />} />

                {/* Main Tabbed Frame */}
                <Route path="/" element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="today" element={<Navigate to="/" replace />} />
                  <Route path="routines" element={<Routines />} />
                  <Route path="journey" element={<Journey />} />
                  <Route path="profile" element={<Profile />} />

                  {/* Secondary pages */}
                  <Route path="breathe" element={<Breathe />} />
                  <Route path="journal" element={<Journal />} />
                  <Route path="morning-flow" element={<MorningFlow />} />
                  <Route path="premium" element={<Premium />} />
                </Route>

                {/* Fallback to Today */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Router>
            </AlarmProvider>
          </SessionProvider>
        </AudioProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
