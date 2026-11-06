/** Punkteberechnung und Rangliste für Wettbewerbe. */
import { berechne, parseFormel, type Knoten, type Wert } from './formel';
import type { Eingabe, Feld, Teilnehmer, Wertung, Wertungsart, Wettbewerb } from './model';

export interface DurchgangErgebnis {
  roh: number | null; // Ergebnis der Formel
  punkte: number | null; // nach Normierung
  fehler?: string;
}

export interface Platzierung {
  platz: number;
  teilnehmer: Teilnehmer;
  durchgaenge: DurchgangErgebnis[];
  gesamt: number;
  gestrichen: number[]; // Indizes gestrichener Durchgänge
}

/** Variablen für eine Formel aus Konstanten + Eingaben zusammenstellen */
function variablen(art: Wertungsart, felder: Record<string, Wert>, extra: Record<string, number> = {}) {
  const v: Record<string, Wert> = {};
  for (const k of art.konstanten) v[k.key] = k.wert;
  Object.assign(v, extra);
  for (const f of art.felder) v[f.key] = normWert(f, felder[f.key]);
  return v;
}

function normWert(f: Feld, w: Wert | undefined): Wert {
  if (f.typ === 'liste') {
    const arr = Array.isArray(w) ? w : w === undefined ? [] : [w];
    return arr.filter((x) => typeof x === 'number' && Number.isFinite(x));
  }
  if (Array.isArray(w)) return w[0] ?? 0;
  return typeof w === 'number' && Number.isFinite(w) ? w : 0;
}

/** Rohpunkte eines Durchgangs */
export function berechneDurchgang(art: Wertungsart, eingabe: Eingabe, ast?: Knoten): number {
  const formel = ast ?? parseFormel(art.formel);
  if (art.elemente && art.elemente.liste.length) {
    let summe = 0;
    art.elemente.liste.forEach((el, i) => {
      const felder = eingabe.elemente?.[i] ?? {};
      summe += berechne(formel, variablen(art, felder, el.werte));
    });
    return summe;
  }
  return berechne(formel, variablen(art, eingabe.felder));
}

/** Variablennamen, die in der Formel verfügbar sind */
export function verfuegbareVariablen(art: Wertungsart): string[] {
  return [
    ...art.konstanten.map((k) => k.key),
    ...(art.elemente?.konstanten ?? []),
    ...art.felder.map((f) => f.key),
  ];
}

function rund(x: number) {
  return Math.round(x * 100) / 100;
}

/**
 * Rangliste für eine Klasse (leere Klasse = alle Teilnehmer).
 * Fehlende Durchgänge zählen als 0 Punkte (bzw. bei Sortierung „niedrig“ als nicht gewertet).
 */
