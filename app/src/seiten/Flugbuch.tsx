/**
 * Elektronisches Flugbuch – nach dem Papiervordruck der MGI.
 * Anmelden trägt die Uhrzeit „Beginn“ ein, Abmelden die Uhrzeit „Ende“ (Blatt „Flugbuch“ in der Google-Tabelle).
 * Wer angemeldet ist, erscheint unter „Jetzt am Platz“.
 */
import { useEffect, useState } from 'react';
import { NurMitglied } from '../components/Anmelden';
import { Icon } from '../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden, Leer, Schalter, Seite, useLaden } from '../components/ui';
import { api } from '../lib/api';
import { klassen, uhrzeit } from '../lib/helfer';
import type {
  WetterstationAntwort, Antrieb, Flugbedingungen, FlugbuchEintrag, FlugbuchStatus, FlugleiterEintrag, Masse, PilotEingabe, Wetter, Windrichtung, Windstaerke,
} from '../lib/model';
import { useSitzung } from '../lib/sitzung';
import { himmelsrichtung, ladeWetter } from '../lib/wetter';

const ANTRIEBE: { k: Antrieb; n: string }[] = [
  { k: 'segler', n: 'Segler' }, { k: 'elektro', n: 'Elektro' }, { k: 'kolben', n: 'Kolben' }, { k: 'turbine', n: 'Turbine' },
];
const MASSEN: Masse[] = ['<250 g', '<2 kg', '<12 kg', '<25 kg'];
const WETTER: Wetter[] = ['klar', 'leicht bedeckt', 'bedeckt', 'nebelig'];
const RICHTUNGEN: Windrichtung[] = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
const STAERKEN: Windstaerke[] = ['kein', 'leicht', 'mäßig', 'stark'];

const LETZTE_KEY = 'mgi.flugbuch.letzte';

/** Auswahl-Chips (einzeln oder mehrfach) */
function Chips<T extends string>({ werte, gewaehlt, onChange, mehrfach, beschriftung }: {
  werte: readonly T[]; gewaehlt: T[]; onChange: (v: T[]) => void; mehrfach?: boolean; beschriftung?: (v: T) => string;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {werte.map((w) => {
        const an = gewaehlt.includes(w);
        return (
          <button key={w} type="button" aria-pressed={an}
            onClick={() => onChange(mehrfach ? (an ? gewaehlt.filter((x) => x !== w) : [...gewaehlt, w]) : [w])}
            className={klassen('min-h-11 min-w-12 rounded-xl px-3 font-semibold transition',
              an ? 'bg-himmel-600 text-white shadow' : 'bg-himmel-100 text-himmel-900 dark:bg-slate-800 dark:text-slate-200')}>
            {beschriftung ? beschriftung(w) : w}
          </button>
        );
      })}
    </div>
  );
}

