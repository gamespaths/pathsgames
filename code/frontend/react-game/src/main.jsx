import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/main.css'
import { loadGtm } from './consent/gtm'

// Load the GTM container. Consent Mode v2 defaults (set inline in index.html)
// keep analytics denied until the user opts in via the cookie banner
// (src/consent/cookieConsent.js).
loadGtm(import.meta.env.VITE_GTM_ID)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
