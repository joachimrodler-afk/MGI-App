/**
 * Vorinstallierte Wertungsarten. Admins können sie in der App anpassen
 * oder neue anlegen – diese Vorlagen dienen nur als Startpunkt.
 */
import type { Wertungsart } from './model';

const jetzt = '2026-11-06T00:00:00.000Z';

export const VORLAGEN: Wertungsart[] = [
  {
    id: 'kunstflug',
    name: 'Kunstflug',
    beschreibung:
      'Jede Figur wird von mehreren Wertungsrichtern mit 0–10 benotet. Punkte je Figur = K-Faktor × Durchschnitt der Noten. ' +
      'Bei 5 oder mehr Richtern kann man in der Formel streich(noten) verwenden (höchste und niedrigste Note fallen weg).',
    felder: [{ key: 'noten', label: 'Noten der Richter', typ: 'liste', anzahl: 3, min: 0, max: 10, einheit: 'Punkte' }],
    konstanten: [],
    elemente: {
      bezeichnung: 'Figur',
      konstanten: ['k'],
      liste: [
        { name: 'Looping', werte: { k: 2 } },
        { name: 'Rolle', werte: { k: 2 } },
        { name: 'Rückenflug', werte: { k: 3 } },
        { name: 'Turn', werte: { k: 3 } },
        { name: 'Messerflug', werte: { k: 4 } },
        { name: 'Landung', werte: { k: 1 } },
      ],
    },
    formel: 'k * durchschnitt(noten)',
    gesamt: 'streichen',
    streichAnzahl: 1,
    normieren1000: true,
    sortierung: 'hoch',
    gleichstand: 'bester_durchgang',
    version: 1,
    geaendert: jetzt,
  },
  {
    id: 'segelflug',
    name: 'Segelflug (Zeit + Landung)',
    beschreibung:
      'Ziel ist es, möglichst genau die Sollzeit zu fliegen. Eine Sekunde zu kurz oder zu lang kostet einen Punkt. ' +
      'Dazu kommen Landepunkte (z. B. 0–100 je nach Abstand zum Landepunkt).',
    felder: [
      { key: 'flugzeit', label: 'Flugzeit', typ: 'zeit', min: 0, max: 3600, einheit: 'mm:ss' },
      { key: 'landepunkte', label: 'Landepunkte', typ: 'zahl', min: 0, max: 100 },
    ],
    konstanten: [{ key: 'sollzeit', label: 'Sollzeit in Sekunden', wert: 300 }],
    formel: 'max(0; sollzeit - abs(flugzeit - sollzeit)) + landepunkte',
    gesamt: 'summe',
    normieren1000: true,
    sortierung: 'hoch',
    gleichstand: 'bester_durchgang',
    version: 1,
    geaendert: jetzt,
  },
  {
    id: 'limbo',
    name: 'Limbo',
    beschreibung:
      'Durchflüge unter dem Band in der vorgegebenen Zeit. Je niedriger das Band, desto mehr Punkte pro Durchflug. Berührungen geben Abzug.',
    felder: [
      { key: 'durchfluege', label: 'Erfolgreiche Durchflüge', typ: 'zahl', min: 0, max: 50 },
      { key: 'hoehe', label: 'Bandhöhe', typ: 'zahl', min: 50, max: 400, einheit: 'cm' },
      { key: 'beruehrungen', label: 'Berührungen', typ: 'zahl', min: 0, max: 50 },
    ],
    konstanten: [
      { key: 'basis', label: 'Punkte je Durchflug bei 2 m', wert: 10 },
      { key: 'abzug', label: 'Abzug je Berührung', wert: 5 },
    ],
    formel: 'durchfluege * basis * 200 / hoehe - beruehrungen * abzug',
    gesamt: 'bester',
    normieren1000: false,
    sortierung: 'hoch',
    gleichstand: 'geteilt',
    version: 1,
    geaendert: jetzt,
  },
  {
    id: 'ballonstechen',
    name: 'Ballonstechen',
    beschreibung:
      'Möglichst viele Ballons in möglichst kurzer Zeit zerstechen. 10 Punkte je Ballon, Bonus wenn alle Ballons erwischt wurden, Abzug für die Zeit und Strafpunkte.',
    felder: [
      { key: 'ballons', label: 'Zerstochene Ballons', typ: 'zahl', min: 0, max: 20 },
      { key: 'zeit', label: 'Benötigte Zeit', typ: 'zeit', min: 0, max: 600, einheit: 'mm:ss' },
      { key: 'strafpunkte', label: 'Strafpunkte', typ: 'zahl', min: 0, max: 100 },
    ],
    konstanten: [
      { key: 'ballons_gesamt', label: 'Ballons insgesamt', wert: 5 },
      { key: 'bonus', label: 'Bonus wenn alle getroffen', wert: 20 },
    ],
    formel: 'ballons * 10 + wenn(ballons >= ballons_gesamt; bonus; 0) - zeit / 10 - strafpunkte',
    gesamt: 'summe',
    normieren1000: false,
    sortierung: 'hoch',
    gleichstand: 'bester_durchgang',
    version: 1,
    geaendert: jetzt,
  },
];
