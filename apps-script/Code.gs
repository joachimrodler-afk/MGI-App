/**
 * MGI-Vereins-App – Backend (Google Apps Script)
 * =============================================
 * Dieses Script läuft als Web-App im Google-Konto des Vereins und übernimmt:
 *   - Anmeldung mit persönlichen PINs (nur als Hash gespeichert)
 *   - Mitgliederverwaltung
 *   - Kalender (ICS-Feed von kalender.digital -> JSON)
 *   - Bluetti-Status (ESP32 /api/status) und Verlauf (ThingSpeak)
 *   - Foto-Upload in den Google-Drive-Ordner der Homepage-Galerie
 *   - Wettbewerbe, Wertungsarten (Formeln), Wertungen
 *   - Wer ist am Platz?, Schwarzes Brett, Nachweis-Erinnerungen
 *   - Push-Nachrichten über Firebase Cloud Messaging
 *
 * Einrichtung: siehe README.md im Repository (Abschnitt „Backend einrichten“).
 * Alle Geheimnisse stehen in den Script Properties (Projekteinstellungen),
 * NICHT in diesem Code.
 *
 * Script Properties:
 *   SHEET_ID              ID der Google-Tabelle (Datenbank)
 *   FOTO_ORDNER_ID        Drive-Ordner der Homepage-Galerie
 *   BRETT_ORDNER_ID       Drive-Ordner für Fotos vom Schwarzen Brett (NICHT der Galerieordner)
 *   KALENDER_ICS_URL      privater ICS-Link von kalender.digital
 *   BLUETTI_URL           z. B. http://mgi-ism.ddns.net:8080
 *   WETTERSTATION_URL     eigene Wetterstation (ESP32), Standard http://mgi-ism.ddns.net:81/
 *   BLUETTI_USER/_PASS    nur falls ENABLE_AUTH in der ESP32-Firmware aktiv ist
 *   THINGSPEAK_KANAL      Kanal-ID (optional, für das Verlaufsdiagramm)
 *   THINGSPEAK_READ_KEY   Read-API-Key (nur bei privatem Kanal)
 *   OEFFENTLICH           "true" = Kalender/Wetter/Webcam/Ergebnisse ohne Anmeldung
 *   ERSTER_ADMIN          "Vorname;Nachname;PIN" – wird bei setup() angelegt, danach löschen!
 *   FCM_SERVICE_ACCOUNT   JSON des Firebase-Service-Accounts (optional, für Push)
 *   APP_URL               Adresse der App (für Links in Push-Nachrichten)
 *   ARBEITSLISTE_ID       Google-Tabelle der Arbeitsdienst-Liste (optional, Standard siehe unten)
 *   TECHNIK_ORDNER_ID     Drive-Ordner für Fotos im Bereich Technik (wird sonst automatisch angelegt)
 *   RABENSCHRECK_URL      Fernsteuerung der Wetterstation, Standard http://mgi-ism.ddns.net/
 *   RABENSCHRECK_USER/_PASS  Web-Login der Fernsteuerung (Passwort nur hier, nie im Code!)
 */

var TZ = 'Europe/Berlin';
// Anmeldungen laufen nicht ab: einmal anmelden, dauerhaft angemeldet.
// Beendet wird eine Anmeldung nur durch Abmelden, neuen PIN oder Deaktivieren.
var SITZUNG_UNBEGRENZT = 0;
var MAX_FEHLVERSUCHE = 5;
var SPERRE_MIN = 10;
var HASH_RUNDEN = 300;
// Arbeitsdienst-Liste (Google-Tabelle im Vereins-Drive). Keine geheime Angabe;
// für ein neues Jahr einfach ARBEITSLISTE_ID in den Script Properties setzen.
var ARBEITSLISTE_STANDARD_ID = '1JmdUEeU4ioUFeHaxiUrYIoH8fhXx-LL8zA88nC-rPaA';

var BLAETTER = {
  Mitglieder: ['id', 'vorname', 'nachname', 'rolle', 'sparte', 'salt', 'hash', 'aktiv', 'erstellt'],
  Sitzungen: ['token', 'mitgliedId', 'ablauf'],
  Einstellungen: ['schluessel', 'wert'],
  Wertungsarten: ['id', 'json'],
  Wettbewerbe: ['id', 'json'],
  Wertungen: ['id', 'wettbewerbId', 'json'],
  Anfragen: ['id', 'vorname', 'nachname', 'nachricht', 'erstellt', 'status', 'bearbeitet'],
  Flugbuch: ['id', 'datum', 'name', 'vorname', 'verein_gast', 'kanal', 'schulungsnachweis', 'segler', 'elektro', 'kolben', 'turbine',
    'max_masse', 'beginn', 'ende', 'regeln_bestaetigt', 'eingetragen_von', 'mitgliedId', 'beginn_ts', 'ende_ts', 'auto_beendet', 'vorkommnisse'],
  Flugleiter: ['id', 'datum', 'name', 'vorname', 'fangnetz', 'rasen_gemaeht', 'wetter', 'windrichtung', 'windstaerke',
    'beginn', 'ende', 'mitgliedId', 'beginn_ts', 'ende_ts', 'auto_beendet'],
  Brett: ['id', 'ablauf', 'json'],
  Technik: ['id', 'reihenfolge', 'json'],
  Nachweise: ['mitgliedId', 'name', 'kenntnisnachweis', 'eid', 'versicherung', 'gemeldet'],
  PushAbos: ['fcmToken', 'mitgliedId', 'einstellungen', 'erstellt'],
};

// =====================================================================
// Einstiegspunkte
// =====================================================================

function doGet() {
  return json_({ ok: true, daten: 'MGI-API läuft' });
}

/**
 * Alle Anfragen kommen als POST mit Content-Type text/plain
 * (vermeidet den CORS-Preflight, den Apps Script nicht beantworten kann).
 * Body: { aktion: "...", token: "...", daten: {...} }
 */
function doPost(e) {
  var anfrage;
  try {
    anfrage = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, fehler: 'Ungültige Anfrage' });
  }
  try {
    var aktion = AKTIONEN[anfrage.aktion];
    if (!aktion) throw fehler_('Unbekannte Aktion: ' + anfrage.aktion);
    var sitzung = anfrage.token ? sitzungPruefen_(anfrage.token) : null;
    if (aktion.recht === 'admin' && (!sitzung || sitzung.rolle !== 'admin')) throw fehler_('Nur für Admins', 403);
    if (aktion.recht === 'mitglied' && !sitzung) throw fehler_('Bitte anmelden', 401);
    if (aktion.recht === 'lesen' && !sitzung && !oeffentlich_()) throw fehler_('Bitte anmelden', 401);
    var daten = aktion.fn(anfrage.daten || {}, sitzung);
    return json_({ ok: true, daten: daten });
  } catch (err) {
    if (!err.status) console.error(err && err.stack ? err.stack : err);
    return json_({ ok: false, fehler: err.status ? err.message : 'Interner Fehler: ' + err.message, status: err.status || 500 });
  }
}

var AKTIONEN = {
  // Anmeldung
  login: { recht: 'offen', fn: login_ },
  logout: { recht: 'mitglied', fn: logout_ },
  ich: { recht: 'mitglied', fn: function (d, s) { return s; } },
  pin_aendern: { recht: 'mitglied', fn: pinAendern_ },
  // Mitglieder
  mitglieder_liste: { recht: 'admin', fn: mitgliederListe_ },
  mitglied_anlegen: { recht: 'admin', fn: mitgliedAnlegen_ },
  mitglied_aendern: { recht: 'admin', fn: mitgliedAendern_ },
  mitglied_loeschen: { recht: 'admin', fn: mitgliedLoeschen_ },
  pin_zuruecksetzen: { recht: 'admin', fn: pinZuruecksetzen_ },
  // Infos
  start: { recht: 'offen', fn: start_ },
  termine: { recht: 'lesen', fn: function () { return termine_(); } },
  bluetti: { recht: 'lesen', fn: function () { return bluetti_(); } },
  bluetti_verlauf: { recht: 'lesen', fn: bluettiVerlauf_ },
  wetterstation: { recht: 'lesen', fn: function () { return wetterstation_(); } },
  einstellungen: { recht: 'offen', fn: einstellungenLesen_ },
  einstellungen_speichern: { recht: 'admin', fn: einstellungenSpeichern_ },
  // Fotos
  foto_hochladen: { recht: 'mitglied', fn: fotoHochladen_ },
  galerie: { recht: 'offen', fn: function (d) { return galerie_(d); } },
  // Am Platz
  anwesende: { recht: 'offen', fn: anwesende_ },
  // Arbeitsdienst
  arbeitsdienst_meine: { recht: 'mitglied', fn: arbeitsdienstMeine_ },
  arbeitsdienst_liste: { recht: 'mitglied', fn: function (d, s) { return arbeitsdienstListe_(d, s); } },
  arbeitsdienst_eintragen: { recht: 'mitglied', fn: arbeitsdienstEintragen_ },
  arbeitsdienst_austragen: { recht: 'admin', fn: arbeitsdienstAustragen_ },
  // Zugangsanfrage
  zugang_anfragen: { recht: 'offen', fn: zugangAnfragen_ },
  anfragen_liste: { recht: 'admin', fn: anfragenListe_ },
  anfrage_freigeben: { recht: 'admin', fn: anfrageFreigeben_ },
  anfrage_ablehnen: { recht: 'admin', fn: anfrageAblehnen_ },
  // Flugbuch
  flugbuch_status: { recht: 'mitglied', fn: flugbuchStatus_ },
  flugbuch_anmelden: { recht: 'mitglied', fn: flugbuchAnmelden_ },
  flugbuch_abmelden: { recht: 'mitglied', fn: flugbuchAbmelden_ },
  flugbuch_kommentar: { recht: 'mitglied', fn: flugbuchKommentar_ },
  flugleiter_anmelden: { recht: 'mitglied', fn: flugleiterAnmelden_ },
  flugleiter_abmelden: { recht: 'mitglied', fn: flugleiterAbmelden_ },
  flugbuch_liste: { recht: 'admin', fn: flugbuchListe_ },
  // Schwarzes Brett
  brett_liste: { recht: 'mitglied', fn: brettListe_ },
  brett_speichern: { recht: 'mitglied', fn: brettSpeichern_ },
  brett_loeschen: { recht: 'mitglied', fn: brettLoeschen_ },
  // Technik
  technik_liste: { recht: 'lesen', fn: technikListe_ },
  technik_speichern: { recht: 'admin', fn: technikSpeichern_ },
  technik_loeschen: { recht: 'admin', fn: technikLoeschen_ },
  technik_sortieren: { recht: 'admin', fn: technikSortieren_ },
  rabenschreck_status: { recht: 'admin', fn: function () { return rabenschreck_(''); } },
  rabenschreck_schalten: { recht: 'admin', fn: function (d) { return rabenschreck_(d.an === true ? 'led1on' : d.an === false ? 'led1off' : ''); } },
  // Nachweise
  nachweise: { recht: 'mitglied', fn: nachweiseLesen_ },
  nachweise_speichern: { recht: 'mitglied', fn: nachweiseSpeichern_ },
  // Push
  push_abo: { recht: 'mitglied', fn: pushAbo_ },
  push_abo_loeschen: { recht: 'offen', fn: pushAboLoeschen_ },
  mitteilung_senden: { recht: 'admin', fn: mitteilungSenden_ },
  // Wettbewerbe
  wertungsarten: { recht: 'lesen', fn: wertungsartenListe_ },
  wertungsart_speichern: { recht: 'admin', fn: wertungsartSpeichern_ },
  wertungsart_loeschen: { recht: 'admin', fn: wertungsartLoeschen_ },
  wettbewerbe: { recht: 'lesen', fn: wettbewerbeListe_ },
  wettbewerb: { recht: 'lesen', fn: wettbewerbLesen_ },
  wettbewerb_speichern: { recht: 'admin', fn: wettbewerbSpeichern_ },
  wettbewerb_loeschen: { recht: 'admin', fn: wettbewerbLoeschen_ },
  wertung_speichern: { recht: 'admin', fn: wertungSpeichern_ },
  wertung_loeschen: { recht: 'admin', fn: wertungLoeschen_ },
};

// =====================================================================
// Einrichtung & Zeitsteuerung
// =====================================================================

/** Einmalig im Editor ausführen: legt Tabellenblätter, ersten Admin und Trigger an. */
function setup() {
  var ss = SpreadsheetApp.openById(prop_('SHEET_ID', true));
  Object.keys(BLAETTER).forEach(function (name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(BLAETTER[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, BLAETTER[name].length).setFontWeight('bold');
    }
  });
  var erster = prop_('ERSTER_ADMIN');
  if (erster) {
    var t = erster.split(';');
    if (t.length !== 3 || !/^\d{4,8}$/.test(t[2])) throw new Error('ERSTER_ADMIN muss "Vorname;Nachname;PIN" sein (PIN 4–8 Ziffern)');
    var vorhanden = zeilen_('Mitglieder').some(function (m) { return m.rolle === 'admin'; });
    if (!vorhanden) {
      mitgliedSchreiben_(t[0].trim(), t[1].trim(), 'admin', '', t[2]);
      console.log('Erster Admin angelegt. Bitte ERSTER_ADMIN jetzt aus den Script Properties löschen!');
    }
  }
  ScriptApp.getProjectTriggers().forEach(function (tr) { ScriptApp.deleteTrigger(tr); });
  ScriptApp.newTrigger('taeglich').timeBased().atHour(7).everyDays(1).inTimezone(TZ).create();
  ScriptApp.newTrigger('stuendlich').timeBased().everyHours(1).create();
  console.log('Setup fertig.');
}

/** Täglich 7 Uhr: Termin- und Nachweis-Erinnerungen, Aufräumen */
function taeglich() {
  try { terminErinnerungen_(); } catch (e) { console.error(e); }
  try { nachweisErinnerungen_(); } catch (e) { console.error(e); }
  try { arbeitsdienstErinnerungen_(); } catch (e) { console.error(e); }
  aufraeumen_();
}

/** Stündlich: neue Termine melden, abgelaufene Check-ins entfernen */
function stuendlich() {
  try { neueTermineMelden_(); } catch (e) { console.error(e); }
  try { flugbuchAutoBeenden_(); } catch (e) { console.error(e); }
}

function aufraeumen_() {
  var jetzt = Date.now();
  // Sitzungen laufen nicht ab (siehe SITZUNG_UNBEGRENZT); nur verwaiste Sitzungen entfernen
  var ids = {};
  zeilen_('Mitglieder').forEach(function (m) { if (String(m.aktiv) === 'true') ids[m.id] = true; });
  loescheZeilen_('Sitzungen', function (r) { return !ids[r.mitgliedId]; });
  loescheZeilen_('Brett', function (r) { return r.ablauf && new Date(r.ablauf).getTime() < jetzt; });
}

