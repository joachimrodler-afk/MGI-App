/**
 * Technik am Platz – Wetterstation, Walze, Dixi-Toilette, Ladesteckdosen …
 * Admins pflegen die Abschnitte direkt in der App. Abschnitte „nur Mitglieder“ (z. B. Zahlenschloss)
 * liefert das Backend nur mit Anmeldung aus.
 */
import { useRef, useState } from 'react';
import { BlockschaltbildLadung, BlockschaltbildStrom, BlockschaltbildWetterstation } from '../components/Blockschaltbild';
import { Icon } from '../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden, Leer, Schalter, Seite, useLaden } from '../components/ui';
import { api, erinnere, merke } from '../lib/api';
import { bildVerkleinern, klassen, markdown } from '../lib/helfer';
import type { RabenschreckStatus, TechnikAbschnitt } from '../lib/model';
import { useSitzung } from '../lib/sitzung';

const ICONS: { k: string; n: string }[] = [
  { k: 'zahnrad', n: 'Allgemein' }, { k: 'wind', n: 'Wetter' }, { k: 'akku', n: 'Strom' }, { k: 'schloss', n: 'Schloss' },
  { k: 'schaufel', n: 'Gerät' }, { k: 'webcam', n: 'Kamera' }, { k: 'flieger', n: 'Flug' }, { k: 'notfall', n: 'Sicherheit' },
];
const GRAFIKEN: { k: TechnikAbschnitt['grafik']; n: string }[] = [{ k: '', n: 'keine' }, { k: 'wetterstation', n: 'Blockschaltbild Wetterstation' }, { k: 'strom', n: 'Blockschaltbild Stromversorgung' }, { k: 'ladung', n: 'Blockschaltbild Ladeanschlüsse' }];

