import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline / installable on the web. The Android app ships its files already,
// and a service worker there would only risk serving stale builds.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