// =====================================================================
// Anmeldung & Sitzungen
// =====================================================================

function login_(d) {
  var name = String(d.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
  var pin = String(d.pin || '').trim();
  if (!name || !pin) throw fehler_('Name und PIN eingeben', 400);
  var mitglieder = zeilen_('Mitglieder').filter(function (m) { return String(m.aktiv) === 'true'; });
  var treffer = mitglieder.filter(function (m) {
    var voll = (m.vorname + ' ' + m.nachname).toLowerCase();
    return voll === name || (m.nachname + ' ' + m.vorname).toLowerCase() === name;
  });
  if (!treffer.length) {
    // Nur Nachname, falls eindeutig
    treffer = mitglieder.filter(function (m) { return String(m.nachname).toLowerCase() === name; });
    if (treffer.length > 1) throw fehler_('Name nicht eindeutig – bitte Vor- und Nachname eingeben', 400);
  }
  globaleBremse_();
  if (!treffer.length) {
    throw fehler_('Name oder PIN falsch', 401);
  }
  var m = treffer[0];
  var cache = CacheService.getScriptCache();
  var key = 'fehl_' + m.id;
  var fehl = Number(cache.get(key) || 0);
  if (fehl >= MAX_FEHLVERSUCHE) throw fehler_('Zu viele Fehlversuche – bitte in ' + SPERRE_MIN + ' Minuten erneut versuchen', 429);
  if (pinHash_(pin, m.salt) !== m.hash) {
    cache.put(key, String(fehl + 1), SPERRE_MIN * 60);
    throw fehler_('Name oder PIN falsch', 401);
  }
  cache.remove(key);
  var token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g, '');
  var ablauf = SITZUNG_UNBEGRENZT;
  zeileAnhaengen_('Sitzungen', [token, m.id, ablauf]);
  return sitzungObjekt_(token, m, ablauf);
}

/** Bremst massenhaftes Durchprobieren über alle Namen hinweg (max. 60 Logins/10 Min.). */
function globaleBremse_() {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('logins') || 0);
  if (n > 60) throw fehler_('Zu viele Anmeldeversuche – bitte später erneut versuchen', 429);
  cache.put('logins', String(n + 1), 600);
}

function sitzungObjekt_(token, m, ablauf) {
  return { token: token, mitgliedId: m.id, name: m.vorname + ' ' + m.nachname, rolle: m.rolle, ablauf: Number(ablauf) };
}

function sitzungPruefen_(token) {
  var cache = CacheService.getScriptCache();
  var c = cache.get('s_' + token);
  if (c) return JSON.parse(c);
  var s = zeilen_('Sitzungen').filter(function (r) { return r.token === token; })[0];
  if (!s) throw fehler_('Abgemeldet – bitte neu anmelden', 401);
  var m = mitgliedNachId_(s.mitgliedId);
  if (!m || String(m.aktiv) !== 'true') throw fehler_('Zugang deaktiviert', 401);
  var obj = sitzungObjekt_(token, m, s.ablauf);
  cache.put('s_' + token, JSON.stringify(obj), 600);
  return obj;
}

function sitzungenEntfernen_(mitgliedId) {
  var cache = CacheService.getScriptCache();
  loescheZeilen_('Sitzungen', function (r) {
    if (r.mitgliedId === mitgliedId) { cache.remove('s_' + r.token); return true; }
    return false;
  });
}

function logout_(d, s) {
  CacheService.getScriptCache().remove('s_' + s.token);
  loescheZeilen_('Sitzungen', function (r) { return r.token === s.token; });
  return true;
}

function pinHash_(pin, salt) {
  var h = salt + ':' + pin;
  for (var i = 0; i < HASH_RUNDEN; i++) {
    h = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + ':' + salt, Utilities.Charset.UTF_8));
  }
  return h;
}

function neuerPin_() {
  var pin = '';
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Date.now());
  for (var i = 0; i < 6; i++) pin += String(((bytes[i] % 256) + 256) % 10);
  if (/^(\d)\1+$/.test(pin) || pin === '123456') return neuerPin_();
  return pin;
}

function pinAendern_(d, s) {
  var m = mitgliedNachId_(s.mitgliedId);
  if (pinHash_(String(d.alt || ''), m.salt) !== m.hash) throw fehler_('Bisheriger PIN ist falsch', 400);
  var neu = String(d.neu || '');
  if (!/^\d{6,8}$/.test(neu)) throw fehler_('Der neue PIN muss 6–8 Ziffern haben', 400);
  setzePin_(m.id, neu);
  return true;
}

// =====================================================================
// Mitglieder
// =====================================================================

function mitgliedNachId_(id) {
  return zeilen_('Mitglieder').filter(function (m) { return m.id === id; })[0];
}

function mitgliedOeffentlich_(m) {
  return { id: m.id, vorname: m.vorname, nachname: m.nachname, rolle: m.rolle, sparte: m.sparte || '', aktiv: String(m.aktiv) === 'true' };
}

function mitgliederListe_() {
  return zeilen_('Mitglieder').map(mitgliedOeffentlich_).sort(function (a, b) {
    return (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de');
  });
}

function mitgliedSchreiben_(vorname, nachname, rolle, sparte, pin) {
  var salt = Utilities.getUuid();
  var id = 'm' + Utilities.getUuid().slice(0, 8);
  zeileAnhaengen_('Mitglieder', [id, vorname, nachname, rolle, sparte, salt, pinHash_(pin, salt), 'true', new Date().toISOString()]);
  return id;
}

function mitgliedAnlegen_(d) {
  var vorname = String(d.vorname || '').trim();
  var nachname = String(d.nachname || '').trim();
  if (!vorname || !nachname) throw fehler_('Vor- und Nachname angeben', 400);
  var doppelt = zeilen_('Mitglieder').some(function (m) {
    return (m.vorname + ' ' + m.nachname).toLowerCase() === (vorname + ' ' + nachname).toLowerCase();
  });
  if (doppelt) throw fehler_('Ein Mitglied mit diesem Namen gibt es schon', 400);
  var pin = neuerPin_();
  var id = mitSperre_(function () {
    return mitgliedSchreiben_(vorname, nachname, d.rolle === 'admin' ? 'admin' : 'mitglied', d.sparte || '', pin);
  });
  return { id: id, pin: pin };
}

function mitgliedAendern_(d, s) {
  if (d.id === s.mitgliedId && (d.rolle === 'mitglied' || d.aktiv === false)) {
    throw fehler_('Du kannst dir nicht selbst die Admin-Rechte entziehen oder dich deaktivieren', 400);
  }
  mitSperre_(function () {
    aktualisiereZeile_('Mitglieder', 'id', d.id, function (r) {
      if (d.rolle) r.rolle = d.rolle === 'admin' ? 'admin' : 'mitglied';
      if (d.sparte !== undefined) r.sparte = d.sparte;
      if (d.aktiv !== undefined) r.aktiv = d.aktiv ? 'true' : 'false';
      if (d.vorname) r.vorname = d.vorname;
      if (d.nachname) r.nachname = d.nachname;
      return r;
    });
  });
  if (d.aktiv === false || d.rolle) sitzungenEntfernen_(d.id);
  return true;
}

/**
 * Mitglied endgültig löschen (nur wenn vorher deaktiviert, nie sich selbst).
 * Entfernt Mitgliedszeile, Anmeldungen, Push-Abos und Nachweise.
 * Flugbuch, Flugleiter, Arbeitsliste und Wertungen behalten den Namen als Text.
 */
function mitgliedLoeschen_(d, s) {
  if (d.id === s.mitgliedId) throw fehler_('Du kannst dich nicht selbst löschen', 400);
  var m = mitgliedNachId_(d.id);
  if (!m) throw fehler_('Mitglied nicht gefunden', 404);
  if (String(m.aktiv) === 'true') throw fehler_('Bitte das Mitglied zuerst deaktivieren', 400);
  mitSperre_(function () {
    loescheZeilen_('Mitglieder', function (r) { return r.id === d.id; });
    loescheZeilen_('Sitzungen', function (r) { return r.mitgliedId === d.id; });
    loescheZeilen_('PushAbos', function (r) { return r.mitgliedId === d.id; });
    loescheZeilen_('Nachweise', function (r) { return r.mitgliedId === d.id; });
  });
  return true;
}

function setzePin_(id, pin) {
  mitSperre_(function () {
    aktualisiereZeile_('Mitglieder', 'id', id, function (r) {
      r.salt = Utilities.getUuid();
      r.hash = pinHash_(pin, r.salt);
      return r;
    });
  });
}

function pinZuruecksetzen_(d) {
  var pin = neuerPin_();
  setzePin_(d.id, pin);
  sitzungenEntfernen_(d.id);
  return { pin: pin };
}

// =====================================================================
// Startseite: alles Wichtige in einer Anfrage
// =====================================================================

function start_(d, s) {
  var darf = !!s || oeffentlich_();
  var erg = { oeffentlich: oeffentlich_(), anwesend: anwesende_(d, s) };
  if (darf) {
    try { erg.termine = termine_().slice(0, 3); } catch (e) { erg.termine = []; }
    try { erg.bluetti = bluetti_(); } catch (e) { erg.bluetti = { erreichbar: false }; }
    try { erg.wetterstation = wetterstation_(); } catch (e) { erg.wetterstation = { erreichbar: false }; }
  }
  if (s) { try { erg.arbeitsdienst = arbeitsdienstMeine_(d, s); } catch (e) { console.error(e); } }
  return erg;
}

// =====================================================================
// Kalender (ICS)
// =====================================================================

function termine_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('termine');
  if (c) return JSON.parse(c);
  var url = prop_('KALENDER_ICS_URL', true);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw fehler_('Kalender nicht erreichbar (' + res.getResponseCode() + ')', 502);
  var heute = Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd'T'00:00:00");
  var liste = icsParsen(res.getContentText(), heute, 400).filter(function (t) { return t.ende >= heute; });
  var kurz = liste.slice(0, 60);
  try { cache.put('termine', JSON.stringify(kurz), 900); } catch (e) { /* zu groß */ }
  return kurz;
}

/**
 * ICS-Text -> Liste von Terminen (sortiert).
 * Zeiten werden als lokale Zeit Europe/Berlin ohne Zeitzone geliefert ("2026-11-20T19:00:00").
 * Wiederkehrende Termine (RRULE) werden bis `tage` Tage nach `ab` aufgelöst.
 */
function icsParsen(text, ab, tage) {
  var zeilen = text.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '').split(/\r?\n/);
  var events = [];
  var ev = null;
  zeilen.forEach(function (z) {
    if (z === 'BEGIN:VEVENT') { ev = { exdates: [] }; return; }
    if (z === 'END:VEVENT') { if (ev) events.push(ev); ev = null; return; }
    if (!ev) return;
    var i = z.indexOf(':');
    if (i < 0) return;
    var kopf = z.slice(0, i);
    var wert = z.slice(i + 1);
    var teile = kopf.split(';');
    var name = teile[0].toUpperCase();
    var params = {};
    teile.slice(1).forEach(function (p) { var kv = p.split('='); params[kv[0].toUpperCase()] = kv[1]; });
    if (name === 'SUMMARY') ev.titel = icsText_(wert);
    else if (name === 'LOCATION') ev.ort = icsText_(wert);
    else if (name === 'DESCRIPTION') ev.beschreibung = icsText_(wert);
    else if (name === 'UID') ev.uid = wert;
    else if (name === 'DTSTART') { ev.beginn = icsZeit_(wert, params); ev.ganztaegig = params.VALUE === 'DATE' || /^\d{8}$/.test(wert); }
    else if (name === 'DTEND') ev.ende = icsZeit_(wert, params);
    else if (name === 'RRULE') ev.rrule = wert;
    else if (name === 'EXDATE') wert.split(',').forEach(function (w) { ev.exdates.push(icsZeit_(w, params)); });
    else if (name === 'STATUS') ev.status = wert;
    else if (name === 'RECURRENCE-ID') ev.recurrenceId = icsZeit_(wert, params);
  });

  // Einzeln geänderte Wiederholungen (RECURRENCE-ID) ersetzen die berechnete Instanz
  var ersetzt = {};
  events.forEach(function (e) { if (e.recurrenceId && e.uid) ersetzt[e.uid + '|' + e.recurrenceId] = true; });

  var bis = lokalPlus_(ab, tage);
  var out = [];
  events.forEach(function (e) {
    if (!e.beginn || e.status === 'CANCELLED') return;
    if (!e.ende) e.ende = e.ganztaegig ? lokalPlus_(e.beginn, 1) : e.beginn;
    var dauer = lokalMs_(e.ende) - lokalMs_(e.beginn);
    var starts = e.rrule && !e.recurrenceId ? rruleExpand_(e.beginn, e.rrule, bis) : [e.beginn];
    starts.forEach(function (st) {
      if (e.exdates.indexOf(st) >= 0) return;
      if (e.rrule && !e.recurrenceId && ersetzt[e.uid + '|' + st]) return;
      out.push({
        uid: e.uid || '',
        titel: e.titel || '(ohne Titel)',
        beginn: st,
        ende: lokalVonMs_(lokalMs_(st) + dauer),
        ganztaegig: !!e.ganztaegig,
        ort: e.ort || '',
        beschreibung: e.beschreibung || '',
      });
    });
  });
  out.sort(function (a, b) { return a.beginn < b.beginn ? -1 : a.beginn > b.beginn ? 1 : 0; });
  return out;
}

function icsText_(s) {
  return s.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

/** ICS-Zeit -> lokale Zeit Europe/Berlin "yyyy-MM-ddTHH:mm:ss" */
function icsZeit_(w, params) {
  var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z?))?$/.exec(String(w).trim());
  if (!m) return '';
  if (!m[4]) return m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00';
  if (m[7] === 'Z') {
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]));
    return formatLokal_(d);
  }
  // TZID oder „floating“: Der Vereinskalender steht in Europe/Berlin, daher unverändert übernehmen
  return m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + m[6];
}

function formatLokal_(d) {
  if (typeof Utilities !== 'undefined' && Utilities.formatDate) return Utilities.formatDate(d, TZ, "yyyy-MM-dd'T'HH:mm:ss");
  // Fallback für Tests außerhalb von Apps Script
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    .format(d).replace(' ', 'T');
}

// Lokale Zeiten werden zum Rechnen als UTC behandelt (keine Sommerzeit-Sprünge)
function lokalMs_(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(s);
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}
function lokalVonMs_(ms) {
  return new Date(ms).toISOString().slice(0, 19);
}
function lokalPlus_(s, tage) {
  return lokalVonMs_(lokalMs_(s) + tage * 86400000);
}

