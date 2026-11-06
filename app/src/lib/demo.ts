/**
 * DEMO-MODUS: Simuliert das Backend im Browser (Daten nur auf diesem Gerät).
 * Wird benutzt, solange in config.ts keine apiUrl eingetragen ist.
 *
 * Demo-Zugänge:   „Demo Admin“ / PIN 123456      „Max Muster“ / PIN 111111
 */
import { ApiFehler } from './api';

interface DemoAWoche { kw: string; von: string; bis: string; einsaetze: { zeile: number; einsatz: string; plaetze: string[] }[] }
import { VORLAGEN } from './vorlagen';
import type {
  Anfrage, BrettBeitrag, TechnikAbschnitt, CheckIn, Einstellungen, FlugbuchEintrag, FlugleiterEintrag, Mitglied, Nachweise, PilotEingabe, Sitzung, Termin, Wertung, Wertungsart, Wettbewerb,
} from './model';

interface DemoMitglied extends Mitglied { pin: string }
interface DemoDaten {
  mitglieder: DemoMitglied[];
  sitzungen: Sitzung[];
  checkins: CheckIn[];
  brett: BrettBeitrag[];
  nachweise: Record<string, Nachweise>;
  arten: Wertungsart[];
  wettbewerbe: Wettbewerb[];
  wertungen: Wertung[];
  einstellungen: Einstellungen;
  anfragen?: Anfrage[];
  flugbuch?: FlugbuchEintrag[];
  flugleiter?: FlugleiterEintrag[];
  arbeitsliste?: DemoAWoche[];
  technik?: TechnikAbschnitt[];
}

const KEY = 'mgi.demo.v2';

const STANDARD_EINST: Einstellungen = {
  platzordnung:
    '## Platzordnung (Beispiel)\n\n' +
    '- Flugbetrieb nur mit anwesendem **Flugleiter**\n' +
    '- Flugzeiten: werktags 9–12 und 14–19 Uhr, Sonn- und Feiertage 10–12 und 15–19 Uhr\n' +
    '- Verbrenner nur mit Schalldämpfer, Lärmgrenzwert beachten\n' +
    '- Drohnen nur im ausgewiesenen Flugraum, nicht über Zuschauer\n' +
    '- Vor dem Start Sender-Frequenz bzw. 2,4-GHz-Check durchführen\n\n' +
    '_Dies ist ein Beispieltext. Admins können ihn unter Verwaltung → Einstellungen ändern._',
  notfallInfo:
    '- **Erste-Hilfe-Kasten:** im Container neben der Tür (Beispiel)\n- **Feuerlöscher:** an der Pilotenbox (Beispiel)\n- **Defibrillator:** nächster AED im Ort – bitte eintragen',
  notfallKontakte: [
    { name: 'Vorsitzender', rolle: 'Vorstand', telefon: '+49 89 0000000' },
  ],
  windGelb: 25,
  windRot: 40,
  datenschutzFoto:
    'Bitte nur Fotos hochladen, mit denen alle abgebildeten Personen einverstanden sind. Die Fotos erscheinen öffentlich auf der Vereins-Homepage.',
  checkinStunden: 6,
};

const demoHeute = () => new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const demoUhr = (d = new Date()) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

