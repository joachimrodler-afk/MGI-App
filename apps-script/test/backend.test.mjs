// Ablauf-Test des Apps-Script-Backends mit nachgebildeten Google-Diensten.
// Start: node apps-script/test/backend.test.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');

// ---------------------------------------------------------------- Mocks
function neueTabelle() {
  const blaetter = {};
  const sheet = (name) => {
    const rows = [];
    const sh = {
      name,
      rows,
      appendRow: (r) => rows.push(r.map((v) => (typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v))),
      setFrozenRows: () => {},
      getLastColumn: () => Math.max(0, ...rows.map((r) => r.length)),
      getRange: (r, c, nr, nc) => ({
        getValues: () => rows.slice(r - 1, r - 1 + (nr || 1)).map((z) => Array.from({ length: nc || 1 }, (_, i) => z[c - 1 + i] ?? '')),
        setFontWeight: () => {},
        setValue: (v) => { rows[r - 1][c - 1] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; },
        setValues: () => {},
      }),
      getDataRange: () => ({ getValues: () => { const w = Math.max(0, ...rows.map((r) => r.length)); return rows.map((r) => Array.from({ length: w }, (_, i) => r[i] ?? '')); } }),
      getLastRow: () => rows.length,
      deleteRow: (i) => rows.splice(i - 1, 1),
    };
    return sh;
  };
  return {
    getSheetByName: (n) => blaetter[n] || null,
    insertSheet: (n) => (blaetter[n] = sheet(n)),
    getUrl: () => 'https://docs.google.com/spreadsheets/d/TEST',
    blaetter,
  };
}

const tabelle = neueTabelle();
// Arbeitsliste (eigene Google-Tabelle, Werte wie angezeigt)
const alRows = [
  ['Kalenderwoche', 'Zeitraum', 'Einsatz', 'Person 1', 'Person 2'],
  ['KW13', '29.03.–04.04.2099', 'Platzpflege', '', ''],
  ['', '', 'Walzen', 'Ada Admin', ''],
  ['KW15', '12.04.–18.04.2099', 'Platzpflege', 'Max Voll', 'Moritz Voll'],
  ['', '', '', '', ''],
  ['Platzpflege', 'Mäharbeiten …', '', '', ''],
];
const alSheet = {
  getDataRange: () => ({ getDisplayValues: () => alRows.map((r) => r.slice()) }),
  getRange: (r, c) => ({ setValue: (v) => { alRows[r - 1][c - 1] = v; } }),
};
const arbeitstabelle = { getName: () => 'Arbeitsliste 2099', getUrl: () => 'https://docs.google.com/spreadsheets/d/AL', getSheets: () => [alSheet] };
const props = { SHEET_ID: 'x', OEFFENTLICH: 'true', ERSTER_ADMIN: 'Ada;Admin;654321' };
const cache = {};
const pad = (n) => String(n).padStart(2, '0');

const ctx = {
  console,
  SpreadsheetApp: { openById: (id) => (id === 'x' ? tabelle : arbeitstabelle), flush: () => {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: (k) => props[k] ?? null, setProperty: (k, v) => (props[k] = v) }) },
  CacheService: { getScriptCache: () => ({ get: (k) => cache[k] ?? null, put: (k, v) => (cache[k] = v), remove: (k) => delete cache[k] }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
  ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => ({ timeBased: () => ({ atHour: () => ({ everyDays: () => ({ inTimezone: () => ({ create: () => {} }) }) }), everyHours: () => ({ create: () => {} }) }) }) },
  ContentService: { createTextOutput: (t) => ({ setMimeType: () => t }), MimeType: { JSON: 'json' } },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    computeDigest: (_a, s) => [...crypto.createHash('sha256').update(String(s)).digest()].map((b) => (b > 127 ? b - 256 : b)),
    base64Encode: (b) => Buffer.from(b.map((x) => (x + 256) % 256)).toString('base64'),
    DigestAlgorithm: { SHA_256: 'sha256' },
    Charset: { UTF_8: 'utf8' },
    formatDate: (d, _tz, f) => {
      // vereinfacht: lokale Zeit des Testrechners
      const m = { yyyy: d.getFullYear(), MM: pad(d.getMonth() + 1), dd: pad(d.getDate()), HH: pad(d.getHours()), mm: pad(d.getMinutes()), ss: pad(d.getSeconds()) };
      return f.replace(/'([^']*)'/g, '$1').replace('XXX', '+01:00').replace(/yyyy|MM|dd|HH|mm|ss/g, (k) => m[k]);
    },
  },
  DriveApp: {},
  UrlFetchApp: {},
};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);