var WOCHENTAGE = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

/** Wiederholungsregel auflösen: FREQ, INTERVAL, COUNT, UNTIL, BYDAY (WEEKLY/MONTHLY), BYMONTHDAY */
function rruleExpand_(beginn, rrule, bis) {
  var r = {};
  rrule.split(';').forEach(function (p) { var kv = p.split('='); r[kv[0].toUpperCase()] = kv[1]; });
  var freq = r.FREQ;
  var interval = Math.max(1, parseInt(r.INTERVAL || '1', 10));
  var count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  var until = r.UNTIL ? icsZeit_(r.UNTIL, {}) : null;
  if (until && until.length === 19 && /T00:00:00$/.test(until) && /^\d{8}$/.test(r.UNTIL)) until = until.slice(0, 11) + '23:59:59';
  var grenze = until && until < bis ? until : bis;
  var start = lokalMs_(beginn);
  var zeitTeil = beginn.slice(10);
  var out = [];
  var n = 0;
  var push = function (ms) {
    var s = lokalVonMs_(ms);
    if (s < beginn) return true;
    if (s > grenze || n >= count) return false;
    out.push(s); n++;
    return true;
  };
  var byday = r.BYDAY ? r.BYDAY.split(',') : null;
  var sicherheit = 0;

  if (freq === 'DAILY') {
    for (var ms = start; sicherheit++ < 5000; ms += interval * 86400000) if (!push(ms)) break;
  } else if (freq === 'WEEKLY') {
    var tage = byday ? byday.map(function (b) { return WOCHENTAGE[b.slice(-2)]; }) : [new Date(start).getUTCDay()];
    tage.sort();
    // Wochenanfang (Montag) der Startwoche
    var wd = (new Date(start).getUTCDay() + 6) % 7;
    var woche = start - wd * 86400000;
    var weiter = true;
    while (weiter && sicherheit++ < 2000) {
      for (var i = 0; i < tage.length; i++) {
        var off = (tage[i] + 6) % 7;
        if (!push(woche + off * 86400000)) { weiter = false; break; }
      }
      woche += interval * 7 * 86400000;
    }
    out.sort();
  } else if (freq === 'MONTHLY' || freq === 'YEARLY') {
    var d0 = new Date(start);
    var j = d0.getUTCFullYear(), mo = d0.getUTCMonth(), tag = d0.getUTCDate();
    var schritt = freq === 'MONTHLY' ? interval : 12 * interval;
    var weiter2 = true;
    while (weiter2 && sicherheit++ < 1000) {
      var kandidaten = [];
      if (freq === 'MONTHLY' && byday) {
        byday.forEach(function (b) {
          var mm = /^([+-]?\d)?(\w\w)$/.exec(b);
          var nr = mm[1] ? parseInt(mm[1], 10) : 0;
          var wt = WOCHENTAGE[mm[2]];
          var tageImMonat = new Date(Date.UTC(j, mo + 1, 0)).getUTCDate();
          var treffer = [];
          for (var t = 1; t <= tageImMonat; t++) if (new Date(Date.UTC(j, mo, t)).getUTCDay() === wt) treffer.push(t);
          var wahl = nr === 0 ? treffer : nr > 0 ? [treffer[nr - 1]] : [treffer[treffer.length + nr]];
          wahl.forEach(function (t) { if (t) kandidaten.push(t); });
        });
      } else {
        var mt = r.BYMONTHDAY ? parseInt(r.BYMONTHDAY, 10) : tag;
        if (new Date(Date.UTC(j, mo, mt)).getUTCMonth() === mo) kandidaten.push(mt);
      }
      kandidaten.sort(function (a, b) { return a - b; });
      for (var k = 0; k < kandidaten.length; k++) {
        var datum = lokalVonMs_(Date.UTC(j, mo, kandidaten[k])).slice(0, 10) + zeitTeil;
        if (!push(lokalMs_(datum))) { weiter2 = false; break; }
      }
      mo += schritt;
      j += Math.floor(mo / 12);
      mo = mo % 12;
    }
  } else {
    out.push(beginn);
  }
  return out;
}

function terminErinnerungen_() {
  var morgen = Utilities.formatDate(new Date(Date.now() + 86400000), TZ, 'yyyy-MM-dd');
  termine_().filter(function (t) { return t.beginn.slice(0, 10) === morgen; }).forEach(function (t) {
    var zeit = t.ganztaegig ? 'ganztägig' : t.beginn.slice(11, 16) + ' Uhr';
    pushSenden_('termine', 'Morgen: ' + t.titel, zeit + (t.ort ? ' · ' + t.ort : ''), '#/kalender');
  });
}

function neueTermineMelden_() {
  CacheService.getScriptCache().remove('termine');
  var liste = termine_();
  var props = PropertiesService.getScriptProperties();
  var bekannt = JSON.parse(props.getProperty('BEKANNTE_TERMINE') || 'null');
  var jetzt = liste.map(function (t) { return t.uid + '|' + t.beginn; });
  if (bekannt) {
    var neu = liste.filter(function (t) { return bekannt.indexOf(t.uid + '|' + t.beginn) < 0; });
    // nur einzelne Termine melden, nicht wenn sich der ganze Kalender geändert hat
    if (neu.length && neu.length <= 3) {
      neu.forEach(function (t) {
        var datum = t.beginn.slice(8, 10) + '.' + t.beginn.slice(5, 7) + '.';
        pushSenden_('termine', 'Neuer Termin: ' + t.titel, datum + (t.ganztaegig ? '' : ' ' + t.beginn.slice(11, 16) + ' Uhr'), '#/kalender');
      });
    }
  }
  props.setProperty('BEKANNTE_TERMINE', JSON.stringify(jetzt.slice(0, 200)));
}

// =====================================================================
// Bluetti (ESP32) & ThingSpeak
// =====================================================================

function bluetti_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('bluetti');
  if (c) return JSON.parse(c);
  var props = PropertiesService.getScriptProperties();
  var basis = String(prop_('BLUETTI_URL') || 'http://mgi-ism.ddns.net:8080').replace(/\/$/, '');
  var opts = { muteHttpExceptions: true, followRedirects: true };
  var user = prop_('BLUETTI_USER');
  if (user) opts.headers = { Authorization: 'Basic ' + Utilities.base64Encode(user + ':' + prop_('BLUETTI_PASS')) };
  var erg;
  try {
    var res = UrlFetchApp.fetch(basis + '/api/status', opts);
    if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
    var daten = JSON.parse(res.getContentText());
    erg = { erreichbar: true, daten: daten, zeit: new Date().toISOString() };
    props.setProperty('BLUETTI_LETZT', JSON.stringify(erg));
    cache.put('bluetti', JSON.stringify(erg), 60);
  } catch (e) {
    var letzt = JSON.parse(props.getProperty('BLUETTI_LETZT') || 'null');
    erg = { erreichbar: false, daten: letzt ? letzt.daten : undefined, zeit: letzt ? letzt.zeit : undefined, ausCache: !!letzt };
    cache.put('bluetti', JSON.stringify(erg), 120); // bei Ausfall nicht bei jeder Anfrage erneut warten
  }
  return erg;
}

function bluettiVerlauf_(d) {
  var kanal = prop_('THINGSPEAK_KANAL');
  if (!kanal) return { eingerichtet: false, punkte: [] };
  var tage = d.tage === 7 ? 7 : 1;
  var key = 'ts_' + tage;
  var cache = CacheService.getScriptCache();
  var c = cache.get(key);
  if (c) return JSON.parse(c);
  var url = 'https://api.thingspeak.com/channels/' + encodeURIComponent(kanal) + '/feeds.json?timezone=Europe%2FBerlin&days=' + tage;
  url += tage === 7 ? '&average=60' : '&average=10';
  var rk = prop_('THINGSPEAK_READ_KEY');
  if (rk) url += '&api_key=' + encodeURIComponent(rk);
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw fehler_('ThingSpeak nicht erreichbar', 502);
  var feeds = JSON.parse(res.getContentText()).feeds || [];
  var zahl = function (x) { var n = parseFloat(x); return isNaN(n) ? null : n; };
  var erg = {
    eingerichtet: true,
    punkte: feeds.map(function (f) { return { zeit: f.created_at, soc: zahl(f.field1), solar: zahl(f.field2) }; }),
  };
  try { cache.put(key, JSON.stringify(erg), 600); } catch (e) { /* zu groß */ }
  return erg;
}

// =====================================================================
// Eigene Wetterstation am Platz (ESP32, Repo Wetterstation-5.0)
// =====================================================================
// Die Station liefert eine kleine HTML-Tabelle („Messwert | Wert“). Das Script liest sie
// alle 2 Minuten aus (Cache) und gibt die Werte als JSON an die App weiter.

var RICHTUNG_DE = { N: 'N', NE: 'NO', NO: 'NO', E: 'O', O: 'O', SE: 'SO', SO: 'SO', S: 'S', SW: 'SW', W: 'W', NW: 'NW' };

function wetterstationParsen(html) {
  var werte = {};
  var re = /<td>([^<]+)<\/td>\s*<td[^>]*>([^<]+)<\/td>/gi;
  var m;
  while ((m = re.exec(html))) werte[m[1].trim().toLowerCase()] = m[2].trim();
  var zahl = function (k) { var v = werte[k]; if (!v) return null; var n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : n; };
  var r = String(werte['windrichtung'] || '').toUpperCase();
  return {
    temperatur: zahl('temperatur'),
    wind: zahl('windgeschwindigkeit'),
    richtung: RICHTUNG_DE[r] || r || null,
    luftdruck: zahl('luftdruck'),
    luftfeuchte: zahl('luftfeuchtigkeit'),
    batterie: zahl('batteriespannung'),
  };
}

function wetterstation_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('wetterstation');
  if (c) return JSON.parse(c);
  var props = PropertiesService.getScriptProperties();
  var url = prop_('WETTERSTATION_URL') || 'http://mgi-ism.ddns.net:81/';
  var erg;
  try {
    var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error('HTTP ' + res.getResponseCode());
    var daten = wetterstationParsen(res.getContentText());
    if (daten.temperatur === null && daten.wind === null) throw new Error('Keine Messwerte gefunden');
    erg = { erreichbar: true, daten: daten, zeit: new Date().toISOString() };
    props.setProperty('WETTERSTATION_LETZT', JSON.stringify(erg));
    cache.put('wetterstation', JSON.stringify(erg), 120);
  } catch (e) {
    var letzt = JSON.parse(props.getProperty('WETTERSTATION_LETZT') || 'null');
    erg = { erreichbar: false, daten: letzt ? letzt.daten : undefined, zeit: letzt ? letzt.zeit : undefined, ausCache: !!letzt };
    cache.put('wetterstation', JSON.stringify(erg), 120);
  }
  return erg;
}

// =====================================================================
// Einstellungen (Platzordnung, Notfall, Windgrenzen …)
// =====================================================================

var STANDARD_EINSTELLUNGEN = {
  platzordnung:
    "## Flugraum\n- Nur **nördlich der Start- und Landebahn**: westlich bis zur Moosstraße, **190 m** nach Norden, **250 m** nach Osten (siehe Karte)\n- **Nicht überfliegen:** südlich des Sicherheitsnetzes, Aufbauraum, Parkplatz, Zuschauer\n- Max. Flughöhe **304 m** · bemannten Flugzeugen ausweichen\n- Landwirtschaft hat Vorrang: Landmaschinen und Personen auf Feldern **nie überfliegen**\n\n## Vor dem Fliegen\n- Zufahrt nur **von Süden**, langsam · nur auf den Parkplätzen parken\n- Im **Flugbuch** anmelden (App → Flugbuch)\n- **Sicherheitsnetz** muss intakt und voll befestigt sein – sonst kein Flugbetrieb\n- Dabei haben: **Haftpflicht** mit mind. 2 Mio. € · **e-ID** auf Modellen über 250 g · **Schulungsnachweis** ab 2 kg oder über 120 m\n- Motoren im Aufbauraum nur gesichert starten (Halteseil, Helfer) · Heli/Copter zur Bahn tragen, kein Schwebeflug dorthin\n- Vor dem Start: Modell und Fernsteuerung in Ordnung, kein Modell im Landeanflug, Bahn frei, Zufahrtsweg im Osten frei\n\n## Im Flug und bei der Landung\n- Startbahn nur Pilot und Helfer, danach sofort verlassen\n- **Landungen haben Vorrang** · jede Landung und Notlandung **laut ansagen**\n- Nach der Landung Motor aus, Modell in den Aufbauraum ziehen oder tragen\n- Flächenflieger haben Vorrang vor Heli und Multicopter\n\n## Flugleiter\n- Pflicht ab **mehr als 8 Modellen** in der Luft oder **mehr als 12 Personen** im Zuschauerbereich\n- Schon ab mehr als 3 Modellen, wenn sich die Piloten nicht abstimmen\n- Der Flugleiter fliegt selbst nicht und steht im Flugbuch\n\n## Modelle und Antriebe\n- Höchstens **25 kg** · Flächenflieger, Hubschrauber, Multicopter, Sondermodelle\n- **Elektro:** „Motor aus“-Schalter an der Fernsteuerung\n- **Kolben:** max. **82 dB(A)**, Messprotokoll nach DMFV-Leitfaden\n- **Turbine:** max. **90 dB(A)**, nur mit Genehmigung des Vorstands, Feuerlöscher griffbereit, nicht bei akuter Trockenheit\n- **FPV:** über 30 m nur mit Spotter neben dem Piloten\n\n## Zeiten und Ordnung\n- Ende spätestens **½ Stunde vor Sonnenuntergang**\n- Kein Flugbetrieb bei Pflege- und Wartungsarbeiten am Platz\n- Müll selbst mitnehmen · Gartenhaus und Überdachung ordentlich halten\n- Zuschauer nur zwischen Parkplätzen und Tischen · Eltern haften für ihre Kinder\n\n## Wer darf fliegen\n- Mitglieder der MGI\n- Gastflieger anderer Vereine nach Absprache mit dem Vorstand\n- Gäste eines volljährigen Mitglieds nach Absprache mit dem Flugleiter und Eintrag ins Flugbuch\n- Anfänger nur unter Verantwortung eines anwesenden, volljährigen Mitglieds\n\n## Bei einem Unfall\n- **112** und den Vorstand informieren, im Flugbuch unter „Besondere Vorkommnisse“ eintragen\n\n_Kurzfassung der Flugbetriebsordnung vom 01.12.2024. Verbindlich ist die vollständige Fassung._",
  notfallInfo: '- **Erste-Hilfe-Kasten:** außen am Gartenhaus\n- **Feuerlöscher:** im Gartenhaus',
  notfallKontakte: [],
  zufahrt: '',
  windGelb: 25,
  windRot: 40,
  datenschutzFoto:
    'Bitte nur Fotos hochladen, mit denen alle abgebildeten Personen einverstanden sind. Die Fotos erscheinen öffentlich auf der Vereins-Homepage.',
  checkinStunden: 6,
};

