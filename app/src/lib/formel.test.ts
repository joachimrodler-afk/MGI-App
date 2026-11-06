import { describe, expect, it } from 'vitest';
import { berechne, FormelFehler, pruefeFormel } from './formel';
import { berechneDurchgang, formatZeit, parseZeit, rangCsv, rangliste } from './auswertung';
import { VORLAGEN } from './vorlagen';
import type { Wertung, Wettbewerb } from './model';

describe('Formel-Parser', () => {
  it('rechnet mit Punkt vor Strich und Klammern', () => {
    expect(berechne('1 + 2 * 3', {})).toBe(7);
    expect(berechne('(1 + 2) * 3', {})).toBe(9);
    expect(berechne('2 ^ 3 ^ 2', {})).toBe(512);
    expect(berechne('-2 ^ 2', {})).toBe(-4);
    expect(berechne('10 / 4', {})).toBe(2.5);
  });
  it('kennt Variablen (Groß-/Kleinschreibung egal)', () => {
    expect(berechne('a * B', { a: 3, b: 4 })).toBe(12);
  });
  it('kennt deutsche Funktionen mit ; und ,', () => {
    expect(berechne('max(1; 5; 3)', {})).toBe(5);
    expect(berechne('min(4, 2)', {})).toBe(2);
    expect(berechne('runden(2.345; 2)', {})).toBe(2.35);
    expect(berechne('abs(-3)', {})).toBe(3);
    expect(berechne('wenn(3 > 2; 10; 20)', {})).toBe(10);
    expect(berechne('wenn(1 > 2 oder 0; 10; 20)', {})).toBe(20);
    expect(berechne('wenn(1 < 2 und nicht 0; 1; 0)', {})).toBe(1);
  });
  it('rechnet mit Listen', () => {
    const n = { noten: [8, 9, 7, 6, 10] };
    expect(berechne('summe(noten)', n)).toBe(40);
    expect(berechne('durchschnitt(noten)', n)).toBe(8);
    expect(berechne('summe(streich(noten))', n)).toBe(24); // ohne 6 und 10
    expect(berechne('summe(noten * 2)', n)).toBe(80);
    expect(berechne('summe(beste(noten; 2))', n)).toBe(19);
    expect(berechne('anzahl(noten)', n)).toBe(5);
  });
  it('streicht nicht, wenn zu wenige Werte da sind', () => {
    expect(berechne('summe(streich(noten))', { noten: [5, 6] })).toBe(11);
  });
  it('wenn() wertet nur den benötigten Zweig aus', () => {
    expect(berechne('wenn(x == 0; 0; 10 / x)', { x: 0 })).toBe(0);
  });
  it('liefert verständliche Fehler', () => {
    expect(() => berechne('1 +', {})).toThrow(FormelFehler);
    expect(() => berechne('foo(1)', {})).toThrow(/Unbekannte Funktion/);
    expect(() => berechne('x + 1', {})).toThrow(/Unbekannte Variable „x“/);
    expect(() => berechne('1 / 0', {})).toThrow(/Division durch 0/);
    expect(() => berechne('noten', { noten: [1, 2] })).toThrow(/Liste/);
    expect(() => berechne('(1 + 2', {})).toThrow(/„\)“ fehlt/);
    expect(() => berechne('1 $ 2', {})).toThrow(/Unbekanntes Zeichen/);
  });
  it('lässt keinen JavaScript-Code durch', () => {
    expect(() => berechne('constructor.constructor("return 1")()', {})).toThrow(FormelFehler);
    expect(() => berechne('alert(1)', {})).toThrow(/Unbekannte Funktion/);
    expect(() => berechne('__proto__', {})).toThrow(/Unbekannte Variable/);
    expect(() => berechne('constructor(1)', {})).toThrow(/Unbekannte Funktion/);
    expect(() => berechne('tostring(1)', {})).toThrow(/Unbekannte Funktion/);
  });
  it('prüft Formeln gegen erlaubte Variablen', () => {
    expect(pruefeFormel('a + b', ['a', 'b'])).toBeNull();
    expect(pruefeFormel('a + c', ['a', 'b'])).toMatch(/„c“/);
  });
});

describe('Zeiten', () => {
  it('liest mm:ss und Sekunden', () => {
    expect(parseZeit('5:00')).toBe(300);
    expect(parseZeit('4:59,5')).toBe(299.5);
    expect(parseZeit('75')).toBe(75);
    expect(parseZeit('1:75')).toBeNull();
    expect(formatZeit(299.5)).toBe('4:59.5');
    expect(formatZeit(65)).toBe('1:05');
  });
});

