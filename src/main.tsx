import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'
import { dismissAppLaunch } from './launch-screen.js'

// Installed PWAs already receive a launch screen from the operating system.
if (window.matchMedia('(display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)) {
  document.getElementById('app-launch')?.remove()
}

// Slow connections reveal the existing skeletons instead of blocking the app.
window.setTimeout(dismissAppLaunch, 3000)
if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) dismissAppLaunch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch(() => {
      // The app remains usable online if service worker registration is unavailable.
    })
  })
}