function tagPlus(n: number, uhr = '19:00') {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${uhr}:00`;
}

function demoTermine(): Termin[] {
  return [
    { titel: 'Bastelabend im Vereinsheim', beginn: tagPlus(2), ende: tagPlus(2, '21:30'), ganztaegig: false, ort: 'Vereinsheim' },
    { titel: 'Arbeitsdienst Flugplatz', beginn: tagPlus(5, '09:00'), ende: tagPlus(5, '13:00'), ganztaegig: false, ort: 'Modellflugplatz', beschreibung: 'Rasen mähen, Hecke schneiden. Bitte Handschuhe mitbringen.' },
    { titel: 'MGI Jahreshauptversammlung', beginn: tagPlus(14), ende: tagPlus(14, '22:00'), ganztaegig: false, ort: 'Gaststätte (Beispiel)' },
    { titel: 'Weihnachtsfeier', beginn: tagPlus(29, '00:00'), ende: tagPlus(30, '00:00'), ganztaegig: true },
    { titel: 'Winterfliegen in der Halle', beginn: tagPlus(40, '18:00'), ende: tagPlus(40, '21:00'), ganztaegig: false, ort: 'Turnhalle' },
  ];
}

function zufall(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function demoWettbewerbe(): { wb: Wettbewerb[]; wt: Wertung[] } {
  const namen = ['Anton B.', 'Bernd K.', 'Christoph M.', 'Doris F.', 'Erich S.', 'Felix H.'];
  const wb: Wettbewerb[] = [];
  const wt: Wertung[] = [];
  const r = zufall(42);
  VORLAGEN.forEach((art, ai) => {
    const id = 'demo' + ai;
    const tn = namen.slice(0, 4 + (ai % 3)).map((n, i) => ({ id: `${id}t${i}`, name: n, klasse: '' }));
    const durchgaenge = art.id === 'limbo' ? 2 : 3;
    wb.push({
      id, name: `Vereinsmeisterschaft ${art.name.split(' ')[0]}`, datum: tagPlus(-20 - ai * 7).slice(0, 10), art: { ...art },
      klassen: [], teilnehmer: tn, durchgaenge, status: ai === 0 ? 'offen' : 'abgeschlossen', erstellt: new Date().toISOString(),
    });
    tn.forEach((t, ti) => {
      for (let d = 1; d <= durchgaenge; d++) {
        if (ai === 0 && d === 3 && ti > 1) continue; // laufender Wettbewerb
        let eingabe: Wertung['eingabe'];
        if (art.id === 'kunstflug') {
          eingabe = { felder: {}, elemente: art.elemente!.liste.map(() => ({ noten: [0, 0, 0].map(() => Math.round((5 + r() * 5) * 2) / 2) })) };
        } else if (art.id === 'segelflug') {
          eingabe = { felder: { flugzeit: Math.round(260 + r() * 70), landepunkte: Math.round(r() * 10) * 10 } };
        } else if (art.id === 'limbo') {
          eingabe = { felder: { durchfluege: Math.round(1 + r() * 6), hoehe: [100, 150, 200][Math.floor(r() * 3)], beruehrungen: Math.round(r() * 2) } };
        } else {
          eingabe = { felder: { ballons: Math.round(2 + r() * 3), zeit: Math.round(40 + r() * 80), strafpunkte: Math.round(r() * 2) * 5 } };
        }
        wt.push({ id: `${id}_${t.id}_${d}`, wettbewerbId: id, teilnehmerId: t.id, durchgang: d, eingabe, richter: 'Demo Admin', zeit: new Date().toISOString() });
      }
    });
  });
  return { wb, wt };
}

function lade(): DemoDaten {
  try {
    const d = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (d) return d;
  } catch {
    /* neu anlegen */
  }
  const { wb, wt } = demoWettbewerbe();
  const d: DemoDaten = {
    mitglieder: [
      { id: 'm1', vorname: 'Demo', nachname: 'Admin', rolle: 'admin', sparte: 'flug', aktiv: true, pin: '123456' },
      { id: 'm2', vorname: 'Max', nachname: 'Muster', rolle: 'mitglied', sparte: 'flug', aktiv: true, pin: '111111' },
      { id: 'm3', vorname: 'Erika', nachname: 'Beispiel', rolle: 'mitglied', sparte: 'schiff', aktiv: true, pin: '222222' },
    ],
    sitzungen: [],
    checkins: [{ mitgliedId: 'm3', name: 'Erika Beispiel', seit: new Date(Date.now() - 50 * 60000).toISOString(), flugleiter: true }],
    brett: [
      {
        id: 'b1', kategorie: 'biete', titel: 'Segler 2,5 m Spannweite', text: 'Gut erhalten, mit Servos, ohne Empfänger. Abholung am Platz.',
        preis: '150 €', kontakt: 'Telefon: 0170 0000000', fotos: [], verfasserId: 'm2', verfasser: 'Max Muster',
        erstellt: new Date(Date.now() - 3 * 86400000).toISOString(), ablauf: new Date(Date.now() + 57 * 86400000).toISOString(),
      },
      {
        id: 'b2', kategorie: 'suche', titel: 'Ladegerät 4S', text: 'Suche ein gebrauchtes Ladegerät für 4S-Akkus.',
        fotos: [], verfasserId: 'm3', verfasser: 'Erika Beispiel',
        erstellt: new Date(Date.now() - 86400000).toISOString(), ablauf: new Date(Date.now() + 59 * 86400000).toISOString(),
      },
    ],
    nachweise: {},
    anfragen: [{ id: 'a1', vorname: 'Klaus', nachname: 'Butz', nachricht: 'Flugmodelle, Handy 0170 0000000', erstellt: new Date(Date.now() - 3600000).toISOString() }],
    flugbuch: [{
      id: 'f1', datum: demoHeute(), name: 'Beispiel', vorname: 'Erika', vereinGast: 'Verein', kanal: 'X', schulungsnachweis: true,
      antrieb: ['elektro'], masse: '<12 kg', beginn: demoUhr(new Date(Date.now() - 50 * 60000)), ende: '', eingetragenVon: 'Erika Beispiel',
      mitgliedId: 'm3', beginnTs: new Date(Date.now() - 50 * 60000).toISOString(), endeTs: '', autoBeendet: false,
    }],
    flugleiter: [{
      id: 'l1', datum: demoHeute(), name: 'Beispiel', vorname: 'Erika', fangnetz: true, rasenGemaeht: true, wetter: 'klar', windrichtung: 'SW',
      windstaerke: 'leicht', beginn: demoUhr(new Date(Date.now() - 50 * 60000)), ende: '', mitgliedId: 'm3',
      beginnTs: new Date(Date.now() - 50 * 60000).toISOString(), endeTs: '', autoBeendet: false,
    }],
    arten: [],
    wettbewerbe: wb,
    wertungen: wt,
    einstellungen: STANDARD_EINST,
  };
  speichere(d);
  return d;
}

function speichere(d: DemoDaten) {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* Speicher voll – Demo läuft trotzdem */
  }
}

export function demoZuruecksetzen() {
  localStorage.removeItem(KEY);
}

const warte = () => new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
const uid = () => Math.random().toString(36).slice(2, 10);

export async function demoAufruf<T>(aktion: string, d: Record<string, unknown>, token?: string): Promise<T> {
  await warte();
  const db = lade();
  const s = token ? db.sitzungen.find((x) => x.token === token) ?? null : null;
  const mitglied = () => { if (!s) throw new ApiFehler('Bitte anmelden', 401); return s; };
  const admin = () => { const x = mitglied(); if (x.rolle !== 'admin') throw new ApiFehler('Nur für Admins', 403); return x; };
  const fertig = <R>(r: R) => { speichere(db); return r as unknown as T; };
  const fb = () => (db.flugbuch ??= []);
  const fl = () => (db.flugleiter ??= []);
  const anwesend = () => {
    const offenFl = fl().filter((f) => !f.ende);
    const liste: CheckIn[] = fb().filter((p) => !p.ende).map((p) => ({
      mitgliedId: p.vereinGast === 'Gast' ? 'gast:' + p.id : p.mitgliedId, name: `${p.vorname} ${p.name}${p.vereinGast === 'Gast' ? ' (Gast)' : ''}`,
      seit: p.beginnTs, flugleiter: p.vereinGast === 'Verein' && offenFl.some((f) => f.mitgliedId === p.mitgliedId),
    }));
    offenFl.forEach((f) => { if (!liste.some((x) => x.mitgliedId === f.mitgliedId)) liste.push({ mitgliedId: f.mitgliedId, name: `${f.vorname} ${f.name}`, seit: f.beginnTs, flugleiter: true }); });
    return { anzahl: liste.length, flugleiter: offenFl.length > 0, liste: s ? liste : [] };
  };
  const al = () => (db.arbeitsliste ??= demoArbeitsliste());
  const tech = () => (db.technik ??= demoTechnik());
  const heuteIso = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const ichName = () => { const x = mitglied(); return x.name; };
  const meineArbeitsdienste = () => al().filter((w) => w.bis >= heuteIso)
    .map((w) => ({ kw: w.kw, von: w.von, bis: w.bis, einsaetze: w.einsaetze.filter((e) => e.plaetze.includes(s?.name ?? '-')).map((e) => e.einsatz) }))
    .filter((w) => w.einsaetze.length).slice(0, 3);
  const arbeitsListe = () => ({
    wochen: al().map((w) => ({
      kw: w.kw, von: w.von, bis: w.bis, vorbei: w.bis < heuteIso,
      einsaetze: w.einsaetze.map((e) => ({ zeile: e.zeile, einsatz: e.einsatz, plaetze: e.plaetze.map((p) => (p ? { name: p, ich: p === s?.name } : null)) })),
    })),
    tabelle: s?.rolle === 'admin' ? 'https://docs.google.com/spreadsheets/' : undefined,
  });
  const flugbuchStatus = () => ({
    heute: demoHeute(),
    piloten: fb().filter((p) => p.datum === demoHeute() || !p.ende),
    flugleiter: fl().filter((f) => f.datum === demoHeute() || !f.ende),
    anwesend: anwesend(),
    autoStunden: db.einstellungen.checkinStunden || 6,
  });
  const ichMitglied = () => db.mitglieder.find((m) => m.id === mitglied().mitgliedId)!;
  const flugleiterAn = (b: Record<string, unknown>) => {
    const m = ichMitglied();
    if (fl().some((f) => !f.ende && f.mitgliedId === m.id)) throw new ApiFehler('Du bist bereits als Flugleiter angemeldet', 400);
    fl().push({
      id: 'l' + uid(), datum: demoHeute(), name: m.nachname, vorname: m.vorname, fangnetz: !!b.fangnetz, rasenGemaeht: !!b.rasenGemaeht,
      wetter: b.wetter as FlugleiterEintrag['wetter'], windrichtung: b.windrichtung as FlugleiterEintrag['windrichtung'], windstaerke: b.windstaerke as FlugleiterEintrag['windstaerke'],
      beginn: demoUhr(), ende: '', mitgliedId: m.id, beginnTs: new Date().toISOString(), endeTs: '', autoBeendet: false,
    });
  };

  switch (aktion) {
    case 'login': {
      const name = String(d.name || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const m = db.mitglieder.find((x) => x.aktiv && (`${x.vorname} ${x.nachname}`.toLowerCase() === name || x.nachname.toLowerCase() === name));
      if (!m || m.pin !== String(d.pin)) throw new ApiFehler('Name oder PIN falsch', 401);
      const sitz: Sitzung = { token: uid() + uid(), mitgliedId: m.id, name: `${m.vorname} ${m.nachname}`, rolle: m.rolle, ablauf: 0 };
      db.sitzungen.push(sitz);
      return fertig(sitz);
    }
    case 'logout':
      db.sitzungen = db.sitzungen.filter((x) => x.token !== token);
      return fertig(true);
    case 'ich': return fertig(mitglied());
    case 'pin_aendern': {
      const m = db.mitglieder.find((x) => x.id === mitglied().mitgliedId)!;
      if (m.pin !== d.alt) throw new ApiFehler('Bisheriger PIN ist falsch', 400);
      if (!/^\d{6,8}$/.test(String(d.neu))) throw new ApiFehler('Der neue PIN muss 6–8 Ziffern haben', 400);
      m.pin = String(d.neu);
      return fertig(true);
    }
    case 'mitglieder_liste':
      admin();
      return fertig(db.mitglieder.map(({ pin: _p, ...m }) => m));
    case 'mitglied_anlegen': {
      admin();
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      const id = 'm' + uid();
      db.mitglieder.push({ id, vorname: String(d.vorname), nachname: String(d.nachname), rolle: d.rolle === 'admin' ? 'admin' : 'mitglied', sparte: (d.sparte as Mitglied['sparte']) || '', aktiv: true, pin });
      return fertig({ id, pin });
    }
    case 'mitglied_aendern': {
      const a = admin();
      if (d.id === a.mitgliedId && (d.rolle === 'mitglied' || d.aktiv === false)) throw new ApiFehler('Du kannst dir nicht selbst die Admin-Rechte entziehen oder dich deaktivieren', 400);
      const m = db.mitglieder.find((x) => x.id === d.id);
      if (m) Object.assign(m, Object.fromEntries(Object.entries(d).filter(([k, v]) => k !== 'id' && v !== undefined)));
      if (d.aktiv === false || d.rolle) db.sitzungen = db.sitzungen.filter((x) => x.mitgliedId !== d.id);
      return fertig(true);
    }
    case 'pin_zuruecksetzen': {
      admin();
      const m = db.mitglieder.find((x) => x.id === d.id)!;
      m.pin = String(Math.floor(100000 + Math.random() * 900000));
      db.sitzungen = db.sitzungen.filter((x) => x.mitgliedId !== d.id);
      return fertig({ pin: m.pin });
    }
    case 'start':
      return fertig({ oeffentlich: true, anwesend: anwesend(), termine: demoTermine().slice(0, 3), bluetti: demoBluetti(), wetterstation: demoStation(), arbeitsdienst: s ? meineArbeitsdienste() : undefined });
    case 'wetterstation': return fertig(demoStation());
    case 'termine': return fertig(demoTermine());
    case 'bluetti': return fertig(demoBluetti());
    case 'bluetti_verlauf': {
      const tage = d.tage === 7 ? 7 : 1;
      const n = tage === 7 ? 168 : 144;
      const schritt = (tage * 86400000) / n;
      const punkte = Array.from({ length: n }, (_, i) => {
        const t = Date.now() - (n - i) * schritt;
        const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
        const sonne = Math.max(0, Math.sin(((h - 7) / 11) * Math.PI));
        return { zeit: new Date(t).toISOString(), soc: Math.round(55 + 30 * Math.sin(((h - 10) / 24) * 2 * Math.PI)), solar: Math.round(sonne * 480) };
      });
      return fertig({ eingerichtet: true, punkte });
    }
    case 'einstellungen': return fertig(db.einstellungen);
    case 'einstellungen_speichern':
      admin();
      db.einstellungen = { ...db.einstellungen, ...(d as Partial<Einstellungen>) };
      return fertig(db.einstellungen);
    case 'foto_hochladen':
      mitglied();
      return fertig({ id: uid(), name: `demo_${Date.now()}.jpg` });
    case 'anwesende': return fertig(anwesend());
    case 'checkin': {
      const m = mitglied();
      db.checkins = db.checkins.filter((c) => c.mitgliedId !== m.mitgliedId);
      db.checkins.push({ mitgliedId: m.mitgliedId, name: m.name, seit: new Date().toISOString(), flugleiter: !!d.flugleiter });
      return fertig(anwesend());
    }
    case 'checkout': {
      const m = mitglied();
      db.checkins = db.checkins.filter((c) => c.mitgliedId !== m.mitgliedId);
      return fertig(anwesend());
    }
    case 'zugang_anfragen': {
      const vorname = String(d.vorname || '').trim();
      const nachname = String(d.nachname || '').trim();
      if (!vorname || !nachname) throw new ApiFehler('Bitte Vor- und Nachname angeben', 400);
      if (db.mitglieder.some((m) => m.aktiv && `${m.vorname} ${m.nachname}`.toLowerCase() === `${vorname} ${nachname}`.toLowerCase()))
        throw new ApiFehler('Du bist bereits registriert. PIN vergessen? Bitte beim Vorstand melden.', 400);
      (db.anfragen ??= []).push({ id: 'a' + uid(), vorname, nachname, nachricht: String(d.nachricht || ''), erstellt: new Date().toISOString() });
      return fertig({ ok: true });
    }
    case 'anfragen_liste': admin(); return fertig(db.anfragen ?? []);
    case 'anfrage_freigeben': {
      admin();
      const a = (db.anfragen ?? []).find((x) => x.id === d.id);
      if (!a) throw new ApiFehler('Anfrage nicht gefunden', 404);
      const pin = String(Math.floor(100000 + Math.random() * 900000));
      db.mitglieder.push({ id: 'm' + uid(), vorname: a.vorname, nachname: a.nachname, rolle: d.rolle === 'admin' ? 'admin' : 'mitglied', sparte: 'flug', aktiv: true, pin });
      db.anfragen = (db.anfragen ?? []).filter((x) => x.id !== a.id);
      return fertig({ pin, vorname: a.vorname, nachname: a.nachname });
    }
    case 'anfrage_ablehnen': admin(); db.anfragen = (db.anfragen ?? []).filter((x) => x.id !== d.id); return fertig(true);
    case 'flugbuch_status': mitglied(); return fertig(flugbuchStatus());
    case 'flugbuch_anmelden': {
      const m = ichMitglied();
      const e = d.eintrag as PilotEingabe;
      if (!e?.regelnBestaetigt) throw new ApiFehler('Bitte bestätigen, dass dir die Betriebsregeln bekannt sind', 400);
      if (!e.antrieb?.length) throw new ApiFehler('Bitte die Antriebsart wählen', 400);
      if (!e.masse) throw new ApiFehler('Bitte die Gewichtsklasse wählen', 400);
      const gast = e.art === 'gast';
      if (!gast && fb().some((p) => !p.ende && p.mitgliedId === m.id && p.vereinGast === 'Verein')) throw new ApiFehler('Du bist bereits im Flugbuch angemeldet', 400);
      fb().push({
        id: 'f' + uid(), datum: demoHeute(), name: gast ? String(e.gastName) : m.nachname, vorname: gast ? String(e.gastVorname) : m.vorname,
        vereinGast: gast ? 'Gast' : 'Verein', kanal: '', schulungsnachweis: !!e.schulungsnachweis, antrieb: e.antrieb, masse: e.masse,
        beginn: demoUhr(), ende: '', eingetragenVon: `${m.vorname} ${m.nachname}`, mitgliedId: m.id, beginnTs: new Date().toISOString(), endeTs: '', autoBeendet: false,
      });
      if (d.flugleiter) flugleiterAn(d.flugleiter as Record<string, unknown>);
      return fertig(flugbuchStatus());
    }
    case 'flugbuch_abmelden': {
      const ich = mitglied();
      const p = fb().find((x) => x.id === d.id && !x.ende);
      if (!p) throw new ApiFehler('Eintrag nicht gefunden oder schon abgemeldet', 404);
      if (p.mitgliedId !== ich.mitgliedId && ich.rolle !== 'admin') throw new ApiFehler('Nur eigene Einträge abmelden', 403);
      p.ende = demoUhr(); p.endeTs = new Date().toISOString();
      if (typeof d.vorkommnisse === 'string') p.vorkommnisse = d.vorkommnisse.trim().slice(0, 1000);
      return fertig(flugbuchStatus());
    }
    case 'technik_liste': return fertig(tech().filter((a) => s || !a.nurMitglieder));
    case 'technik_speichern': {
      const x = admin();
      const alt = tech().find((a) => a.id === d.id);
      const bilder = (alt?.bilder ?? []).filter((b) => !((d.entfernteBilder as string[] | undefined) ?? []).includes(b))
        .concat(((d.neueBilder as string[] | undefined) ?? []).map((b64) => 'data:image/jpeg;base64,' + b64));
      const a: TechnikAbschnitt = {
        id: alt?.id ?? 't' + uid(), titel: String(d.titel ?? '').slice(0, 60), icon: String(d.icon ?? 'zahnrad'),
        grafik: d.grafik === 'wetterstation' ? 'wetterstation' : '', nurMitglieder: d.nurMitglieder === true,
        text: String(d.text ?? ''), bilder, reihenfolge: alt?.reihenfolge ?? tech().length + 1, geaendert: new Date().toISOString(), geaendertVon: x.name,
      };
      if (!a.titel) throw new ApiFehler('Bitte einen Titel angeben', 400);
      db.technik = alt ? tech().map((t) => (t.id === a.id ? a : t)) : [...tech(), a];
      return fertig(tech());
    }
    case 'technik_loeschen': admin(); db.technik = tech().filter((a) => a.id !== d.id); return fertig(tech());
    case 'technik_sortieren': {
      admin();
      const ids = d.ids as string[];
      db.technik = tech().map((a) => ({ ...a, reihenfolge: ids.indexOf(a.id) + 1 })).sort((a, b) => a.reihenfolge - b.reihenfolge);
      return fertig(tech());
    }
    case 'arbeitsdienst_liste': mitglied(); return fertig(arbeitsListe());
    case 'arbeitsdienst_eintragen': {
      const name = ichName();
      const w = al().find((x) => x.einsaetze.some((e) => e.zeile === d.zeile));
      const e = w?.einsaetze.find((x) => x.zeile === d.zeile);
      if (!w || !e || w.kw !== d.kw) throw new ApiFehler('Die Liste wurde inzwischen geändert – bitte neu laden', 409);
      if (w.bis < heuteIso) throw new ApiFehler('Diese Woche ist schon vorbei', 400);
      if (e.plaetze.includes(name)) throw new ApiFehler('Du bist hier schon eingetragen', 400);
      const frei = e.plaetze.indexOf('');
      if (frei < 0) throw new ApiFehler('Leider schon voll – such dir einen anderen Termin aus', 409);
      e.plaetze[frei] = name;
      return fertig(arbeitsListe());
    }
    case 'arbeitsdienst_austragen': {
      admin();
      const e = al().flatMap((w) => w.einsaetze).find((x) => x.zeile === d.zeile);
      if (!e || !e.plaetze[Number(d.platz)]) throw new ApiFehler('Die Liste wurde inzwischen geändert – bitte neu laden', 409);
      e.plaetze[Number(d.platz)] = '';
      return fertig(arbeitsListe());
    }
    case 'flugbuch_kommentar': {
      const ich = mitglied();
      const p = fb().find((x) => x.id === d.id);
      if (!p) throw new ApiFehler('Eintrag nicht gefunden', 404);
      if (p.mitgliedId !== ich.mitgliedId && ich.rolle !== 'admin') throw new ApiFehler('Nur zum eigenen Eintrag', 403);
      if (p.ende && ich.rolle !== 'admin') throw new ApiFehler('Du bist schon abgemeldet', 400);
      p.vorkommnisse = String(d.text ?? '').trim().slice(0, 1000);
      return fertig(flugbuchStatus());
    }
    case 'flugleiter_anmelden': flugleiterAn(d.bedingungen as Record<string, unknown>); return fertig(flugbuchStatus());
    case 'flugleiter_abmelden': {
      const ich = mitglied();
      fl().filter((f) => !f.ende && (f.id === d.id || f.mitgliedId === ich.mitgliedId)).forEach((f) => { f.ende = demoUhr(); f.endeTs = new Date().toISOString(); });
      return fertig(flugbuchStatus());
    }
    case 'flugbuch_liste': {
      admin();
      const isoD = (t: string) => t.split('.').reverse().join('-');
      const im = (t: string) => isoD(t) >= String(d.von || '0') && isoD(t) <= String(d.bis || '9');
      return fertig({ piloten: fb().filter((p) => im(p.datum)).reverse(), flugleiter: fl().filter((f) => im(f.datum)).reverse(), tabelle: 'https://docs.google.com/spreadsheets' });
    }
    case 'brett_liste':
      mitglied();
      return fertig(db.brett.slice().sort((a, b) => b.erstellt.localeCompare(a.erstellt)));
    case 'brett_speichern': {
      const m = mitglied();
      const alt = db.brett.find((b) => b.id === d.id);
      if (alt && alt.verfasserId !== m.mitgliedId && m.rolle !== 'admin') throw new ApiFehler('Nur eigene Beiträge bearbeiten', 403);
      const neueFotos = ((d.neueFotos as string[]) || []).map((b64) => 'data:image/jpeg;base64,' + b64);
      const fotos = [...(alt?.fotos ?? []).filter((f) => !((d.entfernteFotos as string[]) || []).includes(f)), ...neueFotos].slice(0, 3);
      const b: BrettBeitrag = {
        id: alt?.id ?? 'b' + uid(), kategorie: (d.kategorie as BrettBeitrag['kategorie']) || 'info', titel: String(d.titel || ''),
        text: String(d.text || ''), preis: String(d.preis || ''), kontakt: String(d.kontakt || ''), fotos,
        verfasserId: alt?.verfasserId ?? m.mitgliedId, verfasser: alt?.verfasser ?? m.name, erstellt: alt?.erstellt ?? new Date().toISOString(),
        ablauf: new Date(Date.now() + 60 * 86400000).toISOString(),
      };
      if (!b.titel) throw new ApiFehler('Titel fehlt', 400);
      db.brett = [...db.brett.filter((x) => x.id !== b.id), b];
      return fertig(b);
    }
    case 'brett_loeschen': {
      const m = mitglied();
      const b = db.brett.find((x) => x.id === d.id);
      if (b && b.verfasserId !== m.mitgliedId && m.rolle !== 'admin') throw new ApiFehler('Nur eigene Beiträge löschen', 403);
      db.brett = db.brett.filter((x) => x.id !== d.id);
      return fertig(true);
    }
    case 'nachweise': return fertig(db.nachweise[mitglied().mitgliedId] ?? {});
    case 'nachweise_speichern': {
      const m = mitglied();
      db.nachweise[m.mitgliedId] = { kenntnisnachweis: d.kenntnisnachweis as string, eid: d.eid as string, versicherung: d.versicherung as string };
      return fertig(db.nachweise[m.mitgliedId]);
    }
    case 'push_abo': mitglied(); return fertig(true);
    case 'push_abo_loeschen': return fertig(true);
    case 'mitteilung_senden': admin(); return fertig({ gesendet: 0 });
    case 'wertungsarten': return fertig(db.arten);
    case 'wertungsart_speichern': {
      admin();
      const alt = db.arten.find((a) => a.id === d.id) ?? VORLAGEN.find((a) => a.id === d.id);
      const a = { ...(d as unknown as Wertungsart), version: (alt?.version ?? 0) + 1, geaendert: new Date().toISOString() };
      db.arten = [...db.arten.filter((x) => x.id !== a.id), a];
      return fertig(a);
    }
    case 'wertungsart_loeschen':
      admin();
      db.arten = db.arten.filter((x) => x.id !== d.id);
      return fertig(true);
    case 'wettbewerbe':
      return fertig(db.wettbewerbe.map((w) => ({ id: w.id, name: w.name, datum: w.datum, artName: w.art.name, status: w.status, teilnehmer: w.teilnehmer.length }))
        .sort((a, b) => b.datum.localeCompare(a.datum)));
    case 'wettbewerb': {
      const w = db.wettbewerbe.find((x) => x.id === d.id);
      if (!w) throw new ApiFehler('Wettbewerb nicht gefunden', 404);
      return fertig({ wettbewerb: w, wertungen: db.wertungen.filter((x) => x.wettbewerbId === w.id) });
    }
    case 'wettbewerb_speichern': {
      admin();
      const w = { ...(d as unknown as Wettbewerb) };
      if (!w.id) { w.id = 'w' + uid(); w.erstellt = new Date().toISOString(); w.status = 'offen'; }
      w.teilnehmer = w.teilnehmer.map((t) => ({ ...t, id: t.id || 't' + uid() }));
      db.wettbewerbe = [...db.wettbewerbe.filter((x) => x.id !== w.id), w];
      return fertig(w);
    }
    case 'wettbewerb_loeschen':
      admin();
      db.wettbewerbe = db.wettbewerbe.filter((x) => x.id !== d.id);
      db.wertungen = db.wertungen.filter((x) => x.wettbewerbId !== d.id);
      return fertig(true);
    case 'wertung_speichern': {
      const a = admin();
      const w: Wertung = {
        id: `${d.wettbewerbId}_${d.teilnehmerId}_${d.durchgang}`, wettbewerbId: String(d.wettbewerbId), teilnehmerId: String(d.teilnehmerId),
        durchgang: Number(d.durchgang), eingabe: d.eingabe as Wertung['eingabe'], richter: a.name, zeit: new Date().toISOString(),
      };
      db.wertungen = [...db.wertungen.filter((x) => x.id !== w.id), w];
      return fertig(w);
    }
    case 'wertung_loeschen':
      admin();
      db.wertungen = db.wertungen.filter((x) => x.id !== d.id);
      return fertig(true);
  }
  throw new ApiFehler('Unbekannte Aktion: ' + aktion, 400);
}

function demoBluetti() {
  const h = new Date().getHours();
  const sonne = Math.max(0, Math.sin(((h - 7) / 11) * Math.PI));
  const solar = Math.round(sonne * 460);
  const ac = 85;
  const dc = 12;
  return {
    erreichbar: true,
    zeit: new Date().toISOString(),
    daten: {
      soc: 78, solar_input_w: solar, grid_input_w: 0, ac_output_w: ac, dc_output_w: dc, net_power_w: solar - ac - dc,
      dc_active: true, ac_active: true, pack_count: 3, pack_internal: true, pack_b300_1: true, pack_b300_2: true,
      pack1_soc: 81, pack2_soc: 77, pack3_soc: 76, connected: true,
    },
  };
}

/** Demo-Arbeitsliste: letzte Woche (vorbei), dann alle zwei Wochen ab nächster Woche; Max Muster ist nächste Woche dabei */
function demoArbeitsliste(): DemoAWoche[] {
  const mo = new Date(); mo.setHours(0, 0, 0, 0);
  mo.setDate(mo.getDate() - ((mo.getDay() + 6) % 7) - 7);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const kw = (d: Date) => { const t = new Date(d); t.setDate(t.getDate() + 3); const j = new Date(t.getFullYear(), 0, 4); return 1 + Math.round(((t.getTime() - j.getTime()) / 86400000 - 3 + ((j.getDay() + 6) % 7)) / 7); };
  const extra: Record<number, string[]> = { 1: ['Walzen'], 3: ['Nematoden'], 5: ['Düngen (Herbst)', 'Walzen'] };
  let zeile = 2;
  return Array.from({ length: 8 }, (_, i) => {
    const d = new Date(mo); d.setDate(mo.getDate() + i * 14);
    const so = new Date(d); so.setDate(d.getDate() + 6);
    const einsaetze = ['Platzpflege', ...(extra[i] ?? [])].map((e) => ({ zeile: zeile++, einsatz: e, plaetze: ['', ''] }));
    return { kw: 'KW' + kw(d), von: iso(d), bis: iso(so), einsaetze };
  }).map((w, i) => {
    if (i === 0) w.einsaetze[0].plaetze = ['Erika Beispiel', 'Demo Admin'];
    if (i === 1) w.einsaetze[0].plaetze = ['Max Muster', ''];
    if (i === 3) w.einsaetze[1].plaetze = ['Erika Beispiel', ''];
    if (i === 4) w.einsaetze[0].plaetze = ['Demo Admin', 'Erika Beispiel'];
    return w;
  });
}

function demoTechnik(): TechnikAbschnitt[] {
  const a = (titel: string, icon: string, text: string, extra: Partial<TechnikAbschnitt> = {}, i = 0): TechnikAbschnitt =>
    ({ id: 't' + i, titel, icon, text, grafik: '', nurMitglieder: false, bilder: [], reihenfolge: i + 1, ...extra });
  return [
    a('Wetterstation', 'wind', 'Die Wetterstation am Platz misst Wind, Temperatur, Luftfeuchte und Luftdruck.\n## Aufbau\n- **Steuerung:** ESP32 (NodeMCU-32S)\n- **Temperatur, Luftfeuchte, Luftdruck:** BME280 (I²C)\n- **Wind:** Anemometer 4–20 mA, Windfahne analog\n## Ablauf\n- Messung alle 30 Sekunden\n- alle 10 Minuten Upload an Wettermonster', { grafik: 'wetterstation' }, 0),
    a('Walze', 'schaufel', '_Bitte ergänzen._\n## Wozu\n- …\n## Bedienung\n- …', {}, 1),
    a('Dixi-Toilette', 'schloss', '**Zahlenkombination Schloss:** 0-0-0-0 (Demo)\n\nBitte nach Benutzung wieder abschließen.', { nurMitglieder: true }, 2),
    a('Ladesteckdosen', 'akku', 'Die Ladesteckdosen sind mit **15 Ampere** abgesichert.\n- Alle Ladegeräte zusammen dürfen 15 A nicht überschreiten.', {}, 3),
  ];
}

function demoStation() {
  return {
    erreichbar: true, zeit: new Date().toISOString(),
    daten: { temperatur: 3.8, wind: 6.4, richtung: 'SW', luftdruck: 967.5, luftfeuchte: 94, batterie: 13.74 },
  };
}