export function rangliste(wb: Wettbewerb, wertungen: Wertung[], klasse = ''): Platzierung[] {
  const art = wb.art;
  const tn = wb.teilnehmer.filter((t) => !klasse || t.klasse === klasse);
  let ast: Knoten | null = null;
  let formelFehler = '';
  try {
    ast = parseFormel(art.formel);
  } catch (e) {
    formelFehler = (e as Error).message;
  }

  // Rohwerte je Teilnehmer und Durchgang (neueste Wertung gilt)
  const roh: DurchgangErgebnis[][] = tn.map((t) =>
    Array.from({ length: wb.durchgaenge }, (_, d) => {
      const w = wertungen
        .filter((x) => x.wettbewerbId === wb.id && x.teilnehmerId === t.id && x.durchgang === d + 1)
        .sort((a, b) => b.zeit.localeCompare(a.zeit))[0];
      if (!w) return { roh: null, punkte: null };
      if (!ast) return { roh: null, punkte: null, fehler: formelFehler };
      try {
        const r = rund(berechneDurchgang(art, w.eingabe, ast));
        return { roh: r, punkte: r };
      } catch (e) {
        return { roh: null, punkte: null, fehler: (e as Error).message };
      }
    }),
  );

  // Normierung auf 1000 je Durchgang (Bester = 1000)
  if (art.normieren1000) {
    for (let d = 0; d < wb.durchgaenge; d++) {
      const werte = roh.map((r) => r[d].roh).filter((x): x is number => x !== null);
      if (!werte.length) continue;
      const best = art.sortierung === 'hoch' ? Math.max(...werte) : Math.min(...werte);
      for (const r of roh) {
        const x = r[d].roh;
        if (x === null) continue;
        let p = 0;
        if (art.sortierung === 'hoch') p = best > 0 ? (x / best) * 1000 : 0;
        else p = x > 0 ? (best / x) * 1000 : 1000;
        r[d].punkte = rund(p);
      }
    }
  }
  // Nach Normierung gilt immer: höher = besser
  const hoch = art.normieren1000 || art.sortierung === 'hoch';

  const zeilen = tn.map((t, i) => {
    const ds = roh[i];
    const vorhanden = ds.map((d, idx) => ({ idx, p: d.punkte })).filter((x): x is { idx: number; p: number } => x.p !== null);
    let gesamt = 0;
    let gestrichen: number[] = [];
    if (art.gesamt === 'bester') {
      gesamt = vorhanden.length ? (hoch ? Math.max(...vorhanden.map((x) => x.p)) : Math.min(...vorhanden.map((x) => x.p))) : 0;
    } else if (art.gesamt === 'streichen') {
      const n = art.streichAnzahl ?? 1;
      // fehlende Durchgänge zählen als schlechteste Ergebnisse
      const alle = ds.map((d, idx) => ({ idx, p: d.punkte ?? (hoch ? 0 : Infinity) }));
      const sortiert = alle.slice().sort((a, b) => (hoch ? a.p - b.p : b.p - a.p));
      gestrichen = alle.length > n ? sortiert.slice(0, n).map((x) => x.idx) : [];
      gesamt = alle.filter((x) => !gestrichen.includes(x.idx)).reduce((s, x) => s + (Number.isFinite(x.p) ? x.p : 0), 0);
    } else {
      gesamt = vorhanden.reduce((s, x) => s + x.p, 0);
    }
    const bester = vorhanden.length ? (hoch ? Math.max(...vorhanden.map((x) => x.p)) : Math.min(...vorhanden.map((x) => x.p))) : 0;
    return { teilnehmer: t, durchgaenge: ds, gesamt: rund(gesamt), gestrichen, bester, anzahl: vorhanden.length };
  });

  const cmp = (a: (typeof zeilen)[number], b: (typeof zeilen)[number]) => {
    // Teilnehmer ohne Wertung ans Ende
    if (!a.anzahl !== !b.anzahl) return a.anzahl ? -1 : 1;
    const g = hoch ? b.gesamt - a.gesamt : a.gesamt - b.gesamt;
    if (g !== 0) return g;
    if (art.gleichstand === 'bester_durchgang') return hoch ? b.bester - a.bester : a.bester - b.bester;
    return 0;
  };
  zeilen.sort((a, b) => cmp(a, b) || a.teilnehmer.name.localeCompare(b.teilnehmer.name, 'de'));

  const out: Platzierung[] = [];
  zeilen.forEach((z, i) => {
    const platz = i > 0 && cmp(zeilen[i - 1], z) === 0 ? out[i - 1].platz : i + 1;
    out.push({ platz, teilnehmer: z.teilnehmer, durchgaenge: z.durchgaenge, gesamt: z.gesamt, gestrichen: z.gestrichen });
  });
  return out;
}

/** Zeit „mm:ss“ oder „m:ss,s“ -> Sekunden */
export function parseZeit(s: string): number | null {
  const t = s.trim().replace(',', '.');
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const m = /^(\d+):([0-5]?\d(\.\d+)?)$/.exec(t);
  if (!m) return null;
  return parseInt(m[1], 10) * 60 + parseFloat(m[2]);
}

export function formatZeit(sek: number): string {
  const m = Math.floor(sek / 60);
  const s = sek - m * 60;
  const ss = Number.isInteger(s) ? String(s).padStart(2, '0') : s.toFixed(1).padStart(4, '0');
  return `${m}:${ss}`;
}

/** CSV-Export der Rangliste (Semikolon, für Excel/Tabellen in Deutschland) */
export function rangCsv(wb: Wettbewerb, plaetze: Platzierung[]): string {
  const fmt = (x: number | null) => (x === null ? '' : String(x).replace('.', ','));
  const kopf = ['Platz', 'Name', 'Klasse', ...Array.from({ length: wb.durchgaenge }, (_, i) => `DG ${i + 1}`), 'Gesamt'];
  const zeilen = plaetze.map((p) => [
    String(p.platz),
    p.teilnehmer.name,
    p.teilnehmer.klasse,
    ...p.durchgaenge.map((d, i) => (p.gestrichen.includes(i) ? `(${fmt(d.punkte)})` : fmt(d.punkte))),
    fmt(p.gesamt),
  ]);
  const esc = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  return [kopf, ...zeilen].map((z) => z.map(esc).join(';')).join('\r\n');
}
