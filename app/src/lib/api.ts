/**
 * Verbindung zum Apps-Script-Backend.
 * Ohne konfigurierte apiUrl läuft die App im Demo-Modus (siehe demo.ts).
 */
import { config, istDemo } from '../config';
import { demoAufruf } from './demo';
import type { Sitzung } from './model';

const SITZUNG_KEY = 'mgi.sitzung';

export class ApiFehler extends Error {
  constructor(msg: string, public status = 500) {
    super(msg);
  }
}

export function ladeSitzung(): Sitzung | null {
  try {
    const s = JSON.parse(localStorage.getItem(SITZUNG_KEY) || 'null') as Sitzung | null;
    // Anmeldungen laufen nicht ab – nur Abmelden, neuer PIN oder Deaktivieren beenden sie
    if (s && s.token) return s;
  } catch {
    /* kein Speicher verfügbar */
  }
  return null;
}

export function speichereSitzung(s: Sitzung | null) {
  try {
    if (s) localStorage.setItem(SITZUNG_KEY, JSON.stringify(s));
    else localStorage.removeItem(SITZUNG_KEY);
  } catch {
    /* ignorieren */
  }
  window.dispatchEvent(new Event('mgi-sitzung'));
}

/** Ruft eine Aktion im Backend auf. */
export async function api<T = unknown>(aktion: string, daten: Record<string, unknown> = {}): Promise<T> {
  const token = ladeSitzung()?.token;
  if (istDemo) return demoAufruf<T>(aktion, daten, token);

  let res: Response;
  try {
    res = await fetch(config.apiUrl, {
      method: 'POST',
      // text/plain verhindert den CORS-Preflight, den Apps Script nicht beantwortet
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ aktion, token, daten }),
    });
  } catch {
    throw new ApiFehler('Keine Verbindung – bist du online?', 0);
  }
  let json: { ok: boolean; daten?: T; fehler?: string; status?: number };
  try {
    json = await res.json();
  } catch {
    throw new ApiFehler('Unerwartete Antwort vom Server', res.status);
  }
  if (!json.ok) {
    if (json.status === 401 && token) speichereSitzung(null);
    throw new ApiFehler(json.fehler || 'Fehler', json.status);
  }
  return json.daten as T;
}

/** Einfacher Speicher für „letzter bekannter Wert“ (Offline-Anzeige) */
export function merke<T>(key: string, wert: T) {
  try {
    localStorage.setItem('mgi.cache.' + key, JSON.stringify(wert));
  } catch {
    /* ignorieren */
  }
}
export function erinnere<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem('mgi.cache.' + key) || 'null');
  } catch {
    return null;
  }
}