const rufe = (aktion, daten = {}, token) => {
  const out = JSON.parse(ctx.doPost({ postData: { contents: JSON.stringify({ aktion, token, daten }) } }));
  return JSON.parse(JSON.stringify(out));
};
const ok = (r) => { assert.ok(r.ok, r.fehler); return r.daten; };

// ---------------------------------------------------------------- Ablauf
ctx.setup();
assert.equal(tabelle.blaetter.Mitglieder.rows.length, 2, 'erster Admin angelegt');

const admin = ok(rufe('login', { name: 'Ada Admin', pin: '654321' }));
assert.equal(admin.rolle, 'admin');
assert.equal(admin.ablauf, 0, 'Anmeldung läuft nicht ab');

// Zugangsanfrage
ok(rufe('zugang_anfragen', { vorname: 'Klaus', nachname: 'Butz', nachricht: 'Flugmodell' }));
ok(rufe('zugang_anfragen', { vorname: 'Klaus', nachname: 'Butz' })); // doppelt -> keine zweite Anfrage
assert.equal(rufe('zugang_anfragen', { vorname: 'Ada', nachname: 'Admin' }).ok, false, 'bereits registriert');
assert.equal(rufe('anfragen_liste', {}).ok, false, 'nur für Admins');
const anfragen = ok(rufe('anfragen_liste', {}, admin.token));
assert.equal(anfragen.length, 1);
const frei = ok(rufe('anfrage_freigeben', { id: anfragen[0].id, rolle: 'mitglied', sparte: 'flug' }, admin.token));
assert.match(frei.pin, /^\d{6}$/);
assert.equal(ok(rufe('anfragen_liste', {}, admin.token)).length, 0);

const klaus = ok(rufe('login', { name: 'Klaus Butz', pin: frei.pin }));
assert.equal(klaus.rolle, 'mitglied');

// Flugbuch: Pflichtfelder
assert.equal(rufe('flugbuch_anmelden', { eintrag: { antrieb: ['elektro'], masse: '<12 kg' } }, klaus.token).ok, false, 'Regeln bestätigen');
assert.equal(rufe('flugbuch_anmelden', { eintrag: { regelnBestaetigt: true, antrieb: [], masse: '<12 kg' } }, klaus.token).ok, false, 'Antrieb fehlt');

// Anmelden wie auf dem Papier: Verein, Kanal 2,4 GHz, Schulungsnachweis, Elektro, <12 kg
let st = ok(rufe('flugbuch_anmelden', {
  eintrag: { art: 'verein', kanal: 'X', schulungsnachweis: true, antrieb: ['elektro'], masse: '<12 kg', regelnBestaetigt: true },
  flugleiter: { fangnetz: true, rasenGemaeht: true, wetter: 'klar', windrichtung: 'SW', windstaerke: 'leicht' },
}, klaus.token));
assert.equal(st.piloten.length, 1);
const p = st.piloten[0];
assert.equal(p.name, 'Butz');
assert.equal(p.vorname, 'Klaus');
assert.equal(p.vereinGast, 'Verein');
assert.deepEqual(p.antrieb, ['elektro']);
assert.match(p.beginn, /^\d\d:\d\d$/);
assert.equal(p.ende, '');
assert.equal(st.flugleiter.length, 1);
assert.equal(st.flugleiter[0].wetter, 'klar');
assert.equal(st.anwesend.anzahl, 1);
assert.equal(st.anwesend.flugleiter, true);
assert.equal(rufe('flugbuch_anmelden', { eintrag: { antrieb: ['segler'], masse: '<2 kg', regelnBestaetigt: true } }, klaus.token).ok, false, 'nicht doppelt');

// Gast eintragen
st = ok(rufe('flugbuch_anmelden', { eintrag: { art: 'gast', gastVorname: 'Gerd', gastName: 'Gast', antrieb: ['segler'], masse: '<2 kg', regelnBestaetigt: true } }, klaus.token));
assert.equal(st.anwesend.anzahl, 2);
const gast = st.piloten.find((x) => x.vereinGast === 'Gast');
assert.equal(gast.eingetragenVon, 'Klaus Butz');

// Öffentlich nur die Anzahl, keine Namen
const oeff = ok(rufe('anwesende', {}));
assert.equal(oeff.anzahl, 2);
assert.equal(oeff.liste.length, 0);

