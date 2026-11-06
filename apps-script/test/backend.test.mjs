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
      getRange: (r, c) => ({
        setFontWeight: () => {},
        setValue: (v) => { rows[r - 1][c - 1] = typeof v === 'string' && v.startsWith("'") ? v.slice(1) : v; },
        setValues: () => {},
      }),
      getDataRange: () => ({ getValues: () => rows.map((r) => r.slice()) }),
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
const props = { SHEET_ID: 'x', OEFFENTLICH: 'true', ERSTER_ADMIN: 'Ada;Admin;654321' };
const cache = {};
const pad = (n) => String(n).padStart(2, '0');

const ctx = {
  console,
  SpreadsheetApp: { openById: () => tabelle },
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

// Abmelden: Ende wird eingetragen
st = ok(rufe('flugbuch_abmelden', { id: p.id }, klaus.token));
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
