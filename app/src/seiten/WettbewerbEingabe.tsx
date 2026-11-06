import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Fehler, Hinweis, Knopf, Laden, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { berechneDurchgang, formatZeit, parseZeit } from '../lib/auswertung';
import { klassen } from '../lib/helfer';
import type { Eingabe, Feld, FeldWert, Wertung, Wettbewerb } from '../lib/model';

/** Texteingaben je Feld: Schlüssel "feld" bzw. "e<idx>.feld", Listen mit "#<n>" */
type Texte = Record<string, string>;

function zuText(f: Feld, w: FeldWert | undefined, pfad: string, out: Texte) {
  if (f.typ === 'liste') {
    const arr = Array.isArray(w) ? w : [];
    for (let i = 0; i < (f.anzahl ?? 1); i++) out[`${pfad}#${i}`] = arr[i] !== undefined ? String(arr[i]).replace('.', ',') : '';
  } else if (w !== undefined) {
    const n = Array.isArray(w) ? w[0] : w;
    out[pfad] = f.typ === 'zeit' ? formatZeit(n) : f.typ === 'janein' ? (n ? '1' : '0') : String(n).replace('.', ',');
  }
}

function lies(f: Feld, t: Texte, pfad: string): { wert?: FeldWert; fehler?: string } {
  const pruef = (n: number) => {
    if (f.min !== undefined && n < f.min) return `${f.label}: mindestens ${f.min}`;
    if (f.max !== undefined && n > f.max) return `${f.label}: höchstens ${f.max}`;
    return undefined;
  };
  if (f.typ === 'liste') {
    const werte: number[] = [];
    for (let i = 0; i < (f.anzahl ?? 1); i++) {
      const s = (t[`${pfad}#${i}`] ?? '').trim();
      if (!s) continue;
      const n = parseFloat(s.replace(',', '.'));
      if (!Number.isFinite(n)) return { fehler: `${f.label}: ungültige Zahl „${s}“` };
      const e = pruef(n);
      if (e) return { fehler: e };
      werte.push(n);
    }
    return { wert: werte };
  }
  const s = (t[pfad] ?? '').trim();
  if (f.typ === 'janein') return { wert: s === '1' ? 1 : 0 };
  if (!s) return { wert: 0 };
  const n = f.typ === 'zeit' ? parseZeit(s) : parseFloat(s.replace(',', '.'));
  if (n === null || !Number.isFinite(n)) return { fehler: `${f.label}: ${f.typ === 'zeit' ? 'Zeit als mm:ss eingeben' : `ungültige Zahl „${s}“`}` };
  const e = pruef(n);
  return e ? { fehler: e } : { wert: n };
}

function FeldEingabe({ f, t, pfad, setze }: { f: Feld; t: Texte; pfad: string; setze: (k: string, v: string) => void }) {
  const gross = 'eingabe text-center text-xl font-bold tabular-nums';
  if (f.typ === 'janein') {
    const an = t[pfad] === '1';
    return (
      <div>
        <span className="label">{f.label}</span>
        <div className="grid grid-cols-2 gap-2">
          {['Nein', 'Ja'].map((x, i) => (
            <button key={x} type="button" onClick={() => setze(pfad, String(i))} className={klassen('min-h-12 rounded-xl font-bold', (an ? 1 : 0) === i ? 'bg-himmel-600 text-white' : 'bg-himmel-100 dark:bg-slate-800')}>{x}</button>
          ))}
        </div>
      </div>
    );
  }
  if (f.typ === 'liste') {
    return (
      <div>
        <span className="label">{f.label}{f.einheit ? ` (${f.einheit})` : ''}</span>
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(f.anzahl ?? 1, 5)}, minmax(0, 1fr))` }}>
          {Array.from({ length: f.anzahl ?? 1 }, (_, i) => (
            <input key={i} className={gross} inputMode="decimal" aria-label={`${f.label} Richter ${i + 1}`} placeholder={`R${i + 1}`}
              value={t[`${pfad}#${i}`] ?? ''} onChange={(e) => setze(`${pfad}#${i}`, e.target.value)} />
          ))}
        </div>
      </div>
    );
  }
  return (
    <label className="block">
      <span className="label">{f.label}{f.einheit && f.typ !== 'zeit' ? ` (${f.einheit})` : ''}</span>
      <input className={gross} inputMode={f.typ === 'zeit' ? 'text' : 'decimal'} placeholder={f.typ === 'zeit' ? 'mm:ss' : '0'}
        value={t[pfad] ?? ''} onChange={(e) => setze(pfad, e.target.value)} />
    </label>
  );
}