function JaNein({ wert, onChange, label }: { wert: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div>
      <span className="label">{label}</span>
      <div className="grid grid-cols-2 gap-2">
        {[true, false].map((v) => (
          <button key={String(v)} type="button" aria-pressed={wert === v} onClick={() => onChange(v)}
            className={klassen('min-h-11 rounded-xl font-semibold', wert === v ? 'bg-himmel-600 text-white' : 'bg-himmel-100 dark:bg-slate-800')}>
            {v ? 'ja' : 'nein'}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Flugbedingungen (Modellflugleiter, nur wenn erforderlich) – Wind wird aus dem aktuellen Wetter vorgeschlagen */
function BedingungenFormular({ wert, setWert }: { wert: Flugbedingungen; setWert: (b: Flugbedingungen) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <JaNein label="Fangnetz aufgebaut" wert={wert.fangnetz} onChange={(v) => setWert({ ...wert, fangnetz: v })} />
        <JaNein label="Rasen gemäht" wert={wert.rasenGemaeht} onChange={(v) => setWert({ ...wert, rasenGemaeht: v })} />
      </div>
      <div><span className="label">Wetter</span><Chips werte={WETTER} gewaehlt={[wert.wetter]} onChange={([v]) => setWert({ ...wert, wetter: v })} /></div>
      <div><span className="label">Windrichtung</span><Chips werte={RICHTUNGEN} gewaehlt={[wert.windrichtung]} onChange={([v]) => setWert({ ...wert, windrichtung: v })} /></div>
      <div><span className="label">Windstärke</span><Chips werte={STAERKEN} gewaehlt={[wert.windstaerke]} onChange={([v]) => setWert({ ...wert, windstaerke: v })} /></div>
    </div>
  );
}

function useBedingungenVorschlag(): [Flugbedingungen, (b: Flugbedingungen) => void] {
  const [b, setB] = useState<Flugbedingungen>({ fangnetz: true, rasenGemaeht: true, wetter: 'klar', windrichtung: 'W', windstaerke: 'leicht' });
  useEffect(() => {
    const staerke = (kmh: number): Windstaerke => (kmh < 3 ? 'kein' : kmh < 20 ? 'leicht' : kmh < 39 ? 'mäßig' : 'stark');
    void Promise.allSettled([ladeWetter(), api<WetterstationAntwort>('wetterstation')]).then(([v, s]) => {
      const w = v.status === 'fulfilled' ? v.value : null;
      const st = s.status === 'fulfilled' && s.value.erreichbar ? s.value.daten : undefined;
      setB((x) => {
        const n = { ...x };
        if (w) {
          n.wetter = w.code === 0 || w.code === 1 ? 'klar' : w.code === 2 ? 'leicht bedeckt' : w.code >= 45 && w.code <= 48 ? 'nebelig' : 'bedeckt';
          n.windrichtung = himmelsrichtung(w.richtung) as Windrichtung;
          n.windstaerke = staerke(w.wind);
        }
        // Messwerte der eigenen Station am Platz haben Vorrang
        if (st?.richtung && (RICHTUNGEN as string[]).includes(st.richtung)) n.windrichtung = st.richtung as Windrichtung;
        if (st?.wind !== null && st?.wind !== undefined) n.windstaerke = staerke(st.wind);
        return n;
      });
    });
  }, []);
  return [b, setB];
}

function Anmeldeformular({ ohneFlugleiter, fertig, nurGast, abbrechen }: { ohneFlugleiter: boolean; fertig: (s: FlugbuchStatus) => void; nurGast?: boolean; abbrechen?: () => void }) {
  const letzte = (() => { try { return JSON.parse(localStorage.getItem(LETZTE_KEY) || 'null'); } catch { return null; } })();
  const [e, setE] = useState<PilotEingabe>({
    art: nurGast ? 'gast' : 'verein', schulungsnachweis: letzte?.schulungsnachweis ?? false,
    antrieb: letzte?.antrieb ?? [], masse: letzte?.masse ?? '', regelnBestaetigt: false,
  });
  const [flugleiter, setFlugleiter] = useState(false);
  const [bed, setBed] = useBedingungenVorschlag();
  const [fehler, setFehler] = useState('');
  const [laedt, setLaedt] = useState(false);
  const [uhr, setUhr] = useState(() => uhrzeit(new Date().toISOString()));
  useEffect(() => { const t = setInterval(() => setUhr(uhrzeit(new Date().toISOString())), 20000); return () => clearInterval(t); }, []);
  const gast = e.art === 'gast';

  async function anmelden(ev: React.FormEvent) {
    ev.preventDefault();
    setFehler('');
    if (!e.antrieb.length) return setFehler('Bitte die Antriebsart wählen.');
    if (!e.masse) return setFehler('Bitte die Gewichtsklasse wählen.');
    if (!e.regelnBestaetigt) return setFehler('Bitte bestätigen, dass dir die Betriebsregeln bekannt sind.');
    setLaedt(true);
    try {
      const s = await api<FlugbuchStatus>('flugbuch_anmelden', { eintrag: e, flugleiter: flugleiter && !gast ? bed : undefined });
      if (!gast) localStorage.setItem(LETZTE_KEY, JSON.stringify({ schulungsnachweis: e.schulungsnachweis, antrieb: e.antrieb, masse: e.masse }));
      fertig(s);
    } catch (err) {
      setFehler((err as Error).message);
    } finally {
      setLaedt(false);
    }
  }

  return (
    <form onSubmit={anmelden} className="karte space-y-5 p-4">
      {nurGast && <h2 className="text-lg font-bold">Gast ins Flugbuch eintragen</h2>}
      <div className={klassen('grid grid-cols-2 gap-1 rounded-xl bg-himmel-100 p-1 dark:bg-slate-800', nurGast && 'hidden')}>
        {(['verein', 'gast'] as const).map((a) => (
          <button key={a} type="button" onClick={() => setE({ ...e, art: a, ...(a === 'gast' ? { schulungsnachweis: false } : {}) })}
            className={klassen('min-h-11 rounded-lg font-semibold', e.art === a ? 'bg-white shadow dark:bg-slate-700' : 'text-slate-600 dark:text-slate-300')}>
            {a === 'verein' ? 'Ich (Verein)' : 'Gast eintragen'}
          </button>
        ))}
      </div>

      {gast && (
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Vorname Gast"><input className="eingabe" required value={e.gastVorname ?? ''} onChange={(x) => setE({ ...e, gastVorname: x.target.value })} /></Feld>
          <Feld label="Name Gast"><input className="eingabe" required value={e.gastName ?? ''} onChange={(x) => setE({ ...e, gastName: x.target.value })} /></Feld>
        </div>
      )}

      <div className="-mx-4 border-y border-himmel-100 dark:border-slate-700">
        <Schalter an={e.schulungsnachweis} onChange={(v) => setE({ ...e, schulungsnachweis: v })} label="Schulungsnachweis vorhanden" />
      </div>

      <div>
        <span className="label">Antriebsart</span>
        <Chips werte={ANTRIEBE.map((a) => a.k)} gewaehlt={e.antrieb} mehrfach onChange={(v) => setE({ ...e, antrieb: v })}
          beschriftung={(k) => ANTRIEBE.find((a) => a.k === k)!.n} />
      </div>
      <div>
        <span className="label">Gewichtsklasse (max. Masse)</span>
        <Chips werte={MASSEN} gewaehlt={e.masse ? [e.masse] : []} onChange={([v]) => setE({ ...e, masse: v })} />
      </div>

      {!gast && !ohneFlugleiter && (
        <div className="-mx-4 border-y border-himmel-100 dark:border-slate-700">
          <Schalter an={flugleiter} onChange={setFlugleiter} label="Ich übernehme die Flugleitung" text="Modellflugleiter – nur wenn erforderlich" />
          {flugleiter && <div className="px-4 pb-4"><BedingungenFormular wert={bed} setWert={setBed} /></div>}
        </div>
      )}

      <label className="flex items-start gap-3 rounded-xl bg-sonne-hell p-3 text-sm dark:bg-amber-950/40">
        <input type="checkbox" className="mt-0.5 h-6 w-6 shrink-0 accent-mgi-rot" checked={e.regelnBestaetigt} onChange={(x) => setE({ ...e, regelnBestaetigt: x.target.checked })} />
        <span>
          {gast ? 'Der Gast bestätigt' : 'Ich bestätige'}, dass {gast ? 'ihm' : 'mir'} die Betriebsregeln der StRfF (Standardisierte Regeln für Flugmodelle des MFSD), die für {gast ? 'sein' : 'mein'} Flugvorhaben relevant sind,
          die Flugordnung und die Geländeausweisung ggf. samt vorhandener Kontrollerlaubnis der zuständigen Landesluftfahrtbehörde bekannt sind.
        </span>
      </label>

      {fehler && <Hinweis art="fehler">{fehler}</Hinweis>}
      <Knopf type="submit" className="w-full text-lg" laedt={laedt}>
        <Icon name="flieger" /> {gast ? 'Gast anmelden' : 'Im Flugbuch anmelden'} · {uhr} Uhr
      </Knopf>
      {abbrechen && <Knopf type="button" art="leise" className="w-full" onClick={abbrechen}>Abbrechen</Knopf>}
    </form>
  );
}

const antriebText = (a: Antrieb[]) => a.map((x) => ANTRIEBE.find((y) => y.k === x)?.n).join(', ');

function EintragZeile({ p, kannAbmelden, abmelden, arbeitet }: { p: FlugbuchEintrag; kannAbmelden: boolean; abmelden: () => void; arbeitet: boolean }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={klassen('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold',
        p.vereinGast === 'Gast' ? 'bg-sonne-hell text-amber-800' : 'bg-himmel-100 text-himmel-700 dark:bg-slate-800 dark:text-himmel-200')}>
        {(p.vorname[0] ?? '') + (p.name[0] ?? '')}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{p.vorname} {p.name}{p.vereinGast === 'Gast' && <span className="font-normal text-slate-500"> · Gast</span>}</span>
        <span className="block text-sm text-slate-500">
          {p.beginn}{p.ende ? `–${p.ende}` : ' – läuft'}{p.autoBeendet && ' (auto)'} · {antriebText(p.antrieb)} · {p.masse}
        </span>
      </span>
      {kannAbmelden && !p.ende && <Knopf art="sekundaer" onClick={abmelden} laedt={arbeitet} className="!min-h-10 !px-3 text-sm">Abmelden</Knopf>}
    </li>
  );
}

function Inhalt() {
  const s = useSitzung()!;
  const { daten: st, setDaten, fehler, laedt, neu } = useLaden(() => api<FlugbuchStatus>('flugbuch_status'), [s.token]);
  const [arbeitet, setArbeitet] = useState('');
  const [fehler2, setFehler2] = useState('');
  const [flOffen, setFlOffen] = useState(false);
  const [gastForm, setGastForm] = useState(false);
  // Besondere Vorkommnisse: eigener Entwurf, wird bei der 30-Sekunden-Aktualisierung nicht überschrieben
  const [notiz, setNotiz] = useState<{ id: string; text: string } | null>(null);
  const [bed, setBed] = useBedingungenVorschlag();

  // alle 30 Sekunden aktualisieren, damit „Jetzt am Platz“ stimmt
  useEffect(() => { const t = setInterval(() => void neu(), 30000); return () => clearInterval(t); }, [neu]);

  async function aktion(name: string, daten: Record<string, unknown>, id: string) {
    setArbeitet(id); setFehler2('');
    try { setDaten(await api<FlugbuchStatus>(name, daten)); setFlOffen(false); } catch (e) { setFehler2((e as Error).message); } finally { setArbeitet(''); }
  }

  if (laedt && !st) return <Laden />;
  if (!st) return fehler ? <Fehler fehler={fehler} nochmal={neu} /> : null;

  const offen = st.piloten.filter((p) => !p.ende);
  const ich = offen.find((p) => p.mitgliedId === s.mitgliedId && p.vereinGast === 'Verein');
  const meineGaeste = offen.filter((p) => p.vereinGast === 'Gast' && p.mitgliedId === s.mitgliedId);
  const flAktiv = st.flugleiter.filter((f) => !f.ende);
  const ichFl: FlugleiterEintrag | undefined = flAktiv.find((f) => f.mitgliedId === s.mitgliedId);
  const heute = st.piloten.slice().sort((a, b) => b.beginnTs.localeCompare(a.beginnTs));
  const gespeichert = ich?.vorkommnisse ?? '';
  const entwurf = ich && notiz?.id === ich.id ? notiz.text : gespeichert;
  const geaendert = !!ich && entwurf.trim() !== gespeichert.trim();

  return (
    <div className="space-y-4">
      {fehler2 && <Fehler fehler={fehler2} />}

      {/* Mein Status */}
      {ich ? (
        <div className="karte space-y-3 border-2 border-emerald-400 p-4">
          <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
            <Icon name="haken" className="mr-1 inline h-6 w-6" /> Seit {ich.beginn} Uhr im Flugbuch angemeldet
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-400">{antriebText(ich.antrieb)} · {ich.masse}{ich.schulungsnachweis ? ' · Schulungsnachweis' : ''}</p>
          <div className="rounded-xl bg-himmel-50 p-3 dark:bg-slate-800">
            <label htmlFor="vorkommnisse" className="mb-1 block text-sm font-bold">Besondere Vorkommnisse</label>
            <textarea id="vorkommnisse" className="eingabe min-h-24 bg-white dark:bg-slate-900" maxLength={1000} value={entwurf}
              onChange={(e) => setNotiz({ id: ich.id, text: e.target.value })}
              placeholder="z. B. Absturz, Beinahe-Zusammenstoß, Schaden am Platz, Störung der Fernsteuerung …" />
            <div className="mt-2 flex items-center gap-3">
              <Knopf art="sekundaer" className="!min-h-10 !px-4 text-sm" disabled={!geaendert} laedt={arbeitet === 'notiz'}
                onClick={() => aktion('flugbuch_kommentar', { id: ich.id, text: entwurf }, 'notiz')}>Speichern</Knopf>
              <span className="text-xs text-slate-500">
                {geaendert ? 'Noch nicht gespeichert – wird spätestens beim Abmelden übernommen.' : gespeichert ? 'Gespeichert im Flugbuch.' : 'Optional, kann bis zum Abmelden ergänzt werden.'}
              </span>
            </div>
          </div>
          <Knopf className="w-full text-lg" onClick={() => aktion('flugbuch_abmelden', geaendert ? { id: ich.id, vorkommnisse: entwurf } : { id: ich.id }, ich.id)} laedt={arbeitet === ich.id}>
            Abmelden · Ende {uhrzeit(new Date().toISOString())} Uhr
          </Knopf>
          <p className="text-center text-xs text-slate-500">
            {st.autoStunden > 0 && st.autoStunden < 24
              ? `Vergessen? Nach ${st.autoStunden} Std., spätestens um 23:59 Uhr wird automatisch abgemeldet.`
              : 'Vergessen? Um 23:59 Uhr wird automatisch abgemeldet.'}
          </p>
          {!gastForm && <Knopf art="sekundaer" className="w-full" onClick={() => setGastForm(true)}><Icon name="plus" className="h-5 w-5" /> Gast eintragen</Knopf>}
        </div>
      ) : (
        <Anmeldeformular ohneFlugleiter={flAktiv.length > 0} fertig={setDaten} />
      )}

      {ich && gastForm && <Anmeldeformular nurGast ohneFlugleiter fertig={(x) => { setDaten(x); setGastForm(false); }} abbrechen={() => setGastForm(false)} />}

      {/* Flugleiter */}
      <div className="karte p-4">
        <h2 className="mb-2 font-bold">Modellflugleiter</h2>
        {flAktiv.length ? flAktiv.map((f) => (
          <div key={f.id} className="space-y-2">
            <p><span className="rounded-full bg-sonne px-2.5 py-0.5 text-xs font-bold text-tinte">Flugleiter</span> <b>{f.vorname} {f.name}</b> seit {f.beginn} Uhr</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Fangnetz {f.fangnetz ? 'aufgebaut' : 'nicht aufgebaut'} · Rasen {f.rasenGemaeht ? 'gemäht' : 'nicht gemäht'} · Wetter {f.wetter} · Wind {f.windrichtung}, {f.windstaerke}
            </p>
            {f.mitgliedId === s.mitgliedId && (
              <Knopf art="sekundaer" className="w-full" onClick={() => aktion('flugleiter_abmelden', { id: f.id }, f.id)} laedt={arbeitet === f.id}>Flugleitung beenden</Knopf>
            )}
          </div>
        )) : (
          <>
            <p className="text-sm text-slate-500">Zurzeit kein Flugleiter eingetragen (nur wenn erforderlich).</p>
            {ich && !ichFl && (!flOffen ? (
              <Knopf art="sekundaer" className="mt-3 w-full" onClick={() => setFlOffen(true)}>Flugleitung übernehmen</Knopf>
            ) : (
              <div className="mt-3 space-y-4">
                <BedingungenFormular wert={bed} setWert={setBed} />
                <Knopf className="w-full" onClick={() => aktion('flugleiter_anmelden', { bedingungen: bed }, 'fl')} laedt={arbeitet === 'fl'}>Als Flugleiter eintragen</Knopf>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Meine Gäste */}
      {meineGaeste.length > 0 && (
        <div className="karte">
          <h2 className="px-4 pt-3 font-bold">Von dir eingetragene Gäste</h2>
          <ul className="divide-y divide-himmel-100 dark:divide-slate-700">
            {meineGaeste.map((p) => <EintragZeile key={p.id} p={p} kannAbmelden abmelden={() => aktion('flugbuch_abmelden', { id: p.id }, p.id)} arbeitet={arbeitet === p.id} />)}
          </ul>
        </div>
      )}

      {/* Jetzt am Platz / heute */}
      <div className="karte">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="font-bold">Flugbuch heute ({st.heute})</h2>
          <button onClick={neu} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-himmel-100 dark:hover:bg-slate-800" aria-label="Aktualisieren"><Icon name="aktualisieren" className="h-5 w-5" /></button>
        </div>
        <p className="px-4 text-sm text-slate-500">{offen.length} Pilot{offen.length === 1 ? '' : 'en'} gerade am Platz</p>
        {!heute.length && <Leer>Heute noch keine Einträge.</Leer>}
        <ul className="divide-y divide-himmel-100 dark:divide-slate-700">
          {heute.map((p) => (
            <EintragZeile key={p.id} p={p} kannAbmelden={s.rolle === 'admin' && p.mitgliedId !== s.mitgliedId}
              abmelden={() => aktion('flugbuch_abmelden', { id: p.id }, p.id)} arbeitet={arbeitet === p.id} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Flugbuch() {
  return (
    <Seite titel="Flugbuch">
      <NurMitglied text="Das Flugbuch ist für registrierte Mitglieder. Bitte anmelden.">
        <Inhalt />
      </NurMitglied>
    </Seite>
  );
}
