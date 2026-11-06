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
 *   BLUETTI_USER/_PASS    nur falls ENABLE_AUTH in der ESP32-Firmware aktiv ist
 *   THINGSPEAK_KANAL      Kanal-ID (optional, für das Verlaufsdiagramm)
 *   THINGSPEAK_READ_KEY   Read-API-Key (nur bei privatem Kanal)
 *   OEFFENTLICH           "true" = Kalender/Wetter/Webcam/Ergebnisse ohne Anmeldung
 *   ERSTER_ADMIN          "Vorname;Nachname;PIN" – wird bei setup() angelegt, danach löschen!
 *   FCM_SERVICE_ACCOUNT   JSON des Firebase-Service-Accounts (optional, für Push)
 *   APP_URL               Adresse der App (für Links in Push-Nachrichten)
 */

var TZ = 'Europe/Berlin';
var SITZUNG_TAGE = 30;
var MAX_FEHLVERSUCHE = 5;
var SPERRE_MIN = 10;
var HASH_RUNDEN = 300;

var BLAETTER = {
  Mitglieder: ['id', 'vorname', 'nachname', 'rolle', 'sparte', 'salt', 'hash', 'aktiv', 'erstellt'],
  Sitzungen: ['token', 'mitgliedId', 'ablauf'],
  Einstellungen: ['schluessel', 'wert'],
  Wertungsarten: ['id', 'json'],
  Wettbewerbe: ['id', 'json'],
  Wertungen: ['id', 'wettbewerbId', 'json'],
  CheckIns: ['mitgliedId', 'name', 'seit', 'flugleiter'],
  Brett: ['id', 'ablauf', 'json'],
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
  pin_zuruecksetzen: { recht: 'admin', fn: pinZuruecksetzen_ },
  // Infos
  start: { recht: 'offen', fn: start_ },
  termine: { recht: 'lesen', fn: function () { return termine_(); } },
  bluetti: { recht: 'lesen', fn: function () { return bluetti_(); } },
  bluetti_verlauf: { recht: 'lesen', fn: bluettiVerlauf_ },
  einstellungen: { recht: 'offen', fn: einstellungenLesen_ },
  einstellungen_speichern: { recht: 'admin', fn: einstellungenSpeichern_ },
  // Fotos
  foto_hochladen: { recht: 'mitglied', fn: fotoHochladen_ },
  // Am Platz
  anwesende: { recht: 'offen', fn: anwesende_ },
  checkin: { recht: 'mitglied', fn: checkin_ },
  checkout: { recht: 'mitglied', fn: checkout_ },
  // Schwarzes Brett
  brett_liste: { recht: 'mitglied', fn: brettListe_ },
  brett_speichern: { recht: 'mitglied', fn: brettSpeichern_ },
  brett_loeschen: { recht: 'mitglied', fn: brettLoeschen_ },
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
  aufraeumen_();
}

/** Stündlich: neue Termine melden, abgelaufene Check-ins entfernen */
function stuendlich() {
  try { neueTermineMelden_(); } catch (e) { console.error(e); }
  try { checkinsAufraeumen_(); } catch (e) { console.error(e); }
}

function aufraeumen_() {
  var jetzt = Date.now();
  loescheZeilen_('Sitzungen', function (r) { return Number(r.ablauf) < jetzt; });
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
  var ablauf = Date.now() + SITZUNG_TAGE * 86400000;
  blatt_('Sitzungen').appendRow([token, m.id, ablauf]);
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
  if (!s || Number(s.ablauf) < Date.now()) throw fehler_('Sitzung abgelaufen – bitte neu anmelden', 401);
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
  blatt_('Mitglieder').appendRow([id, vorname, nachname, rolle, sparte, salt, pinHash_(pin, salt), 'true', new Date().toISOString()]);
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
  }
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
// Einstellungen (Platzordnung, Notfall, Windgrenzen …)
// =====================================================================

