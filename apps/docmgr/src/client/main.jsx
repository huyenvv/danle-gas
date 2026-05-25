import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Dev mode: read SSO token from URL params (simulates server-side doGet injection)
if (import.meta.env.DEV) {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  const parent = params.get('parent')
  if (token) {
    window.__SSO_TOKEN__ = token
    window.__SSO_PARENT__ = parent || ''
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
