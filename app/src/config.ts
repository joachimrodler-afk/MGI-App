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
  arbeitsdienstUrl: 'https://docs.google.com/spreadsheets/d/1-4fZkz3a4TTHiGIb_dJHv5kdszw7dVQG6lIEEgkXuNw/edit',

  platz: {
    /**
     * TODO: Genaue GPS-Koordinaten des Modellflugplatzes eintragen.
     * Vorläufig: Ortsmitte Ismaning (nur für die Wettervorhersage brauchbar).
     */
    lat: 48.2262,
    lon: 11.6744,
    koordinatenGeprueft: false,
    /** TODO: Zufahrt so beschreiben, dass man sie am Telefon dem Rettungsdienst vorlesen kann */
    zufahrt: 'TODO: Zufahrtsbeschreibung zum Modellflugplatz eintragen.',
    adresse: 'TODO: Adresse/nächste Straße eintragen',
  },

  /**
   * Firebase Cloud Messaging für Push-Nachrichten (optional).
   * Leer lassen = Push ist in der App als „noch nicht eingerichtet“ markiert.
   * Diese Werte sind öffentlich und dürfen im Frontend stehen.
   */
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    messagingSenderId: '',
    appId: '',
    vapidKey: '',
  },

  impressumUrl: 'TODO',
  datenschutzUrl: 'TODO',
} as const;

export const istDemo = !config.apiUrl;
export const pushKonfiguriert = !!(config.firebase.apiKey && config.firebase.vapidKey);
export function istGesetzt(v: string) {
  return !!v && !v.startsWith('TODO');
}
