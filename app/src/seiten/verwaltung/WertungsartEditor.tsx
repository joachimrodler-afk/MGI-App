import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { NurMitglied } from '../../components/Anmelden';
import { Icon } from '../../components/Icon';
import { Feld, Fehler, Hinweis, Knopf, Laden, Schalter, Seite } from '../../components/ui';
import { api } from '../../lib/api';
import { alleArten } from '../../lib/arten';
import { berechneDurchgang, parseZeit, verfuegbareVariablen } from '../../lib/auswertung';
import { FUNKTIONEN, pruefeFormel } from '../../lib/formel';
import { klassen } from '../../lib/helfer';
import type { Feld as FeldT, FeldTyp, Wertungsart } from '../../lib/model';

const LEER: Wertungsart = {
  id: '', name: '', beschreibung: '', felder: [{ key: 'punkte', label: 'Punkte', typ: 'zahl', min: 0 }], konstanten: [],
  formel: 'punkte', gesamt: 'summe', normieren1000: false, sortierung: 'hoch', gleichstand: 'bester_durchgang', version: 0, geaendert: '',
};

const KEY_RE = /^[a-z_][a-z0-9_]*$/;
const slug = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
const kleinInput = 'w-full rounded-lg border border-himmel-200 bg-white px-2 py-2 text-sm dark:border-slate-600 dark:bg-slate-800';

