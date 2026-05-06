import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Dev mode: simulate SSO token injection so AuthContext can initialize
if (import.meta.env.DEV && !window.__SSO_TOKEN__) {
  window.__SSO_TOKEN__ = 'dev-mock-token'
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