function Editor({ alt, fertig, abbrechen }: { alt?: TechnikAbschnitt; fertig: (l: TechnikAbschnitt[]) => void; abbrechen: () => void }) {
  const [titel, setTitel] = useState(alt?.titel ?? '');
  const [icon, setIcon] = useState(alt?.icon ?? 'zahnrad');
  const [grafik, setGrafik] = useState<TechnikAbschnitt['grafik']>(alt?.grafik ?? '');
  const [nurMitglieder, setNurMitglieder] = useState(alt?.nurMitglieder ?? false);
  const [text, setText] = useState(alt?.text ?? '');
  const [bilder, setBilder] = useState<string[]>(alt?.bilder ?? []);
  const [neu, setNeu] = useState<{ b64: string; vorschau: string }[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState('');
  const [loeschFrage, setLoeschFrage] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function dateien(fs: FileList | null) {
    for (const f of Array.from(fs ?? []).slice(0, 6 - bilder.length - neu.length)) {
      const b = await bildVerkleinern(f, 1800, 0.85);
      setNeu((x) => [...x, { b64: b.base64, vorschau: b.vorschau }]);
    }
  }

  async function speichern(ev: React.FormEvent) {
    ev.preventDefault();
    setLaedt(true); setFehler('');
    try {
      fertig(await api<TechnikAbschnitt[]>('technik_speichern', {
        id: alt?.id, titel, icon, grafik, nurMitglieder, text,
        neueBilder: neu.map((n) => n.b64), entfernteBilder: (alt?.bilder ?? []).filter((b) => !bilder.includes(b)),
      }));
    } catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  }

  async function loeschen() {
    setLaedt(true); setFehler('');
    try { fertig(await api<TechnikAbschnitt[]>('technik_loeschen', { id: alt!.id })); } catch (e) { setFehler((e as Error).message); } finally { setLaedt(false); }
  }

  return (
    <form onSubmit={speichern} className="karte space-y-4 border-2 border-himmel-300 p-4">
      <h2 className="text-lg font-bold">{alt ? 'Abschnitt bearbeiten' : 'Neuer Abschnitt'}</h2>
      <Feld label="Titel"><input className="eingabe" value={titel} onChange={(e) => setTitel(e.target.value)} required maxLength={60} placeholder="z. B. Rasenmäher" /></Feld>
      <div>
        <span className="label">Symbol</span>
        <div className="grid grid-cols-4 gap-2">
          {ICONS.map((i) => (
            <button type="button" key={i.k} onClick={() => setIcon(i.k)} aria-pressed={icon === i.k}
              className={klassen('flex min-h-14 flex-col items-center justify-center rounded-xl text-xs font-semibold', icon === i.k ? 'bg-himmel-600 text-white' : 'bg-himmel-100 dark:bg-slate-800')}>
              <Icon name={i.k} className="h-5 w-5" />{i.n}
            </button>
          ))}
        </div>
      </div>
      <Feld label="Text" hilfe="**fett**, _kursiv_, „- “ für Aufzählungen, „## “ für Zwischenüberschriften">
        <textarea rows={12} className="eingabe !h-auto font-mono text-sm" value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} />
      </Feld>
      <Feld label="Grafik">
        <select className="eingabe" value={grafik} onChange={(e) => setGrafik(e.target.value as TechnikAbschnitt['grafik'])}>
          {GRAFIKEN.map((g) => <option key={g.k} value={g.k}>{g.n}</option>)}
        </select>
      </Feld>
      <div>
        <span className="label">Fotos (max. 6)</span>
        <div className="flex flex-wrap gap-2">
          {bilder.map((b) => (
            <div key={b} className="relative h-20 w-20 overflow-hidden rounded-xl">
              <img src={b} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setBilder((x) => x.filter((y) => y !== b))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white" aria-label="Foto entfernen"><Icon name="x" className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {neu.map((n, i) => (
            <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl">
              <img src={n.vorschau} alt="" className="h-full w-full object-cover" />
              <button type="button" onClick={() => setNeu((x) => x.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-1 text-white" aria-label="Foto entfernen"><Icon name="x" className="h-3.5 w-3.5" /></button>
            </div>
          ))}
          {bilder.length + neu.length < 6 && (
            <button type="button" onClick={() => input.current?.click()} className="flex h-20 w-20 items-center justify-center rounded-xl border-2 border-dashed border-himmel-300 text-himmel-600" aria-label="Foto hinzufügen">
              <Icon name="plus" />
            </button>
          )}
          <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => { void dateien(e.target.files); e.target.value = ''; }} />
        </div>
      </div>
      <Schalter an={nurMitglieder} onChange={setNurMitglieder} label="Nur für angemeldete Mitglieder" text="z. B. für Zahlenkombinationen – ohne Anmeldung unsichtbar" />
      {nurMitglieder || !/\b\d{3,}\b/.test(text) ? null : (
        <Hinweis art="warnung">Steht hier eine Zahlenkombination? Dann „Nur für angemeldete Mitglieder“ einschalten.</Hinweis>
      )}
      {fehler && <Fehler fehler={fehler} />}
      <div className="flex gap-2">
        <Knopf type="submit" className="flex-1" laedt={laedt}>Speichern</Knopf>
        <Knopf type="button" art="sekundaer" onClick={abbrechen}>Abbrechen</Knopf>
      </div>
      {alt && (loeschFrage ? (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-sm dark:bg-red-950">
          <span className="flex-1">„{alt.titel}“ wirklich löschen?</span>
          <Knopf type="button" art="gefahr" className="!min-h-10" onClick={loeschen} laedt={laedt}>Löschen</Knopf>
          <Knopf type="button" art="leise" className="!min-h-10" onClick={() => setLoeschFrage(false)}>Nein</Knopf>
        </div>
      ) : (
        <Knopf type="button" art="leise" className="w-full text-mgi-rot" onClick={() => setLoeschFrage(true)}><Icon name="muell" className="h-5 w-5" /> Abschnitt löschen</Knopf>
      ))}
    </form>
  );
}

function AbschnittKarte({ a, offen, umschalten, admin, bearbeiten, hoch, runter }: {
  a: TechnikAbschnitt; offen: boolean; umschalten: () => void; admin: boolean; bearbeiten: () => void; hoch?: () => void; runter?: () => void;
}) {
  const [gross, setGross] = useState('');
  return (
    <div className="karte overflow-hidden">
      <button onClick={umschalten} aria-expanded={offen} className="flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-himmel-100 text-himmel-700 dark:bg-slate-800 dark:text-himmel-300">
          <Icon name={a.icon || 'zahnrad'} />
        </span>
        <span className="flex-1">
          <span className="block font-bold">{a.titel}</span>
          {a.nurMitglieder && <span className="text-xs text-slate-500"><Icon name="schloss" className="mr-0.5 inline h-3.5 w-3.5" />nur für Mitglieder</span>}
        </span>
        <Icon name="rechts" className={klassen('h-5 w-5 text-slate-400 transition', offen && 'rotate-90')} />
      </button>
      {offen && (
        <div className="border-t border-himmel-100 px-4 pb-4 pt-2 dark:border-slate-700">
          {a.grafik === 'wetterstation' && <BlockschaltbildWetterstation />}
          {a.grafik === 'strom' && <BlockschaltbildStrom />}
          {a.grafik === 'ladung' && <BlockschaltbildLadung />}
          {a.text && <div className="md" dangerouslySetInnerHTML={{ __html: markdown(a.text) }} />}
          {a.bilder.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {a.bilder.map((b) => (
                <button key={b} onClick={() => setGross(b)} className="aspect-square overflow-hidden rounded-xl"><img src={b} alt="" loading="lazy" className="h-full w-full object-cover" /></button>
              ))}
            </div>
          )}
          {admin && (
            <div className="mt-4 flex gap-2">
              <Knopf art="sekundaer" className="flex-1 !min-h-10 text-sm" onClick={bearbeiten}><Icon name="stift" className="h-4 w-4" /> Bearbeiten</Knopf>
              <Knopf art="sekundaer" className="!min-h-10 !px-3" onClick={hoch} disabled={!hoch} aria-label="Nach oben">↑</Knopf>
              <Knopf art="sekundaer" className="!min-h-10 !px-3" onClick={runter} disabled={!runter} aria-label="Nach unten">↓</Knopf>
            </div>
          )}
        </div>
      )}
      {gross && (
        <button className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4" onClick={() => setGross('')} aria-label="Bild schließen">
          <img src={gross} alt="" className="max-h-full max-w-full rounded-xl" />
        </button>
      )}
    </div>
  );
}