// Besondere Vorkommnisse, solange angemeldet
assert.equal(p.vorkommnisse, '');
st = ok(rufe('flugbuch_kommentar', { id: p.id, text: '  Landung im Mais, Modell geborgen  ' }, klaus.token));
assert.equal(st.piloten.find((x) => x.id === p.id).vorkommnisse, 'Landung im Mais, Modell geborgen');
assert.equal(rufe('flugbuch_kommentar', { id: p.id, text: 'fremd' }, admin.token).ok, true, 'Admin darf');
st = ok(rufe('flugbuch_kommentar', { id: p.id, text: 'Landung im Mais, Modell geborgen' }, klaus.token));

// Abmelden: Ende wird eingetragen
st = ok(rufe('flugbuch_abmelden', { id: p.id }, klaus.token));
assert.equal(rufe('flugbuch_kommentar', { id: p.id, text: 'zu spät' }, klaus.token).ok, false, 'nach Abmelden gesperrt');
assert.equal(st.piloten.find((x) => x.id === p.id).vorkommnisse, 'Landung im Mais, Modell geborgen');
const pNachher = st.piloten.find((x) => x.id === p.id);
assert.match(pNachher.ende, /^\d\d:\d\d$/);
assert.equal(st.anwesend.anzahl, 2, 'Gast + Flugleiter noch da');
st = ok(rufe('flugbuch_abmelden', { id: gast.id }, klaus.token));
st = ok(rufe('flugleiter_abmelden', {}, klaus.token));
assert.equal(st.anwesend.anzahl, 0);

// Tabelle für Menschen lesbar
const fb = tabelle.blaetter.Flugbuch.rows;
assert.deepEqual([...fb[0].slice(0, 6)], ['id', 'datum', 'name', 'vorname', 'verein_gast', 'kanal']);
assert.equal(fb[1][2], 'Butz');
assert.equal(fb[1][8], 'x', 'Elektro angekreuzt');
assert.equal(fb[1][11], '<12 kg');

// Automatisches Beenden vergessener Abmeldungen
ok(rufe('flugbuch_anmelden', { eintrag: { antrieb: ['kolben'], masse: '<25 kg', regelnBestaetigt: true } }, admin.token));
const zeile = fb[fb.length - 1];
zeile[17] = new Date(Date.now() - 7 * 3600000).toISOString(); // vor 7 Stunden angemeldet
ctx.flugbuchAutoBeenden_();
assert.ok(zeile[18], 'automatisch beendet');
assert.equal(zeile[19], 'ja');

// Admin-Übersicht
const liste = ok(rufe('flugbuch_liste', {}, admin.token));
assert.equal(liste.piloten.length, 3);
assert.equal(rufe('flugbuch_liste', {}, klaus.token).ok, false);

// Abgelehnte Anfrage
ok(rufe('zugang_anfragen', { vorname: 'Fremd', nachname: 'Person' }));
const a2 = ok(rufe('anfragen_liste', {}, admin.token));
ok(rufe('anfrage_ablehnen', { id: a2[0].id }, admin.token));
assert.equal(ok(rufe('anfragen_liste', {}, admin.token)).length, 0);

console.log('Backend-Ablauftest OK');

// Wetterstation-Parser mit dem echten HTML der MGI-Station
const html = `<h2>MGI Wetterstation</h2>
<table><tbody><tr><th>Messwert</th><th style="text-align:right;">Wert</th></tr>
<tr><td>Temperatur</td><td class="val">3.8 °C</td></tr><tr><td>Windgeschwindigkeit</td><td class="val">0.2 km/h</td></tr><tr><td>Windrichtung</td><td class="val">NE</td></tr><tr><td>Luftdruck</td><td class="val">967.5 hPa</td></tr><tr><td>Luftfeuchtigkeit</td><td class="val">94.0 %</td></tr><tr><td>Batteriespannung</td><td class="val">13.74 V</td></tr></tbody></table>`;
const ws = JSON.parse(JSON.stringify(ctx.wetterstationParsen(html)));
assert.deepEqual(ws, { temperatur: 3.8, wind: 0.2, richtung: 'NO', luftdruck: 967.5, luftfeuchte: 94, batterie: 13.74 });
console.log('Wetterstation-Parser OK');

