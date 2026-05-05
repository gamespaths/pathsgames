import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/main.css'

// Inject GTM ID from env at runtime
const gtmId = import.meta.env.VITE_GTM_ID
if (gtmId) {
  document.querySelectorAll('script, noscript').forEach(el => {
    el.innerHTML = el.innerHTML.replace(/__GTM_ID__/g, gtmId)
    if (el.src) el.src = el.src.replace(/__GTM_ID__/g, gtmId)
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
