import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { testConnection } from './firebase';
import { registerAppServiceWorker } from './utils/notifications';

testConnection();

// Clear stale caches and register lightweight notification Service Worker (no fetch/HLS interception)
if (typeof window !== 'undefined') {
  try {
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          for (const key of keys) {
            caches.delete(key).catch(() => {});
          }
        })
        .catch(() => {});
    }
    registerAppServiceWorker().catch(() => {});
  } catch {}
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