function Inhalt() {
  const { id } = useParams();
  const { daten, fehler, laedt, neu, setDaten } = useLaden(() => api<{ wettbewerb: Wettbewerb; wertungen: Wertung[] }>('wettbewerb', { id }), [id]);
  const [tn, setTn] = useState('');
  const [dg, setDg] = useState(1);
  const [texte, setTexte] = useState<Texte>({});
  const [msg, setMsg] = useState<{ art: 'ok' | 'fehler'; text: string } | null>(null);
  const [sendet, setSendet] = useState(false);
  const wb = daten?.wettbewerb;
  const art = wb?.art;

  const vorhanden = (t: string, d: number) => daten?.wertungen.find((w) => w.teilnehmerId === t && w.durchgang === d);

  // Formular mit vorhandener Wertung füllen
  useEffect(() => {
    if (!art || !tn) return;
    const w = vorhanden(tn, dg);
    const t: Texte = {};
    if (w) {
      art.felder.forEach((f) => zuText(f, w.eingabe.felder[f.key], f.key, t));
      art.elemente?.liste.forEach((_, i) => art.felder.forEach((f) => zuText(f, w.eingabe.elemente?.[i]?.[f.key], `e${i}.${f.key}`, t)));
    }
    setTexte(t);
    setMsg(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tn, dg, art]);

  useEffect(() => {
    if (wb && !tn && wb.teilnehmer.length) setTn(wb.teilnehmer[0].id);
  }, [wb, tn]);

  const ergebnis = useMemo((): { eingabe?: Eingabe; punkte?: number; fehler?: string } => {
    if (!art) return {};
    const felder: Record<string, FeldWert> = {};
    const elemente: Record<string, FeldWert>[] = [];
    if (art.elemente?.liste.length) {
      for (let i = 0; i < art.elemente.liste.length; i++) {
        const el: Record<string, FeldWert> = {};
        for (const f of art.felder) {
          const r = lies(f, texte, `e${i}.${f.key}`);
          if (r.fehler) return { fehler: `${art.elemente.liste[i].name} – ${r.fehler}` };
          el[f.key] = r.wert!;
        }
        elemente.push(el);
      }
    } else {
      for (const f of art.felder) {
        const r = lies(f, texte, f.key);
        if (r.fehler) return { fehler: r.fehler };
        felder[f.key] = r.wert!;
      }
    }
    const eingabe: Eingabe = art.elemente?.liste.length ? { felder, elemente } : { felder };
    try {
      return { eingabe, punkte: Math.round(berechneDurchgang(art, eingabe) * 100) / 100 };
    } catch (e) {
      return { eingabe, fehler: (e as Error).message };
    }
  }, [art, texte]);

  async function speichern() {
    if (!ergebnis.eingabe || ergebnis.fehler) return;
    setSendet(true);
    try {
      const w = await api<Wertung>('wertung_speichern', { wettbewerbId: wb!.id, teilnehmerId: tn, durchgang: dg, eingabe: ergebnis.eingabe });
      const name = wb!.teilnehmer.find((t) => t.id === tn)?.name;
      setDaten({ ...daten!, wertungen: [...daten!.wertungen.filter((x) => x.id !== w.id), w] });
      // Zum nächsten Teilnehmer ohne Wertung in diesem Durchgang springen
      const naechster = wb!.teilnehmer.find((t) => t.id !== tn && !vorhanden(t.id, dg));
      setMsg({ art: 'ok', text: `Gespeichert: ${name}, Durchgang ${dg} – ${ergebnis.punkte} Punkte` });
      if (naechster) setTimeout(() => setTn(naechster.id), 600);
    } catch (e) {
      setMsg({ art: 'fehler', text: (e as Error).message });
    } finally {
      setSendet(false);
    }
  }

  if (laedt && !daten) return <Laden />;
  if (!wb || !art) return fehler ? <Fehler fehler={fehler} nochmal={neu} /> : null;
  if (!wb.teilnehmer.length) return <Hinweis art="warnung">Noch keine Teilnehmer. <Link className="underline" to={`/wettbewerbe/${wb.id}/bearbeiten`}>Teilnehmer hinzufügen</Link></Hinweis>;
  const setze = (k: string, v: string) => setTexte((t) => ({ ...t, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="karte space-y-3 p-4">
        <label className="block">
          <span className="label">Teilnehmer</span>
          <select className="eingabe text-lg font-semibold" value={tn} onChange={(e) => setTn(e.target.value)}>
            {wb.teilnehmer.map((t) => (
              <option key={t.id} value={t.id}>{vorhanden(t.id, dg) ? '✓ ' : ''}{t.name}{t.klasse ? ` (${t.klasse})` : ''}</option>
            ))}
          </select>
        </label>
        <div>
          <span className="label">Durchgang</span>
          <div className="flex gap-2">
            {Array.from({ length: wb.durchgaenge }, (_, i) => i + 1).map((d) => (
              <button key={d} onClick={() => setDg(d)} className={klassen('relative min-h-12 flex-1 rounded-xl text-lg font-bold', dg === d ? 'bg-himmel-600 text-white' : 'bg-himmel-100 dark:bg-slate-800')}>
                {d}
                {vorhanden(tn, d) && <span className="absolute right-1.5 top-1 text-xs">✓</span>}
              </button>
            ))}
          </div>
        </div>
      </div>

      {vorhanden(tn, dg) && <Hinweis art="warnung">Für diesen Durchgang gibt es schon eine Wertung – Speichern überschreibt sie.</Hinweis>}

      {art.elemente?.liste.length ? (
        art.elemente.liste.map((el, i) => (
          <div key={i} className="karte space-y-3 p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">{i + 1}. {el.name}</h3>
              <span className="text-sm text-slate-500">{Object.entries(el.werte).map(([k, v]) => `${k} = ${v}`).join(', ')}</span>
            </div>
            {art.felder.map((f) => <FeldEingabe key={f.key} f={f} t={texte} pfad={`e${i}.${f.key}`} setze={setze} />)}
          </div>
        ))
      ) : (
        <div className="karte space-y-4 p-4">
          {art.felder.map((f) => <FeldEingabe key={f.key} f={f} t={texte} pfad={f.key} setze={setze} />)}
        </div>
      )}

      <div className="sticky bottom-20 z-10 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-himmel-200 backdrop-blur dark:bg-slate-900/95 dark:ring-slate-700">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-slate-500">Punkte (vor Normierung)</span>
          <span className={klassen('text-2xl font-extrabold tabular-nums', ergebnis.fehler && 'text-base text-mgi-rot')}>
            {ergebnis.fehler ?? ergebnis.punkte?.toLocaleString('de-DE')}
          </span>
        </div>
        <Knopf className="w-full text-lg" onClick={speichern} laedt={sendet} disabled={!!ergebnis.fehler}>Speichern</Knopf>
      </div>
      {msg && <Hinweis art={msg.art}>{msg.text}</Hinweis>}
      <Link to={`/wettbewerbe/${wb.id}`} className="flex min-h-12 items-center justify-center gap-2 font-semibold text-himmel-700 dark:text-himmel-200">
        <Icon name="pokal" className="h-5 w-5" /> Zur Rangliste
      </Link>
    </div>
  );
}

export default function WettbewerbEingabe() {
  return (
    <Seite titel="Wertung eintragen">
      <NurMitglied admin><Inhalt /></NurMitglied>
    </Seite>
  );
}
