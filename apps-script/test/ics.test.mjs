// Tests für den ICS-Parser im Apps Script (läuft mit Node: node apps-script/test/ics.test.mjs)
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const code = fs.readFileSync(new URL('../Code.gs', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(code, ctx);
const parse = ctx.icsParsen;

const ics = [
  'BEGIN:VCALENDAR', 'VERSION:2.0',
  'BEGIN:VEVENT', 'UID:a1', 'DTSTART;TZID=Europe/Berlin:20261120T190000', 'DTEND;TZID=Europe/Berlin:20261120T220000',
  'SUMMARY:MGI Jahreshauptversammlung', 'LOCATION:Vereinsheim\\, Ismaning', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a2', 'DTSTART;VALUE=DATE:20261205', 'DTEND;VALUE=DATE:20261206', 'SUMMARY:Weihnachtsfeier', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:a3', 'DTSTART:20261201T170000Z', 'DTEND:20261201T180000Z', 'SUMMARY:UTC-Termin mit sehr lang', ' em Titel', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:r1', 'DTSTART;TZID=Europe/Berlin:20261104T190000', 'DTEND;TZID=Europe/Berlin:20261104T210000',
  'RRULE:FREQ=WEEKLY;BYDAY=WE;COUNT=4', 'EXDATE;TZID=Europe/Berlin:20261118T190000', 'SUMMARY:Bastelabend', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:r2', 'DTSTART;VALUE=DATE:20260101', 'RRULE:FREQ=MONTHLY;BYDAY=1SA', 'SUMMARY:Arbeitsdienst', 'END:VEVENT',
  'BEGIN:VEVENT', 'UID:x', 'DTSTART:20261110T100000', 'STATUS:CANCELLED', 'SUMMARY:Abgesagt', 'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n');

const liste = JSON.parse(JSON.stringify(parse(ics, '2026-11-01T00:00:00', 90)));
const titel = (t) => liste.filter((x) => x.titel === t);

const jhv = titel('MGI Jahreshauptversammlung')[0];
assert.equal(jhv.beginn, '2026-11-20T19:00:00');
assert.equal(jhv.ende, '2026-11-20T22:00:00');
assert.equal(jhv.ort, 'Vereinsheim, Ismaning');

const wf = titel('Weihnachtsfeier')[0];
assert.equal(wf.ganztaegig, true);
assert.equal(wf.beginn, '2026-12-05T00:00:00');

assert.equal(titel('UTC-Termin mit sehr langem Titel')[0].beginn, '2026-12-01T18:00:00'); // UTC -> MEZ

const bastel = titel('Bastelabend').map((x) => x.beginn);
assert.deepEqual(bastel, ['2026-11-04T19:00:00', '2026-11-11T19:00:00', '2026-11-25T19:00:00']); // 4 Termine, 18.11. ausgelassen

const ad = titel('Arbeitsdienst').map((x) => x.beginn.slice(0, 10));
assert.ok(ad.includes('2026-11-07') && ad.includes('2026-12-05') && ad.includes('2027-01-02'), ad.join(','));
assert.equal(titel('Abgesagt').length, 0);

// sortiert
for (let i = 1; i < liste.length; i++) assert.ok(liste[i - 1].beginn <= liste[i].beginn);

// Sommerzeit: wöchentlicher Termin über die Zeitumstellung bleibt 19:00 Ortszeit
const so = JSON.parse(JSON.stringify(parse(['BEGIN:VEVENT', 'UID:s', 'DTSTART;TZID=Europe/Berlin:20270320T190000', 'RRULE:FREQ=WEEKLY;COUNT=3', 'SUMMARY:S', 'END:VEVENT'].join('\n'), '2027-03-01T00:00:00', 60)));
assert.deepEqual(so.map((x) => x.beginn), ['2027-03-20T19:00:00', '2027-03-27T19:00:00', '2027-04-03T19:00:00']);

console.log('ICS-Tests OK (' + liste.length + ' Termine)');