function einstellungenLesen_() {
  var erg = JSON.parse(JSON.stringify(STANDARD_EINSTELLUNGEN));
  zeilen_('Einstellungen').forEach(function (r) {
    try { erg[r.schluessel] = JSON.parse(r.wert); } catch (e) { erg[r.schluessel] = r.wert; }
  });
  return erg;
}

function einstellungenSpeichern_(d) {
  mitSperre_(function () {
    Object.keys(STANDARD_EINSTELLUNGEN).forEach(function (k) {
      if (d[k] === undefined) return;
      var wert = JSON.stringify(d[k]);
      var gefunden = aktualisiereZeile_('Einstellungen', 'schluessel', k, function (r) { r.wert = wert; return r; });
      if (!gefunden) zeileAnhaengen_('Einstellungen', [k, wert]);
    });
  });
  return einstellungenLesen_();
}

// =====================================================================
// Fotos
// =====================================================================

var KATEGORIEN = ['Flugtag', 'Wettbewerb', 'Schiffsmodell', 'Arbeitsdienst', 'Sonstiges'];

function fotoHochladen_(d, s) {
  if (!d.base64) throw fehler_('Kein Bild empfangen', 400);
  var kat = KATEGORIEN.indexOf(d.kategorie) >= 0 ? d.kategorie : 'Sonstiges';
  var jetzt = d.aufgenommen ? new Date(d.aufgenommen) : new Date();
  // direkt in den Ordner „Fotos Homepage“ (keine Unterordner)
  // Dateiname: Datum_Uhrzeit_Titel_Vorname-N.jpg (Titel optional), bei Doppelten _2, _3 …
  var ordner = DriveApp.getFolderById(prop_('FOTO_ORDNER_ID', true));
  var titel = String(d.titel || '').trim().slice(0, 60);
  var m = mitgliedNachId_(s.mitgliedId);
  var vor = m ? m.vorname : teileName_(s.name).vorname;
  var nach = m ? m.nachname : teileName_(s.name).nachname;
  var kurz = (dateiname_(vor) || 'Mitglied') + (nach ? '-' + dateiname_(nach).charAt(0).toUpperCase() : '');
  var titelTeil = dateiname_(titel).slice(0, 30).replace(/-+$/, '');
  var stamm = Utilities.formatDate(jetzt, TZ, 'yyyy-MM-dd_HH-mm') + '_' + (titelTeil ? titelTeil + '_' : '') + kurz;
  var name = stamm + '.jpg';
  for (var n = 2; ordner.getFilesByName(name).hasNext() && n < 500; n++) name = stamm + '_' + n + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(d.base64), d.mimeType || 'image/jpeg', name);
  var datei = ordner.createFile(blob);
  datei.setDescription((titel ? titel + ' – ' : '') + kat + ' – Foto: ' + s.name);
  CacheService.getScriptCache().remove('galerie');
  return { id: datei.getId(), name: name };
}

/**
 * Öffentliche Foto-Galerie für die Homepage: Bilder aus „Fotos Homepage“, neueste zuerst.
 * Die Bilder selbst sind ohnehin per Link öffentlich (Homepage), hier nur Name, Beschreibung, Datum.
 */
function galerie_(d) {
  var cache = CacheService.getScriptCache();
  var c = cache.get('galerie');
  var liste;
  if (c) liste = JSON.parse(c);
  else {
    liste = [];
    var it = DriveApp.getFolderById(prop_('FOTO_ORDNER_ID', true)).getFiles();
    while (it.hasNext() && liste.length < 1000) {
      var f = it.next();
      if (String(f.getMimeType()).indexOf('image/') !== 0) continue;
      liste.push({ id: f.getId(), name: f.getName(), beschreibung: f.getDescription() || '', datum: f.getDateCreated().toISOString() });
    }
    liste.sort(function (a, b) { return b.datum.localeCompare(a.datum); });
    try { cache.put('galerie', JSON.stringify(liste), 120); } catch (e) { /* zu groß */ }
  }
  var max = Math.min(Math.max(Number(d && d.max) || 200, 1), 1000);
  return liste.slice(0, max);
}

function unterordner_(eltern, name) {
  var it = eltern.getFoldersByName(name);
  return it.hasNext() ? it.next() : eltern.createFolder(name);
}

function dateiname_(s) {
  return s.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe').replace(/Ü/g, 'Ue').replace(/ß/g, 'ss')
    .replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
}

// =====================================================================
// Elektronisches Flugbuch (ersetzt „Wer ist am Platz?“)
// =====================================================================
// Jede Anmeldung im Flugbuch ist eine Zeile im Blatt „Flugbuch“ (Piloten) bzw.
// „Flugleiter“. Beim Anmelden wird die Uhrzeit „beginn“, beim Abmelden „ende“
// eingetragen. Wer eine offene Zeile (ohne Ende) hat, gilt als „am Platz“.

var ANTRIEBE = ['segler', 'elektro', 'kolben', 'turbine'];
var MASSEN = ['<250 g', '<2 kg', '<12 kg', '<25 kg'];
var WETTER = ['klar', 'leicht bedeckt', 'bedeckt', 'nebelig'];
var WINDRICHTUNGEN = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
var WINDSTAERKEN = ['kein', 'leicht', 'mäßig', 'stark'];

/** Zellwert als Text (falls Google Tabellen doch ein Datum/eine Uhrzeit daraus gemacht hat) */
function zelle_(v, format) {
  if (v instanceof Date) return format ? Utilities.formatDate(v, TZ, format) : v.toISOString();
  return v === undefined || v === null ? '' : String(v);
}

function heute_() { return Utilities.formatDate(new Date(), TZ, 'dd.MM.yyyy'); }
function uhr_(d) { return Utilities.formatDate(d || new Date(), TZ, 'HH:mm'); }
function txt_(v) { return "'" + String(v === undefined || v === null ? '' : v); } // als Text speichern (keine Datums-Umwandlung)
function jaNein_(b) { return b ? 'ja' : 'nein'; }

function teileName_(voll) {
  var t = String(voll || '').trim().split(/\s+/);
  return { vorname: t.slice(0, -1).join(' ') || t[0] || '', nachname: t.length > 1 ? t[t.length - 1] : '' };
}

function flugbuchEintrag_(r) {
  return {
    id: r.id, datum: zelle_(r.datum, 'dd.MM.yyyy'), name: r.name, vorname: r.vorname, vereinGast: r.verein_gast, kanal: zelle_(r.kanal),
    schulungsnachweis: r.schulungsnachweis === 'ja',
    antrieb: ANTRIEBE.filter(function (a) { return r[a] === 'x'; }),
    masse: zelle_(r.max_masse), beginn: zelle_(r.beginn, 'HH:mm'), ende: zelle_(r.ende, 'HH:mm'),
    eingetragenVon: r.eingetragen_von, mitgliedId: r.mitgliedId,
    beginnTs: zelle_(r.beginn_ts), endeTs: zelle_(r.ende_ts), autoBeendet: r.auto_beendet === 'ja',
    vorkommnisse: zelle_(r.vorkommnisse),
  };
}

function flugleiterEintrag_(r) {
  return {
    id: r.id, datum: zelle_(r.datum, 'dd.MM.yyyy'), name: r.name, vorname: r.vorname,
    fangnetz: r.fangnetz === 'ja', rasenGemaeht: r.rasen_gemaeht === 'ja', wetter: r.wetter,
    windrichtung: r.windrichtung, windstaerke: r.windstaerke,
    beginn: zelle_(r.beginn, 'HH:mm'), ende: zelle_(r.ende, 'HH:mm'), mitgliedId: r.mitgliedId,
    beginnTs: zelle_(r.beginn_ts), endeTs: zelle_(r.ende_ts), autoBeendet: r.auto_beendet === 'ja',
  };
}

function offenePiloten_() {
  return zeilen_('Flugbuch').filter(function (r) { return !r.ende_ts; }).map(flugbuchEintrag_);
}
function offeneFlugleiter_() {
  return zeilen_('Flugleiter').filter(function (r) { return !r.ende_ts; }).map(flugleiterEintrag_);
}

/** Wer ist gerade am Platz? (Öffentlich nur die Anzahl, Namen nur für Mitglieder) */
function anwesende_(d, s) {
  var piloten = offenePiloten_();
  var fl = offeneFlugleiter_();
  var liste = piloten.map(function (p) {
    return {
      mitgliedId: p.vereinGast === 'Gast' ? 'gast:' + p.id : p.mitgliedId,
      name: p.vorname + ' ' + p.name + (p.vereinGast === 'Gast' ? ' (Gast)' : ''),
      seit: p.beginnTs,
      flugleiter: fl.some(function (f) { return f.mitgliedId === p.mitgliedId && p.vereinGast !== 'Gast'; }),
    };
  });
  // Flugleiter, der selbst nicht fliegt, trotzdem anzeigen
  fl.forEach(function (f) {
    if (!liste.some(function (x) { return x.mitgliedId === f.mitgliedId; })) {
      liste.push({ mitgliedId: f.mitgliedId, name: f.vorname + ' ' + f.name, seit: f.beginnTs, flugleiter: true });
    }
  });
  var erg = { anzahl: liste.length, flugleiter: fl.length > 0, liste: [] };
  if (s) erg.liste = liste;
  return erg;
}

function flugbuchStatus_(d, s) {
  var heute = heute_();
  var alle = zeilen_('Flugbuch').filter(function (r) { return zelle_(r.datum, 'dd.MM.yyyy') === heute || !r.ende_ts; }).map(flugbuchEintrag_);
  var fl = zeilen_('Flugleiter').filter(function (r) { return zelle_(r.datum, 'dd.MM.yyyy') === heute || !r.ende_ts; }).map(flugleiterEintrag_);
  return {
    heute: heute,
    piloten: alle,
    flugleiter: fl,
    anwesend: anwesende_(d, s),
    autoStunden: Number(einstellungenLesen_().checkinStunden) || 6,
  };
}

function flugbuchAnmelden_(d, s) {
  var e = d.eintrag || {};
  if (e.regelnBestaetigt !== true) throw fehler_('Bitte bestätigen, dass dir die Betriebsregeln bekannt sind', 400);
  var gast = e.art === 'gast';
  var name, vorname;
  if (gast) {
    vorname = String(e.gastVorname || '').trim();
    name = String(e.gastName || '').trim();
    if (!vorname || !name) throw fehler_('Bitte Vor- und Nachname des Gastes angeben', 400);
  } else {
    var m = mitgliedNachId_(s.mitgliedId);
    vorname = m ? m.vorname : teileName_(s.name).vorname;
    name = m ? m.nachname : teileName_(s.name).nachname;
  }
  var antrieb = (e.antrieb || []).filter(function (a) { return ANTRIEBE.indexOf(a) >= 0; });
  if (!antrieb.length) throw fehler_('Bitte die Antriebsart wählen', 400);
  if (MASSEN.indexOf(e.masse) < 0) throw fehler_('Bitte die Gewichtsklasse wählen', 400);
  var jetzt = new Date();
  var id = 'f' + Utilities.getUuid().slice(0, 8);
  mitSperre_(function () {
    if (!gast) {
      var offen = zeilen_('Flugbuch').some(function (r) { return !r.ende_ts && r.mitgliedId === s.mitgliedId && r.verein_gast !== 'Gast'; });
      if (offen) throw fehler_('Du bist bereits im Flugbuch angemeldet', 400);
    }
    zeileAnhaengen_('Flugbuch', [
      id, txt_(heute_()), name, vorname, gast ? 'Gast' : 'Verein', txt_(String(e.kanal || '').slice(0, 20)), jaNein_(e.schulungsnachweis),
      antrieb.indexOf('segler') >= 0 ? 'x' : '', antrieb.indexOf('elektro') >= 0 ? 'x' : '',
      antrieb.indexOf('kolben') >= 0 ? 'x' : '', antrieb.indexOf('turbine') >= 0 ? 'x' : '',
      txt_(e.masse), txt_(uhr_(jetzt)), '', 'ja', s.name, s.mitgliedId, txt_(jetzt.toISOString()), '', '', '',
    ]);
  });
  if (d.flugleiter) flugleiterAnmelden_({ bedingungen: d.flugleiter }, s);
  return flugbuchStatus_(d, s);
}

function flugbuchAbmelden_(d, s) {
  var jetzt = new Date();
  var gefunden = false;
  mitSperre_(function () {
    var zeile = zeilen_('Flugbuch').filter(function (r) { return r.id === d.id && !r.ende_ts; })[0];
    if (!zeile) return;
    if (zeile.mitgliedId !== s.mitgliedId && s.rolle !== 'admin') throw fehler_('Nur eigene Einträge oder selbst eingetragene Gäste abmelden', 403);
    aktualisiereZeile_('Flugbuch', 'id', d.id, function (r) {
      r.ende = txt_(uhr_(jetzt)); r.ende_ts = txt_(jetzt.toISOString()); r.auto_beendet = 'nein';
      if (d.vorkommnisse !== undefined) r.vorkommnisse = vorkommnisseText_(d.vorkommnisse);
      return r;
    });
    gefunden = true;
  });
  if (!gefunden) throw fehler_('Eintrag nicht gefunden oder schon abgemeldet', 404);
  return flugbuchStatus_(d, s);
}

function vorkommnisseText_(t) {
  var x = String(t || '').replace(/\r/g, '').trim().slice(0, 1000);
  return x ? txt_(x) : '';
}

/** Besondere Vorkommnisse (Freitext) zum eigenen Flugbuch-Eintrag – solange angemeldet, Admins auch danach */
function flugbuchKommentar_(d, s) {
  var gefunden = false;
  mitSperre_(function () {
    var zeile = zeilen_('Flugbuch').filter(function (r) { return r.id === d.id; })[0];
    if (!zeile) return;
    var admin = s.rolle === 'admin';
    if (zeile.mitgliedId !== s.mitgliedId && !admin) throw fehler_('Nur zum eigenen Eintrag', 403);
    if (zeile.ende_ts && !admin) throw fehler_('Du bist schon abgemeldet', 400);
    aktualisiereZeile_('Flugbuch', 'id', d.id, function (r) { r.vorkommnisse = vorkommnisseText_(d.text); return r; });
    gefunden = true;
  });
  if (!gefunden) throw fehler_('Eintrag nicht gefunden', 404);
  return flugbuchStatus_(d, s);
}