describe('Vorlagen', () => {
  const art = (id: string) => VORLAGEN.find((v) => v.id === id)!;

  it('alle Vorlagen-Formeln sind gültig', () => {
    for (const v of VORLAGEN) {
      const vars = [...v.konstanten.map((k) => k.key), ...(v.elemente?.konstanten ?? []), ...v.felder.map((f) => f.key)];
      expect(pruefeFormel(v.formel, vars), v.name).toBeNull();
    }
  });
  it('Kunstflug: K-Faktor × Durchschnitt je Figur', () => {
    const a = art('kunstflug');
    const elemente = a.elemente!.liste.map(() => ({ noten: [8, 8, 8] }));
    // Summe K = 2+2+3+3+4+1 = 15 -> 15 * 8 = 120
    expect(berechneDurchgang(a, { felder: {}, elemente })).toBe(120);
  });
  it('Segelflug: Abweichung von der Sollzeit kostet Punkte', () => {
    const a = art('segelflug');
    expect(berechneDurchgang(a, { felder: { flugzeit: 300, landepunkte: 50 } })).toBe(350);
    expect(berechneDurchgang(a, { felder: { flugzeit: 290, landepunkte: 50 } })).toBe(340);
    expect(berechneDurchgang(a, { felder: { flugzeit: 320, landepunkte: 0 } })).toBe(280);
  });
  it('Limbo: tieferes Band bringt mehr', () => {
    const a = art('limbo');
    expect(berechneDurchgang(a, { felder: { durchfluege: 3, hoehe: 200, beruehrungen: 1 } })).toBe(25);
    expect(berechneDurchgang(a, { felder: { durchfluege: 3, hoehe: 100, beruehrungen: 0 } })).toBe(60);
  });
  it('Ballonstechen: Bonus wenn alle getroffen', () => {
    const a = art('ballonstechen');
    expect(berechneDurchgang(a, { felder: { ballons: 5, zeit: 60, strafpunkte: 0 } })).toBe(64);
    expect(berechneDurchgang(a, { felder: { ballons: 4, zeit: 60, strafpunkte: 2 } })).toBe(32);
  });
});

describe('Rangliste', () => {
  const basis = (artId: string, durchgaenge: number): Wettbewerb => ({
    id: 'w1',
    name: 'Test',
    datum: '2026-07-01',
    art: { ...VORLAGEN.find((v) => v.id === artId)! },
    klassen: [],
    teilnehmer: [
      { id: 'a', name: 'Anna', klasse: '' },
      { id: 'b', name: 'Bernd', klasse: '' },
      { id: 'c', name: 'Clara', klasse: '' },
    ],
    durchgaenge,
    status: 'offen',
    erstellt: '',
  });
  const w = (t: string, d: number, felder: Record<string, number>): Wertung => ({
    id: `${t}${d}`, wettbewerbId: 'w1', teilnehmerId: t, durchgang: d, eingabe: { felder }, richter: 'x', zeit: '2026-07-01T10:00:00Z',
  });

  it('normiert je Durchgang auf 1000 und summiert', () => {
    const wb = basis('segelflug', 2);
    const r = rangliste(wb, [
      w('a', 1, { flugzeit: 300, landepunkte: 100 }), // 400
      w('b', 1, { flugzeit: 300, landepunkte: 0 }), // 300
      w('a', 2, { flugzeit: 250, landepunkte: 0 }), // 250
      w('b', 2, { flugzeit: 300, landepunkte: 100 }), // 400
    ]);
    expect(r.find((p) => p.teilnehmer.id === 'a')!.durchgaenge[0].punkte).toBe(1000);
    // Anna: 1000 + 625 = 1625, Bernd: 750 + 1000 = 1750 -> Bernd vorne
    expect(r[0].teilnehmer.name).toBe('Bernd');
    expect(r[0].gesamt).toBe(1750);
    expect(r[1].gesamt).toBe(1625);
    expect(r[2].platz).toBe(3); // Clara ohne Wertung am Ende
  });

  it('Streichergebnis und geteilte Plätze', () => {
    const wb = basis('ballonstechen', 3);
    wb.art = { ...wb.art, gesamt: 'streichen', streichAnzahl: 1, gleichstand: 'geteilt' };
    const r = rangliste(wb, [
      w('a', 1, { ballons: 5, zeit: 0, strafpunkte: 0 }), // 70
      w('a', 2, { ballons: 1, zeit: 0, strafpunkte: 0 }), // 10 (gestrichen)
      w('a', 3, { ballons: 3, zeit: 0, strafpunkte: 0 }), // 30
      w('b', 1, { ballons: 4, zeit: 0, strafpunkte: 0 }), // 40
      w('b', 2, { ballons: 4, zeit: 0, strafpunkte: 0 }), // 40
      // b DG3 fehlt -> zählt als 0 und wird gestrichen
    ]);
    expect(r[0].teilnehmer.name).toBe('Anna');
    expect(r[0].gesamt).toBe(100);
    expect(r[0].gestrichen).toEqual([1]);
    expect(r[1].gesamt).toBe(80);
    expect(r[1].gestrichen).toEqual([2]);

    const gleich = rangliste(wb, [w('a', 1, { ballons: 2, zeit: 0, strafpunkte: 0 }), w('b', 1, { ballons: 2, zeit: 0, strafpunkte: 0 })]);
    expect(gleich[0].platz).toBe(1);
    expect(gleich[1].platz).toBe(1);
  });

  it('meldet Formelfehler pro Durchgang statt abzustürzen', () => {
    const wb = basis('limbo', 1);
    wb.art = { ...wb.art, formel: 'durchfluege / (hoehe - hoehe)' };
    const r = rangliste(wb, [w('a', 1, { durchfluege: 1, hoehe: 100, beruehrungen: 0 })]);
    expect(r.find((p) => p.teilnehmer.id === 'a')!.durchgaenge[0].fehler).toMatch(/Division durch 0/);
  });

  it('erzeugt CSV mit Semikolon und Dezimalkomma', () => {
    const wb = basis('limbo', 1);
    const r = rangliste(wb, [w('a', 1, { durchfluege: 1, hoehe: 300, beruehrungen: 0 })]);
    const csv = rangCsv(wb, r);
    expect(csv.split('\r\n')[0]).toBe('Platz;Name;Klasse;DG 1;Gesamt');
    expect(csv).toContain('1;Anna;;6,67;6,67');
  });
});