function Inhalt() {
  const { id } = useParams();
  const nav = useNavigate();
  const neu = id === 'neu';
  const [a, setA] = useState<Wertungsart | null>(neu ? LEER : null);
  const [vorlage, setVorlage] = useState(false);
  const [test, setTest] = useState<Record<string, string>>({});
  const [fehler, setFehler] = useState('');
  const [ok, setOk] = useState('');
  const [laedt, setLaedt] = useState(false);
  const formelRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (neu) return;
    void alleArten().then((l) => {
      const x = l.find((y) => y.id === id);
      if (!x) return setFehler('Wertungsart nicht gefunden');
      const { vorlage: v, ...rest } = x;
      setVorlage(!!v);
      setA(rest);
    });
  }, [id, neu]);

  const vars = a ? verfuegbareVariablen(a) : [];
  const formelFehler = a ? pruefeFormel(a.formel, vars) : null;

  const keyFehler = useMemo(() => {
    if (!a) return '';
    const keys = [...a.felder.map((f) => f.key), ...a.konstanten.map((k) => k.key), ...(a.elemente?.konstanten ?? [])];
    for (const k of keys) {
      if (!KEY_RE.test(k)) return `Variablenname „${k}“: nur Kleinbuchstaben, Ziffern und _ (kein Leerzeichen, nicht mit Ziffer beginnen)`;
      if (Object.hasOwn(FUNKTIONEN, k) || ['und', 'oder', 'nicht'].includes(k)) return `„${k}“ ist ein reserviertes Wort`;
    }
    const doppelt = keys.find((k, i) => keys.indexOf(k) !== i);
    return doppelt ? `Variablenname „${doppelt}“ kommt doppelt vor` : '';
  }, [a]);

  const vorschau = useMemo(() => {
    if (!a || formelFehler || keyFehler) return null;
    const felder: Record<string, number | number[]> = {};
    for (const f of a.felder) {
      const t = test[f.key] ?? '';
      if (f.typ === 'liste') felder[f.key] = t.split(/[;\s]+/).map((x) => parseFloat(x.replace(',', '.'))).filter(Number.isFinite);
      else if (f.typ === 'zeit') felder[f.key] = parseZeit(t) ?? 0;
      else felder[f.key] = parseFloat(t.replace(',', '.')) || 0;
    }
    try {
      const elemente = a.elemente?.liste.length ? a.elemente.liste.map(() => felder) : undefined;
      return { wert: berechneDurchgang(a, { felder, elemente }) };
    } catch (e) {
      return { fehler: (e as Error).message };
    }
  }, [a, test, formelFehler, keyFehler]);

  if (!a) return fehler ? <Fehler fehler={fehler} /> : <Laden />;
  const set = (p: Partial<Wertungsart>) => setA({ ...a, ...p });
  const setFeld = (i: number, p: Partial<FeldT>) => set({ felder: a.felder.map((f, j) => (j === i ? { ...f, ...p } : f)) });

  function einfuegen(text: string) {
    const ta = formelRef.current;
    if (!ta) return set({ formel: a!.formel + text });
    const s = ta.selectionStart, e = ta.selectionEnd;
    const neuF = a!.formel.slice(0, s) + text + a!.formel.slice(e);
    set({ formel: neuF });
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = s + text.length; });
  }

  async function speichern() {
    setFehler(''); setOk('');
    if (!a!.name.trim()) return setFehler('Bitte einen Namen eingeben');
    if (keyFehler || formelFehler) return setFehler(keyFehler || formelFehler!);
    setLaedt(true);
    try {
      const gespeichert = await api<Wertungsart>('wertungsart_speichern', { ...a!, id: a!.id || slug(a!.name) });
      setA(gespeichert);
      setVorlage(false);
      setOk(`Gespeichert (Version ${gespeichert.version}).`);
      if (neu) nav(`/verwaltung/wertungsarten/${gespeichert.id}`, { replace: true });
    } catch (e) {
      setFehler((e as Error).message);
    } finally {
      setLaedt(false);
    }
  }

  async function loeschen() {
    if (!confirm(`Wertungsart „${a!.name}“ löschen? Bestehende Wettbewerbe behalten ihre Kopie.`)) return;
    await api('wertungsart_loeschen', { id: a!.id });
    nav('/verwaltung/wertungsarten');
  }

  return (
    <div className="space-y-4">
      {vorlage && <Hinweis>Dies ist eine Vorlage. Beim Speichern wird sie als eigene Wertungsart des Vereins übernommen.</Hinweis>}

      <section className="karte space-y-3 p-4">
        <Feld label="Name"><input className="eingabe" value={a.name} onChange={(e) => set({ name: e.target.value })} /></Feld>
        <Feld label="Beschreibung (für Teilnehmer und Wertungsrichter)"><textarea className="eingabe min-h-20" value={a.beschreibung} onChange={(e) => set({ beschreibung: e.target.value })} /></Feld>
      </section>

      <section className="karte p-4">
        <h2 className="mb-1 font-bold">Eingabefelder</h2>
        <p className="mb-3 text-sm text-slate-500">Was der Wertungsrichter pro Durchgang eingibt. Der Variablenname wird in der Formel benutzt.</p>
        <div className="space-y-3">
          {a.felder.map((f, i) => (
            <div key={i} className="rounded-xl bg-himmel-50 p-3 dark:bg-slate-800/60">
              <div className="grid grid-cols-2 gap-2">
                <input className={kleinInput} value={f.label} placeholder="Bezeichnung" aria-label="Bezeichnung"
                  onChange={(e) => setFeld(i, { label: e.target.value, ...(f.key === '' || f.key === slug(f.label) ? { key: slug(e.target.value) } : {}) })} />
                <input className={klassen(kleinInput, 'font-mono')} value={f.key} placeholder="variable" aria-label="Variablenname" onChange={(e) => setFeld(i, { key: e.target.value })} />
                <select className={kleinInput} value={f.typ} aria-label="Typ" onChange={(e) => setFeld(i, { typ: e.target.value as FeldTyp, anzahl: e.target.value === 'liste' ? f.anzahl ?? 3 : undefined })}>
                  <option value="zahl">Zahl</option><option value="zeit">Zeit (mm:ss)</option><option value="janein">Ja/Nein</option><option value="liste">Liste (z. B. je Richter)</option>
                </select>
                {f.typ === 'liste'
                  ? <input className={kleinInput} type="number" min={1} max={10} value={f.anzahl ?? 3} aria-label="Anzahl Werte" onChange={(e) => setFeld(i, { anzahl: Number(e.target.value) })} />
                  : <input className={kleinInput} value={f.einheit ?? ''} placeholder="Einheit" aria-label="Einheit" onChange={(e) => setFeld(i, { einheit: e.target.value })} />}
                {f.typ !== 'janein' && (
                  <>
                    <input className={kleinInput} type="number" value={f.min ?? ''} placeholder="min" aria-label="Minimum" onChange={(e) => setFeld(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })} />
                    <input className={kleinInput} type="number" value={f.max ?? ''} placeholder="max" aria-label="Maximum" onChange={(e) => setFeld(i, { max: e.target.value === '' ? undefined : Number(e.target.value) })} />
                  </>
                )}
              </div>
              <button className="mt-2 text-sm font-semibold text-mgi-rot" onClick={() => set({ felder: a.felder.filter((_, j) => j !== i) })}>Feld entfernen</button>
            </div>
          ))}
        </div>
        <Knopf art="leise" className="mt-2" onClick={() => set({ felder: [...a.felder, { key: '', label: '', typ: 'zahl' }] })}><Icon name="plus" className="h-5 w-5" /> Feld hinzufügen</Knopf>
      </section>

      <section className="karte p-4">
        <h2 className="mb-1 font-bold">Konstanten</h2>
        <p className="mb-3 text-sm text-slate-500">Feste Werte, z. B. Sollzeit oder Bonuspunkte.</p>
        <div className="space-y-2">
          {a.konstanten.map((k, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_5rem_auto] gap-2">
              <input className={kleinInput} value={k.label} placeholder="Bezeichnung" aria-label="Bezeichnung"
                onChange={(e) => set({ konstanten: a.konstanten.map((x, j) => (j === i ? { ...x, label: e.target.value, ...(x.key === '' || x.key === slug(x.label) ? { key: slug(e.target.value) } : {}) } : x)) })} />
              <input className={klassen(kleinInput, 'font-mono')} value={k.key} placeholder="variable" aria-label="Variablenname" onChange={(e) => set({ konstanten: a.konstanten.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)) })} />
              <input className={kleinInput} type="number" value={k.wert} aria-label="Wert" onChange={(e) => set({ konstanten: a.konstanten.map((x, j) => (j === i ? { ...x, wert: Number(e.target.value) } : x)) })} />
              <button onClick={() => set({ konstanten: a.konstanten.filter((_, j) => j !== i) })} aria-label="Konstante entfernen" className="px-2 text-mgi-rot"><Icon name="x" className="h-5 w-5" /></button>
            </div>
          ))}
        </div>
        <Knopf art="leise" className="mt-2" onClick={() => set({ konstanten: [...a.konstanten, { key: '', label: '', wert: 0 }] })}><Icon name="plus" className="h-5 w-5" /> Konstante hinzufügen</Knopf>
      </section>

      <section className="karte overflow-hidden">
        <Schalter an={!!a.elemente} onChange={(v) => set({ elemente: v ? { bezeichnung: 'Figur', konstanten: ['k'], liste: [{ name: 'Figur 1', werte: { k: 1 } }] } : undefined })}
          label="Mehrere Figuren / Aufgaben je Durchgang" text="z. B. Kunstflug: jede Figur hat einen eigenen K-Faktor; die Formel wird je Figur berechnet und addiert" />
        {a.elemente && (
          <div className="space-y-3 border-t border-himmel-100 p-4 dark:border-slate-700">
            <div className="grid grid-cols-2 gap-2">
              <Feld label="Bezeichnung"><input className={kleinInput} value={a.elemente.bezeichnung} onChange={(e) => set({ elemente: { ...a.elemente!, bezeichnung: e.target.value } })} /></Feld>
              <Feld label="Werte je Figur (Variablen)"><input className={klassen(kleinInput, 'font-mono')} value={a.elemente.konstanten.join(', ')}
                onChange={(e) => set({ elemente: { ...a.elemente!, konstanten: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) } })} /></Feld>
            </div>
            {a.elemente.liste.map((el, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <input className={klassen(kleinInput, 'flex-1')} value={el.name} aria-label={`${a.elemente!.bezeichnung} ${i + 1}`}
                  onChange={(e) => set({ elemente: { ...a.elemente!, liste: a.elemente!.liste.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) } })} />
                {a.elemente!.konstanten.map((k) => (
                  <label key={k} className="flex items-center gap-1 text-sm font-mono">{k}
                    <input className={klassen(kleinInput, 'w-16')} type="number" value={el.werte[k] ?? 0}
                      onChange={(e) => set({ elemente: { ...a.elemente!, liste: a.elemente!.liste.map((x, j) => (j === i ? { ...x, werte: { ...x.werte, [k]: Number(e.target.value) } } : x)) } })} />
                  </label>
                ))}
                <button onClick={() => set({ elemente: { ...a.elemente!, liste: a.elemente!.liste.filter((_, j) => j !== i) } })} aria-label="Entfernen" className="px-1 text-mgi-rot"><Icon name="x" className="h-5 w-5" /></button>
              </div>
            ))}
            <Knopf art="leise" onClick={() => set({ elemente: { ...a.elemente!, liste: [...a.elemente!.liste, { name: `${a.elemente!.bezeichnung} ${a.elemente!.liste.length + 1}`, werte: Object.fromEntries(a.elemente!.konstanten.map((k) => [k, 1])) }] } })}>
              <Icon name="plus" className="h-5 w-5" /> {a.elemente.bezeichnung} hinzufügen
            </Knopf>
          </div>
        )}
      </section>

      <section className="karte space-y-3 p-4">
        <h2 className="font-bold">Formel {a.elemente ? `(je ${a.elemente.bezeichnung})` : '(je Durchgang)'}</h2>
        <textarea ref={formelRef} className={klassen('eingabe min-h-24 font-mono', (formelFehler || keyFehler) && 'border-mgi-rot')} value={a.formel}
          onChange={(e) => set({ formel: e.target.value })} spellCheck={false} aria-label="Formel" />
        {keyFehler ? <Hinweis art="fehler">{keyFehler}</Hinweis> : formelFehler ? <Hinweis art="fehler">{formelFehler}</Hinweis> : <Hinweis art="ok">Formel ist gültig.</Hinweis>}
        <div>
          <p className="label">Variablen (antippen zum Einfügen)</p>
          <div className="flex flex-wrap gap-1.5">
            {vars.map((v) => <button key={v} onClick={() => einfuegen(v)} className="rounded-lg bg-himmel-100 px-2.5 py-1.5 font-mono text-sm dark:bg-slate-800">{v}</button>)}
          </div>
        </div>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-himmel-700 dark:text-himmel-300">Funktionen & Rechenzeichen</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {Object.entries(FUNKTIONEN).map(([n, f]) => (
              <li key={n}><button onClick={() => einfuegen(`${n}(`)} className="text-left"><code className="rounded bg-himmel-100 px-1 dark:bg-slate-800">{n}</code> – {f.hilfe.split(' – ')[1] ?? f.hilfe}</button></li>
            ))}
            <li>Rechnen: <code>+ - * / ^ ( )</code> · Vergleich: <code>== != &lt; &lt;= &gt; &gt;=</code> · Logik: <code>und oder nicht</code></li>
            <li>Dezimalpunkt verwenden (2.5), Argumente mit <code>;</code> trennen.</li>
          </ul>
        </details>
      </section>

      <section className="karte space-y-3 p-4">
        <h2 className="font-bold">Test mit Beispielwerten</h2>
        <div className="grid grid-cols-2 gap-2">
          {a.felder.map((f) => (
            <Feld key={f.key} label={f.label || f.key} hilfe={f.typ === 'liste' ? 'Werte mit Leerzeichen trennen' : f.typ === 'zeit' ? 'mm:ss' : f.typ === 'janein' ? '1 = ja, 0 = nein' : undefined}>
              <input className={kleinInput} value={test[f.key] ?? ''} onChange={(e) => setTest({ ...test, [f.key]: e.target.value })} />
            </Feld>
          ))}
        </div>
        <div className="flex items-center justify-between rounded-xl bg-himmel-50 p-3 dark:bg-slate-800">
          <span className="text-sm">Ergebnis {a.elemente ? `(alle ${a.elemente.liste.length} ${a.elemente.bezeichnung}en mit diesen Werten)` : ''}</span>
          <span className={klassen('text-xl font-extrabold', vorschau?.fehler && 'text-sm text-mgi-rot')}>
            {vorschau ? vorschau.fehler ?? Math.round((vorschau.wert ?? 0) * 100) / 100 : '–'}
          </span>
        </div>
      </section>

      <section className="karte space-y-3 p-4">
        <h2 className="font-bold">Gesamtwertung</h2>
        <div className="grid grid-cols-2 gap-3">
          <Feld label="Gesamt aus Durchgängen">
            <select className="eingabe" value={a.gesamt} onChange={(e) => set({ gesamt: e.target.value as Wertungsart['gesamt'] })}>
              <option value="summe">Summe</option><option value="bester">Bester Durchgang</option><option value="streichen">Summe mit Streichergebnis</option>
            </select>
          </Feld>
          {a.gesamt === 'streichen'
            ? <Feld label="Anzahl Streicher"><input className="eingabe" type="number" min={1} max={5} value={a.streichAnzahl ?? 1} onChange={(e) => set({ streichAnzahl: Number(e.target.value) })} /></Feld>
            : <Feld label="Besser ist"><select className="eingabe" value={a.sortierung} onChange={(e) => set({ sortierung: e.target.value as 'hoch' | 'niedrig' })}><option value="hoch">mehr Punkte</option><option value="niedrig">weniger (z. B. Zeit)</option></select></Feld>}
          {a.gesamt === 'streichen' && <Feld label="Besser ist"><select className="eingabe" value={a.sortierung} onChange={(e) => set({ sortierung: e.target.value as 'hoch' | 'niedrig' })}><option value="hoch">mehr Punkte</option><option value="niedrig">weniger (z. B. Zeit)</option></select></Feld>}
          <Feld label="Bei Gleichstand">
            <select className="eingabe" value={a.gleichstand} onChange={(e) => set({ gleichstand: e.target.value as Wertungsart['gleichstand'] })}>
              <option value="bester_durchgang">Bester Einzeldurchgang entscheidet</option><option value="geteilt">Geteilter Platz</option>
            </select>
          </Feld>
        </div>
        <Schalter an={a.normieren1000} onChange={(v) => set({ normieren1000: v })} label="Je Durchgang auf 1000 normieren" text="Tagesbester eines Durchgangs = 1000 Punkte, alle anderen anteilig" />
      </section>

      {fehler && <Fehler fehler={fehler} />}
      {ok && <Hinweis art="ok">{ok}</Hinweis>}
      <Knopf className="w-full" onClick={speichern} laedt={laedt}>Speichern</Knopf>
      {!neu && !vorlage && <Knopf art="gefahr" className="w-full" onClick={loeschen}>Wertungsart löschen</Knopf>}
    </div>
  );
}

export default function WertungsartEditor() {
  return <Seite titel="Wertungsart bearbeiten"><NurMitglied admin><Inhalt /></NurMitglied></Seite>;
}