function flugleiterAnmelden_(d, s) {
  var b = d.bedingungen || {};
  if (WETTER.indexOf(b.wetter) < 0) throw fehler_('Bitte das Wetter wählen', 400);
  if (WINDRICHTUNGEN.indexOf(b.windrichtung) < 0) throw fehler_('Bitte die Windrichtung wählen', 400);
  if (WINDSTAERKEN.indexOf(b.windstaerke) < 0) throw fehler_('Bitte die Windstärke wählen', 400);
  var m = mitgliedNachId_(s.mitgliedId);
  var jetzt = new Date();
  mitSperre_(function () {
    var offen = zeilen_('Flugleiter').some(function (r) { return !r.ende_ts && r.mitgliedId === s.mitgliedId; });
    if (offen) throw fehler_('Du bist bereits als Flugleiter angemeldet', 400);
    zeileAnhaengen_('Flugleiter', [
      'l' + Utilities.getUuid().slice(0, 8), txt_(heute_()), m ? m.nachname : teileName_(s.name).nachname, m ? m.vorname : teileName_(s.name).vorname,
      jaNein_(b.fangnetz), jaNein_(b.rasenGemaeht), b.wetter, b.windrichtung, b.windstaerke,
      txt_(uhr_(jetzt)), '', s.mitgliedId, txt_(jetzt.toISOString()), '', '',
    ]);
  });
  return flugbuchStatus_(d, s);
}

function flugleiterAbmelden_(d, s) {
  var jetzt = new Date();
  mitSperre_(function () {
    zeilen_('Flugleiter').filter(function (r) { return !r.ende_ts && (r.id === d.id || (!d.id && r.mitgliedId === s.mitgliedId)); }).forEach(function (z) {
      if (z.mitgliedId !== s.mitgliedId && s.rolle !== 'admin') throw fehler_('Nur den eigenen Flugleiter-Eintrag beenden', 403);
      aktualisiereZeile_('Flugleiter', 'id', z.id, function (r) {
        r.ende = txt_(uhr_(jetzt)); r.ende_ts = txt_(jetzt.toISOString()); r.auto_beendet = 'nein';
        return r;
      });
    });
  });
  return flugbuchStatus_(d, s);
}

/** Vergessene Abmeldungen nach X Stunden bzw. zum Tageswechsel automatisch beenden */
function flugbuchAutoBeenden_() {
  var stunden = Number(einstellungenLesen_().checkinStunden) || 6;
  var heute = heute_();
  ['Flugbuch', 'Flugleiter'].forEach(function (blatt) {
    zeilen_(blatt).filter(function (r) { return !r.ende_ts && r.beginn_ts; }).forEach(function (z) {
      var beginn = z.beginn_ts instanceof Date ? z.beginn_ts : new Date(z.beginn_ts);
      var ende = new Date(beginn.getTime() + stunden * 3600000);
      var anderer = zelle_(z.datum, 'dd.MM.yyyy') !== heute;
      if (ende.getTime() > Date.now() && !anderer) return;
      if (anderer) {
        // spätestens 23:59 am Tag der Anmeldung
        var tagesende = new Date(Utilities.formatDate(beginn, TZ, "yyyy-MM-dd'T'23:59:00") + Utilities.formatDate(beginn, TZ, 'XXX'));
        if (tagesende.getTime() < ende.getTime()) ende = tagesende;
      }
      if (ende.getTime() > Date.now()) ende = new Date();
      mitSperre_(function () {
        aktualisiereZeile_(blatt, 'id', z.id, function (r) {
          r.ende = txt_(uhr_(ende)); r.ende_ts = txt_(ende.toISOString()); r.auto_beendet = 'ja';
          return r;
        });
      });
    });
  });
}

/** Flugbuch-Übersicht für Admins (Zeitraum, neueste zuerst) */
function flugbuchListe_(d) {
  var von = String(d.von || '0000-00-00');
  var bis = String(d.bis || '9999-12-31');
  var iso = function (datum) { var t = zelle_(datum, 'dd.MM.yyyy').split('.'); return t.length === 3 ? t[2] + '-' + t[1] + '-' + t[0] : ''; };
  var imZeitraum = function (r) { var x = iso(r.datum); return x >= von && x <= bis; };
  return {
    piloten: zeilen_('Flugbuch').filter(imZeitraum).map(flugbuchEintrag_).reverse(),
    flugleiter: zeilen_('Flugleiter').filter(imZeitraum).map(flugleiterEintrag_).reverse(),
    tabelle: SpreadsheetApp.openById(prop_('SHEET_ID', true)).getUrl(),
  };
}

// =====================================================================
// Zugangsanfrage
// =====================================================================

function zugangAnfragen_(d) {
  var vorname = String(d.vorname || '').trim().slice(0, 40);
  var nachname = String(d.nachname || '').trim().slice(0, 40);
  if (!vorname || !nachname) throw fehler_('Bitte Vor- und Nachname angeben', 400);
  // einfache Bremse gegen Massen-Anfragen
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get('anfragen') || 0);
  if (n > 20) throw fehler_('Gerade gehen zu viele Anfragen ein – bitte später erneut versuchen', 429);
  cache.put('anfragen', String(n + 1), 3600);
  var voll = (vorname + ' ' + nachname).toLowerCase();
  var vorhanden = zeilen_('Mitglieder').some(function (m) { return String(m.aktiv) === 'true' && (m.vorname + ' ' + m.nachname).toLowerCase() === voll; });
  if (vorhanden) throw fehler_('Du bist bereits registriert. PIN vergessen? Bitte beim Vorstand melden.', 400);
  var offen = zeilen_('Anfragen').some(function (a) { return a.status === 'offen' && (a.vorname + ' ' + a.nachname).toLowerCase() === voll; });
  if (!offen) {
    mitSperre_(function () {
      zeileAnhaengen_('Anfragen', ['a' + Utilities.getUuid().slice(0, 8), vorname, nachname, String(d.nachricht || '').slice(0, 200), txt_(new Date().toISOString()), 'offen', '']);
    });
    pushAnAdmins_('Neue Zugangsanfrage', vorname + ' ' + nachname + ' möchte in die MGI-App.', '#/verwaltung/mitglieder');
  }
  return { ok: true };
}

function anfragenListe_() {
  return zeilen_('Anfragen').filter(function (a) { return a.status === 'offen'; }).map(function (a) {
    return { id: a.id, vorname: a.vorname, nachname: a.nachname, nachricht: a.nachricht, erstellt: zelle_(a.erstellt) };
  });
}

function anfrageFreigeben_(d, s) {
  var a = zeilen_('Anfragen').filter(function (x) { return x.id === d.id && x.status === 'offen'; })[0];
  if (!a) throw fehler_('Anfrage nicht gefunden', 404);
  var erg = mitgliedAnlegen_({ vorname: d.vorname || a.vorname, nachname: d.nachname || a.nachname, rolle: d.rolle, sparte: d.sparte }, s);
  mitSperre_(function () {
    aktualisiereZeile_('Anfragen', 'id', a.id, function (r) { r.status = 'freigegeben'; r.bearbeitet = s.name + ' ' + new Date().toISOString(); return r; });
  });
  return { id: erg.id, pin: erg.pin, vorname: d.vorname || a.vorname, nachname: d.nachname || a.nachname };
}

function anfrageAblehnen_(d, s) {
  mitSperre_(function () {
    aktualisiereZeile_('Anfragen', 'id', d.id, function (r) { r.status = 'abgelehnt'; r.bearbeitet = s.name + ' ' + new Date().toISOString(); return r; });
  });
  return true;
}

// =====================================================================
// Schwarzes Brett
// =====================================================================

function brettListe_() {
  var jetzt = new Date().toISOString();
  return zeilen_('Brett').map(function (r) { return JSON.parse(r.json); })
    .filter(function (b) { return b.ablauf > jetzt; })
    .sort(function (a, b) { return b.erstellt.localeCompare(a.erstellt); });
}

function brettSpeichern_(d, s) {
  var titel = String(d.titel || '').trim();
  if (!titel) throw fehler_('Titel fehlt', 400);
  var vorhanden = d.id ? zeilen_('Brett').filter(function (r) { return r.id === d.id; })[0] : null;
  var alt = vorhanden ? JSON.parse(vorhanden.json) : null;
  if (alt && alt.verfasserId !== s.mitgliedId && s.rolle !== 'admin') throw fehler_('Nur eigene Beiträge bearbeiten', 403);
  var fotos = alt ? alt.fotos.slice() : [];
  (d.neueFotos || []).slice(0, Math.max(0, 3 - fotos.length)).forEach(function (b64, i) {
    var ordner = DriveApp.getFolderById(prop_('BRETT_ORDNER_ID', true));
    var datei = ordner.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', 'brett_' + Date.now() + '_' + i + '.jpg'));
    datei.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    fotos.push('https://drive.google.com/thumbnail?id=' + datei.getId() + '&sz=w1000');
  });
  if (d.entfernteFotos) fotos = fotos.filter(function (f) { return d.entfernteFotos.indexOf(f) < 0; });
  var jetzt = new Date();
  var b = {
    id: alt ? alt.id : 'b' + Utilities.getUuid().slice(0, 8),
    kategorie: ['biete', 'suche', 'info'].indexOf(d.kategorie) >= 0 ? d.kategorie : 'info',
    titel: titel.slice(0, 80),
    text: String(d.text || '').slice(0, 2000),
    preis: String(d.preis || '').slice(0, 30),
    kontakt: String(d.kontakt || '').slice(0, 100),
    fotos: fotos,
    verfasserId: alt ? alt.verfasserId : s.mitgliedId,
    verfasser: alt ? alt.verfasser : s.name,
    erstellt: alt ? alt.erstellt : jetzt.toISOString(),
    ablauf: new Date(jetzt.getTime() + 60 * 86400000).toISOString(),
  };
  mitSperre_(function () {
    if (alt) aktualisiereZeile_('Brett', 'id', b.id, function (r) { r.json = JSON.stringify(b); r.ablauf = b.ablauf; return r; });
    else zeileAnhaengen_('Brett', [b.id, b.ablauf, JSON.stringify(b)]);
  });
  if (!alt) pushSenden_('brett', 'Schwarzes Brett: ' + ({ biete: 'Biete', suche: 'Suche', info: 'Info' }[b.kategorie]), b.titel, '#/brett', s.mitgliedId);
  return b;
}

function brettLoeschen_(d, s) {
  var r = zeilen_('Brett').filter(function (x) { return x.id === d.id; })[0];
  if (!r) return true;
  var b = JSON.parse(r.json);
  if (b.verfasserId !== s.mitgliedId && s.rolle !== 'admin') throw fehler_('Nur eigene Beiträge löschen', 403);
  mitSperre_(function () { loescheZeilen_('Brett', function (x) { return x.id === d.id; }); });
  return true;
}

// =====================================================================
// Technik: Infos zu Anlagen am Platz (von Admins in der App gepflegt)
// Abschnitte mit nurMitglieder = true (z. B. Zahlenschloss) gibt es nur mit Anmeldung.
// =====================================================================

var TECHNIK_GRAFIKEN = ['', 'wetterstation', 'strom'];

// Erster Text der Ladesteckdosen – wird bei der Migration nur ersetzt, wenn ihn noch niemand geändert hat
var TECHNIK_LADE_ALT = 'Die Ladesteckdosen sind mit **15 Ampere** abgesichert.';

function technikStandard_() {
  return [
    {
      titel: 'Wetterstation', icon: 'wind', grafik: 'wetterstation', nurMitglieder: false,
      text: [
        'Die Wetterstation am Platz misst Wind, Temperatur, Luftfeuchte und Luftdruck. Die Werte erscheinen in der App unter **Wetter** und auf Wettermonster.',
        '## Aufbau',
        '- **Steuerung:** ESP32 (NodeMCU-32S) mit WLAN, Hardware-Watchdog (30 s) und Update über WLAN (OTA)',
        '- **Temperatur, Luftfeuchte, Luftdruck:** Sensor BME280 am I²C-Bus (Adresse 0x76)',
        '- **Windgeschwindigkeit:** Schalenanemometer mit 4–20-mA-Ausgang über 120-Ω-Messwiderstand an GPIO 34',
        '- **Windrichtung:** Windfahne mit Analogspannung an GPIO 35 (8 Richtungen)',
        '- **Akkuspannung:** Spannungsteiler 1 : 5,4 an GPIO 36',
        '- **Rabenschreck:** Schaltausgang GPIO 14, ein- und ausschaltbar über die Weboberfläche',
        '## Ablauf',
        '- Messung alle 30 Sekunden, Werte werden geglättet',
        '- alle 10 Minuten Upload an Wettermonster',
        '- Messwert-Seite im Netz (Port 81), die auch die App abruft',
        '- Neustart automatisch nach 1000 Sendeintervallen oder wenn sich die Software aufhängt',
      ].join('\n'),
    },
    technikStrom_(),
    {
      titel: 'Walze', icon: 'schaufel', grafik: '', nurMitglieder: false,
      text: [
        '_Bitte ergänzen (Admins: Stift oben rechts)._',
        '## Wozu',
        '- …',
        '## Bedienung',
        '- …',
        '## Hinweise',
        '- …',
      ].join('\n'),
    },
    {
      titel: 'Dixi-Toilette', icon: 'schloss', grafik: '', nurMitglieder: true,
      text: [
        '**Zahlenkombination Schloss:** _bitte eintragen_',
        '',
        'Bitte nach Benutzung wieder abschließen und die Zahlen verstellen.',
      ].join('\n'),
    },
    {
      titel: 'Ladesteckdosen', icon: 'akku', grafik: '', nurMitglieder: false,
      text: technikLadeText_(),
    },
  ];
}

function technikStrom_() {
  return {
    titel: 'Stromversorgung', icon: 'akku', grafik: 'strom', nurMitglieder: false,
    text: [
      'Der Platz wird komplett mit Solarstrom versorgt.',
      '## Gartenhaus',
      '- **Bluetti AC200MAX** mit 2 Zusatzakkus **B300** – zusammen **8.192 Wh** (LiFePO₄)',
      '- **Solar:** 2 Module mit je 500 Wp über einen **DC-Trennschalter** am Solareingang (max. 900 W, 10–145 V, 15 A)',
      '- **Wechselrichter:** 230 V, reiner Sinus, 2.200 W Dauerleistung',
      '- Ladezustand und Solarleistung live in der App unter **Strom**',
      '## 12-V-Ausgang',
      '- Wetterstation',
      '- WLAN-Router',
      '- DC-DC-Wandler zur Pufferbatterie an den Tischen',
      '## 230-V-Ausgang',
      '- Mähroboter',
      '- RTK-Antenne',
      '- Kühlschrank',
      '## An den Tischen',
      '- **Pufferbatterie:** LiFePO₄, 12,8 V, 100 Ah (rund 1.280 Wh), wird über den DC-DC-Wandler vom Bluetti nachgeladen',
      '- versorgt die Ladesteckdosen an zwei Tischen, abgesichert mit **15 A** (bei 12,8 V rund 190 W)',
      '## Hinweise',
      '- Die Module haben zusammen 1.000 Wp, das Bluetti nimmt höchstens 900 W auf. An sehr sonnigen Tagen wird die Spitze abgeschnitten – das ist normal.',
      '- Vor Arbeiten an den Solarleitungen den DC-Trennschalter ausschalten.',
      '- _Bitte ergänzen: Typ des DC-DC-Wandlers._',
    ].join('\n'),
  };
}

