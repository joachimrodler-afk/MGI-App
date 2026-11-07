/**
 * ZENTRALE KONFIGURATION DER MGI-APP
 * ==================================
 * Alle Links, IDs und Texte, die sich ändern können, stehen hier.
 * Geheime Werte (PINs, Kalender-Export-Link, Passwörter, Service-Account)
 * gehören NICHT hierher, sondern in die Script Properties des Apps Script.
 *
 * Werte, die mit "TODO" beginnen, müssen noch eingetragen werden.
 */

export const config = {
  /** Vereinsname für Titel und Druckansichten */
  vereinsname: 'Modellbau-Gemeinschaft Ismaning e.V.',
  kurzname: 'MGI',

  /**
   * Adresse der Apps-Script-Web-App (endet auf /exec).
   * Leer lassen = Demo-Modus mit Beispieldaten (nur auf diesem Gerät gespeichert).
   */
  // Für lokale Tests mit Beispieldaten: VITE_DEMO=1 npm run dev
  apiUrl: import.meta.env.VITE_DEMO ? '' : 'https://script.google.com/macros/s/AKfycbwYpvHj7fK74ioY2YbiPidO2uFnxhsYZVR5ks-9u9pVMIARDS_NMVcm-62gOzls-GdAMg/exec',

  /** Dürfen Kalender, Wetter, Webcam und Ergebnisse ohne Anmeldung angezeigt werden? */
  oeffentlichLesbar: true,

  kalender: {
    /** Öffentliche Kalenderseite (für den Button „Vollständiger Kalender“) */
    webUrl: 'https://kalender.digital/bb924ccd203a836b79ba',
    /** Wie viele kommende Termine in der Liste stehen */
    anzahlTermine: 10,
  },

  webcam: {
    seite: 'https://www.ipcamlive.com/65d35a6bb9cb9',
    alias: '65d35a6bb9cb9',
    /** Standbild – IPCamLive liefert das aktuelle Bild über diese Adresse */
    snapshotUrl: 'https://www.ipcamlive.com/player/snapshot.php?alias=65d35a6bb9cb9',
    // Hinweis: Der Live-Player lässt sich im kostenlosen IPCamLive-Paket nicht einbetten,
    // daher öffnet die App für den Live-Stream die IPCamLive-Seite (seite).
    aktualisierenSek: 60,
  },

  bluetti: {
    /** Original-Webseite des ESP32 (http – wird nur als Link geöffnet) */
    webUrl: 'http://mgi-ism.ddns.net:8080/',
  },

  wetter: {
    /** Vereins-Wetterstation bei Wettermonster (Link) */
    stationUrl: 'https://wettermonster.de/wetterdetails?id=1356546',
  },

  /** Arbeitsdienst-Liste (Google-Tabelle im Vereins-Drive) – Mitglieder tragen sich dort ein */
  arbeitsdienstUrl: 'https://docs.google.com/spreadsheets/d/1JmdUEeU4ioUFeHaxiUrYIoH8fhXx-LL8zA88nC-rPaA/edit',

  platz: {
    /** GPS-Koordinaten des Modellflugplatzes (aus dem Google-Maps-Eintrag „MGI Modellflugplatz“) */
    lat: 48.2552913,
    lon: 11.7225233,
    koordinatenGeprueft: true,
    /** Google-Maps-Eintrag des Platzes */
    mapsUrl: 'https://maps.app.goo.gl/B5yAokCeZMDLbDLC6',
    /** Zufahrt zum Vorlesen am Telefon – leer = nicht anzeigen */
    zufahrt: '',
    adresse: 'MGI Modellflugplatz, 85737 Ismaning',
  },

  /**
   * Firebase Cloud Messaging für Push-Nachrichten (optional).
   * Leer lassen = Push ist in der App als „noch nicht eingerichtet“ markiert.
   * Diese Werte sind öffentlich und dürfen im Frontend stehen.
   */
  firebase: {
    apiKey: 'AIzaSyAemTfRQegqwtVCrRS7dMDI6fSKWKP12R4',
    authDomain: 'mgi-app-7eabc.firebaseapp.com',
    projectId: 'mgi-app-7eabc',
    messagingSenderId: '441937746135',
    appId: '1:441937746135:web:76cb64d91b54a4bc807892',
    vapidKey: 'BIEfsHrCa_P5WuQuMj2779X_AUKG38ZLRtpJglfqiSIQbQnWzdfpAGBw8RwrUETKXDfs3WyKH6STPkyc_8LdQnY',
  },

  impressumUrl: 'TODO',
  datenschutzUrl: 'TODO',
} as const;

export const istDemo = !config.apiUrl;
export const pushKonfiguriert = !!(config.firebase.apiKey && config.firebase.vapidKey);
export function istGesetzt(v: string) {
  return !!v && !v.startsWith('TODO');
}
