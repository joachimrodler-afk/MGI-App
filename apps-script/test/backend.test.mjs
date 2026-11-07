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
// Standard: keine Stundengrenze – am selben Tag bleibt die Anmeldung offen
ctx.flugbuchAutoBeenden_();
assert.ok(!zeile[18], 'Standard: erst um 23:59 abmelden');
// Mit Stundengrenze aus den Einstellungen (z. B. 6 Std.) wird beendet
const einst = ok(rufe('einstellungen', {}, admin.token));
ok(rufe('einstellungen_speichern', { ...einst, checkinStunden: 6 }, admin.token));
ctx.flugbuchAutoBeenden_();
assert.ok(zeile[18], 'automatisch beendet');
assert.equal(zeile[19], 'ja');
ok(rufe('einstellungen_speichern', { ...einst, checkinStunden: 0 }, admin.token));
// Anmeldung vom Vortag ohne Abmeldung: Ende 23:59 des Vortags
ok(rufe('flugbuch_anmelden', { eintrag: { antrieb: ['segler'], masse: '<2 kg', regelnBestaetigt: true } }, klaus.token));
const vortag = fb[fb.length - 1];
const gestern = new Date(Date.now() - 86400000);
vortag[1] = ctx.Utilities.formatDate(gestern, 'Europe/Berlin', 'dd.MM.yyyy');
vortag[17] = new Date(gestern.getTime()).toISOString();
ctx.flugbuchAutoBeenden_();
assert.equal(vortag[19], 'ja');
assert.equal(String(vortag[13]), '23:59');

// Admin-Übersicht
const liste = ok(rufe('flugbuch_liste', {}, admin.token));
assert.equal(liste.piloten.length, 4);
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