function technikLadeText_() {
  return [
    'Die Ladesteckdosen an **zwei Tischen** hängen an der **Pufferbatterie** vorne bei den Tischen und sind mit **15 Ampere** abgesichert.',
    '- Die Pufferbatterie wird über einen DC-DC-Wandler vom Bluetti im Gartenhaus nachgeladen (siehe **Stromversorgung**).',
    '- Alle gleichzeitig angeschlossenen Ladegeräte zusammen dürfen 15 A nicht überschreiten.',
    '- Löst die Sicherung aus: Ladegeräte abstecken, Sicherung wieder einschalten, Geräte einzeln wieder anstecken.',
    '## Erlaubter Ladestrom',
    'Die 12-V-Ladesteckdosen sind mit 15 A abgesichert. Das reicht für rund 190 W Ladeleistung. Je mehr Zellen der Akku hat, desto kleiner muss der Ladestrom sein:',
    '| Akku | Ladeschluss | max. Ladestrom |',
    '|---|---|---:|',
    '| 3S | 12,6 V | 15 A |',
    '| 4S | 16,8 V | 11,2 A |',
    '| 5S | 21,0 V | 9,0 A |',
    '| 6S | 25,2 V | 7,5 A |',
    '| 7S | 29,4 V | 6,4 A |',
    '| 8S | 33,6 V | 5,6 A |',
    '_Faustregel: max. Ladestrom = 45 ÷ Zellenzahl (für LiPo mit 4,2 V je Zelle). Die Werte gelten für alle Ladegeräte an einer Sicherung zusammen._',
  ].join('\n');
}

// Textersetzungen für bereits angelegte Abschnitte (nur wenn die alte Zeile noch unverändert drinsteht)
var TECHNIK_ERSETZUNGEN = {
  TECHNIK_PUFFER: [
    ['- Pufferbatterie, wird über den DC-DC-Wandler vom Bluetti nachgeladen', '- **Pufferbatterie:** LiFePO₄, 12,8 V, 100 Ah (rund 1.280 Wh), wird über den DC-DC-Wandler vom Bluetti nachgeladen'],
    ['- versorgt die Ladesteckdosen an zwei Tischen, abgesichert mit **15 A**\n', '- versorgt die Ladesteckdosen an zwei Tischen, abgesichert mit **15 A** (bei 12,8 V rund 190 W)\n'],
    ['- _Bitte ergänzen: Typ und Kapazität der Pufferbatterie, Typ des DC-DC-Wandlers._', '- _Bitte ergänzen: Typ des DC-DC-Wandlers._'],
  ],
  TECHNIK_LADETABELLE: [
    ['- Löst die Sicherung aus: Ladegeräte abstecken, Sicherung wieder einschalten, Geräte einzeln wieder anstecken.', '- Löst die Sicherung aus: Ladegeräte abstecken, Sicherung wieder einschalten, Geräte einzeln wieder anstecken.\n## Erlaubter Ladestrom\nDie 12-V-Ladesteckdosen sind mit 15 A abgesichert. Das reicht für rund 190 W Ladeleistung. Je mehr Zellen der Akku hat, desto kleiner muss der Ladestrom sein:\n| Akku | Ladeschluss | max. Ladestrom |\n|---|---|---:|\n| 3S | 12,6 V | 15 A |\n| 4S | 16,8 V | 11,2 A |\n| 5S | 21,0 V | 9,0 A |\n| 6S | 25,2 V | 7,5 A |\n| 7S | 29,4 V | 6,4 A |\n| 8S | 33,6 V | 5,6 A |\n_Faustregel: max. Ladestrom = 45 ÷ Zellenzahl (für LiPo mit 4,2 V je Zelle). Die Werte gelten für alle Ladegeräte an einer Sicherung zusammen._'],
  ],
  TECHNIK_KUEHLSCHRANK: [
    ['- RTK-Antenne\n## An den Tischen', '- RTK-Antenne\n- Kühlschrank\n## An den Tischen'],
  ],
};

function technikErsetzen_(liste) {
  var props = PropertiesService.getScriptProperties();
  var geaendert = false;
  Object.keys(TECHNIK_ERSETZUNGEN).forEach(function (flag) {
    if (props.getProperty(flag)) return;
    mitSperre_(function () {
      if (props.getProperty(flag)) return;
      liste.forEach(function (x) {
        var neu = String(x.text || '');
        TECHNIK_ERSETZUNGEN[flag].forEach(function (e) { neu = neu.split(e[0]).join(e[1]); });
        if (neu !== x.text) {
          aktualisiereZeile_('Technik', 'id', x.id, function (r) {
            var j = JSON.parse(r.json); j.text = neu; j.geaendert = new Date().toISOString();
            r.json = JSON.stringify(j); return r;
          });
          geaendert = true;
        }
      });
      props.setProperty(flag, 'true');
    });
  });
  return geaendert;
}

/** Einmalige Ergänzungen für bereits angelegte Technik-Blätter */
function technikMigrieren_(liste) {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty('TECHNIK_STROM')) return technikErsetzen_(liste);
  mitSperre_(function () {
    if (props.getProperty('TECHNIK_STROM')) return;
    var wetter = liste.filter(function (a) { return a.grafik === 'wetterstation'; })[0];
    var a = technikStrom_();
    a.id = 't' + Utilities.getUuid().slice(0, 8);
    a.bilder = [];
    a.geaendert = new Date().toISOString();
    zeileAnhaengen_('Technik', [a.id, wetter ? wetter.reihenfolge + 0.5 : 0.5, JSON.stringify(a)]);
    liste.forEach(function (x) {
      if (x.titel === 'Ladesteckdosen' && String(x.text).indexOf(TECHNIK_LADE_ALT) === 0) {
        aktualisiereZeile_('Technik', 'id', x.id, function (r) {
          var j = JSON.parse(r.json); j.text = technikLadeText_(); j.geaendert = new Date().toISOString();
          r.json = JSON.stringify(j); return r;
        });
      }
    });
    props.setProperty('TECHNIK_STROM', 'true');
  });
  // neuer Abschnitt hat schon den aktuellen Text – Ersetzungen als erledigt markieren
  Object.keys(TECHNIK_ERSETZUNGEN).forEach(function (f) { props.setProperty(f, 'true'); });
  return true;
}

function technikAlle_() {
  var zeilen = zeilen_('Technik');
  if (!zeilen.length && !prop_('TECHNIK_ANGELEGT')) {
    mitSperre_(function () {
      if (zeilen_('Technik').length) return;
      technikStandard_().forEach(function (a, i) {
        a.id = 't' + Utilities.getUuid().slice(0, 8);
        a.bilder = [];
        a.geaendert = new Date().toISOString();
        zeileAnhaengen_('Technik', [a.id, i + 1, JSON.stringify(a)]);
      });
      PropertiesService.getScriptProperties().setProperty('TECHNIK_ANGELEGT', 'true');
      PropertiesService.getScriptProperties().setProperty('TECHNIK_STROM', 'true');
      Object.keys(TECHNIK_ERSETZUNGEN).forEach(function (f) { PropertiesService.getScriptProperties().setProperty(f, 'true'); });
    });
    zeilen = zeilen_('Technik');
  }
  var lies = function (z) {
    return z.map(function (r) { var a = JSON.parse(r.json); a.reihenfolge = Number(r.reihenfolge) || 0; return a; })
      .sort(function (a, b) { return a.reihenfolge - b.reihenfolge; });
  };
  var liste = lies(zeilen);
  if (technikMigrieren_(liste)) liste = lies(zeilen_('Technik'));
  return liste;
}

function technikListe_(d, s) {
  return technikAlle_().filter(function (a) { return s || !a.nurMitglieder; });
}

function technikOrdner_() {
  var id = prop_('TECHNIK_ORDNER_ID');
  if (id) return DriveApp.getFolderById(id);
  var eltern = DriveApp.getFileById(prop_('SHEET_ID', true)).getParents();
  var basis = eltern.hasNext() ? eltern.next() : DriveApp.getRootFolder();
  var vorhanden = basis.getFoldersByName('Technik (App)');
  var ordner = vorhanden.hasNext() ? vorhanden.next() : basis.createFolder('Technik (App)');
  PropertiesService.getScriptProperties().setProperty('TECHNIK_ORDNER_ID', ordner.getId());
  return ordner;
}

function technikSpeichern_(d, s) {
  var titel = String(d.titel || '').trim().slice(0, 60);
  if (!titel) throw fehler_('Bitte einen Titel angeben', 400);
  var alle = technikAlle_();
  var alt = d.id ? alle.filter(function (a) { return a.id === d.id; })[0] : null;
  if (d.id && !alt) throw fehler_('Abschnitt nicht gefunden', 404);
  var bilder = alt ? (alt.bilder || []).slice() : [];
  if (d.entfernteBilder) bilder = bilder.filter(function (b) { return d.entfernteBilder.indexOf(b) < 0; });
  (d.neueBilder || []).slice(0, Math.max(0, 6 - bilder.length)).forEach(function (b64, i) {
    var datei = technikOrdner_().createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'image/jpeg', 'technik_' + Date.now() + '_' + i + '.jpg'));
    datei.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    bilder.push('https://drive.google.com/thumbnail?id=' + datei.getId() + '&sz=w1600');
  });
  var a = {
    id: alt ? alt.id : 't' + Utilities.getUuid().slice(0, 8),
    titel: titel,
    icon: String(d.icon || (alt && alt.icon) || 'zahnrad').slice(0, 20),
    grafik: TECHNIK_GRAFIKEN.indexOf(d.grafik) >= 0 ? d.grafik : '',
    nurMitglieder: d.nurMitglieder === true,
    text: String(d.text || '').slice(0, 8000),
    bilder: bilder,
    geaendert: new Date().toISOString(),
    geaendertVon: s.name,
  };
  var reihenfolge = alt ? alt.reihenfolge : alle.reduce(function (m, x) { return Math.max(m, x.reihenfolge); }, 0) + 1;
  mitSperre_(function () {
    if (alt) aktualisiereZeile_('Technik', 'id', a.id, function (r) { r.json = JSON.stringify(a); return r; });
    else zeileAnhaengen_('Technik', [a.id, reihenfolge, JSON.stringify(a)]);
  });
  return technikListe_(d, s);
}

function technikLoeschen_(d, s) {
  mitSperre_(function () { loescheZeilen_('Technik', function (x) { return x.id === d.id; }); });
  return technikListe_(d, s);
}

/** Reihenfolge: d.ids = alle IDs in der neuen Reihenfolge */
function technikSortieren_(d, s) {
  var ids = (d.ids || []).map(String);
  mitSperre_(function () {
    ids.forEach(function (id, i) {
      aktualisiereZeile_('Technik', 'id', id, function (r) { r.reihenfolge = i + 1; return r; });
    });
  });
  return technikListe_(d, s);
}

// =====================================================================
// Rabenschreck (Schaltausgang der Wetterstation, nur Admins)
// =====================================================================

/** Status aus der Fernsteuerungsseite lesen: true = aktiv, false = aus, null = unbekannt */
function rabenschreckParsen(html) {
  var m = String(html || '').match(/Status Rabenschreck:\s*<strong>\s*([^<]+?)\s*<\/strong>/i);
  if (!m) return null;
  return /aktiv|an|ein/i.test(m[1]) && !/^aus$/i.test(m[1]);
}

/** Im Editor ausführen, um die Verbindung zur Fernsteuerung zu prüfen (gibt kein Passwort aus). */
function diagnoseRabenschreck() {
  var basis = (prop_('RABENSCHRECK_URL') || 'http://mgi-ism.ddns.net/').replace(/\/+$/, '');
  var user = prop_('RABENSCHRECK_USER') || '';
  console.log('URL: ' + basis + '/ · Benutzer gesetzt: ' + (user ? 'ja (' + user.length + ' Zeichen)' : 'nein') + ' · Passwort gesetzt: ' + (prop_('RABENSCHRECK_PASS') ? 'ja' : 'nein'));
  try {
    var res = UrlFetchApp.fetch(basis + '/', {
      muteHttpExceptions: true, followRedirects: false,
      headers: { Authorization: 'Basic ' + Utilities.base64Encode(user + ':' + (prop_('RABENSCHRECK_PASS') || '')) },
    });
    console.log('HTTP ' + res.getResponseCode() + ' · ' + res.getContentText().replace(/\s+/g, ' ').slice(0, 300));
  } catch (e) {
    console.log('Fehler: ' + e.message);
  }
  console.log('Ergebnis App: ' + JSON.stringify(rabenschreck_('')));
}

/** pfad '' = nur Status lesen, 'led1on'/'led1off' = schalten */
function rabenschreck_(pfad) {
  var basis = (prop_('RABENSCHRECK_URL') || 'http://mgi-ism.ddns.net/').replace(/\/+$/, '');
  var user = prop_('RABENSCHRECK_USER');
  var pass = prop_('RABENSCHRECK_PASS');
  if (!user || !pass) return { eingerichtet: false, erreichbar: false, aktiv: null };
  var opts = {
    muteHttpExceptions: true, followRedirects: false,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(user + ':' + pass) },
  };
  try {
    var res = UrlFetchApp.fetch(basis + '/' + pfad, opts);
    var code = res.getResponseCode();
    if (code === 401) return { eingerichtet: true, erreichbar: true, aktiv: null, fehler: 'Benutzername oder Passwort der Fernsteuerung falsch' };
    if (code !== 200) return { eingerichtet: true, erreichbar: false, aktiv: null, fehler: 'Antwort ' + code };
    var aktiv = rabenschreckParsen(res.getContentText());
    if (pfad && aktiv !== (pfad === 'led1on')) return { eingerichtet: true, erreichbar: true, aktiv: aktiv, fehler: 'Schalten nicht bestätigt' };
    return { eingerichtet: true, erreichbar: true, aktiv: aktiv, zeit: new Date().toISOString() };
  } catch (e) {
    console.warn('Rabenschreck: ' + e.message);
    return { eingerichtet: true, erreichbar: false, aktiv: null, fehler: 'Fernsteuerung nicht erreichbar' };
  }
}

