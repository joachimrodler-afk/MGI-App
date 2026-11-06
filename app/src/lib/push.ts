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

export async function pushEinschalten(einstellungen: PushEinstellungen): Promise<void> {
  const erlaubnis = await Notification.requestPermission();
  if (erlaubnis !== 'granted') throw new Error('Benachrichtigungen wurden nicht erlaubt. Das kannst du in den Browser-Einstellungen ändern.');
  const { initializeApp } = await import('firebase/app');
  const { getMessaging, getToken } = await import('firebase/messaging');
  const app = initializeApp(config.firebase);
  const reg = await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: config.firebase.vapidKey, serviceWorkerRegistration: reg });
  await api('push_abo', { fcmToken: token, einstellungen });
  localStorage.setItem(KEY, JSON.stringify({ token, einstellungen }));
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
