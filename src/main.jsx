/* eslint-disable no-unused-vars */
// Web password-recovery mount-timing race — imported first, before
// anything else, so its subscription to Supabase's one-time
// PASSWORD_RECOVERY event is registered as early as this app can
// possibly manage, regardless of which route the user lands on. See
// passwordRecoveryLatch.js's own header for the full rationale.
import './lib/passwordRecoveryLatch'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