// =====================================================================
// Nachweise (Kenntnisnachweis, e-ID, Versicherung)
// =====================================================================

function nachweiseLesen_(d, s) {
  var r = zeilen_('Nachweise').filter(function (x) { return x.mitgliedId === s.mitgliedId; })[0];
  return r ? { kenntnisnachweis: datumStr_(r.kenntnisnachweis), eid: datumStr_(r.eid), versicherung: datumStr_(r.versicherung) } : {};
}

function datumStr_(v) {
  if (!v) return '';
  if (v instanceof Date) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  return String(v).slice(0, 10);
}

function nachweiseSpeichern_(d, s) {
  var ok = function (x) { return /^\d{4}-\d{2}-\d{2}$/.test(x || '') ? "'" + x : ''; }; // ' = als Text speichern
  mitSperre_(function () {
    var gef = aktualisiereZeile_('Nachweise', 'mitgliedId', s.mitgliedId, function (r) {
      r.name = s.name; r.kenntnisnachweis = ok(d.kenntnisnachweis); r.eid = ok(d.eid); r.versicherung = ok(d.versicherung); r.gemeldet = '';
      return r;
    });
    if (!gef) zeileAnhaengen_('Nachweise', [s.mitgliedId, s.name, ok(d.kenntnisnachweis), ok(d.eid), ok(d.versicherung), '']);
  });
  return nachweiseLesen_(d, s);
}

function nachweisErinnerungen_() {
  var heute = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var namen = { kenntnisnachweis: 'Kenntnisnachweis', eid: 'e-ID-Registrierung', versicherung: 'Versicherung' };
  zeilen_('Nachweise').forEach(function (r) {
    var gemeldet = String(r.gemeldet || '').split(',');
    var neu = gemeldet.slice();
    Object.keys(namen).forEach(function (k) {
      var ablauf = datumStr_(r[k]);
      if (!ablauf) return;
      var tage = Math.round((lokalMs_(ablauf + 'T00:00:00') - lokalMs_(heute + 'T00:00:00')) / 86400000);
      [30, 7, 0].forEach(function (grenze) {
        var marke = k + ':' + ablauf + ':' + grenze;
        if (tage <= grenze && tage >= grenze - 6 && gemeldet.indexOf(marke) < 0) {
          var text = tage > 0 ? 'läuft in ' + tage + ' Tagen ab (' + ablauf.split('-').reverse().join('.') + ')' : tage === 0 ? 'läuft heute ab' : 'ist abgelaufen';
          pushSenden_('nachweise', namen[k], 'Dein ' + namen[k] + ' ' + text + '.', '#/nachweise', null, r.mitgliedId);
          neu.push(marke);
        }
      });
    });
    if (neu.length !== gemeldet.length) {
      aktualisiereZeile_('Nachweise', 'mitgliedId', r.mitgliedId, function (x) { x.gemeldet = neu.filter(String).join(','); return x; });
    }
  });
}

// =====================================================================
// Arbeitsdienst (Liste in eigener Google-Tabelle)
// Mitglieder tragen sich in der App ein; austragen dürfen nur Admins.
// =====================================================================

/**
 * Tabellenwerte -> Liste der Wochen.
 * Spalten: Kalenderwoche | Zeitraum "30.03.–05.04.2026" | Einsatz | Person 1 | Person 2 …
 * Zeilen ohne Kalenderwoche gehören zur Woche darüber (weitere Einsätze).
 * Jede Zeile einer Woche ist ein Einsatz mit eigenen Plätzen (Spalten „Person …“).
 */
function arbeitslisteParsen(werte, jahrStandard) {
  var liste = [];
  var akt = null;
  var spalten = [3, 4];
  (werte || []).forEach(function (zeile, i) {
    var z = zeile.map(function (v) { return String(v == null ? '' : v).trim(); });
    if (i === 0 && !/^KW\s*\d/i.test(z[0])) { // Kopfzeile
      var ps = [];
      z.forEach(function (k, j) { if (/^person/i.test(k)) ps.push(j); });
      if (ps.length) spalten = ps;
      return;
    }
    if (/^KW\s*\d+/i.test(z[0])) {
      var zr = zeitraumParsen_(z[1], jahrStandard);
      if (!zr) { akt = null; return; }
      akt = { kw: z[0].replace(/\s+/g, '').toUpperCase(), von: zr.von, bis: zr.bis, einsaetze: [], personen: [], zeilen: [] };
      liste.push(akt);
    } else if (z[0]) {
      akt = null; // anderer Inhalt (z. B. Erläuterungen) beendet die Woche
      return;
    }
    if (!akt) return;
    if (!z[2] && spalten.every(function (j) { return !z[j]; })) return; // Leerzeile
    var plaetze = spalten.map(function (j) { return z[j] || ''; });
    akt.zeilen.push({ zeile: i + 1, einsatz: z[2] || 'Arbeitsdienst', plaetze: plaetze, spalten: spalten.map(function (j) { return j + 1; }) });
    if (z[2]) z[2].split(';').forEach(function (e) { e = e.trim(); if (e && akt.einsaetze.indexOf(e) < 0) akt.einsaetze.push(e); });
    plaetze.forEach(function (p) { if (p && akt.personen.indexOf(p) < 0) akt.personen.push(p); });
  });
  return liste;
}

function zeitraumParsen_(t, jahrStandard) {
  var m = String(t || '').match(/(\d{1,2})\.(\d{1,2})\.?(\d{4})?\s*[–—-]\s*(\d{1,2})\.(\d{1,2})\.?(\d{4})?/);
  if (!m) return null;
  var jb = Number(m[6] || m[3] || jahrStandard);
  var jv = Number(m[3] || (Number(m[2]) > Number(m[5]) ? jb - 1 : jb));
  var f = function (j, mo, ta) { return j + '-' + ('0' + mo).slice(-2) + '-' + ('0' + ta).slice(-2); };
  return { von: f(jv, m[2], m[1]), bis: f(jb, m[5], m[4]) };
}

function namenNorm_(n) {
  return String(n || '').toLowerCase().replace(/[.,;()]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Ordnet einen eingetragenen Namen einem Mitglied zu (voller Name oder eindeutiger Nachname). */
function personZuMitglied(name, mitglieder) {
  var n = namenNorm_(name);
  if (!n) return null;
  var aktive = mitglieder.filter(function (m) { return String(m.aktiv) === 'true'; });
  var voll = aktive.filter(function (m) {
    var v = namenNorm_(m.vorname), na = namenNorm_(m.nachname);
    return n === v + ' ' + na || n === na + ' ' + v;
  });
  if (voll.length === 1) return voll[0].id;
  var nach = aktive.filter(function (m) { return namenNorm_(m.nachname) === n; });
  if (nach.length === 1) return nach[0].id;
  // „J. Rodler“ oder „Joachim R.“
  var teile = n.split(' ');
  if (teile.length === 2) {
    var kurz = aktive.filter(function (m) {
      var v = namenNorm_(m.vorname), na = namenNorm_(m.nachname);
      return (teile[1] === na && v.indexOf(teile[0]) === 0) || (teile[0] === v && na.indexOf(teile[1]) === 0);
    });
    if (kurz.length === 1) return kurz[0].id;
  }
  return null;
}

function arbeitslisteTabelle_() {
  var ss = SpreadsheetApp.openById(prop_('ARBEITSLISTE_ID') || ARBEITSLISTE_STANDARD_ID);
  var jahr = Number((String(ss.getName()).match(/20\d\d/) || [Utilities.formatDate(new Date(), TZ, 'yyyy')])[0]);
  return { ss: ss, sh: ss.getSheets()[0], jahr: jahr };
}

function arbeitslisteFrisch_() {
  var t = arbeitslisteTabelle_();
  var liste = arbeitslisteParsen(t.sh.getDataRange().getDisplayValues(), t.jahr);
  try { CacheService.getScriptCache().put('arbeitsliste', JSON.stringify(liste), 600); } catch (e) { /* zu groß */ }
  return liste;
}

function arbeitsliste_() {
  var c = CacheService.getScriptCache().get('arbeitsliste');
  return c ? JSON.parse(c) : arbeitslisteFrisch_();
}

/** Einsätze einer Woche, in denen das Mitglied eingetragen ist */
function meineEinsaetze_(w, mitgliedId, mitglieder) {
  return w.zeilen.filter(function (z) {
    return z.plaetze.some(function (p) { return p && personZuMitglied(p, mitglieder) === mitgliedId; });
  }).map(function (z) { return z.einsatz; });
}

/** Die nächsten Arbeitsdienst-Wochen des angemeldeten Mitglieds (laufende Woche eingeschlossen). */
function arbeitsdienstMeine_(d, s) {
  var heute = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var mitglieder = zeilen_('Mitglieder');
  var erg = [];
  arbeitsliste_().forEach(function (w) {
    if (w.bis < heute || erg.length >= 3) return;
    var e = meineEinsaetze_(w, s.mitgliedId, mitglieder);
    if (e.length) erg.push({ kw: w.kw, von: w.von, bis: w.bis, einsaetze: e });
  });
  return erg;
}

/** Ganze Liste für die App-Seite: Einsätze mit Plätzen (Name, ob ich, ob frei) */
function arbeitsdienstListe_(d, s, frisch) {
  var heute = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var mitglieder = zeilen_('Mitglieder');
  var liste = frisch || arbeitsliste_();
  var erg = {
    wochen: liste.map(function (w) {
      return {
        kw: w.kw, von: w.von, bis: w.bis, vorbei: w.bis < heute,
        einsaetze: w.zeilen.map(function (z) {
          return {
            zeile: z.zeile, einsatz: z.einsatz,
            plaetze: z.plaetze.map(function (p) { return p ? { name: p, ich: personZuMitglied(p, mitglieder) === s.mitgliedId } : null; }),
          };
        }),
      };
    }),
  };
  if (s.rolle === 'admin') {
    try { erg.tabelle = arbeitslisteTabelle_().ss.getUrl(); } catch (e) { /* egal */ }
  }
  return erg;
}

/** Mitglied trägt sich selbst in einen freien Platz ein – verbindlich (austragen nur Admins) */
function arbeitsdienstEintragen_(d, s) {
  var m = mitgliedNachId_(s.mitgliedId);
  var name = m ? (m.vorname + ' ' + m.nachname).trim() : s.name;
  var heute = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var frisch;
  mitSperre_(function () {
    var t = arbeitslisteTabelle_();
    var liste = arbeitslisteParsen(t.sh.getDataRange().getDisplayValues(), t.jahr);
    var woche = null, zeile = null;
    liste.forEach(function (w) { w.zeilen.forEach(function (z) { if (z.zeile === Number(d.zeile)) { woche = w; zeile = z; } }); });
    if (!zeile || (d.kw && woche.kw !== d.kw)) throw fehler_('Die Liste wurde inzwischen geändert – bitte neu laden', 409);
    if (woche.bis < heute) throw fehler_('Diese Woche ist schon vorbei', 400);
    var mitglieder = zeilen_('Mitglieder');
    if (zeile.plaetze.some(function (p) { return p && personZuMitglied(p, mitglieder) === s.mitgliedId; })) throw fehler_('Du bist hier schon eingetragen', 400);
    var frei = zeile.plaetze.indexOf('');
    if (frei < 0) throw fehler_('Leider schon voll – such dir einen anderen Termin aus', 409);
    t.sh.getRange(zeile.zeile, zeile.spalten[frei]).setValue(name);
    SpreadsheetApp.flush();
    zeile.plaetze[frei] = name;
    frisch = liste;
    try { CacheService.getScriptCache().put('arbeitsliste', JSON.stringify(liste), 600); } catch (e) { /* zu groß */ }
  });
  return arbeitsdienstListe_(d, s, frisch);
}

/** Nur Admins: einen Eintrag wieder entfernen */
function arbeitsdienstAustragen_(d, s) {
  var frisch;
  mitSperre_(function () {
    var t = arbeitslisteTabelle_();
    var liste = arbeitslisteParsen(t.sh.getDataRange().getDisplayValues(), t.jahr);
    var zeile = null;
    liste.forEach(function (w) { w.zeilen.forEach(function (z) { if (z.zeile === Number(d.zeile)) zeile = z; }); });
    var platz = Number(d.platz);
    if (!zeile || !zeile.plaetze[platz] || (d.name && zeile.plaetze[platz] !== d.name)) throw fehler_('Die Liste wurde inzwischen geändert – bitte neu laden', 409);
    t.sh.getRange(zeile.zeile, zeile.spalten[platz]).setValue('');
    SpreadsheetApp.flush();
    zeile.plaetze[platz] = '';
    frisch = liste;
    try { CacheService.getScriptCache().put('arbeitsliste', JSON.stringify(liste), 600); } catch (e) { /* zu groß */ }
  });
  return arbeitsdienstListe_(d, s, frisch);
}

/** Täglich: 7 Tage vorher und am Montag der Woche erinnern (jeweils einmal). */
function arbeitsdienstErinnerungen_() {
  if (!prop_('FCM_SERVICE_ACCOUNT')) return; // ohne Push nichts zu tun (Hinweis auf der Startseite gibt es trotzdem)
  var props = PropertiesService.getScriptProperties();
  var gemeldet = [];
  try { gemeldet = JSON.parse(props.getProperty('ARBEITSDIENST_GEMELDET') || '[]'); } catch (e) { gemeldet = []; }
  var heute = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  var heuteMs = lokalMs_(heute + 'T00:00:00');
  var mitglieder = zeilen_('Mitglieder');
  var neu = gemeldet.slice();
  arbeitslisteFrisch_().forEach(function (w) {
    var tage = Math.round((lokalMs_(w.von + 'T00:00:00') - heuteMs) / 86400000);
    var zeit = w.von.split('-').reverse().join('.').slice(0, 6) + '–' + w.bis.split('-').reverse().join('.');
    [7, 0].forEach(function (grenze) {
      if (tage > grenze || tage < grenze - 6) return;
      var ids = {};
      w.personen.forEach(function (p) {
        var id = personZuMitglied(p, mitglieder);
        if (!id) console.warn('Arbeitsdienst: „' + p + '“ keinem Mitglied zugeordnet');
        else ids[id] = true;
      });
      Object.keys(ids).forEach(function (id) {
        var marke = w.kw + ':' + w.von + ':' + grenze + ':' + id;
        if (neu.indexOf(marke) >= 0) return;
        var was = meineEinsaetze_(w, id, mitglieder).join(', ') || 'Arbeitsdienst';
        var text = grenze === 7
          ? 'Nächste Woche (' + w.kw + ', ' + zeit + ') bist du für den Arbeitsdienst eingetragen: ' + was + '.'
          : 'Diese Woche (' + w.kw + ', ' + zeit + ') hast du Arbeitsdienst: ' + was + '. Danke!';
        pushSenden_('arbeitsdienst', 'Arbeitsdienst', text, '#/arbeitsdienst', null, id);
        neu.push(marke);
      });
    });
  });
  // nur Marken der letzten Monate behalten
  var grenzeAlt = Utilities.formatDate(new Date(Date.now() - 90 * 86400000), TZ, 'yyyy-MM-dd');
  neu = neu.filter(function (m) { return (m.split(':')[1] || '') >= grenzeAlt; });
  if (JSON.stringify(neu) !== JSON.stringify(gemeldet)) props.setProperty('ARBEITSDIENST_GEMELDET', JSON.stringify(neu));
}

// =====================================================================
// Push-Nachrichten (Firebase Cloud Messaging, HTTP v1)
// =====================================================================

function pushAbo_(d, s) {
  if (!d.fcmToken) throw fehler_('Kein Push-Token', 400);
  var einst = JSON.stringify(d.einstellungen || {});
  mitSperre_(function () {
    var gef = aktualisiereZeile_('PushAbos', 'fcmToken', d.fcmToken, function (r) { r.mitgliedId = s.mitgliedId; r.einstellungen = einst; return r; });
    if (!gef) zeileAnhaengen_('PushAbos', [d.fcmToken, s.mitgliedId, einst, new Date().toISOString()]);
  });
  return true;
}

function pushAboLoeschen_(d) {
  if (d.fcmToken) mitSperre_(function () { loescheZeilen_('PushAbos', function (r) { return r.fcmToken === d.fcmToken; }); });
  return true;
}

function mitteilungSenden_(d) {
  var titel = String(d.titel || '').trim();
  if (!titel) throw fehler_('Titel fehlt', 400);
  var n = pushSenden_('mitteilungen', titel, String(d.text || ''), '#/');
  return { gesendet: n };
}

/**
 * Sendet eine Push-Nachricht an alle Abos, die den Anlass eingeschaltet haben.
 * ausser: Mitglied-ID, die nichts bekommt (z. B. Verfasser); nur: nur an dieses Mitglied.
 */
/** Push nur an Admins (z. B. neue Zugangsanfrage) */
function pushAnAdmins_(titel, text, pfad) {
  var admins = zeilen_('Mitglieder').filter(function (m) { return m.rolle === 'admin' && String(m.aktiv) === 'true'; }).map(function (m) { return m.id; });
  return pushSenden_('anfragen', titel, text, pfad, null, admins);
}

function pushSenden_(anlass, titel, text, pfad, ausser, nur) {
  var sa = prop_('FCM_SERVICE_ACCOUNT');
  if (!sa) return 0;
  var konto = JSON.parse(sa);
  var zugriff = fcmZugriffstoken_(konto);
  var appUrl = prop_('APP_URL') || '';
  var ungueltig = [];
  var gesendet = 0;
  zeilen_('PushAbos').forEach(function (r) {
    if (ausser && r.mitgliedId === ausser) return;
    if (nur && (Array.isArray(nur) ? nur.indexOf(r.mitgliedId) < 0 : r.mitgliedId !== nur)) return;
    var e = {};
    try { e = JSON.parse(r.einstellungen || '{}'); } catch (x) { /* leer */ }
    if (e[anlass] === false) return;
    var nachricht = {
      message: {
        token: r.fcmToken,
        data: { titel: titel, text: text, url: appUrl + pfad, anlass: anlass },
        webpush: { headers: { Urgency: anlass === 'mitteilungen' ? 'high' : 'normal', TTL: '86400' } },
      },
    };
    var res = UrlFetchApp.fetch('https://fcm.googleapis.com/v1/projects/' + konto.project_id + '/messages:send', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + zugriff },
      payload: JSON.stringify(nachricht),
      muteHttpExceptions: true,
    });
    var code = res.getResponseCode();
    if (code === 200) gesendet++;
    else if (code === 404 || code === 400) ungueltig.push(r.fcmToken);
    else console.warn('FCM ' + code + ': ' + res.getContentText().slice(0, 200));
  });
  if (ungueltig.length) loescheZeilen_('PushAbos', function (r) { return ungueltig.indexOf(r.fcmToken) >= 0; });
  return gesendet;
}

