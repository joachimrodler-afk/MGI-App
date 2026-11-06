import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { hochladen } from './lib/fotos';
import './index.css';

// Hell-/Dunkelmodus folgt der Systemeinstellung (oder der Wahl im Konto)
function thema() {
  const wahl = localStorage.getItem('mgi.thema');
  const dunkel = wahl ? wahl === 'dunkel' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dunkel);
}
thema();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', thema);
window.addEventListener('mgi-thema', thema);

registerSW({ immediate: true });

// Browser bitten, die Anmeldung nicht automatisch zu löschen (dauerhaft angemeldet bleiben)
void navigator.storage?.persist?.().catch(() => undefined);

// Wartende Fotos beim Start hochladen
if (navigator.onLine) setTimeout(() => void hochladen(), 3000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