var STANDARD_EINSTELLUNGEN = {
  platzordnung:
    '## Platzordnung\n\n_Noch nicht eingetragen. Ein Admin kann diesen Text unter „Verwaltung → Einstellungen“ bearbeiten._',
  notfallInfo: '- **Erste-Hilfe-Kasten:** _bitte eintragen_\n- **Feuerlöscher:** _bitte eintragen_',
  notfallKontakte: [],
  windGelb: 25,
  windRot: 40,
  datenschutzFoto:
    'Bitte nur Fotos hochladen, mit denen alle abgebildeten Personen einverstanden sind. Die Fotos erscheinen öffentlich auf der Vereins-Homepage.',
  checkinStunden: 4,
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
      if (!gefunden) blatt_('Einstellungen').appendRow([k, wert]);
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
  var basis = DriveApp.getFolderById(prop_('FOTO_ORDNER_ID', true));
  var ordner = unterordner_(unterordner_(basis, Utilities.formatDate(jetzt, TZ, 'yyyy')), Utilities.formatDate(jetzt, TZ, 'MM'));
  var titel = String(d.titel || '').trim().slice(0, 60);
  var name = Utilities.formatDate(jetzt, TZ, 'yyyy-MM-dd_HHmm') + '_' + kat + (titel ? '_' + dateiname_(titel) : '') + '.jpg';
  var blob = Utilities.newBlob(Utilities.base64Decode(d.base64), d.mimeType || 'image/jpeg', name);
  var datei = ordner.createFile(blob);
  datei.setDescription((titel ? titel + ' – ' : '') + 'Foto: ' + s.name);
  return { id: datei.getId(), name: name };
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
// Wer ist am Platz?
// =====================================================================

function anwesende_(d, s) {
  checkinsAufraeumen_();
  var liste = zeilen_('CheckIns').map(function (r) {
    return { mitgliedId: r.mitgliedId, name: r.name, seit: r.seit, flugleiter: String(r.flugleiter) === 'true' };
  });
  // Namen nur für angemeldete Mitglieder, öffentlich nur die Anzahl
  if (!s) return { anzahl: liste.length, flugleiter: liste.some(function (x) { return x.flugleiter; }), liste: [] };
  return { anzahl: liste.length, flugleiter: liste.some(function (x) { return x.flugleiter; }), liste: liste };
}

function checkinsAufraeumen_() {
  var stunden = Number(einstellungenLesen_().checkinStunden) || 4;
  var grenze = Date.now() - stunden * 3600000;
  loescheZeilen_('CheckIns', function (r) { return new Date(r.seit).getTime() < grenze; });
}

function checkin_(d, s) {
  mitSperre_(function () {
    loescheZeilen_('CheckIns', function (r) { return r.mitgliedId === s.mitgliedId; });
    blatt_('CheckIns').appendRow([s.mitgliedId, s.name, new Date().toISOString(), d.flugleiter ? 'true' : 'false']);
  });
  return anwesende_(d, s);
}

function checkout_(d, s) {
  mitSperre_(function () {
    loescheZeilen_('CheckIns', function (r) { return r.mitgliedId === s.mitgliedId; });
  });
  return anwesende_(d, s);
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
    else blatt_('Brett').appendRow([b.id, b.ablauf, JSON.stringify(b)]);
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
    if (!gef) blatt_('Nachweise').appendRow([s.mitgliedId, s.name, ok(d.kenntnisnachweis), ok(d.eid), ok(d.versicherung), '']);
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
// Push-Nachrichten (Firebase Cloud Messaging, HTTP v1)
// =====================================================================

function pushAbo_(d, s) {
  if (!d.fcmToken) throw fehler_('Kein Push-Token', 400);
  var einst = JSON.stringify(d.einstellungen || {});
  mitSperre_(function () {
    var gef = aktualisiereZeile_('PushAbos', 'fcmToken', d.fcmToken, function (r) { r.mitgliedId = s.mitgliedId; r.einstellungen = einst; return r; });
    if (!gef) blatt_('PushAbos').appendRow([d.fcmToken, s.mitgliedId, einst, new Date().toISOString()]);
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
    if (nur && r.mitgliedId !== nur) return;
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
    else blatt_('Wertungsarten').appendRow([d.id, JSON.stringify(erg)]);
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
    else blatt_('Wettbewerbe').appendRow([w.id, JSON.stringify(w)]);
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
    if (!gef) blatt_('Wertungen').appendRow([w.id, w.wettbewerbId, JSON.stringify(w)]);
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
  if (!sh) throw new Error('Tabellenblatt "' + name + '" fehlt – bitte setup() ausführen');
  return sh;
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
      var neu = fn(o);
      sh.getRange(i + 1, 1, 1, kopf.length).setValues([kopf.map(function (k) { return neu[k] === undefined ? '' : neu[k]; })]);
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
