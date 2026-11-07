/**
 * Push-Nachrichten über Firebase Cloud Messaging.
 * Das Firebase-SDK wird erst geladen, wenn ein Mitglied Push einschaltet.
 * Auf dem iPhone funktioniert Push nur, wenn die App auf dem Home-Bildschirm installiert ist (ab iOS 16.4).
 */
import { config, pushKonfiguriert } from '../config';
import { api } from './api';
import type { PushEinstellungen } from './model';

const KEY = 'mgi.push';

export const STANDARD_PUSH: PushEinstellungen = { anfragen: true, termine: true, mitteilungen: true, ergebnisse: true, brett: false, nachweise: true, arbeitsdienst: true };

export function pushStatus(): { token?: string; einstellungen: PushEinstellungen } {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null') ?? { einstellungen: STANDARD_PUSH };
  } catch {
    return { einstellungen: STANDARD_PUSH };
  }
}

export function pushMoeglich(): { ok: boolean; grund?: string } {
  if (!pushKonfiguriert) return { ok: false, grund: 'Push-Nachrichten sind vom Verein noch nicht eingerichtet.' };
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const installiert = window.matchMedia('(display-mode: standalone)').matches;
    if (ios && !installiert)
      return { ok: false, grund: 'Auf dem iPhone zuerst die App installieren: Teilen-Symbol → „Zum Home-Bildschirm“, dann die App von dort öffnen.' };
    return { ok: false, grund: 'Dieser Browser unterstützt keine Push-Nachrichten.' };
  }
  return { ok: true };
}

const istIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** Erlaubnis für Mitteilungen auf diesem Gerät: 'granted' | 'denied' | 'default' | 'fehlt' */
export function pushErlaubnis(): NotificationPermission | 'fehlt' {
  return 'Notification' in window ? Notification.permission : 'fehlt';
}

/** Hinweis, wie man abgelehnte Mitteilungen wieder erlaubt */
export function erlaubnisHilfe(): string {
  return istIos()
    ? 'Mitteilungen sind für die MGI-App abgelehnt. Auf dem iPhone: Einstellungen → Mitteilungen → MGI → „Mitteilungen erlauben“ einschalten. Danach die App schließen, neu öffnen und Push einschalten.'
    : 'Mitteilungen sind für die App blockiert. In den Browser- bzw. App-Einstellungen für diese Seite „Benachrichtigungen“ erlauben, dann Push einschalten.';
}

async function holeToken(): Promise<string> {
  const { initializeApp, getApps } = await import('firebase/app');
  const { getMessaging, getToken } = await import('firebase/messaging');
  const app = getApps()[0] ?? initializeApp(config.firebase);
  const reg = await navigator.serviceWorker.ready;
  return getToken(getMessaging(app), { vapidKey: config.firebase.vapidKey, serviceWorkerRegistration: reg });
}

export async function pushEinschalten(einstellungen: PushEinstellungen): Promise<void> {
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== 'granted') throw new Error(erlaubnis === 'denied' ? erlaubnisHilfe() : 'Mitteilungen wurden nicht erlaubt.');
  const token = await holeToken();
  await api('push_abo', { fcmToken: token, einstellungen });
  localStorage.setItem(KEY, JSON.stringify({ token, einstellungen }));
}

/**
 * Beim App-Start: Push-Abo prüfen. Das iPhone vergibt nach Updates oder Neuinstallation manchmal ein neues Token –
 * dann wird das neue Token im Backend gespeichert. Ist die Erlaubnis weg, gilt Push auf diesem Gerät als aus.
 */
export async function pushAuffrischen(): Promise<void> {
  const s = pushStatus();
  if (!s.token || !pushMoeglich().ok) return;
  if (pushErlaubnis() !== 'granted') {
    localStorage.setItem(KEY, JSON.stringify({ einstellungen: s.einstellungen }));
    return;
  }
  const token = await holeToken();
  if (token && token !== s.token) {
    await api('push_abo', { fcmToken: token, einstellungen: s.einstellungen });
    await api('push_abo_loeschen', { fcmToken: s.token }).catch(() => undefined);
    localStorage.setItem(KEY, JSON.stringify({ token, einstellungen: s.einstellungen }));
  }
}

/** Test-Nachricht an alle eigenen Geräte */
export async function pushTesten(): Promise<number> {
  const r = await api<{ gesendet: number }>('push_test');
  return r.gesendet;
}

export async function pushEinstellungenSpeichern(einstellungen: PushEinstellungen) {
  const s = pushStatus();
  if (s.token) await api('push_abo', { fcmToken: s.token, einstellungen });
  localStorage.setItem(KEY, JSON.stringify({ ...s, einstellungen }));
}

export async function pushAusschalten() {
  const s = pushStatus();
  if (s.token) await api('push_abo_loeschen', { fcmToken: s.token }).catch(() => undefined);
  localStorage.setItem(KEY, JSON.stringify({ einstellungen: s.einstellungen }));
}