/** Schalter für den Rabenschreck – nur für Admins sichtbar, das Backend prüft die Rolle zusätzlich */
function Rabenschreck() {
  const { daten, setDaten, laedt, neu } = useLaden(() => api<RabenschreckStatus>('rabenschreck_status'), []);
  const [schaltet, setSchaltet] = useState(false);
  const [fehler, setFehler] = useState('');
  async function schalten(an: boolean) {
    setSchaltet(true); setFehler('');
    try { setDaten(await api<RabenschreckStatus>('rabenschreck_schalten', { an })); } catch (e) { setFehler((e as Error).message); } finally { setSchaltet(false); }
  }
  const st = daten;
  const aktiv = st?.aktiv;
  return (
    <div className="karte overflow-hidden border-2 border-amber-300 dark:border-amber-700">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={klassen('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
          aktiv ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')}>
          <Icon name="flieger" />
        </span>
        <span className="flex-1">
          <span className="block font-bold">Rabenschreck</span>
          <span className="text-xs text-slate-500"><Icon name="schloss" className="mr-0.5 inline h-3.5 w-3.5" />nur für Admins</span>
        </span>
        <span className={klassen('rounded-full px-2.5 py-0.5 text-xs font-bold',
          aktiv === true ? 'bg-emerald-100 text-emerald-800' : aktiv === false ? 'bg-slate-200 text-slate-700' : 'bg-amber-100 text-amber-800')}>
          {laedt && !st ? '…' : aktiv === true ? 'AKTIV' : aktiv === false ? 'AUS' : 'unbekannt'}
        </span>
      </div>
      <div className="space-y-2 px-4 pb-4">
        {st && !st.eingerichtet && <Hinweis art="warnung">Die Zugangsdaten der Fernsteuerung fehlen im Backend (Skripteigenschaften RABENSCHRECK_USER und RABENSCHRECK_PASS).</Hinweis>}
        {st?.fehler && <Hinweis art="warnung">{st.fehler}</Hinweis>}
        {fehler && <Fehler fehler={fehler} />}
        <div className="grid grid-cols-3 gap-2">
          <Knopf className="col-span-2" art={aktiv ? 'gefahr' : 'primaer'} laedt={schaltet} disabled={!st?.eingerichtet || schaltet}
            onClick={() => void schalten(!aktiv)}>
            {aktiv ? 'Ausschalten' : 'Einschalten'}
          </Knopf>
          <Knopf art="sekundaer" onClick={() => void neu()} disabled={laedt || schaltet} aria-label="Status neu laden"><Icon name="aktualisieren" className="h-5 w-5" /></Knopf>
        </div>
      </div>
    </div>
  );
}

function Inhalt() {
  const s = useSitzung();
  const admin = s?.rolle === 'admin';
  const cacheKey = `technik.${s ? 'mitglied' : 'oeffentlich'}`;
  const { daten, setDaten, fehler, laedt, neu } = useLaden(async () => {
    const l = await api<TechnikAbschnitt[]>('technik_liste');
    merke(cacheKey, l);
    return l;
  }, [s?.token]);
  const liste = daten ?? erinnere<TechnikAbschnitt[]>(cacheKey);
  const [offen, setOffen] = useState<string>('');
  const [bearbeite, setBearbeite] = useState<string>(''); // id oder 'neu'
  const [fehler2, setFehler2] = useState('');

  function fertig(l: TechnikAbschnitt[]) { setDaten(l); merke(cacheKey, l); setBearbeite(''); }
  async function verschieben(i: number, um: number) {
    if (!liste) return;
    const ids = liste.map((a) => a.id);
    [ids[i], ids[i + um]] = [ids[i + um], ids[i]];
    setFehler2('');
    try { fertig(await api<TechnikAbschnitt[]>('technik_sortieren', { ids })); } catch (e) { setFehler2((e as Error).message); }
  }

  if (laedt && !liste) return <Laden />;
  if (!liste) return fehler ? <Fehler fehler={fehler} nochmal={neu} /> : null;

  return (
    <div className="space-y-3">
      {!s && <Hinweis>Einige Infos (z. B. Zahlenschloss) sehen nur angemeldete Mitglieder.</Hinweis>}
      {fehler && daten === null && <Hinweis art="warnung">Offline – letzter bekannter Stand.</Hinweis>}
      {fehler2 && <Fehler fehler={fehler2} />}
      {admin && <Rabenschreck />}
      {liste.length === 0 && <Leer>Noch keine Technik-Infos eingetragen.</Leer>}
      {liste.map((a, i) => bearbeite === a.id ? (
        <Editor key={a.id} alt={a} fertig={fertig} abbrechen={() => setBearbeite('')} />
      ) : (
        <AbschnittKarte key={a.id} a={a} admin={admin} offen={offen === a.id} umschalten={() => setOffen(offen === a.id ? '' : a.id)}
          bearbeiten={() => setBearbeite(a.id)}
          hoch={i > 0 ? () => void verschieben(i, -1) : undefined}
          runter={i < liste.length - 1 ? () => void verschieben(i, 1) : undefined} />
      ))}
      {admin && (bearbeite === 'neu'
        ? <Editor fertig={fertig} abbrechen={() => setBearbeite('')} />
        : <Knopf art="sekundaer" className="w-full" onClick={() => setBearbeite('neu')}><Icon name="plus" className="h-5 w-5" /> Neuer Abschnitt</Knopf>)}
    </div>
  );
}

export default function Technik() {
  return (
    <Seite titel="Technik am Platz">
      <Inhalt />
    </Seite>
  );
}