// Flugbuch: Blatt mit anderer Spaltenreihenfolge (z. B. „kanal“ später hinten ergänzt) – Werte landen trotzdem richtig
{
  const fb = tabelle.blaetter.Flugbuch || tabelle.insertSheet('Flugbuch');
  const kopf = ctx.BLAETTER.Flugbuch.filter((k) => k !== 'kanal').concat('kanal');
  fb.rows.splice(0, fb.rows.length, kopf);
  const r = ok(rufe('flugbuch_anmelden', { eintrag: { art: 'mitglied', antrieb: ['elektro'], masse: ctx.MASSEN[0], kanal: '7', schulungsnachweis: true, regelnBestaetigt: true } }, klaus.token));
  const zeile = fb.rows[1];
  const wert = (k) => zeile[kopf.indexOf(k)];
  assert.equal(wert('elektro'), 'x');
  assert.equal(wert('kolben'), '');
  assert.equal(wert('kanal'), '7');
  assert.equal(wert('ende_ts'), '');
  assert.ok(wert('beginn_ts'));
  assert.deepEqual(r.piloten[0].antrieb, ['elektro']);
  assert.equal(r.anwesend.anzahl, 1);
  ok(rufe('flugbuch_abmelden', { id: r.piloten[0].id }, klaus.token));
  console.log('Flugbuch Spaltenreihenfolge OK');
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
  // je Tisch eine Sicherung: alte Formulierung wird ersetzt
  {
    const st5 = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Stromversorgung');
    ok(rufe('technik_speichern', { ...st5, text: '- versorgt die Ladesteckdosen an zwei Tischen, abgesichert mit **15 A** (bei 12,8 V rund 190 W)\n' }, admin.token));
    delete props.TECHNIK_SICHERUNG;
    const t5 = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Stromversorgung').text;
    assert.match(t5, /jeder Tisch\*\* mit eigener Sicherung/);
    assert.match(ctx.technikLadeText_(), /Jeder Tisch\*\* hat eine eigene Sicherung/);
  }
  // Kühlschrank-Ergänzung
  const st4 = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Stromversorgung');
  assert.match(ctx.technikStrom_().text, /- Kühlschrank/, 'Standardtext enthält Kühlschrank');
  ok(rufe('technik_speichern', { ...st4, text: '## 230-V-Ausgang\n- Mähroboter\n- RTK-Antenne\n## An den Tischen\n- x' }, admin.token));
  delete props.TECHNIK_KUEHLSCHRANK;
  const st5 = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Stromversorgung').text;
  assert.match(st5, /- RTK-Antenne\n- Kühlschrank\n## An den Tischen/);
  // Ladestrom-Tabelle an bestehende Ladesteckdosen anhängen (nur einmal)
  const ld = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Ladesteckdosen');
  assert.match(ctx.technikLadeText_(), /\| 6S \| 25,2 V \| 7,5 A \|/);
  ok(rufe('technik_speichern', { ...ld, text: 'X\n- Löst die Sicherung aus: Ladegeräte abstecken, Sicherung wieder einschalten, Geräte einzeln wieder anstecken.' }, admin.token));
  delete props.TECHNIK_LADETABELLE;
  const ld2 = ok(rufe('technik_liste', {}, klaus.token)).find((x) => x.titel === 'Ladesteckdosen').text;
  assert.match(ld2, /\| 8S \| 33,6 V \| 5,6 A \|/);
  assert.equal(ld2.split('| 3S |').length, 2, 'Tabelle nur einmal');
  // nach Löschen aller Abschnitte keine erneute Vorbelegung
  console.log('Technik OK');
}

// Mitglied endgültig löschen: nur deaktiviert, nicht sich selbst, nur Admin
{
  const fr = ok(rufe('mitglied_anlegen', { vorname: 'Weg', nachname: 'Gehen', rolle: 'mitglied' }, admin.token));
  const weg = ok(rufe('login', { name: 'Weg Gehen', pin: fr.pin }));
  const id = weg.mitgliedId;
  assert.equal(rufe('mitglied_loeschen', { id }, admin.token).ok, false, 'erst deaktivieren');
  assert.equal(rufe('mitglied_loeschen', { id }, klaus.token).status, 403);
  assert.equal(rufe('mitglied_loeschen', { id: admin.mitgliedId }, admin.token).ok, false, 'nicht selbst');
  ok(rufe('mitglied_aendern', { id, aktiv: false }, admin.token));
  ok(rufe('mitglied_loeschen', { id }, admin.token));
  assert.ok(!ok(rufe('mitglieder_liste', {}, admin.token)).some((m) => m.id === id));
  assert.equal(rufe('ich', {}, weg.token).ok, false, 'Anmeldung weg');
  console.log('Mitglied löschen OK');
}

// Rabenschreck-Status aus der Fernsteuerungsseite
assert.equal(ctx.rabenschreckParsen('<p>Status Rabenschreck: <strong>AKTIV</strong></p>'), true);
assert.equal(ctx.rabenschreckParsen('<p>Status Rabenschreck: <strong>AUS</strong></p>'), false);
assert.equal(ctx.rabenschreckParsen('<p>irgendwas</p>'), null);
assert.equal(rufe('rabenschreck_status', {}, klaus.token).status, 403, 'nur Admins');
assert.deepEqual(ok(rufe('rabenschreck_status', {}, admin.token)), { eingerichtet: false, erreichbar: false, aktiv: null });
console.log('Rabenschreck OK');

// Push: Test-Nachricht, Nachricht mit "notification" für Safari/iPhone, Abo nur bei unbekanntem Gerät löschen
{
  props.FCM_SERVICE_ACCOUNT = JSON.stringify({ project_id: 'p', client_email: 'x@y' });
  props.APP_URL = 'https://beispiel.de/app/';
  cache.fcm_token = 'zugriff';
  const gesendet = [];
  let antwort = { code: 200, text: '{}' };
  ctx.UrlFetchApp.fetch = (url, opt) => { gesendet.push(JSON.parse(opt.payload)); return { getResponseCode: () => antwort.code, getContentText: () => antwort.text }; };
  ok(rufe('push_abo', { fcmToken: 'tokKlaus', einstellungen: { mitteilungen: true } }, klaus.token));
  assert.equal(rufe('push_test', {}).ok, false, 'nur angemeldet');
  assert.deepEqual(ok(rufe('push_test', {}, klaus.token)), { gesendet: 1 });
  const m = gesendet[0].message;
  assert.equal(m.token, 'tokKlaus');
  assert.equal(m.data.titel, 'MGI – Test');
  assert.deepEqual(m.webpush.notification, { title: 'MGI – Test', body: 'Push-Nachrichten funktionieren auf diesem Gerät.' });
  assert.equal(m.webpush.fcm_options.link, 'https://beispiel.de/app/#/konto');
  // Fehler in der Nachricht (400 ohne Token-Bezug): Abo bleibt
  antwort = { code: 400, text: '{"error":{"message":"Invalid JSON payload"}}' };
  ok(rufe('push_test', {}, klaus.token));
  assert.ok(ctx.zeilen_('PushAbos').some((r) => r.fcmToken === 'tokKlaus'));
  // Gerät unbekannt (404): Abo wird gelöscht
  antwort = { code: 404, text: '{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}' };
  ok(rufe('push_test', {}, klaus.token));
  assert.ok(!ctx.zeilen_('PushAbos').some((r) => r.fcmToken === 'tokKlaus'));
  delete props.FCM_SERVICE_ACCOUNT; delete props.APP_URL; delete cache.fcm_token;
  console.log('Push OK');
}

// Regel-Assistent (Gemini): Dokumente als PDF/Text, Verlauf, Tageslimit, Fehler
{
  assert.equal(rufe('regeln_frage', { frage: 'x' }).ok, false, 'nur Mitglieder');
  assert.match(rufe('regeln_frage', { frage: 'x' }, klaus.token).fehler, /nicht eingerichtet/);
  props.GEMINI_API_KEY = 'k';
  props.REGELN_DATEIEN = 'Satzung=pdf1,Ordnung=txt1';
  ctx.DriveApp.getFileById = (id) => ({ getBlob: () => ({ getContentType: () => (id === 'pdf1' ? 'application/pdf' : 'text/plain'), getBytes: () => [1, 2, 3], getDataAsString: () => 'Text der Ordnung' }) });
  const gesendet = [];
  let antwort = { code: 200, text: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Gedanke', thought: true }, { text: 'Antwort (Satzung § 5)' }] } }] }) };
  ctx.UrlFetchApp.fetch = (url, opt) => { gesendet.push({ url, opt }); return { getResponseCode: () => antwort.code, getContentText: () => antwort.text }; };
  const r = ok(rufe('regeln_frage', { frage: 'Wie hoch ist der Beitrag?', verlauf: [{ rolle: 'ki', text: 'Hallo' }, { rolle: 'ich', text: 'Vorfrage' }, { rolle: 'ki', text: 'Vorantwort' }] }, klaus.token));
  assert.equal(r.antwort, 'Antwort (Satzung § 5)');
  assert.deepEqual(r.dokumente, ['Satzung', 'Ordnung']);
  const g = gesendet[0];
  assert.match(g.url, /models\/gemini-3\.1-flash-lite:generateContent$/);
  assert.equal(g.opt.headers['x-goog-api-key'], 'k');
  const body = JSON.parse(g.opt.payload);
  assert.deepEqual(body.contents.map((c) => c.role), ['user', 'model', 'user'], 'beginnt mit Nutzer, ohne führende KI-Nachricht');
  const erste = body.contents[0].parts;
  assert.equal(erste[1].inline_data.mime_type, 'application/pdf');
  assert.equal(erste[3].text, 'Text der Ordnung');
  assert.equal(erste.at(-1).text, 'Vorfrage');
  assert.equal(body.contents.at(-1).parts[0].text, 'Wie hoch ist der Beitrag?');
  assert.match(body.system_instruction.parts[0].text, /AUSSCHLIESSLICH/);
  assert.match(rufe('regeln_frage', { frage: 'x'.repeat(601) }, klaus.token).fehler, /zu lang/);
  antwort = { code: 429, text: '{}' };
  assert.equal(rufe('regeln_frage', { frage: 'a' }, klaus.token).status, 503);
  // Tageslimit
  antwort = { code: 200, text: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) };
  for (let i = 0; i < 29; i++) ok(rufe('regeln_frage', { frage: 'a' }, klaus.token));
  assert.equal(rufe('regeln_frage', { frage: 'a' }, klaus.token).status, 429);
  delete props.GEMINI_API_KEY; delete props.REGELN_DATEIEN;
  console.log('Regel-Assistent OK');
}

// Foto-Upload: direkt in den Homepage-Ordner, Dateiname mit Datum und Ersteller
{
  const dateien = [];
  props.FOTO_ORDNER_ID = 'fotos';
  ctx.DriveApp.getFolderById = (id) => ({ id, getFilesByName: (nm) => ({ hasNext: () => dateien.some((f) => f.name === nm) }), createFile: (b) => { const f = { name: b.name, setDescription: (x) => (f.desc = x), getId: () => 'f1' }; dateien.push(f); return f; }, createFolder: () => { throw new Error('keine Unterordner'); } });
  ctx.Utilities.newBlob = (_bytes, _mime, name) => ({ name });
  ctx.Utilities.base64Decode = () => [];
  const r = ok(rufe('foto_hochladen', { base64: 'AA==', kategorie: 'Flugtag', titel: 'Erstflug Ü-Segler!', aufgenommen: '2026-11-07T09:05:30' }, klaus.token));
  assert.equal(r.name, '2026-11-07_09-05_Erstflug-Ue-Segler_Klaus-B.jpg');
  const r1 = ok(rufe('foto_hochladen', { base64: 'AA==', titel: 'Erstflug Ü-Segler!', aufgenommen: '2026-11-07T09:05:50' }, klaus.token));
  assert.equal(r1.name, '2026-11-07_09-05_Erstflug-Ue-Segler_Klaus-B_2.jpg');
  const r2 = ok(rufe('foto_hochladen', { base64: 'AA==', aufgenommen: '2026-11-07T10:00:00' }, klaus.token));
  assert.equal(r2.name, '2026-11-07_10-00_Klaus-B.jpg');
  // öffentliche Galerie, neueste zuerst
  let n = 0;
  ctx.DriveApp.getFolderById = () => ({ getFiles: () => { const fs = [['a.jpg', '2026-11-01'], ['b.jpg', '2026-11-07'], ['x.txt', '2026-11-08']]; let i = 0; return { hasNext: () => i < fs.length, next: () => { const [nm, dt] = fs[i++]; n++; return { getId: () => nm, getName: () => nm, getMimeType: () => (nm.endsWith('.jpg') ? 'image/jpeg' : 'text/plain'), getDescription: () => '', getDateCreated: () => new Date(dt) }; } }; } });
  delete cache.galerie;
  const g = ok(rufe('galerie', {}));
  assert.deepEqual(g.map((x) => x.name), ['b.jpg', 'a.jpg']);
  assert.equal(dateien[0].desc, 'Erstflug Ü-Segler! – Flugtag – Foto: Klaus Butz');
  console.log('Foto-Upload OK');
}