// Arbeitsdienst-Liste
const al = JSON.parse(JSON.stringify(ctx.arbeitslisteParsen([
  ['Kalenderwoche', 'Zeitraum', 'Einsatz', 'Person 1', 'Person 2'],
  ['KW14', '30.03.–05.04.2026', 'Arbeitsdienst', 'Ada Admin', ''],
  ['', '', 'Walzen', '', 'Huber'],
  ['KW22', '25.05.–31.05', 'Arbeitsdienst; Walzen', '', ''],
  ['KW53', '28.12.–03.01.2027', 'Arbeitsdienst', 'J. Rodler', ''],
  ['Hinweis', 'Text', '', '', ''],
  ['', '', 'gehört nicht dazu', 'X', ''],
], 2026))).map(({ zeilen, ...w }) => w);
assert.deepEqual(al, [
  { kw: 'KW14', von: '2026-03-30', bis: '2026-04-05', einsaetze: ['Arbeitsdienst', 'Walzen'], personen: ['Ada Admin', 'Huber'] },
  { kw: 'KW22', von: '2026-05-25', bis: '2026-05-31', einsaetze: ['Arbeitsdienst', 'Walzen'], personen: [] },
  { kw: 'KW53', von: '2026-12-28', bis: '2027-01-03', einsaetze: ['Arbeitsdienst'], personen: ['J. Rodler'] },
]);
const mg = [
  { id: '1', vorname: 'Joachim', nachname: 'Rodler', aktiv: 'true' },
  { id: '2', vorname: 'Klaus', nachname: 'Huber', aktiv: 'true' },
  { id: '3', vorname: 'Anna', nachname: 'Huber', aktiv: 'false' },
  { id: '4', vorname: 'Max', nachname: 'Maier', aktiv: 'true' },
  { id: '5', vorname: 'Eva', nachname: 'Maier', aktiv: 'true' },
];
assert.equal(ctx.personZuMitglied('Joachim Rodler', mg), '1');
assert.equal(ctx.personZuMitglied('rodler, joachim', mg), '1');
assert.equal(ctx.personZuMitglied('J. Rodler', mg), '1');
assert.equal(ctx.personZuMitglied('Huber', mg), '2'); // Anna ist inaktiv
assert.equal(ctx.personZuMitglied('Maier', mg), null); // nicht eindeutig
assert.equal(ctx.personZuMitglied('Eva Maier', mg), '5');
assert.equal(ctx.personZuMitglied('Unbekannt', mg), null);
console.log('Arbeitsdienst-Parser OK');

// Update: fehlende Spalte wird an ein altes Blatt angehängt
{
  const alt = neueTabelle().insertSheet('Flugbuch');
  const kopfAlt = ctx.BLAETTER.Flugbuch.filter((k) => k !== 'vorkommnisse');
  alt.appendRow(kopfAlt);
  alt.appendRow(kopfAlt.map(() => 'x'));
  vm.runInContext('_spaltenGeprueft = {}', ctx);
  ctx.spaltenErgaenzen_(alt, 'Flugbuch');
  assert.equal(alt.rows[0].at(-1), 'vorkommnisse');
  assert.equal(alt.rows[0].length, ctx.BLAETTER.Flugbuch.length);
  console.log('Spalten-Update OK');
}

// Arbeitsdienst in der App: eintragen (verbindlich), austragen nur Admin
{
  let l = ok(rufe('arbeitsdienst_liste', {}, klaus.token));
  assert.equal(l.wochen.length, 2);
  assert.equal(l.tabelle, undefined, 'Tabellenlink nur für Admins');
  const kw13 = l.wochen[0];
  assert.deepEqual(kw13.einsaetze.map((e) => e.einsatz), ['Platzpflege', 'Walzen']);
  assert.deepEqual(kw13.einsaetze[1].plaetze, [{ name: 'Ada Admin', ich: false }, null]);
  l = ok(rufe('arbeitsdienst_eintragen', { zeile: 2, kw: 'KW13' }, klaus.token));
  assert.equal(alRows[1][3], 'Klaus Butz');
  assert.deepEqual(l.wochen[0].einsaetze[0].plaetze[0], { name: 'Klaus Butz', ich: true });
  assert.equal(rufe('arbeitsdienst_eintragen', { zeile: 2, kw: 'KW13' }, klaus.token).ok, false, 'nicht doppelt');
  assert.equal(rufe('arbeitsdienst_eintragen', { zeile: 4, kw: 'KW15' }, klaus.token).status, 409, 'voll');
  assert.equal(rufe('arbeitsdienst_eintragen', { zeile: 3, kw: 'KW15' }, klaus.token).status, 409, 'falsche KW');
  assert.equal(rufe('arbeitsdienst_austragen', { zeile: 2, platz: 0 }, klaus.token).ok, false, 'Mitglied darf nicht austragen');
  const meine = ok(rufe('start', {}, klaus.token)).arbeitsdienst;
  assert.deepEqual(meine, [{ kw: 'KW13', von: '2099-03-29', bis: '2099-04-04', einsaetze: ['Platzpflege'] }]);
  l = ok(rufe('arbeitsdienst_austragen', { zeile: 2, platz: 0, name: 'Klaus Butz' }, admin.token));
  assert.equal(alRows[1][3], '');
  assert.ok(l.tabelle);
  console.log('Arbeitsdienst-Eintragen OK');
}

