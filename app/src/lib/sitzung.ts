import { useEffect, useState } from 'react';
import { ladeSitzung } from './api';
import type { Sitzung } from './model';

/** Aktuelle Anmeldung (aktualisiert sich bei Login/Logout automatisch) */
export function useSitzung(): Sitzung | null {
  const [s, setS] = useState(ladeSitzung);
  useEffect(() => {
    const f = () => setS(ladeSitzung());
    window.addEventListener('mgi-sitzung', f);
    window.addEventListener('storage', f);
    return () => {
      window.removeEventListener('mgi-sitzung', f);
      window.removeEventListener('storage', f);
    };
  }, []);
  return s;
}

/** Online-Status */
export function useOnline() {
  const [on, setOn] = useState(navigator.onLine);
  useEffect(() => {
    const a = () => setOn(true);
    const b = () => setOn(false);
    window.addEventListener('online', a);
    window.addEventListener('offline', b);
    return () => {
      window.removeEventListener('online', a);
      window.removeEventListener('offline', b);
    };
  }, []);
  return on;
}
