/* eslint-disable no-unused-vars */
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { AudioProvider } from './context/AudioContext';
import { AlarmProvider } from './context/AlarmContext';
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

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AudioProvider>
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
        </AudioProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