// Technik: Standard-Abschnitte, Dixi nur für Mitglieder, nur Admins bearbeiten
{
  const oeffentlich = ok(rufe('technik_liste', {}));
  assert.deepEqual(oeffentlich.map((a) => a.titel), ['Wetterstation', 'Stromversorgung', 'Walze', 'Ladesteckdosen'], 'Dixi ohne Anmeldung unsichtbar');
  let t = ok(rufe('technik_liste', {}, klaus.token));
  assert.equal(t.length, 5);
  assert.equal(t[1].grafik, 'strom');
  const dixi = t.find((a) => a.titel === 'Dixi-Toilette');
  assert.equal(dixi.nurMitglieder, true);
  assert.equal(t[0].grafik, 'wetterstation');
  assert.equal(rufe('technik_speichern', { ...dixi, text: 'x' }, klaus.token).status, 403);
  t = ok(rufe('technik_speichern', { ...dixi, text: '**Zahlenkombination Schloss:** 1-2-3-4' }, admin.token));
  assert.match(t.find((a) => a.id === dixi.id).text, /1-2-3-4/);
  assert.ok(!JSON.stringify(ok(rufe('technik_liste', {}))).includes('1-2-3-4'), 'Code nie öffentlich');
  t = ok(rufe('technik_speichern', { titel: 'Rasenmäher', text: 'Benzin: Super E5', nurMitglieder: false }, admin.token));
  assert.equal(t.at(-1).titel, 'Rasenmäher');
  t = ok(rufe('technik_sortieren', { ids: [t.at(-1).id, ...t.slice(0, -1).map((a) => a.id)] }, admin.token));
  assert.equal(t[0].titel, 'Rasenmäher');
  t = ok(rufe('technik_loeschen', { id: t[0].id }, admin.token));
  assert.equal(t.length, 5);
  // Migration eines alten Blatts: Stromversorgung ergänzen, unveränderten Ladesteckdosen-Text ersetzen
  const strom = t.find((a) => a.titel === 'Stromversorgung');
  const lade = t.find((a) => a.titel === 'Ladesteckdosen');
  ok(rufe('technik_loeschen', { id: strom.id }, admin.token));
  ok(rufe('technik_speichern', { ...lade, text: 'Die Ladesteckdosen sind mit **15 Ampere** abgesichert.\n- alt' }, admin.token));
  delete props.TECHNIK_STROM;
  t = ok(rufe('technik_liste', {}, klaus.token));
  assert.deepEqual(t.map((a) => a.titel), ['Wetterstation', 'Stromversorgung', 'Walze', 'Dixi-Toilette', 'Ladesteckdosen']);
  assert.match(t.at(-1).text, /Pufferbatterie/);
  assert.equal(ok(rufe('technik_liste', {}, klaus.token)).length, 5, 'nur einmal');
  assert.match(t.find((x) => x.titel === 'Stromversorgung').text, /100 Ah/);
  // Textersetzung in einem älteren Stromversorgungs-Abschnitt
  const st2 = t.find((x) => x.titel === 'Stromversorgung');
  ok(rufe('technik_speichern', { ...st2, text: 'A\n- Pufferbatterie, wird über den DC-DC-Wandler vom Bluetti nachgeladen\n- versorgt die Ladesteckdosen an zwei Tischen, abgesichert mit **15 A**\nB' }, admin.token));
  delete props.TECHNIK_PUFFER;
  const st3 = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Stromversorgung').text;
  assert.match(st3, /LiFePO₄, 12,8 V, 100 Ah/);
  assert.match(st3, /rund 190 W/);
  // nach Löschen aller Abschnitte keine erneute Vorbelegung
  console.log('Technik OK');
}
