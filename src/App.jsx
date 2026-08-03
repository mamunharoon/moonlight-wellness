import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AudioProvider } from './context/AudioContext';
import { AlarmProvider } from './context/AlarmContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Breathe } from './pages/Breathe';
import { Journal } from './pages/Journal';
import { Toolkit } from './pages/Toolkit';
import { Journey } from './pages/Journey';
import { SleepHub } from './pages/SleepHub';
import { WindDown } from './pages/WindDown';
import { Gallery } from './pages/Gallery';
import { Notifications } from './pages/Notifications';
import { Landing } from './pages/Landing';
import { SessionComplete } from './pages/SessionComplete';
import { Vibes } from './pages/Vibes';
import { Onboarding } from './pages/Onboarding';
import { AlarmActive } from './pages/AlarmActive';
import { MorningFlow } from './pages/MorningFlow';
import { Profile } from './pages/Profile';
import { Premium } from './pages/Premium';

function App() {
  return (
    <ThemeProvider>
      <AudioProvider>
        <AlarmProvider>
          <Router>
            <Routes>
              {/* Full-Screen mobile pages */}
              <Route path="alarm-trigger" element={<AlarmActive />} />
              <Route path="onboarding" element={<Onboarding />} />
              <Route path="session-complete" element={<SessionComplete />} />
              <Route path="landing" element={<Landing />} />
              
              {/* Core navigation pages */}
              <Route path="/" element={<Layout />}>
                <Route index element={<Home />} />
                <Route path="breathe" element={<Breathe />} />
                <Route path="journal" element={<Journal />} />
                <Route path="toolkit" element={<Toolkit />} />
                <Route path="journey" element={<Journey />} />
                <Route path="sleep" element={<SleepHub />} />
                <Route path="wind-down" element={<WindDown />} />
                <Route path="gallery" element={<Layout />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="vibes" element={<Vibes />} />
                <Route path="morning-flow" element={<MorningFlow />} />
                <Route path="profile" element={<Profile />} />
                <Route path="premium" element={<Premium />} />
              </Route>
            </Routes>
          </Router>
        </AlarmProvider>
      </AudioProvider>
    </ThemeProvider>
  );
}

export default App;