function fcmZugriffstoken_(konto) {
  var cache = CacheService.getScriptCache();
  var c = cache.get('fcm_token');
  if (c) return c;
  var jetzt = Math.floor(Date.now() / 1000);
  var b64 = function (o) { return Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, ''); };
  var kopf = b64({ alg: 'RS256', typ: 'JWT' });
  var inhalt = b64({
    iss: konto.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: jetzt,
    exp: jetzt + 3600,
  });
  var sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(kopf + '.' + inhalt, konto.private_key)).replace(/=+$/, '');
  var res = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    payload: { grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: kopf + '.' + inhalt + '.' + sig },
  });
  var token = JSON.parse(res.getContentText()).access_token;
  cache.put('fcm_token', token, 3000);
  return token;
}

// =====================================================================
// Wettbewerbe
// =====================================================================

function wertungsartenListe_() {
  return zeilen_('Wertungsarten').map(function (r) { return JSON.parse(r.json); });
}

function wertungsartSpeichern_(d) {
  if (!d.id || !d.name || !d.formel) throw fehler_('Name und Formel angeben', 400);
  if (!/^[a-z0-9_-]{2,40}$/.test(d.id)) throw fehler_('Ungültige ID', 400);
  var erg;
  mitSperre_(function () {
    var alt = zeilen_('Wertungsarten').filter(function (r) { return r.id === d.id; })[0];
    var version = alt ? (JSON.parse(alt.json).version || 1) + 1 : 1;
    erg = JSON.parse(JSON.stringify(d));
    erg.version = version;
    erg.geaendert = new Date().toISOString();
    if (alt) aktualisiereZeile_('Wertungsarten', 'id', d.id, function (r) { r.json = JSON.stringify(erg); return r; });
    else zeileAnhaengen_('Wertungsarten', [d.id, JSON.stringify(erg)]);
  });
  return erg;
}

function wertungsartLoeschen_(d) {
  mitSperre_(function () { loescheZeilen_('Wertungsarten', function (r) { return r.id === d.id; }); });
  return true;
}

function wettbewerbeListe_() {
  return zeilen_('Wettbewerbe').map(function (r) {
    var w = JSON.parse(r.json);
    return { id: w.id, name: w.name, datum: w.datum, artName: w.art.name, status: w.status, teilnehmer: w.teilnehmer.length };
  }).sort(function (a, b) { return b.datum.localeCompare(a.datum); });
}

function wettbewerbLesen_(d) {
  var r = zeilen_('Wettbewerbe').filter(function (x) { return x.id === d.id; })[0];
  if (!r) throw fehler_('Wettbewerb nicht gefunden', 404);
  var wertungen = zeilen_('Wertungen').filter(function (x) { return x.wettbewerbId === d.id; }).map(function (x) { return JSON.parse(x.json); });
  return { wettbewerb: JSON.parse(r.json), wertungen: wertungen };
}

function wettbewerbSpeichern_(d) {
  if (!d.name || !d.art) throw fehler_('Name und Wertungsart angeben', 400);
  var w;
  var abgeschlossen = false;
  mitSperre_(function () {
    var alt = d.id ? zeilen_('Wettbewerbe').filter(function (r) { return r.id === d.id; })[0] : null;
    var altW = alt ? JSON.parse(alt.json) : null;
    w = JSON.parse(JSON.stringify(d));
    if (!altW) {
      w.id = 'w' + Utilities.getUuid().slice(0, 8);
      w.erstellt = new Date().toISOString();
      w.status = 'offen';
    }
    w.teilnehmer = (w.teilnehmer || []).map(function (t) { return { id: t.id || 't' + Utilities.getUuid().slice(0, 6), name: t.name, klasse: t.klasse || '' }; });
    abgeschlossen = altW && altW.status !== 'abgeschlossen' && w.status === 'abgeschlossen';
    if (alt) aktualisiereZeile_('Wettbewerbe', 'id', w.id, function (r) { r.json = JSON.stringify(w); return r; });
    else zeileAnhaengen_('Wettbewerbe', [w.id, JSON.stringify(w)]);
  });
  if (abgeschlossen) pushSenden_('ergebnisse', 'Ergebnisse: ' + w.name, 'Die Rangliste ist fertig.', '#/wettbewerbe/' + w.id);
  return w;
}

function wettbewerbLoeschen_(d) {
  mitSperre_(function () {
    loescheZeilen_('Wettbewerbe', function (r) { return r.id === d.id; });
    loescheZeilen_('Wertungen', function (r) { return r.wettbewerbId === d.id; });
  });
  return true;
}

function wertungSpeichern_(d, s) {
  if (!d.wettbewerbId || !d.teilnehmerId || !d.durchgang || !d.eingabe) throw fehler_('Unvollständige Wertung', 400);
  var w = {
    id: d.wettbewerbId + '_' + d.teilnehmerId + '_' + d.durchgang,
    wettbewerbId: d.wettbewerbId,
    teilnehmerId: d.teilnehmerId,
    durchgang: Number(d.durchgang),
    eingabe: d.eingabe,
    richter: s.name,
    zeit: new Date().toISOString(),
  };
  mitSperre_(function () {
    var gef = aktualisiereZeile_('Wertungen', 'id', w.id, function (r) { r.json = JSON.stringify(w); return r; });
    if (!gef) zeileAnhaengen_('Wertungen', [w.id, w.wettbewerbId, JSON.stringify(w)]);
  });
  return w;
}

function wertungLoeschen_(d) {
  mitSperre_(function () { loescheZeilen_('Wertungen', function (r) { return r.id === d.id; }); });
  return true;
}

// =====================================================================
// Hilfsfunktionen: Tabelle
// =====================================================================

var _ss = null;
function blatt_(name) {
  if (!_ss) _ss = SpreadsheetApp.openById(prop_('SHEET_ID', true));
  var sh = _ss.getSheetByName(name);
  if (!sh && BLAETTER[name]) {
    // neue Blätter (z. B. nach einem Update) automatisch anlegen
    sh = _ss.insertSheet(name);
    sh.appendRow(BLAETTER[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, BLAETTER[name].length).setFontWeight('bold');
  }
  if (!sh) throw new Error('Tabellenblatt "' + name + '" fehlt – bitte setup() ausführen');
  spaltenErgaenzen_(sh, name);
  return sh;
}

var _spaltenGeprueft = {};
/** Neue Spalten aus BLAETTER (nach einem Update) hinten an bestehende Blätter anhängen */
function spaltenErgaenzen_(sh, name) {
  if (_spaltenGeprueft[name] || !BLAETTER[name]) return;
  _spaltenGeprueft[name] = true;
  var breite = sh.getLastColumn();
  var kopf = breite ? sh.getRange(1, 1, 1, breite).getValues()[0].map(String) : [];
  BLAETTER[name].forEach(function (k) {
    if (kopf.indexOf(k) < 0) {
      kopf.push(k);
      sh.getRange(1, kopf.length).setValue(k);
      sh.getRange(1, kopf.length).setFontWeight('bold');
    }
  });
}

/**
 * Hängt eine Zeile an. Die Werte kommen in der Reihenfolge von BLAETTER[name],
 * geschrieben wird aber nach den tatsächlichen Spaltenüberschriften im Blatt –
 * so passt es auch, wenn Spalten später ergänzt oder in der Tabelle verschoben wurden.
 */
function zeileAnhaengen_(name, werte) {
  var sh = blatt_(name);
  var soll = BLAETTER[name];
  if (!soll) { sh.appendRow(werte); return; }
  var breite = sh.getLastColumn();
  var kopf = breite ? sh.getRange(1, 1, 1, breite).getValues()[0].map(String) : soll;
  var zeile = kopf.map(function () { return ''; });
  soll.forEach(function (k, i) {
    var j = kopf.indexOf(k);
    if (j >= 0 && i < werte.length) zeile[j] = werte[i] === undefined || werte[i] === null ? '' : werte[i];
  });
  sh.appendRow(zeile);
}

function zeilen_(name) {
  var sh = blatt_(name);
  var werte = sh.getDataRange().getValues();
  var kopf = werte.shift() || BLAETTER[name];
  return werte.map(function (z) {
    var o = {};
    kopf.forEach(function (k, i) { o[k] = z[i] instanceof Date ? z[i] : z[i] === '' ? '' : String(z[i]); });
    return o;
  });
}

/** Aktualisiert die erste Zeile mit spalte == wert. Gibt true zurück, wenn gefunden. */
function aktualisiereZeile_(name, spalte, wert, fn) {
  var sh = blatt_(name);
  var werte = sh.getDataRange().getValues();
  var kopf = werte[0];
  var idx = kopf.indexOf(spalte);
  for (var i = 1; i < werte.length; i++) {
    if (String(werte[i][idx]) === String(wert)) {
      var o = {};
      kopf.forEach(function (k, j) { o[k] = werte[i][j]; });
      var alt = {};
      kopf.forEach(function (k, j) { alt[k] = werte[i][j]; });
      var neu = fn(o);
      // Nur geänderte Zellen schreiben – sonst wandelt Google Tabellen Texte wie „06.11.2026“ oder „11:45“ in Datumswerte um
      kopf.forEach(function (k, j) {
        var v = neu[k] === undefined ? '' : neu[k];
        if (v !== alt[k]) sh.getRange(i + 1, j + 1).setValue(v);
      });
      return true;
    }
  }
  return false;
}

function loescheZeilen_(name, pruef) {
  var sh = blatt_(name);
  var werte = sh.getDataRange().getValues();
  var kopf = werte[0];
  for (var i = werte.length - 1; i >= 1; i--) {
    var o = {};
    kopf.forEach(function (k, j) { o[k] = werte[i][j] instanceof Date ? werte[i][j].toISOString() : String(werte[i][j]); });
    if (pruef(o)) sh.deleteRow(i + 1);
  }
}

function mitSperre_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw fehler_('Server ist gerade beschäftigt – bitte nochmal versuchen', 503);
  try { return fn(); } finally { lock.releaseLock(); }
}

// =====================================================================
// Sonstiges
// =====================================================================

function prop_(name, pflicht) {
  var v = PropertiesService.getScriptProperties().getProperty(name);
  if (pflicht && !v) throw new Error('Script Property "' + name + '" fehlt – siehe README');
  return v;
}

function oeffentlich_() {
  return String(prop_('OEFFENTLICH') || 'true') === 'true';
}

function fehler_(msg, status) {
  var e = new Error(msg);
  e.status = status || 400;
  return e;
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
